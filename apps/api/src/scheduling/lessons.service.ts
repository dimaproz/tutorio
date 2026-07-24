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
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  invalidLessonTransition,
  lessonNotFound,
  scheduleConflict,
} from '../common/business.errors';
import { PrismaService } from '../prisma/prisma.service';
import { MaterializerService } from './materializer.service';
import {
  assertTargetAndTeacher,
  findLessonConflicts,
  lessonInclude,
  localHourMinute,
  toLessonResponse,
} from './scheduling.shared';

@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly materializer: MaterializerService,
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
    const enrollmentId = dto.enrollmentId ?? null;
    const groupId = dto.groupId ?? null;
    const starts = dto.startsAt.map((iso) => new Date(iso));

    const rows = await this.prisma.$transaction(async (tx) => {
      await assertTargetAndTeacher(tx, auth.workspaceId, {
        enrollmentId,
        groupId,
        teacherId: dto.teacherId,
      });

      if (!force) {
        const accepted: { start: Date; end: Date; id: string }[] = [];
        for (const start of starts) {
          const dbConflicts = await findLessonConflicts(tx, {
            workspaceId: auth.workspaceId,
            teacherId: dto.teacherId,
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
            teacherId: dto.teacherId,
            startsAtUtc,
            durationMin: dto.durationMin,
            priceMinor: dto.priceMinor,
            currency: dto.currency,
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
              teacherId: dto.teacherId,
              startsAtUtc,
              durationMin: dto.durationMin,
              priceMinor: dto.priceMinor,
              currency: dto.currency,
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
