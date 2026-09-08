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
  lessonFinancialHistoryImmutable,
  lessonTransitionReplayConflict,
  lessonCreditMustBeReversed,
  lessonNotFound,
  scheduleConflict,
} from '../common/business.errors';
import { LedgerService } from '../packages/ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { MaterializerService } from './materializer.service';
import {
  lockGroupSchedule,
  lockStudentLifecycles,
  lockTeacherSchedules,
} from './lifecycle-suspension';
import {
  assertTargetAndTeacher,
  findLessonConflicts,
  lessonInclude,
  localHourMinute,
  localWeekday,
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

  private assertCompatibleTransitionReplay(
    lesson: {
      status: string;
      cancelledBy: string | null;
      cancelledReason: string | null;
    },
    dto: TransitionLessonDto,
  ): void {
    const isCancellation =
      dto.targetStatus === 'CANCELLED_CHARGED' ||
      dto.targetStatus === 'CANCELLED_UNCHARGED';
    const normalizedReason = dto.cancelledReason?.trim() || null;
    if (
      isCancellation &&
      (lesson.cancelledBy !== dto.cancelledBy ||
        lesson.cancelledReason !== normalizedReason)
    ) {
      throw lessonTransitionReplayConflict();
    }
  }

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
        await lockStudentLifecycles(tx, auth.workspaceId, [dto.studentId]);
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

      if (groupId) {
        await lockGroupSchedule(tx, auth.workspaceId, groupId);
      }
      await lockTeacherSchedules(tx, auth.workspaceId, [teacherId]);
      // Lifecycle state may have changed while this request waited for the
      // schedule lock, so validate the canonical target only after locking.
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

      // A lesson booked straight into a finished state still has to walk the
      // status machine: the ledger, not the row, is the source of truth for
      // credits, and it only learns about a lesson through a transition.
      const now = new Date();
      const isCancel =
        dto.status === 'CANCELLED_CHARGED' ||
        dto.status === 'CANCELLED_UNCHARGED';

      const created: string[] = [];
      for (const startsAtUtc of starts) {
        if (dto.packageId) {
          await this.ledger.assertCompatiblePackage(
            tx,
            auth.workspaceId,
            {
              packageId: dto.packageId,
              enrollmentId,
              groupId,
              currency,
              occursAt: startsAtUtc,
            },
            false,
          );
        }
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
            packageId: dto.packageId ?? null,
            status: 'SCHEDULED',
            paidAt: dto.paidAt ? new Date(dto.paidAt) : null,
            notes: dto.notes ?? null,
          },
        });
        created.push(lesson.id);

        if (dto.status !== 'SCHEDULED') {
          await this.ledger.applyTransition(tx, {
            workspaceId: auth.workspaceId,
            actorId: auth.userId,
            lesson: {
              id: lesson.id,
              packageId: lesson.packageId,
              enrollmentId,
              groupId,
              currency,
              startsAtUtc,
              // The ledger diffs against where the lesson came from, and every
              // lesson is born SCHEDULED.
              status: 'SCHEDULED',
            },
            targetStatus: dto.status,
            transitionVersion: 1,
          });
          await tx.lesson.update({
            where: { id: lesson.id },
            data: {
              status: dto.status,
              statusVersion: 1,
              completedAt: dto.status === 'COMPLETED' ? now : null,
              cancelledBy: isCancel ? (dto.cancelledBy ?? null) : null,
              cancelledReason: isCancel ? (dto.cancelledReason ?? null) : null,
              cancelledAt: isCancel ? now : null,
            },
          });
        }
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
              status: dto.status,
              paidAt: dto.paidAt ?? null,
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

  /** Per-lesson notes, price and payment date. Status and timing have their own
   * dedicated endpoints. */
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
      const changesFinancialSnapshot =
        dto.priceMinor != null &&
        dto.currency != null &&
        (dto.priceMinor !== lesson.priceMinor ||
          dto.currency !== lesson.currency);
      if (changesFinancialSnapshot) {
        const creditHistory = await tx.lessonCreditEntry.count({
          where: { lessonId: lesson.id, delta: { not: 0 } },
        });
        if (creditHistory > 0) throw lessonFinancialHistoryImmutable();
        if (lesson.packageId) {
          await this.ledger.assertCompatiblePackage(
            tx,
            auth.workspaceId,
            {
              packageId: lesson.packageId,
              enrollmentId: lesson.enrollmentId,
              groupId: lesson.groupId,
              currency: dto.currency!,
              occursAt: lesson.startsAtUtc,
            },
            false,
          );
        }
      }
      const data: Prisma.LessonUpdateInput = {
        ...('notes' in dto ? { notes: dto.notes ?? null } : {}),
        ...(dto.priceMinor != null && dto.currency != null
          ? { priceMinor: dto.priceMinor, currency: dto.currency }
          : {}),
        ...('paidAt' in dto
          ? { paidAt: dto.paidAt ? new Date(dto.paidAt) : null }
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
        select: {
          id: true,
          seriesId: true,
          creditEntries: { select: { delta: true } },
        },
      });
      if (!lesson) {
        return; // Idempotent: deleting an already-deleted lesson is a no-op.
      }
      const netCreditDelta = lesson.creditEntries.reduce(
        (sum, entry) => sum + entry.delta,
        0,
      );
      if (netCreditDelta !== 0) {
        throw lessonCreditMustBeReversed(netCreditDelta);
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
      if (lesson.groupId) {
        await lockGroupSchedule(tx, auth.workspaceId, lesson.groupId);
      }
      await lockTeacherSchedules(tx, auth.workspaceId, [lesson.teacherId]);

      if (!force && !(dto.scope === 'this_and_following' && lesson.seriesId)) {
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

      // A following edit creates a new rule boundary. The original series
      // remains an honest record of the rule that produced prior occurrences.
      if (dto.scope === 'this_and_following' && lesson.seriesId) {
        const series = await tx.lessonSeries.findUniqueOrThrow({
          where: { id: lesson.seriesId },
        });
        const localTime = localHourMinute(newStart, series.timezone);
        const weekdays = [localWeekday(newStart, series.timezone)];
        const endedSeries = await tx.lessonSeries.update({
          where: { id: series.id },
          data: { endsAt: lesson.startsAtUtc },
        });
        await this.materializer.regenerateFuture(
          tx,
          endedSeries,
          lesson.startsAtUtc,
          force,
        );
        const followingSeries = await tx.lessonSeries.create({
          data: {
            workspaceId: series.workspaceId,
            enrollmentId: series.enrollmentId,
            groupId: series.groupId,
            packageId: series.packageId,
            teacherId: series.teacherId,
            weekdays,
            localTime,
            timezone: series.timezone,
            durationMin,
            priceMinor: series.priceMinor,
            currency: series.currency,
            startDate: newStart,
            endsAt: series.endsAt,
            horizonMaterializedUntil: newStart,
          },
        });
        await this.materializer.materializeSeries(
          tx,
          followingSeries,
          this.materializer.horizonUntil(),
          newStart,
          force,
        );
        await this.audit.record(tx, {
          workspaceId: auth.workspaceId,
          actorId: auth.userId,
          action: 'UPDATE',
          entity: 'LESSON_SERIES',
          entityId: series.id,
          changes: this.audit.buildChanges(series, {
            endsAt: lesson.startsAtUtc,
          }),
        });
        await this.audit.record(tx, {
          workspaceId: auth.workspaceId,
          actorId: auth.userId,
          action: 'CREATE',
          entity: 'LESSON_SERIES',
          entityId: followingSeries.id,
          changes: this.audit.buildChanges(
            {},
            {
              previousSeriesId: series.id,
              localTime,
              weekdays,
              durationMin,
              startDate: newStart,
            },
          ),
        });
        // Return the regenerated lesson now occupying the new slot, carrying
        // this move in its reschedule history.
        const moved = await tx.lesson.findFirst({
          where: { seriesId: followingSeries.id, startsAtUtc: newStart },
          select: { id: true },
        });
        if (!moved) {
          return lesson;
        }
        return tx.lesson.update({
          where: { id: moved.id },
          data: {
            rescheduledCount: { increment: 1 },
            rescheduledAt: new Date(),
          },
          include: lessonInclude,
        });
      }

      const updated = await tx.lesson.update({
        where: { id: lesson.id },
        data: {
          startsAtUtc: newStart,
          durationMin,
          isDetached: lesson.seriesId ? true : lesson.isDetached,
          rescheduledCount: { increment: 1 },
          rescheduledAt: new Date(),
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

  /** Applies an atomic, versioned status transition and its credit effect. */
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
      if (lesson.status === dto.targetStatus) {
        this.assertCompatibleTransitionReplay(lesson, dto);
        return lesson;
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
        statusVersion: { increment: 1 },
        cancelledBy: isCancel ? dto.cancelledBy : null,
        cancelledReason: isCancel ? (dto.cancelledReason ?? null) : null,
        cancelledAt: isCancel ? now : null,
        completedAt: dto.targetStatus === 'COMPLETED' ? now : null,
      };

      const updated = await tx.lesson.updateMany({
        where: {
          id: lesson.id,
          status: lesson.status,
          statusVersion: lesson.statusVersion,
        },
        data,
      });
      if (updated.count !== 1) {
        const current = await tx.lesson.findFirst({
          where: {
            id: lesson.id,
            workspaceId: auth.workspaceId,
            deletedAt: null,
          },
          include: lessonInclude,
        });
        if (current?.status === dto.targetStatus) {
          this.assertCompatibleTransitionReplay(current, dto);
          return current;
        }
        throw invalidLessonTransition();
      }

      // Stage 4: the transition now moves the credit balance. Idempotent, so a
      // repeated click cannot charge twice; a lesson with no package behind it
      // simply has no ledger effect.
      await this.ledger.applyTransition(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        lesson: {
          id: lesson.id,
          packageId: lesson.packageId,
          enrollmentId: lesson.enrollmentId,
          groupId: lesson.groupId,
          currency: lesson.currency,
          startsAtUtc: lesson.startsAtUtc,
          status: lesson.status,
        },
        targetStatus: dto.targetStatus,
        transitionVersion: lesson.statusVersion + 1,
      });

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
      return tx.lesson.findUniqueOrThrow({
        where: { id: lesson.id },
        include: lessonInclude,
      });
    });

    return toLessonResponse(row);
  }
}
