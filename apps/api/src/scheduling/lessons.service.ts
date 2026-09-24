import { Injectable } from '@nestjs/common';
import {
  canHaveMakeup,
  canTransition,
  isCancelledStatus,
  localWeekdayOf,
  replaceSlot,
} from '@tutorio/domain';
import { Prisma } from '@prisma/client';
import type {
  CreateLessonDto,
  CreateMakeupDto,
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
  lessonCharged,
  lessonEnded,
  lessonTransitionReplayConflict,
  lessonNotFound,
  makeupExists,
  makeupNotAllowed,
  noShowIndividualOnly,
  teacherNotFound,
} from '../common/business.errors';
import { BillingService } from '../billing/billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { markRosterPresent } from './attendance.service';
import { assertNoScheduleConflicts } from './conflicts';
import { SchedulesService, currentVersionRows } from './schedules.service';
import {
  lockGroupSchedule,
  lockStudentLifecycles,
  lockTeacherSchedules,
} from './lifecycle-suspension';
import {
  assertTargetAndTeacher,
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
    private readonly schedules: SchedulesService,
    private readonly billing: BillingService,
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

      // The teacher and the student(s), against booked lessons and against
      // each other's requested dates (L-110); `force` saves anyway (L-111).
      // A lesson recorded after the fact as cancelled frees its slot.
      if (!force && !isCancelledStatus(dto.status)) {
        await assertNoScheduleConflicts(
          tx,
          auth.workspaceId,
          starts.map((startsAtUtc, index) => ({
            id: `new:${index}`,
            startsAtUtc,
            durationMin: dto.durationMin,
            teacherId,
            enrollmentId,
            groupId,
          })),
        );
      }

      // A lesson booked straight into a finished state is charged the same
      // way a status change would charge it.
      const now = new Date();
      const isCancel = isCancelledStatus(dto.status);
      if (dto.status === 'NO_SHOW' && groupId) {
        throw noShowIndividualOnly();
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
            status: 'SCHEDULED',
            paidAt: dto.paidAt ? new Date(dto.paidAt) : null,
            topic: dto.topic?.trim() || null,
            notes: dto.notes ?? null,
          },
        });
        created.push(lesson.id);

        if (dto.status !== 'SCHEDULED') {
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
          // Held with no marks: every active member was there (L-72).
          if (dto.status === 'COMPLETED') {
            await markRosterPresent(
              tx,
              {
                id: lesson.id,
                workspaceId: auth.workspaceId,
                groupId,
                startsAtUtc,
              },
              now,
            );
          }
          await this.billing.syncLesson(
            tx,
            auth.workspaceId,
            lesson.id,
            auth.userId,
          );
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
              topic: dto.topic?.trim() || null,
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

  /**
   * Changes one lesson (product/scheduling.md L-40): topic, notes, duration,
   * teacher (a substitute for this lesson only), price and payment date. A new
   * duration or teacher on an upcoming lesson is conflict-checked unless the
   * tutor saves anyway (`force`), and takes a schedule lesson out of its
   * schedule's regeneration so the change survives it.
   */
  async update(
    auth: AuthenticatedUser,
    lessonId: string,
    dto: UpdateLessonDto,
    force = false,
  ): Promise<LessonResponse> {
    const row = await this.prisma.$transaction(async (tx) => {
      let lesson = await tx.lesson.findFirst({
        where: { id: lessonId, workspaceId: auth.workspaceId, deletedAt: null },
        include: lessonInclude,
      });
      if (!lesson) {
        throw lessonNotFound();
      }
      const newTeacher =
        dto.teacherId != null && dto.teacherId !== lesson.teacherId
          ? dto.teacherId
          : null;
      const newDuration =
        dto.durationMin != null && dto.durationMin !== lesson.durationMin
          ? dto.durationMin
          : null;
      if (newTeacher || newDuration) {
        if (lesson.groupId) {
          await lockGroupSchedule(tx, auth.workspaceId, lesson.groupId);
        }
        await lockTeacherSchedules(
          tx,
          auth.workspaceId,
          [lesson.teacherId, newTeacher].filter(
            (id): id is string => id != null,
          ),
        );
        // Read again under the locks: the lesson may have moved meanwhile.
        lesson = await tx.lesson.findFirst({
          where: {
            id: lessonId,
            workspaceId: auth.workspaceId,
            deletedAt: null,
          },
          include: lessonInclude,
        });
        if (!lesson) {
          throw lessonNotFound();
        }
      }
      if (newTeacher) {
        const teacher = await tx.teacher.findFirst({
          where: {
            id: newTeacher,
            workspaceId: auth.workspaceId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!teacher) {
          throw teacherNotFound();
        }
      }
      if (
        (newTeacher || newDuration) &&
        !force &&
        lesson.status === 'SCHEDULED'
      ) {
        await assertNoScheduleConflicts(
          tx,
          auth.workspaceId,
          [
            {
              id: lesson.id,
              startsAtUtc: lesson.startsAtUtc,
              durationMin: newDuration ?? lesson.durationMin,
              teacherId: newTeacher ?? lesson.teacherId,
              enrollmentId: lesson.enrollmentId,
              groupId: lesson.groupId,
            },
          ],
          { excludeIds: [lesson.id] },
        );
      }

      // PATCH semantics: an omitted field is unchanged; `notes: null` clears it.
      const changesFinancialSnapshot =
        dto.priceMinor != null &&
        dto.currency != null &&
        (dto.priceMinor !== lesson.priceMinor ||
          dto.currency !== lesson.currency);
      if (changesFinancialSnapshot) {
        await this.billing.repriceLesson(
          tx,
          lesson,
          dto.priceMinor!,
          dto.currency!,
        );
      }
      const data: Prisma.LessonUncheckedUpdateInput = {
        ...('topic' in dto ? { topic: dto.topic?.trim() || null } : {}),
        ...('notes' in dto ? { notes: dto.notes ?? null } : {}),
        ...(newDuration ? { durationMin: newDuration } : {}),
        ...(newTeacher ? { teacherId: newTeacher } : {}),
        // A schedule regenerating its lessons must not undo this change.
        ...((newDuration || newTeacher) && lesson.seriesId
          ? { isDetached: true }
          : {}),
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
   * Assigns a makeup for a cancelled or no-show individual lesson (L-60): a
   * new individual lesson for the same student, linked to the original, with
   * the original's teacher and duration unless others are named. Exactly one
   * of the pair is charged (L-61); the status change decides it.
   */
  async createMakeup(
    auth: AuthenticatedUser,
    lessonId: string,
    dto: CreateMakeupDto,
    force = false,
  ): Promise<LessonResponse> {
    const row = await this.prisma.$transaction(async (tx) => {
      const original = await tx.lesson.findFirst({
        where: { id: lessonId, workspaceId: auth.workspaceId, deletedAt: null },
        select: {
          id: true,
          enrollmentId: true,
          teacherId: true,
          durationMin: true,
          priceMinor: true,
          currency: true,
          status: true,
          makeup: { select: { id: true } },
          enrollment: { select: { studentId: true } },
        },
      });
      if (!original) {
        throw lessonNotFound();
      }
      if (!original.enrollment || !canHaveMakeup(original.status)) {
        throw makeupNotAllowed();
      }
      if (original.makeup) {
        throw makeupExists();
      }
      await lockStudentLifecycles(tx, auth.workspaceId, [
        original.enrollment.studentId,
      ]);
      const teacherId = dto.teacherId ?? original.teacherId;
      await lockTeacherSchedules(tx, auth.workspaceId, [teacherId]);
      await assertTargetAndTeacher(tx, auth.workspaceId, {
        enrollmentId: original.enrollmentId,
        groupId: null,
        teacherId,
      });
      const startsAtUtc = new Date(dto.startsAtUtc);
      const durationMin = dto.durationMin ?? original.durationMin;
      if (!force) {
        await assertNoScheduleConflicts(tx, auth.workspaceId, [
          {
            id: 'makeup',
            startsAtUtc,
            durationMin,
            teacherId,
            enrollmentId: original.enrollmentId,
          },
        ]);
      }

      const data = {
        workspaceId: auth.workspaceId,
        enrollmentId: original.enrollmentId,
        teacherId,
        startsAtUtc,
        durationMin,
        priceMinor: original.priceMinor,
        currency: original.currency,
        kind: 'MAKEUP' as const,
        originalLessonId: original.id,
        topic: dto.topic?.trim() || null,
        notes: dto.notes ?? null,
      };
      const created = await tx.lesson.create({ data, include: lessonInclude });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'CREATE',
        entity: 'LESSON',
        entityId: created.id,
        changes: this.audit.buildChanges({}, data),
      });
      return created;
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
          _count: { select: { charges: { where: { voidedAt: null } } } },
        },
      });
      if (!lesson) {
        return; // Idempotent: deleting an already-deleted lesson is a no-op.
      }
      if (lesson._count.charges > 0) {
        throw lessonCharged(lesson._count.charges);
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
        await assertNoScheduleConflicts(
          tx,
          auth.workspaceId,
          [
            {
              id: lesson.id,
              startsAtUtc: newStart,
              durationMin,
              teacherId: lesson.teacherId,
              enrollmentId: lesson.enrollmentId,
              groupId: lesson.groupId,
            },
          ],
          { excludeIds: [lesson.id] },
        );
      }

      // "This and following" changes that weekday's time in the schedule from
      // this lesson on (product/scheduling.md L-41); the other weekdays stay.
      // The schedule change moves the lessons instead of deleting them.
      if (dto.scope === 'this_and_following' && lesson.seriesId) {
        const series = await tx.lessonSeries.findUniqueOrThrow({
          where: { id: lesson.seriesId },
        });
        const schedule = await tx.schedule.findUniqueOrThrow({
          where: { id: series.scheduleId },
        });
        const rows = await tx.lessonSeries.findMany({
          where: {
            scheduleId: schedule.id,
            OR: [
              { deletedAt: null },
              { scheduleSuspensionToken: { not: null } },
            ],
          },
        });
        const current = currentVersionRows(rows, lesson.startsAtUtc).flatMap(
          (row) =>
            row.weekdays.map((weekday) => ({
              weekday,
              localTime: row.localTime,
            })),
        );
        const slots = replaceSlot(
          current,
          localWeekdayOf(lesson.startsAtUtc, schedule.timezone),
          {
            weekday: localWeekdayOf(newStart, schedule.timezone),
            localTime: localHourMinute(newStart, schedule.timezone),
          },
        );
        await this.schedules.changeInTx(
          tx,
          auth,
          schedule.id,
          {
            effectiveFrom: lesson.startsAtUtc.toISOString(),
            slots,
            durationMin: dto.durationMin ?? schedule.durationMin,
          },
          force,
        );
        // The lesson keeps its id when it takes the new time; count the move.
        const moved = await tx.lesson.findFirst({
          where: {
            workspaceId: auth.workspaceId,
            deletedAt: null,
            startsAtUtc: newStart,
            series: { scheduleId: schedule.id },
          },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        if (!moved) {
          return tx.lesson.findUniqueOrThrow({
            where: { id: lesson.id },
            include: lessonInclude,
          });
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

  /** Applies an atomic, versioned status transition and its charges. */
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
      if (dto.targetStatus === 'NO_SHOW' && lesson.groupId) {
        throw noShowIndividualOnly();
      }
      // An ended lesson is corrected between final statuses; it never goes
      // back to "scheduled", which the end-of-lesson completion would undo
      // (product/scheduling.md L-53).
      const endsAt = lesson.startsAtUtc.getTime() + lesson.durationMin * 60_000;
      if (dto.targetStatus === 'SCHEDULED' && endsAt <= now.getTime()) {
        throw lessonEnded();
      }

      const isCancel = isCancelledStatus(dto.targetStatus);
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

      // Held with no marks: every active member was there (L-72).
      if (dto.targetStatus === 'COMPLETED') {
        await markRosterPresent(tx, lesson, now);
      }
      // The charges follow the new status: one per participant, a makeup
      // paired with its original (L-61), whatever pays for it (L-81, L-90).
      await this.billing.syncLesson(
        tx,
        auth.workspaceId,
        lesson.id,
        auth.userId,
      );

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
