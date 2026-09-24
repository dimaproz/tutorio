import { Injectable } from '@nestjs/common';
import { Prisma, type LessonSeries, type Schedule } from '@prisma/client';
import {
  expandSchedule,
  localDateStartUtc,
  localWeekdayOf,
  normalizeSlots,
  planScheduleChange,
  weekKeyOf,
  type ScheduleSlot,
} from '@tutorio/domain';
import type {
  CreateScheduleDto,
  ListSchedulesQueryDto,
  ScheduleChangeDto,
  ScheduleChangePreview,
  ScheduleChangeResult,
  ScheduleListResponse,
  ScheduleResponse,
  StopScheduleDto,
  UpdateScheduleDto,
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  groupNotFound,
  groupTeacherRequired,
  scheduleConflict,
  scheduleEnded,
  scheduleExists,
  scheduleNotFound,
} from '../common/business.errors';
import { buildPaginatedResponse, toSkipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { detectScheduleConflicts } from './conflicts';
import {
  lockGroupSchedule,
  lockStudentLifecycles,
  lockTeacherSchedules,
} from './lifecycle-suspension';
import { MaterializerService } from './materializer.service';
import {
  assertTargetAndTeacher,
  resolveStudentTarget,
} from './scheduling.shared';

const DAY_MS = 24 * 60 * 60 * 1000;

/** What a new schedule is made of, once its target is resolved. */
export interface NewSchedule {
  enrollmentId: string | null;
  groupId: string | null;
  teacherId: string;
  slots: ScheduleSlot[];
  durationMin: number;
  timezone: string;
  startDate: Date;
  endsAt: Date | null;
  horizonWeeks: number;
  priceMinor: number;
  currency: string;
  /** A package-owned schedule pins its lessons to the package (until phase 3). */
  packageId?: string | null;
}

const scheduleInclude = {
  enrollment: {
    select: { student: { select: { id: true, fullName: true } } },
  },
  group: { select: { id: true, name: true } },
  teacher: { select: { id: true, fullName: true } },
} satisfies Prisma.ScheduleInclude;

type ScheduleRow = Prisma.ScheduleGetPayload<{
  include: typeof scheduleInclude;
}>;

/** A row that is part of the rule: live, or suspended and coming back. */
const liveRowWhere = {
  OR: [{ deletedAt: null }, { scheduleSuspensionToken: { not: null } }],
} satisfies Prisma.LessonSeriesWhereInput;

/**
 * The rows of the rule in force at `at`: the version that started last on or
 * before it, else (a schedule that has not started) the first one.
 */
export function currentVersionRows<
  T extends { startDate: Date; endsAt: Date | null },
>(rows: readonly T[], at: Date): T[] {
  const running = rows.filter((row) => !row.endsAt || row.endsAt > at);
  if (running.length === 0) return [];
  const started = running.filter((row) => row.startDate <= at);
  const pick = started.length
    ? Math.max(...started.map((row) => row.startDate.getTime()))
    : Math.min(...running.map((row) => row.startDate.getTime()));
  return running.filter((row) => row.startDate.getTime() === pick);
}

/**
 * The rows a rule is stored in: one per start time, with the weekdays that
 * share it ("Tue, Thu 17:00" is one row, "Mon 17:00 · Thu 18:30" two).
 */
function rowsByTime(
  slots: readonly ScheduleSlot[],
): { localTime: string; weekdays: number[] }[] {
  const byTime = new Map<string, number[]>();
  for (const slot of slots) {
    byTime.set(slot.localTime, [
      ...(byTime.get(slot.localTime) ?? []),
      slot.weekday,
    ]);
  }
  return [...byTime].map(([localTime, weekdays]) => ({
    localTime,
    weekdays: [...weekdays].sort((a, b) => a - b),
  }));
}

function slotsOf(
  rows: readonly Pick<LessonSeries, 'weekdays' | 'localTime'>[],
) {
  return normalizeSlots(
    rows.flatMap((row) =>
      row.weekdays.map((weekday) => ({ weekday, localTime: row.localTime })),
    ),
  );
}

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly materializer: MaterializerService,
  ) {}

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async list(
    auth: AuthenticatedUser,
    query: ListSchedulesQueryDto,
  ): Promise<ScheduleListResponse> {
    const where: Prisma.ScheduleWhereInput = {
      workspaceId: auth.workspaceId,
      ...(query.state === 'all' ? {} : { state: query.state }),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.studentId
        ? { enrollment: { studentId: query.studentId } }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.schedule.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...toSkipTake(query),
        include: scheduleInclude,
      }),
      this.prisma.schedule.count({ where }),
    ]);
    const items = await this.toResponses(this.prisma, rows);
    return buildPaginatedResponse(items, total, query);
  }

  async getDetail(
    auth: AuthenticatedUser,
    scheduleId: string,
  ): Promise<ScheduleResponse> {
    const row = await this.prisma.schedule.findFirst({
      where: { id: scheduleId, workspaceId: auth.workspaceId },
      include: scheduleInclude,
    });
    if (!row) throw scheduleNotFound();
    return (await this.toResponses(this.prisma, [row]))[0];
  }

  private async toResponses(
    db: Prisma.TransactionClient,
    schedules: readonly ScheduleRow[],
  ): Promise<ScheduleResponse[]> {
    if (schedules.length === 0) return [];
    const now = new Date();
    const ids = schedules.map((schedule) => schedule.id);
    // Every row: the live ones describe the rule, and a hand-moved lesson of
    // a retired row is still the schedule's next lesson.
    const [allRows, next] = await Promise.all([
      db.lessonSeries.findMany({
        where: { scheduleId: { in: ids } },
        orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
      }),
      db.lesson.groupBy({
        by: ['seriesId'],
        where: {
          series: { scheduleId: { in: ids } },
          deletedAt: null,
          status: 'SCHEDULED',
          startsAtUtc: { gte: now },
        },
        _min: { startsAtUtc: true },
      }),
    ]);
    const rows = allRows.filter(
      (row) => row.deletedAt === null || row.scheduleSuspensionToken !== null,
    );
    const rowsBySchedule = new Map<string, LessonSeries[]>();
    for (const row of rows) {
      rowsBySchedule.set(row.scheduleId, [
        ...(rowsBySchedule.get(row.scheduleId) ?? []),
        row,
      ]);
    }
    const nextBySeries = new Map(
      next.map((entry) => [entry.seriesId, entry._min.startsAtUtc]),
    );

    return schedules.map((schedule) => {
      const own = rowsBySchedule.get(schedule.id) ?? [];
      const current = currentVersionRows(own, now);
      const later = own.filter(
        (row) =>
          row.startDate > now &&
          !current.includes(row) &&
          (!row.endsAt || row.endsAt > now),
      );
      const nextStart = later.length
        ? Math.min(...later.map((row) => row.startDate.getTime()))
        : null;
      const nextRows = later.filter(
        (row) => row.startDate.getTime() === nextStart,
      );
      const nextLessonAt = allRows
        .filter((row) => row.scheduleId === schedule.id)
        .map((row) => nextBySeries.get(row.id))
        .filter((value): value is Date => value instanceof Date)
        .sort((a, b) => a.getTime() - b.getTime())[0];
      return {
        id: schedule.id,
        workspaceId: schedule.workspaceId,
        enrollmentId: schedule.enrollmentId,
        groupId: schedule.groupId,
        teacherId: schedule.teacherId,
        timezone: schedule.timezone,
        durationMin: schedule.durationMin,
        horizonWeeks: schedule.horizonWeeks,
        endsAt: schedule.endsAt?.toISOString() ?? null,
        state: schedule.state,
        slots: current
          .flatMap((row) =>
            row.weekdays.map((weekday) => ({
              weekday,
              localTime: row.localTime,
              seriesId: row.id,
            })),
          )
          .sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7)),
        nextChange:
          nextStart !== null
            ? {
                effectiveFrom: new Date(nextStart).toISOString(),
                slots: slotsOf(nextRows),
              }
            : null,
        nextLessonAt: nextLessonAt?.toISOString() ?? null,
        student: schedule.enrollment?.student ?? null,
        group: schedule.group,
        teacher: { id: schedule.teacher.id, name: schedule.teacher.fullName },
        createdAt: schedule.createdAt.toISOString(),
        updatedAt: schedule.updatedAt.toISOString(),
      };
    });
  }

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  async create(
    auth: AuthenticatedUser,
    dto: CreateScheduleDto,
    force: boolean,
  ): Promise<ScheduleResponse> {
    const scheduleId = await this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findUniqueOrThrow({
        where: { id: auth.workspaceId },
        select: {
          timezone: true,
          scheduleHorizonWeeks: true,
          defaultCurrency: true,
          cancellationDeadlineHours: true,
        },
      });
      let enrollmentId = dto.enrollmentId ?? null;
      const groupId = dto.groupId ?? null;
      let teacherId = dto.teacherId ?? null;
      let priceMinor = dto.priceMinor ?? null;
      let currency: string | null = dto.currency ?? null;

      if (dto.studentId) {
        await lockStudentLifecycles(tx, auth.workspaceId, [dto.studentId]);
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
      } else if (enrollmentId) {
        const enrollment = await tx.enrollment.findFirst({
          where: { id: enrollmentId, workspaceId: auth.workspaceId },
          select: { teacherId: true, priceMinor: true, currency: true },
        });
        teacherId = teacherId ?? enrollment?.teacherId ?? null;
        priceMinor = priceMinor ?? enrollment?.priceMinor ?? null;
        currency = currency ?? enrollment?.currency ?? null;
      } else if (groupId) {
        const group = await tx.group.findFirst({
          where: {
            id: groupId,
            workspaceId: auth.workspaceId,
            deletedAt: null,
          },
          select: { teacherId: true, pricePerLesson: true, currency: true },
        });
        if (!group) throw groupNotFound();
        // A group is taught by its own teacher (L-20).
        teacherId = group.teacherId;
        if (!teacherId) throw groupTeacherRequired();
        priceMinor = priceMinor ?? group.pricePerLesson ?? 0;
        currency = currency ?? group.currency ?? workspace.defaultCurrency;
      }
      await assertTargetAndTeacher(tx, auth.workspaceId, {
        enrollmentId,
        groupId,
        teacherId: teacherId ?? '',
      });

      const timezone = dto.timezone ?? workspace.timezone;
      const created = await this.createInTx(
        tx,
        auth,
        {
          enrollmentId,
          groupId,
          teacherId: teacherId!,
          slots: dto.slots,
          durationMin: dto.durationMin,
          timezone,
          startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
          endsAt: dto.endsOn
            ? localDateStartUtc(nextDay(dto.endsOn), timezone)
            : null,
          horizonWeeks: dto.horizonWeeks ?? workspace.scheduleHorizonWeeks,
          priceMinor: priceMinor ?? 0,
          currency: currency ?? workspace.defaultCurrency,
        },
        { force },
      );
      return created.id;
    });
    return this.getDetail(auth, scheduleId);
  }

  /**
   * Creates a schedule and its rows inside the caller's transaction, after a
   * teacher-and-student conflict check of the lessons it would generate
   * (skipped with `force`, or when the caller checked already). Refuses a
   * second active schedule for the same direction (409 SCHEDULE_EXISTS).
   */
  async createInTx(
    tx: Prisma.TransactionClient,
    auth: AuthenticatedUser,
    input: NewSchedule,
    options: { force: boolean },
  ): Promise<Schedule & { series: LessonSeries[] }> {
    if (input.groupId) {
      await lockGroupSchedule(tx, auth.workspaceId, input.groupId);
    }
    await lockTeacherSchedules(tx, auth.workspaceId, [input.teacherId]);
    const existing = await tx.schedule.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        state: 'ACTIVE',
        ...(input.enrollmentId
          ? { enrollmentId: input.enrollmentId }
          : { groupId: input.groupId }),
      },
      select: { id: true },
    });
    if (existing) throw scheduleExists(existing.id);

    const slots = normalizeSlots(input.slots);
    const now = new Date();
    if (!options.force) {
      const from = input.startDate > now ? input.startDate : now;
      const horizon = this.materializer.horizonUntil(now, input.horizonWeeks);
      const until =
        input.endsAt && input.endsAt < horizon ? input.endsAt : horizon;
      const occurrences = expandSchedule(slots, {
        timezone: input.timezone,
        startDate: input.startDate,
        from,
        until,
      });
      const conflicts = await detectScheduleConflicts(
        tx,
        auth.workspaceId,
        occurrences.map((occurrence, index) => ({
          id: `new:${index}`,
          startsAtUtc: occurrence.startsAtUtc,
          durationMin: input.durationMin,
          teacherId: input.teacherId,
          enrollmentId: input.enrollmentId,
          groupId: input.groupId,
        })),
      );
      if (conflicts.length > 0) {
        throw scheduleConflict(
          [...new Set(conflicts.map((conflict) => conflict.lessonId))],
          conflicts,
        );
      }
    }

    const schedule = await tx.schedule.create({
      data: {
        workspaceId: auth.workspaceId,
        enrollmentId: input.enrollmentId,
        groupId: input.groupId,
        teacherId: input.teacherId,
        timezone: input.timezone,
        durationMin: input.durationMin,
        horizonWeeks: input.horizonWeeks,
        endsAt: input.endsAt,
        state: input.endsAt && input.endsAt <= now ? 'ENDED' : 'ACTIVE',
      },
    });
    const series: LessonSeries[] = [];
    for (const rule of rowsByTime(slots)) {
      series.push(
        await tx.lessonSeries.create({
          data: {
            workspaceId: auth.workspaceId,
            scheduleId: schedule.id,
            enrollmentId: input.enrollmentId,
            groupId: input.groupId,
            packageId: input.packageId ?? null,
            teacherId: input.teacherId,
            weekdays: rule.weekdays,
            localTime: rule.localTime,
            timezone: input.timezone,
            durationMin: input.durationMin,
            priceMinor: input.priceMinor,
            currency: input.currency,
            startDate: input.startDate,
            endsAt: input.endsAt,
            horizonMaterializedUntil: input.startDate,
          },
        }),
      );
    }
    // Checked above as a whole; a group with no students generates nothing
    // until its first student joins.
    const horizon = this.materializer.horizonUntil(now, input.horizonWeeks);
    for (const row of series) {
      await this.materializer.materializeSeries(
        tx,
        row,
        horizon,
        row.startDate,
        true,
      );
    }
    await this.audit.record(tx, {
      workspaceId: auth.workspaceId,
      actorId: auth.userId,
      action: 'CREATE',
      entity: 'SCHEDULE',
      entityId: schedule.id,
      changes: this.audit.buildChanges(
        {},
        {
          enrollmentId: input.enrollmentId,
          groupId: input.groupId,
          teacherId: input.teacherId,
          slots,
          durationMin: input.durationMin,
          timezone: input.timezone,
          horizonWeeks: input.horizonWeeks,
          endsAt: input.endsAt,
        },
      ),
    });
    return { ...schedule, series };
  }

  // -------------------------------------------------------------------------
  // Change from a date (L-25, L-26)
  // -------------------------------------------------------------------------

  async previewChange(
    auth: AuthenticatedUser,
    scheduleId: string,
    dto: ScheduleChangeDto,
  ): Promise<ScheduleChangePreview> {
    return this.prisma.$transaction(async (tx) => {
      const schedule = await this.activeSchedule(tx, auth, scheduleId);
      return (await this.planChange(tx, schedule, dto)).preview;
    });
  }

  async change(
    auth: AuthenticatedUser,
    scheduleId: string,
    dto: ScheduleChangeDto,
    force: boolean,
  ): Promise<ScheduleChangeResult> {
    const summary = await this.prisma.$transaction((tx) =>
      this.changeInTx(tx, auth, scheduleId, dto, force),
    );
    return { schedule: await this.getDetail(auth, scheduleId), summary };
  }

  /**
   * Applies a change inside the caller's transaction: the current rows end at
   * the change date, new rows start there, affected lessons move to their
   * paired times (keeping id, topic, notes and history) and the rest are
   * removed softly or created. Held, cancelled, hand-moved and marked lessons
   * are never touched (L-27).
   */
  async changeInTx(
    tx: Prisma.TransactionClient,
    auth: AuthenticatedUser,
    scheduleId: string,
    dto: ScheduleChangeDto,
    force: boolean,
  ): Promise<ScheduleChangePreview> {
    const schedule = await this.activeSchedule(tx, auth, scheduleId);
    if (schedule.groupId) {
      await lockGroupSchedule(tx, auth.workspaceId, schedule.groupId);
    }
    await lockTeacherSchedules(tx, auth.workspaceId, [schedule.teacherId]);
    const plan = await this.planChange(tx, schedule, dto);
    if (plan.preview.conflicts.length > 0 && !force) {
      throw scheduleConflict(
        [
          ...new Set(
            plan.preview.conflicts.map((conflict) => conflict.lessonId),
          ),
        ],
        plan.preview.conflicts,
      );
    }
    const { effectiveFrom } = plan;
    const now = new Date();

    // End the rule in force at the change date; drop versions that had not
    // started by then (a change replacing an earlier planned change).
    for (const row of plan.rows) {
      if (row.startDate >= effectiveFrom) {
        await tx.lessonSeries.update({
          where: { id: row.id },
          data: {
            deletedAt: row.deletedAt ?? now,
            endsAt: row.startDate,
            scheduleSuspensionToken: null,
          },
        });
      } else {
        await tx.lessonSeries.update({
          where: { id: row.id },
          data: { endsAt: effectiveFrom },
        });
      }
    }
    // A suspended schedule (empty group, paused student) stays suspended:
    // its new rows carry the same token, so the return revives them.
    const suspension = plan.rows.find((row) => row.scheduleSuspensionToken);
    const template = plan.rows[0];
    // Each weekday maps to the row that carries its start time.
    const newRows = new Map<number, LessonSeries>();
    for (const rule of rowsByTime(plan.slots)) {
      const created = await tx.lessonSeries.create({
        data: {
          workspaceId: auth.workspaceId,
          scheduleId: schedule.id,
          enrollmentId: schedule.enrollmentId,
          groupId: schedule.groupId,
          packageId: template?.packageId ?? null,
          teacherId: schedule.teacherId,
          weekdays: rule.weekdays,
          localTime: rule.localTime,
          timezone: schedule.timezone,
          durationMin: plan.durationMin,
          priceMinor: template?.priceMinor ?? 0,
          currency: template?.currency ?? 'EUR',
          startDate: effectiveFrom,
          endsAt: schedule.endsAt,
          horizonMaterializedUntil: effectiveFrom,
          ...(suspension
            ? {
                deletedAt: suspension.deletedAt,
                scheduleSuspensionToken: suspension.scheduleSuspensionToken,
              }
            : {}),
        },
      });
      for (const weekday of rule.weekdays) newRows.set(weekday, created);
    }

    for (const move of plan.moves) {
      await tx.lesson.update({
        where: { id: move.lessonId },
        data: {
          startsAtUtc: move.to.startsAtUtc,
          durationMin: plan.durationMin,
          seriesId: newRows.get(move.to.weekday)!.id,
        },
      });
    }
    if (plan.removes.length > 0) {
      await tx.lesson.updateMany({
        where: { id: { in: plan.removes } },
        data: { deletedAt: now },
      });
    }
    // Lessons an earlier suspension set aside belong to the old rule: they
    // must not come back with the new one.
    await tx.lesson.updateMany({
      where: {
        seriesId: { in: plan.rows.map((row) => row.id) },
        scheduleSuspensionToken: { not: null },
        startsAtUtc: { gte: effectiveFrom },
      },
      data: { scheduleSuspensionToken: null },
    });
    await tx.schedule.update({
      where: { id: schedule.id },
      data: { durationMin: plan.durationMin },
    });
    if (!suspension) {
      for (const row of new Set(newRows.values())) {
        await this.materializer.materializeSeries(
          tx,
          row,
          plan.until,
          effectiveFrom,
          true,
        );
      }
    }
    await this.audit.record(tx, {
      workspaceId: auth.workspaceId,
      actorId: auth.userId,
      action: 'UPDATE',
      entity: 'SCHEDULE',
      entityId: schedule.id,
      changes: this.audit.buildChanges(
        {
          slots: slotsOf(currentVersionRows(plan.rows, effectiveFrom)),
          durationMin: schedule.durationMin,
        },
        {
          slots: plan.slots,
          durationMin: plan.durationMin,
          effectiveFrom,
          moved: plan.preview.moved,
          created: plan.preview.created,
          removed: plan.preview.removed,
        },
      ),
    });
    return plan.preview;
  }

  /** The exact effect of a change, shared by the preview and the apply. */
  private async planChange(
    tx: Prisma.TransactionClient,
    schedule: Schedule,
    dto: ScheduleChangeDto,
  ) {
    const now = new Date();
    const requested = dto.effectiveFrom ? new Date(dto.effectiveFrom) : now;
    const from = requested > now ? requested : now;
    const slots = normalizeSlots(dto.slots);

    const rows = await tx.lessonSeries.findMany({
      where: {
        scheduleId: schedule.id,
        // Live and still running at the date (two ORs, so AND them).
        AND: [
          liveRowWhere,
          { OR: [{ endsAt: null }, { endsAt: { gt: from } }] },
        ],
      },
    });
    // A schedule that has not started yet changes from its start: the new
    // rule never generates lessons before it.
    const start = rows.length
      ? Math.min(...rows.map((row) => row.startDate.getTime()))
      : from.getTime();
    const effectiveFrom = start > from.getTime() ? new Date(start) : from;
    const lessons = await tx.lesson.findMany({
      where: {
        seriesId: { in: rows.map((row) => row.id) },
        deletedAt: null,
        startsAtUtc: { gte: effectiveFrom },
      },
      select: {
        id: true,
        startsAtUtc: true,
        durationMin: true,
        status: true,
        isDetached: true,
        topic: true,
        notes: true,
        _count: { select: { attendance: true } },
      },
    });
    const changeable = lessons.filter(
      (lesson) =>
        lesson.status === 'SCHEDULED' &&
        !lesson.isDetached &&
        lesson._count.attendance === 0,
    );
    const kept = lessons.length - changeable.length;

    const horizon = this.materializer.horizonUntil(now, schedule.horizonWeeks);
    const lastExisting = Math.max(
      0,
      ...changeable.map((lesson) => lesson.startsAtUtc.getTime() + 1),
    );
    let until = new Date(Math.max(horizon.getTime(), lastExisting));
    if (schedule.endsAt && schedule.endsAt < until) until = schedule.endsAt;

    const occurrences = expandSchedule(slots, {
      timezone: schedule.timezone,
      startDate: effectiveFrom,
      from: effectiveFrom,
      until,
    });
    const plan = planScheduleChange(
      changeable.map((lesson) => ({
        id: lesson.id,
        startsAtUtc: lesson.startsAtUtc,
        weekday: localWeekdayOf(lesson.startsAtUtc, schedule.timezone),
        weekKey: weekKeyOf(lesson.startsAtUtc, schedule.timezone),
      })),
      occurrences,
    );
    const byId = new Map(changeable.map((lesson) => [lesson.id, lesson]));
    const unchanged = plan.moves.filter((move) => {
      const lesson = byId.get(move.lessonId)!;
      return (
        lesson.startsAtUtc.getTime() === move.to.startsAtUtc.getTime() &&
        lesson.durationMin === dto.durationMin
      );
    }).length;

    const conflicts = await detectScheduleConflicts(
      tx,
      schedule.workspaceId,
      [
        ...plan.moves.map((move) => ({
          id: move.lessonId,
          startsAtUtc: move.to.startsAtUtc,
          durationMin: dto.durationMin,
          teacherId: schedule.teacherId,
          enrollmentId: schedule.enrollmentId,
          groupId: schedule.groupId,
        })),
        ...plan.creates.map((occurrence, index) => ({
          id: `new:${index}`,
          startsAtUtc: occurrence.startsAtUtc,
          durationMin: dto.durationMin,
          teacherId: schedule.teacherId,
          enrollmentId: schedule.enrollmentId,
          groupId: schedule.groupId,
        })),
      ],
      { excludeIds: changeable.map((lesson) => lesson.id) },
    );

    const preview: ScheduleChangePreview = {
      effectiveFrom: effectiveFrom.toISOString(),
      moved: plan.moves.length - unchanged,
      unchanged,
      created: plan.creates.length,
      removed: plan.removes.length,
      kept,
      notesLost: plan.removes.flatMap((id) => {
        const lesson = byId.get(id)!;
        return lesson.topic || lesson.notes
          ? [
              {
                lessonId: lesson.id,
                startsAtUtc: lesson.startsAtUtc.toISOString(),
                topic: lesson.topic,
                hasNotes: Boolean(lesson.notes),
              },
            ]
          : [];
      }),
      conflicts,
    };
    return {
      preview,
      effectiveFrom,
      slots,
      durationMin: dto.durationMin,
      rows,
      until,
      moves: plan.moves,
      removes: plan.removes,
    };
  }

  // -------------------------------------------------------------------------
  // Stop (L-24)
  // -------------------------------------------------------------------------

  async previewStop(
    auth: AuthenticatedUser,
    scheduleId: string,
    dto: StopScheduleDto,
  ): Promise<ScheduleChangePreview> {
    return this.prisma.$transaction(async (tx) => {
      const schedule = await this.activeSchedule(tx, auth, scheduleId);
      return (await this.planStop(tx, schedule, dto)).preview;
    });
  }

  async stop(
    auth: AuthenticatedUser,
    scheduleId: string,
    dto: StopScheduleDto,
  ): Promise<ScheduleChangeResult> {
    const summary = await this.prisma.$transaction((tx) =>
      this.stopInTx(tx, auth, scheduleId, dto),
    );
    return { schedule: await this.getDetail(auth, scheduleId), summary };
  }

  /**
   * Stops a schedule from a date: its scheduled lessons from then on are
   * removed softly; lessons moved by hand, held, cancelled or marked stay.
   */
  async stopInTx(
    tx: Prisma.TransactionClient,
    auth: AuthenticatedUser,
    scheduleId: string,
    dto: StopScheduleDto,
  ): Promise<ScheduleChangePreview> {
    const schedule = await this.activeSchedule(tx, auth, scheduleId);
    if (schedule.groupId) {
      await lockGroupSchedule(tx, auth.workspaceId, schedule.groupId);
    }
    await lockTeacherSchedules(tx, auth.workspaceId, [schedule.teacherId]);
    const plan = await this.planStop(tx, schedule, dto);
    const now = new Date();
    for (const row of plan.rows) {
      await tx.lessonSeries.update({
        where: { id: row.id },
        data:
          row.startDate >= plan.from
            ? {
                deletedAt: row.deletedAt ?? now,
                endsAt: row.startDate,
                scheduleSuspensionToken: null,
              }
            : { endsAt: plan.from },
      });
    }
    if (plan.removes.length > 0) {
      await tx.lesson.updateMany({
        where: { id: { in: plan.removes } },
        data: { deletedAt: now },
      });
    }
    await tx.lesson.updateMany({
      where: {
        seriesId: { in: plan.rows.map((row) => row.id) },
        scheduleSuspensionToken: { not: null },
        startsAtUtc: { gte: plan.from },
      },
      data: { scheduleSuspensionToken: null },
    });
    await tx.schedule.update({
      where: { id: schedule.id },
      data: {
        endsAt: plan.from,
        state: plan.from <= now ? 'ENDED' : 'ACTIVE',
      },
    });
    await this.audit.record(tx, {
      workspaceId: auth.workspaceId,
      actorId: auth.userId,
      action: 'UPDATE',
      entity: 'SCHEDULE',
      entityId: schedule.id,
      changes: this.audit.buildChanges(
        { endsAt: schedule.endsAt },
        { endsAt: plan.from, removed: plan.preview.removed },
      ),
    });
    return plan.preview;
  }

  private async planStop(
    tx: Prisma.TransactionClient,
    schedule: Schedule,
    dto: StopScheduleDto,
  ) {
    const now = new Date();
    const requested = dto.from ? new Date(dto.from) : now;
    const from = requested > now ? requested : now;
    const rows = await tx.lessonSeries.findMany({
      where: {
        scheduleId: schedule.id,
        // Live and still running at the date (two ORs, so AND them).
        AND: [
          liveRowWhere,
          { OR: [{ endsAt: null }, { endsAt: { gt: from } }] },
        ],
      },
    });
    const lessons = await tx.lesson.findMany({
      where: {
        seriesId: { in: rows.map((row) => row.id) },
        deletedAt: null,
        startsAtUtc: { gte: from },
      },
      select: {
        id: true,
        startsAtUtc: true,
        status: true,
        isDetached: true,
        topic: true,
        notes: true,
        _count: { select: { attendance: true } },
      },
    });
    const removable = lessons.filter(
      (lesson) =>
        lesson.status === 'SCHEDULED' &&
        !lesson.isDetached &&
        lesson._count.attendance === 0,
    );
    const preview: ScheduleChangePreview = {
      effectiveFrom: from.toISOString(),
      moved: 0,
      unchanged: 0,
      created: 0,
      removed: removable.length,
      kept: lessons.length - removable.length,
      notesLost: removable
        .filter((lesson) => lesson.topic || lesson.notes)
        .map((lesson) => ({
          lessonId: lesson.id,
          startsAtUtc: lesson.startsAtUtc.toISOString(),
          topic: lesson.topic,
          hasNotes: Boolean(lesson.notes),
        })),
      conflicts: [],
    };
    return {
      preview,
      from,
      rows,
      removes: removable.map((lesson) => lesson.id),
    };
  }

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  /** A longer horizon generates the extra weeks now; a shorter one keeps
   * what is already booked and simply stops topping up that far. */
  async update(
    auth: AuthenticatedUser,
    scheduleId: string,
    dto: UpdateScheduleDto,
  ): Promise<ScheduleResponse> {
    await this.prisma.$transaction(async (tx) => {
      const schedule = await this.activeSchedule(tx, auth, scheduleId);
      await tx.schedule.update({
        where: { id: schedule.id },
        data: { horizonWeeks: dto.horizonWeeks },
      });
      const now = new Date();
      const rows = await tx.lessonSeries.findMany({
        where: {
          scheduleId: schedule.id,
          deletedAt: null,
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
      });
      const horizon = this.materializer.horizonUntil(now, dto.horizonWeeks);
      for (const row of rows) {
        await this.materializer.materializeSeries(
          tx,
          row,
          horizon,
          row.startDate > now ? row.startDate : now,
          true,
        );
      }
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'UPDATE',
        entity: 'SCHEDULE',
        entityId: schedule.id,
        changes: this.audit.buildChanges(
          { horizonWeeks: schedule.horizonWeeks },
          { horizonWeeks: dto.horizonWeeks },
        ),
      });
    });
    return this.getDetail(auth, scheduleId);
  }

  private async activeSchedule(
    tx: Prisma.TransactionClient,
    auth: AuthenticatedUser,
    scheduleId: string,
  ): Promise<Schedule> {
    const schedule = await tx.schedule.findFirst({
      where: { id: scheduleId, workspaceId: auth.workspaceId },
    });
    if (!schedule) throw scheduleNotFound();
    if (schedule.state !== 'ACTIVE') throw scheduleEnded();
    return schedule;
  }
}

/** The calendar day after "yyyy-MM-dd": an inclusive end date's boundary. */
function nextDay(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  return new Date(Date.UTC(y, m - 1, d) + DAY_MS).toISOString().slice(0, 10);
}
