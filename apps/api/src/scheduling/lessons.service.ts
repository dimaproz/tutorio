import { Injectable } from '@nestjs/common';
import { canTransition, findConflicts, toInterval } from '@tutorio/domain';
import { Prisma } from '@prisma/client';
import type {
  CreateLessonDto,
  LessonListResponse,
  LessonResponse,
  ListLessonsQueryDto,
  RescheduleLessonDto,
  TransitionLessonDto,
  UpdateLessonDto,
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  invalidLessonTransition,
  lessonNotFound,
  scheduleConflict,
} from '../common/business.errors';
import { LedgerService } from '../packages/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { MaterializerService } from './materializer.service';
import {
  assertTargetAndTeacher,
  findLessonConflicts,
  lessonInclude,
  localHourMinute,
  resolveStudentTarget,
  toLessonResponse,
} from './scheduling.shared';

@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly materializer: MaterializerService,
    private readonly ledger: LedgerService,
  ) {}

  /** Calendar feed: every non-deleted lesson inside the requested time window. */
  async list(
    auth: AuthenticatedUser,
    query: ListLessonsQueryDto,
  ): Promise<LessonListResponse> {
    const rows = await this.prisma.lesson.findMany({
      where: {
        workspaceId: auth.workspaceId,
        deletedAt: null,
        startsAtUtc: { gte: new Date(query.from), lt: new Date(query.to) },
        ...(query.teacherId ? { teacherId: query.teacherId } : {}),
        ...(query.enrollmentId ? { enrollmentId: query.enrollmentId } : {}),
        ...(query.studentId
          ? { enrollment: { studentId: query.studentId } }
          : {}),
        ...(query.groupId ? { groupId: query.groupId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ startsAtUtc: 'asc' }, { id: 'asc' }],
      include: lessonInclude,
    });
    return { items: rows.map(toLessonResponse) };
  }

  async create(
    auth: AuthenticatedUser,
    dto: CreateLessonDto,
    force: boolean,
  ): Promise<LessonListResponse> {
    const groupId = dto.groupId ?? null;
    const starts = dto.startsAt.map((iso) => new Date(iso));

    const rows = await this.prisma.$transaction(async (tx) => {
      // The tutor-facing path books by student; everything else still names its
      // target explicitly.
      let enrollmentId = dto.enrollmentId ?? null;
      let teacherId = dto.teacherId ?? '';
      let priceMinor = dto.priceMinor ?? 0;
      let currency = dto.currency ?? '';

      if (dto.studentId) {
        const workspace = await tx.workspace.findUniqueOrThrow({
          where: { id: auth.workspaceId },
          select: { cancellationDeadlineHours: true },
        });
        const resolved = await resolveStudentTarget(tx, auth.workspaceId, {
          studentId: dto.studentId,
          teacherId: dto.teacherId,
          priceMinor: dto.priceMinor,
          currency: dto.currency,
          defaultCancellationDeadlineHours: workspace.cancellationDeadlineHours,
        });
        enrollmentId = resolved.enrollmentId;
        teacherId = resolved.teacherId;
        priceMinor = resolved.priceMinor;
        currency = resolved.currency;
        if (resolved.createdEnrollment) {
          await this.audit.record(tx, {
            workspaceId: auth.workspaceId,
            actorId: auth.userId,
            action: 'CREATE',
            entity: 'ENROLLMENT',
            entityId: resolved.enrollmentId,
            changes: this.audit.buildChanges(
              {},
              { studentId: dto.studentId, teacherId, priceMinor, currency },
            ),
          });
        }
      }

      await assertTargetAndTeacher(tx, auth.workspaceId, {
        enrollmentId,
        groupId,
        teacherId,
      });

      if (!force) {
        const accepted: { start: Date; end: Date; id: string }[] = [];
        for (const start of starts) {
          const dbConflicts = await findLessonConflicts(tx, {
            workspaceId: auth.workspaceId,
            teacherId,
            start,
            durationMin: dto.durationMin,
          });
          // Also reject two requested dates that overlap each other.
          const selfConflicts = findConflicts(
            toInterval(start, dto.durationMin),
            accepted,
          ).map((c) => c.id);
          const all = [...dbConflicts, ...selfConflicts];
          if (all.length > 0) {
            throw scheduleConflict(all);
          }
          accepted.push({
            ...toInterval(start, dto.durationMin),
            id: start.toISOString(),
          });
        }
      }

      const created: string[] = [];
      for (const startsAtUtc of starts) {
        const lesson = await tx.lesson.create({
          data: {
            workspaceId: auth.workspaceId,
            enrollmentId,
            groupId,
            teacherId,
            startsAtUtc,
            durationMin: dto.durationMin,
            priceMinor,
            currency,
            notes: dto.notes ?? null,
          },
        });
        created.push(lesson.id);
        await this.audit.record(tx, {
          workspaceId: auth.workspaceId,
          actorId: auth.userId,
          action: 'CREATE',
          entity: 'LESSON',
          entityId: lesson.id,
          changes: this.audit.buildChanges(
            {},
            {
              enrollmentId,
              groupId,
              teacherId,
              startsAtUtc,
              durationMin: dto.durationMin,
              priceMinor,
              currency,
            },
          ),
        });
      }

      return tx.lesson.findMany({
        where: { id: { in: created } },
        orderBy: [{ startsAtUtc: 'asc' }, { id: 'asc' }],
        include: lessonInclude,
      });
    });

    return { items: rows.map(toLessonResponse) };
  }

  /** Per-lesson notes. Status and timing have their own dedicated endpoints. */
  async update(
    auth: AuthenticatedUser,
    lessonId: string,
    dto: UpdateLessonDto,
  ): Promise<LessonResponse> {
    const row = await this.prisma.$transaction(async (tx) => {
      const lesson = await tx.lesson.findFirst({
        where: { id: lessonId, workspaceId: auth.workspaceId, deletedAt: null },
        include: lessonInclude,
      });
      if (!lesson) {
        throw lessonNotFound();
      }
      // PATCH semantics: an omitted field is unchanged; `notes: null` clears it.
      const data: Prisma.LessonUpdateInput = {
        ...('notes' in dto ? { notes: dto.notes ?? null } : {}),
        ...(dto.priceMinor != null && dto.currency != null
          ? { priceMinor: dto.priceMinor, currency: dto.currency }
          : {}),
      };
      if (Object.keys(data).length === 0) {
        return lesson;
      }

      const updated = await tx.lesson.update({
        where: { id: lesson.id },
        data,
        include: lessonInclude,
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'UPDATE',
        entity: 'LESSON',
        entityId: lesson.id,
        changes: this.audit.buildChanges(lesson, data),
      });
      return updated;
    });

    return toLessonResponse(row);
  }

  /**
   * Soft-deletes a lesson. A lesson generated by a series is also detached, so
   * the materializer does not simply recreate it on the next run.
   */
  async remove(auth: AuthenticatedUser, lessonId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const lesson = await tx.lesson.findFirst({
        where: { id: lessonId, workspaceId: auth.workspaceId, deletedAt: null },
        select: { id: true, seriesId: true },
      });
      if (!lesson) {
        return; // Idempotent: deleting an already-deleted lesson is a no-op.
      }
      await tx.lesson.update({
        where: { id: lesson.id },
        data: {
          deletedAt: new Date(),
          isDetached: lesson.seriesId ? true : undefined,
        },
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'DELETE',
        entity: 'LESSON',
        entityId: lesson.id,
      });
    });
  }

  async reschedule(
    auth: AuthenticatedUser,
    lessonId: string,
    dto: RescheduleLessonDto,
    force: boolean,
  ): Promise<LessonResponse> {
    const newStart = new Date(dto.startsAtUtc);

    const row = await this.prisma.$transaction(async (tx) => {
      const lesson = await tx.lesson.findFirst({
        where: { id: lessonId, workspaceId: auth.workspaceId, deletedAt: null },
        include: lessonInclude,
      });
      if (!lesson) {
        throw lessonNotFound();
      }
      const durationMin = dto.durationMin ?? lesson.durationMin;

      if (!force) {
        const conflicts = await findLessonConflicts(tx, {
          workspaceId: auth.workspaceId,
          teacherId: lesson.teacherId,
          start: newStart,
          durationMin,
          excludeLessonId: lesson.id,
        });
        if (conflicts.length > 0) {
          throw scheduleConflict(conflicts);
        }
      }

      // "This and following" on a series lesson shifts the pattern's time and
      // regenerates future slots; the individual case (or a one-off lesson)
      // just detaches and moves this single lesson.
      if (dto.scope === 'this_and_following' && lesson.seriesId) {
        const series = await tx.lessonSeries.findUniqueOrThrow({
          where: { id: lesson.seriesId },
        });
        const localTime = localHourMinute(newStart, series.timezone);
        const updatedSeries = await tx.lessonSeries.update({
          where: { id: series.id },
          data: { localTime, durationMin },
        });
        await this.materializer.regenerateFuture(
          tx,
          updatedSeries,
          lesson.startsAtUtc,
        );
        await this.audit.record(tx, {
          workspaceId: auth.workspaceId,
          actorId: auth.userId,
          action: 'UPDATE',
          entity: 'LESSON_SERIES',
          entityId: series.id,
          changes: this.audit.buildChanges(series, { localTime, durationMin }),
        });
        // Return the regenerated lesson now occupying the new slot.
        const moved = await tx.lesson.findFirst({
          where: { seriesId: series.id, startsAtUtc: newStart },
          include: lessonInclude,
        });
        return moved ?? lesson;
      }

      const updated = await tx.lesson.update({
        where: { id: lesson.id },
        data: {
          startsAtUtc: newStart,
          durationMin,
          isDetached: lesson.seriesId ? true : lesson.isDetached,
        },
        include: lessonInclude,
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'UPDATE',
        entity: 'LESSON',
        entityId: lesson.id,
        changes: this.audit.buildChanges(lesson, {
          startsAtUtc: newStart,
          durationMin,
          isDetached: updated.isDetached,
        }),
      });
      return updated;
    });

    return toLessonResponse(row);
  }

  /**
   * Applies a lesson status transition. Stage 3 enforces the state machine and
   * records cancellation metadata only — the credit ledger is Stage 4.
   */
  async transition(
    auth: AuthenticatedUser,
    lessonId: string,
    dto: TransitionLessonDto,
  ): Promise<LessonResponse> {
    const row = await this.prisma.$transaction(async (tx) => {
      const lesson = await tx.lesson.findFirst({
        where: { id: lessonId, workspaceId: auth.workspaceId, deletedAt: null },
        include: lessonInclude,
      });
      if (!lesson) {
        throw lessonNotFound();
      }
      if (!canTransition(lesson.status, dto.targetStatus)) {
        throw invalidLessonTransition();
      }

      const now = new Date();
      const isCancel =
        dto.targetStatus === 'CANCELLED_CHARGED' ||
        dto.targetStatus === 'CANCELLED_UNCHARGED';
      const data: Prisma.LessonUpdateInput = {
        status: dto.targetStatus,
        cancelledBy: isCancel ? dto.cancelledBy : null,
        cancelledReason: isCancel ? (dto.cancelledReason ?? null) : null,
        cancelledAt: isCancel ? now : null,
        completedAt: dto.targetStatus === 'COMPLETED' ? now : null,
      };

      const updated = await tx.lesson.update({
        where: { id: lesson.id },
        data,
        include: lessonInclude,
      });

      // Stage 4: the transition now moves the credit balance. Idempotent, so a
      // repeated click cannot charge twice; a lesson with no package behind it
      // simply has no ledger effect.
      const effect = await this.ledger.applyTransition(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        lesson: {
          id: lesson.id,
          packageId: lesson.packageId,
          enrollmentId: lesson.enrollmentId,
          groupId: lesson.groupId,
          status: lesson.status,
        },
        targetStatus: dto.targetStatus,
      });

      // Cancelling without charge keeps the paid slot alive: the student is
      // owed a replacement lesson from the same pattern.
      if (effect.rebookReplacement && lesson.seriesId) {
        const series = await tx.lessonSeries.findUnique({
          where: { id: lesson.seriesId },
        });
        if (series) {
          await this.materializer.materializeSeries(
            tx,
            series,
            this.materializer.horizonUntil(),
            new Date(),
          );
        }
      }

      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'UPDATE',
        entity: 'LESSON',
        entityId: lesson.id,
        changes: this.audit.buildChanges(
          { status: lesson.status },
          {
            status: dto.targetStatus,
            ...(isCancel
              ? {
                  cancelledBy: dto.cancelledBy,
                  cancelledReason: dto.cancelledReason ?? null,
                }
              : {}),
          },
        ),
      });
      return updated;
    });

    return toLessonResponse(row);
  }
}
