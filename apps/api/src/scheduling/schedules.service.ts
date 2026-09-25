import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type Lesson,
  type LessonSeries,
  type Schedule,
} from '@prisma/client';
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
  KeptReasonDto,
  ListSchedulesQueryDto,
  ScheduleChangeDto,
  ScheduleChangePreview,
  ScheduleChangeResult,
  ScheduleCreatePreview,
  ScheduleHorizonPreview,
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
  noPlannedChange,
  scheduleConflict,
  scheduleEnded,
  scheduleExists,
  scheduleNotFound,
  studentNotFound,
  teacherNotFound,
} from '../common/business.errors';
import { buildPaginatedResponse, toSkipTake } from '../common/pagination';
import { liveEnrollmentWhere } from '../groups/groups.shared';
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
}

const scheduleInclude = {
  enrollment: {
    select: {
      student: { select: { id: true, fullName: true, avatarKey: true } },
    },
  },
  group: {
    select: {
      id: true,
      name: true,
      _count: { select: { enrollments: { where: liveEnrollmentWhere } } },
    },
  },
  teacher: { select: { id: true, fullName: true } },
} satisfies Prisma.ScheduleInclude;

type ScheduleAvatarKey = NonNullable<ScheduleResponse['student']>['avatarKey'];

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

/** Whether two versions of a rule meet on the same days, times and length. */
function sameRule(
  a: readonly Pick<LessonSeries, 'weekdays' | 'localTime' | 'durationMin'>[],
  b: readonly Pick<LessonSeries, 'weekdays' | 'localTime' | 'durationMin'>[],
): boolean {
  const key = (rows: typeof a) =>
    JSON.stringify({
      slots: slotsOf(rows),
      lengths: [...new Set(rows.map((row) => row.durationMin))].sort(),
    });
  return key(a) === key(b);
}

/**
 * The change planned after the rule in force at `now`: the first later
 * version that differs from the one before it (a cancelled change leaves a
 * version equal to its predecessor, which is no change). Null when none.
 */
export function plannedChangeOf<
  T extends Pick<
    LessonSeries,
    'startDate' | 'endsAt' | 'weekdays' | 'localTime' | 'durationMin'
  >,
>(rows: readonly T[], now: Date): { effectiveFrom: Date; rows: T[] } | null {
  const current = currentVersionRows(rows, now);
  const later = rows.filter(
    (row) =>
      row.startDate > now &&
      !current.includes(row) &&
      (!row.endsAt || row.endsAt > now),
  );
  const starts = [...new Set(later.map((row) => row.startDate.getTime()))].sort(
    (a, b) => a - b,
  );
  let previous = current;
  for (const start of starts) {
    const version = later.filter((row) => row.startDate.getTime() === start);
    if (!sameRule(previous, version)) {
      return { effectiveFrom: new Date(start), rows: version };
    }
    previous = version;
  }
  return null;
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
    const now = new Date();
    const contains = query.search
      ? { contains: query.search, mode: 'insensitive' as const }
      : null;
    // Every filter but the state: the state tabs count against it.
    const base: Prisma.ScheduleWhereInput = {
      workspaceId: auth.workspaceId,
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.studentId
        ? { enrollment: { studentId: query.studentId } }
        : {}),
      ...(query.kind === 'group' ? { groupId: { not: null } } : {}),
      ...(query.kind === 'individual' ? { groupId: null } : {}),
      ...(contains
        ? {
            OR: [
              { enrollment: { student: { fullName: contains } } },
              { group: { name: contains } },
              { teacher: { fullName: contains } },
            ],
          }
        : {}),
    };
    const changing = await this.changingScheduleIds(this.prisma, base, now);
    const where: Prisma.ScheduleWhereInput =
      query.state === 'all'
        ? base
        : query.state === 'CHANGING'
          ? { AND: [base, { id: { in: changing } }] }
          : { AND: [base, { state: query.state }] };

    const [total, active, ended, all] = await Promise.all([
      this.prisma.schedule.count({ where }),
      this.prisma.schedule.count({
        where: { AND: [base, { state: 'ACTIVE' }] },
      }),
      this.prisma.schedule.count({
        where: { AND: [base, { state: 'ENDED' }] },
      }),
      this.prisma.schedule.count({ where: base }),
    ]);
    const rows =
      query.sort === 'next'
        ? await this.pageByNextLesson(where, query, now)
        : await this.prisma.schedule.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            ...toSkipTake(query),
            include: scheduleInclude,
          });
    const items = await this.toResponses(this.prisma, rows);
    return {
      ...buildPaginatedResponse(items, total, query),
      counts: { active, changing: changing.length, ended, all },
    };
  }

  /**
   * The active schedules with a change planned for later: a rule that starts
   * after the one in force now (the same reading as `nextChange`).
   */
  private async changingScheduleIds(
    db: Prisma.TransactionClient,
    where: Prisma.ScheduleWhereInput,
    now: Date,
  ): Promise<string[]> {
    const rows = await db.lessonSeries.findMany({
      where: {
        schedule: { AND: [where, { state: 'ACTIVE' }] },
        ...liveRowWhere,
      },
      select: {
        id: true,
        scheduleId: true,
        startDate: true,
        endsAt: true,
        weekdays: true,
        localTime: true,
        durationMin: true,
      },
    });
    const bySchedule = new Map<string, typeof rows>();
    for (const row of rows) {
      bySchedule.set(row.scheduleId, [
        ...(bySchedule.get(row.scheduleId) ?? []),
        row,
      ]);
    }
    return [...bySchedule]
      .filter(([, own]) => plannedChangeOf(own, now) !== null)
      .map(([id]) => id);
  }

  /**
   * One page of schedules by their next lesson, soonest first; schedules with
   * none follow, newest first. The next lesson is not a column, so the order
   * is worked out over the ids that match (a studio has hundreds at most).
   */
  private async pageByNextLesson(
    where: Prisma.ScheduleWhereInput,
    query: ListSchedulesQueryDto,
    now: Date,
  ): Promise<ScheduleRow[]> {
    const matching = await this.prisma.schedule.findMany({
      where,
      select: { id: true, createdAt: true },
    });
    const ids = matching.map((schedule) => schedule.id);
    const [series, next] = await Promise.all([
      this.prisma.lessonSeries.findMany({
        where: { scheduleId: { in: ids } },
        select: { id: true, scheduleId: true },
      }),
      this.prisma.lesson.groupBy({
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
    const scheduleOf = new Map(series.map((row) => [row.id, row.scheduleId]));
    const nextOf = new Map<string, number>();
    for (const entry of next) {
      const scheduleId = entry.seriesId && scheduleOf.get(entry.seriesId);
      const at = entry._min.startsAtUtc?.getTime();
      if (!scheduleId || at === undefined) continue;
      nextOf.set(scheduleId, Math.min(nextOf.get(scheduleId) ?? at, at));
    }
    const ordered = [...matching].sort((left, right) => {
      const a = nextOf.get(left.id) ?? Infinity;
      const b = nextOf.get(right.id) ?? Infinity;
      if (a !== b) return a < b ? -1 : 1;
      return right.createdAt.getTime() - left.createdAt.getTime();
    });
    const { skip, take } = toSkipTake(query);
    const pageIds = ordered.slice(skip, skip + take).map((row) => row.id);
    const rows = await this.prisma.schedule.findMany({
      where: { id: { in: pageIds } },
      include: scheduleInclude,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return pageIds.flatMap((id) => byId.get(id) ?? []);
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
        _max: { startsAtUtc: true },
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
    const lastBySeries = new Map(
      next.map((entry) => [entry.seriesId, entry._max.startsAtUtc]),
    );
    const dates = (values: (Date | null | undefined)[]) =>
      values
        .filter((value): value is Date => value instanceof Date)
        .sort((a, b) => a.getTime() - b.getTime());

    return schedules.map((schedule) => {
      const own = rowsBySchedule.get(schedule.id) ?? [];
      const current = currentVersionRows(own, now);
      const planned = plannedChangeOf(own, now);
      const everyRow = allRows.filter((row) => row.scheduleId === schedule.id);
      const nextLessonAt = dates(
        everyRow.map((row) => nextBySeries.get(row.id)),
      )[0];
      const lastLessonAt = dates(
        everyRow.map((row) => lastBySeries.get(row.id)),
      ).at(-1);
      const startsAt = dates(everyRow.map((row) => row.startDate))[0];
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
        nextChange: planned
          ? {
              effectiveFrom: planned.effectiveFrom.toISOString(),
              slots: slotsOf(planned.rows),
            }
          : null,
        nextLessonAt: nextLessonAt?.toISOString() ?? null,
        startsAt: startsAt?.toISOString() ?? null,
        lastLessonAt: lastLessonAt?.toISOString() ?? null,
        student: schedule.enrollment
          ? {
              ...schedule.enrollment.student,
              avatarKey: schedule.enrollment.student
                .avatarKey as ScheduleAvatarKey,
            }
          : null,
        group: schedule.group
          ? {
              id: schedule.group.id,
              name: schedule.group.name,
              memberCount: schedule.group._count.enrollments,
            }
          : null,
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
   * What creating the schedule would do, writing nothing (L-22, L-110): the
   * same target, the lessons it generates at once and the same conflict check
   * as `create`. A student with no direction with the teacher yet is checked
   * as that student, without opening the direction (L-2).
   */
  async previewCreate(
    auth: AuthenticatedUser,
    dto: CreateScheduleDto,
  ): Promise<ScheduleCreatePreview> {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findUniqueOrThrow({
        where: { id: auth.workspaceId },
        select: { timezone: true, scheduleHorizonWeeks: true },
      });
      let enrollmentId = dto.enrollmentId ?? null;
      const groupId = dto.groupId ?? null;
      let teacherId = dto.teacherId ?? null;
      let studentId: string | null = null;

      if (dto.studentId) {
        const student = await tx.student.findFirst({
          where: {
            id: dto.studentId,
            workspaceId: auth.workspaceId,
            deletedAt: null,
            status: { not: 'ARCHIVED' },
          },
          select: { id: true },
        });
        if (!student) throw studentNotFound();
        const direction = await tx.enrollment.findFirst({
          where: {
            workspaceId: auth.workspaceId,
            studentId: student.id,
            groupId: null,
            status: 'ACTIVE',
            deletedAt: null,
            ...(teacherId ? { teacherId } : {}),
          },
          orderBy: { createdAt: 'asc' },
          select: { id: true, teacherId: true },
        });
        enrollmentId = direction?.id ?? null;
        teacherId = teacherId ?? direction?.teacherId ?? null;
        if (!direction) studentId = student.id;
        if (!teacherId) {
          // As the create does: the studio's one teacher, never a guess.
          const teachers = await tx.teacher.findMany({
            where: {
              workspaceId: auth.workspaceId,
              deletedAt: null,
              status: 'ACTIVE',
            },
            take: 2,
            select: { id: true },
          });
          if (teachers.length !== 1) throw teacherNotFound();
          teacherId = teachers[0].id;
        }
      } else if (enrollmentId) {
        const enrollment = await tx.enrollment.findFirst({
          where: { id: enrollmentId, workspaceId: auth.workspaceId },
          select: { teacherId: true },
        });
        teacherId = teacherId ?? enrollment?.teacherId ?? null;
      } else if (groupId) {
        const group = await tx.group.findFirst({
          where: {
            id: groupId,
            workspaceId: auth.workspaceId,
            deletedAt: null,
          },
          select: { teacherId: true },
        });
        if (!group) throw groupNotFound();
        teacherId = group.teacherId;
        if (!teacherId) throw groupTeacherRequired();
      }
      await assertTargetAndTeacher(tx, auth.workspaceId, {
        enrollmentId,
        groupId,
        teacherId: teacherId ?? '',
      });

      const existing =
        enrollmentId || groupId
          ? await tx.schedule.findFirst({
              where: {
                workspaceId: auth.workspaceId,
                state: 'ACTIVE',
                ...(enrollmentId ? { enrollmentId } : { groupId }),
              },
              select: { id: true },
            })
          : null;
      const timezone = dto.timezone ?? workspace.timezone;
      const occurrences = this.firstOccurrences(
        {
          slots: normalizeSlots(dto.slots),
          timezone,
          startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
          endsAt: dto.endsOn
            ? localDateStartUtc(nextDay(dto.endsOn), timezone)
            : null,
          horizonWeeks: dto.horizonWeeks ?? workspace.scheduleHorizonWeeks,
        },
        new Date(),
      );
      const conflicts = await detectScheduleConflicts(
        tx,
        auth.workspaceId,
        occurrences.map((occurrence, index) => ({
          id: `new:${index}`,
          startsAtUtc: occurrence.startsAtUtc,
          durationMin: dto.durationMin,
          teacherId: teacherId!,
          enrollmentId,
          groupId,
          studentId,
        })),
      );
      return {
        created: occurrences.length,
        dates: occurrences.map((occurrence) =>
          occurrence.startsAtUtc.toISOString(),
        ),
        firstLessonAt: occurrences[0]?.startsAtUtc.toISOString() ?? null,
        existingScheduleId: existing?.id ?? null,
        conflicts,
      };
    });
  }

  /**
   * The lessons a new schedule generates at once: its occurrences from the
   * later of the start and now to the earlier of the end and the horizon.
   */
  private firstOccurrences(
    input: Pick<
      NewSchedule,
      'slots' | 'timezone' | 'startDate' | 'endsAt' | 'horizonWeeks'
    >,
    now: Date,
  ) {
    const from = input.startDate > now ? input.startDate : now;
    const horizon = this.materializer.horizonUntil(now, input.horizonWeeks);
    const until =
      input.endsAt && input.endsAt < horizon ? input.endsAt : horizon;
    return expandSchedule(normalizeSlots(input.slots), {
      timezone: input.timezone,
      startDate: input.startDate,
      from,
      until,
    });
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
      const occurrences = this.firstOccurrences(input, now);
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
    const keptLessons = keptLessonsOf(lessons, changeable);

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

    const moved = plan.moves.filter((move) => {
      const lesson = byId.get(move.lessonId)!;
      return (
        lesson.startsAtUtc.getTime() !== move.to.startsAtUtc.getTime() ||
        lesson.durationMin !== dto.durationMin
      );
    });
    const preview: ScheduleChangePreview = {
      effectiveFrom: effectiveFrom.toISOString(),
      moved: plan.moves.length - unchanged,
      unchanged,
      created: plan.creates.length,
      removed: plan.removes.length,
      kept: keptLessons.length,
      moves: moved.map((move) => ({
        lessonId: move.lessonId,
        startsAtUtc: byId.get(move.lessonId)!.startsAtUtc.toISOString(),
        toStartsAtUtc: move.to.startsAtUtc.toISOString(),
      })),
      removals: plan.removes.map((id) => ({
        lessonId: id,
        startsAtUtc: byId.get(id)!.startsAtUtc.toISOString(),
      })),
      creates: plan.creates.map((occurrence) =>
        occurrence.startsAtUtc.toISOString(),
      ),
      keptLessons,
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

  /**
   * Takes back the change planned for later: the rule in force before it
   * applies again from the change's date, through the change path, so the
   * lessons it moved move back with their topic and notes (L-26) and the
   * ones it created are removed. SCHEDULE_CONFLICT unless `force`.
   */
  async cancelChange(
    auth: AuthenticatedUser,
    scheduleId: string,
    force: boolean,
  ): Promise<ScheduleChangeResult> {
    const summary = await this.prisma.$transaction(async (tx) => {
      const schedule = await this.activeSchedule(tx, auth, scheduleId);
      const rows = await tx.lessonSeries.findMany({
        where: { scheduleId: schedule.id, ...liveRowWhere },
      });
      const planned = plannedChangeOf(rows, new Date());
      if (!planned) throw noPlannedChange();
      const before = currentVersionRows(
        rows,
        new Date(planned.effectiveFrom.getTime() - 1),
      );
      if (before.length === 0) throw noPlannedChange();
      return this.changeInTx(
        tx,
        auth,
        schedule.id,
        {
          effectiveFrom: planned.effectiveFrom.toISOString(),
          slots: slotsOf(before),
          durationMin: before[0].durationMin,
        },
        force,
      );
    });
    return { schedule: await this.getDetail(auth, scheduleId), summary };
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
    const keptLessons = keptLessonsOf(lessons, removable);
    const preview: ScheduleChangePreview = {
      effectiveFrom: from.toISOString(),
      moved: 0,
      unchanged: 0,
      created: 0,
      removed: removable.length,
      kept: keptLessons.length,
      moves: [],
      removals: removable.map((lesson) => ({
        lessonId: lesson.id,
        startsAtUtc: lesson.startsAtUtc.toISOString(),
      })),
      creates: [],
      keptLessons,
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
      await this.applyHorizon(tx, schedule, dto.horizonWeeks);
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

  /**
   * What saving a horizon would add, found by saving it in a transaction that
   * is then rolled back, so the preview can never drift from the apply.
   */
  async previewHorizon(
    auth: AuthenticatedUser,
    scheduleId: string,
    dto: UpdateScheduleDto,
  ): Promise<ScheduleHorizonPreview> {
    // Filled inside the transaction that is then rolled back.
    const result: { preview?: ScheduleHorizonPreview } = {};
    try {
      await this.prisma.$transaction(async (tx) => {
        const schedule = await this.activeSchedule(tx, auth, scheduleId);
        const added = await this.applyHorizon(tx, schedule, dto.horizonWeeks);
        const last = await tx.lesson.aggregate({
          where: {
            series: { scheduleId: schedule.id },
            deletedAt: null,
            status: 'SCHEDULED',
            startsAtUtc: { gte: new Date() },
          },
          _max: { startsAtUtc: true },
        });
        result.preview = {
          horizonWeeks: dto.horizonWeeks,
          added: added.length,
          dates: added.map((date) => date.toISOString()),
          lastLessonAt: last._max.startsAtUtc?.toISOString() ?? null,
        };
        throw new HorizonPreviewRollback();
      });
    } catch (error) {
      if (!(error instanceof HorizonPreviewRollback)) throw error;
    }
    return result.preview!;
  }

  /**
   * Sets the horizon and generates the weeks it adds; a shorter horizon keeps
   * what is booked. Returns the starts of the lessons it created.
   */
  private async applyHorizon(
    tx: Prisma.TransactionClient,
    schedule: Schedule,
    horizonWeeks: number,
  ): Promise<Date[]> {
    await tx.schedule.update({
      where: { id: schedule.id },
      data: { horizonWeeks },
    });
    const now = new Date();
    const rows = await tx.lessonSeries.findMany({
      where: {
        scheduleId: schedule.id,
        deletedAt: null,
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
    });
    const horizon = this.materializer.horizonUntil(now, horizonWeeks);
    const created: Date[] = [];
    for (const row of rows) {
      created.push(
        ...(await this.materializer.materializeSeries(
          tx,
          row,
          horizon,
          row.startDate > now ? row.startDate : now,
          true,
        )),
      );
    }
    return created.sort((a, b) => a.getTime() - b.getTime());
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

/** Thrown to roll a horizon preview's transaction back. */
class HorizonPreviewRollback extends Error {}

/**
 * The lessons a change or a stop leaves alone, soonest first, and why (L-27):
 * held, cancelled or missed, moved by hand, or with attendance marked.
 */
function keptLessonsOf<
  T extends {
    id: string;
    startsAtUtc: Date;
    status: Lesson['status'];
    isDetached: boolean;
  },
>(lessons: readonly T[], touched: readonly T[]) {
  const reasonOf = (lesson: T): KeptReasonDto => {
    if (lesson.status === 'COMPLETED') return 'HELD';
    if (lesson.status === 'NO_SHOW') return 'NO_SHOW';
    if (lesson.status !== 'SCHEDULED') return 'CANCELLED';
    return lesson.isDetached ? 'MOVED' : 'MARKED';
  };
  return lessons
    .filter((lesson) => !touched.includes(lesson))
    .sort((a, b) => a.startsAtUtc.getTime() - b.startsAtUtc.getTime())
    .map((lesson) => ({
      lessonId: lesson.id,
      startsAtUtc: lesson.startsAtUtc.toISOString(),
      reason: reasonOf(lesson),
    }));
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
