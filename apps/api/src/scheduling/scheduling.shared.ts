import {
  effectiveDeadlineHours,
  findConflicts,
  resolveDefaultPrice,
  toInterval,
} from '@tutorio/domain';
import { Prisma } from '@prisma/client';
import type { CurrencyCode } from '@tutorio/domain';
import type { LessonResponse, LessonSeriesResponse } from '@tutorio/validation';
import {
  groupNotFound,
  invalidWorkspaceRelation,
  studentNotFound,
  teacherNotFound,
} from '../common/business.errors';

// Longest allowed lesson (durationMinSchema max) — the lookback window for
// conflict queries so an earlier lesson that runs long is still considered.
const MAX_DURATION_MIN = 720;

// Statuses that occupy the teacher's time. A cancelled lesson frees its slot.
const BUSY_STATUSES: Prisma.LessonWhereInput['status'] = {
  in: ['SCHEDULED', 'COMPLETED'],
};

export const lessonInclude = {
  // cancellationDeadlineHours travels with the lesson so the cancel dialog can
  // tell the tutor whether cancelling now is late, without a second request.
  enrollment: {
    select: {
      id: true,
      cancellationDeadlineHours: true,
      student: { select: { id: true, fullName: true } },
    },
  },
  group: { select: { id: true, name: true } },
  teacher: { select: { id: true, fullName: true, color: true } },
  workspace: { select: { cancellationDeadlineHours: true } },
} satisfies Prisma.LessonInclude;

export type LessonRow = Prisma.LessonGetPayload<{
  include: typeof lessonInclude;
}>;

export const seriesInclude = {
  enrollment: {
    select: { id: true, student: { select: { id: true, fullName: true } } },
  },
  group: { select: { id: true, name: true } },
  teacher: { select: { id: true, fullName: true, color: true } },
} satisfies Prisma.LessonSeriesInclude;

export type SeriesRow = Prisma.LessonSeriesGetPayload<{
  include: typeof seriesInclude;
}>;

export function toLessonResponse(row: LessonRow): LessonResponse {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    enrollmentId: row.enrollmentId,
    groupId: row.groupId,
    seriesId: row.seriesId,
    packageId: row.packageId,
    teacherId: row.teacherId,
    startsAtUtc: row.startsAtUtc.toISOString(),
    durationMin: row.durationMin,
    priceMinor: row.priceMinor,
    currency: row.currency as LessonResponse['currency'],
    status: row.status,
    isDetached: row.isDetached,
    cancelledBy: row.cancelledBy,
    cancelledReason: row.cancelledReason,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    notes: row.notes,
    cancellationDeadlineHours: effectiveDeadlineHours(
      row.enrollment?.cancellationDeadlineHours,
      row.workspace.cancellationDeadlineHours,
    ),
    student: row.enrollment?.student ?? null,
    group: row.group,
    teacher: {
      id: row.teacher.id,
      name: row.teacher.fullName,
      color: row.teacher.color,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

export function toSeriesResponse(row: SeriesRow): LessonSeriesResponse {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    enrollmentId: row.enrollmentId,
    groupId: row.groupId,
    packageId: row.packageId,
    teacherId: row.teacherId,
    weekdays: row.weekdays,
    localTime: row.localTime,
    timezone: row.timezone,
    durationMin: row.durationMin,
    priceMinor: row.priceMinor,
    currency: row.currency as LessonSeriesResponse['currency'],
    startDate: row.startDate.toISOString(),
    horizonMaterializedUntil: row.horizonMaterializedUntil.toISOString(),
    student: row.enrollment?.student ?? null,
    group: row.group,
    teacher: {
      id: row.teacher.id,
      name: row.teacher.fullName,
      color: row.teacher.color,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

/**
 * Validates that the lesson/series target and teacher belong to the workspace
 * and are live. Cross-workspace or missing IDs raise the same not-found error
 * as truly absent records.
 */
export async function assertTargetAndTeacher(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  target: {
    enrollmentId?: string | null;
    groupId?: string | null;
    teacherId: string;
  },
): Promise<void> {
  if (target.enrollmentId) {
    const enrollment = await tx.enrollment.findFirst({
      where: { id: target.enrollmentId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!enrollment) {
      throw invalidWorkspaceRelation();
    }
  }
  if (target.groupId) {
    const group = await tx.group.findFirst({
      where: { id: target.groupId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!group) {
      throw groupNotFound();
    }
  }
  const teacher = await tx.teacher.findFirst({
    where: { id: target.teacherId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!teacher) {
    throw teacherNotFound();
  }
}

/**
 * What booking "for a student" resolves to: a concrete enrollment, teacher and
 * price. `createdEnrollment` tells the caller to audit a new enrollment row.
 */
export interface ResolvedStudentTarget {
  enrollmentId: string;
  teacherId: string;
  priceMinor: number;
  currency: string;
  createdEnrollment: boolean;
}

/**
 * Resolves a bare `studentId` into a bookable enrollment so tutors never have
 * to name an "enrollment" to schedule a lesson.
 *
 * Reuses the student's single active individual enrollment when one exists;
 * otherwise creates a default one. The teacher is taken from the explicit
 * argument, then from that enrollment, then from the workspace when it has
 * exactly one teacher — anything ambiguous is rejected rather than guessed.
 * The price falls back through student → group → teacher (`resolveDefaultPrice`).
 */
export async function resolveStudentTarget(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  input: {
    studentId: string;
    teacherId?: string | null;
    priceMinor?: number | null;
    currency?: string | null;
    defaultCancellationDeadlineHours?: number | null;
  },
): Promise<ResolvedStudentTarget> {
  const student = await tx.student.findFirst({
    where: { id: input.studentId, workspaceId },
    select: { id: true, hourlyRateMinor: true, currency: true },
  });
  if (!student) {
    throw studentNotFound();
  }

  if (input.teacherId) {
    const teacher = await tx.teacher.findFirst({
      where: { id: input.teacherId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) {
      throw teacherNotFound();
    }
  }

  // Prefer an existing active individual enrollment, optionally narrowed to the
  // requested teacher.
  const existing = await tx.enrollment.findFirst({
    where: {
      workspaceId,
      studentId: student.id,
      groupId: null,
      status: 'ACTIVE',
      deletedAt: null,
      ...(input.teacherId ? { teacherId: input.teacherId } : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, teacherId: true, priceMinor: true, currency: true },
  });

  if (existing) {
    return {
      enrollmentId: existing.id,
      teacherId: existing.teacherId,
      priceMinor: input.priceMinor ?? existing.priceMinor,
      currency: input.currency ?? existing.currency,
      createdEnrollment: false,
    };
  }

  // No enrollment yet — pick the teacher, refusing to guess when ambiguous.
  let teacherId = input.teacherId ?? null;
  let teacherRate: { amountMinor?: number | null; currency?: string | null } =
    {};
  if (teacherId) {
    const teacher = await tx.teacher.findFirstOrThrow({
      where: { id: teacherId, workspaceId, deletedAt: null },
      select: { defaultRateMinor: true, currency: true },
    });
    teacherRate = {
      amountMinor: teacher.defaultRateMinor,
      currency: teacher.currency,
    };
  } else {
    const teachers = await tx.teacher.findMany({
      where: { workspaceId, deletedAt: null, status: 'ACTIVE' },
      take: 2,
      select: { id: true, defaultRateMinor: true, currency: true },
    });
    if (teachers.length !== 1) {
      throw teacherNotFound();
    }
    teacherId = teachers[0].id;
    teacherRate = {
      amountMinor: teachers[0].defaultRateMinor,
      currency: teachers[0].currency,
    };
  }

  const resolvedPrice =
    input.priceMinor != null && input.currency != null
      ? { priceMinor: input.priceMinor, currency: input.currency }
      : (resolveDefaultPrice({
          student: {
            amountMinor: student.hourlyRateMinor,
            currency: student.currency as CurrencyCode | null,
          },
          teacher: {
            amountMinor: teacherRate.amountMinor,
            currency: teacherRate.currency as CurrencyCode | null,
          },
        }) ?? { priceMinor: 0, currency: student.currency ?? 'EUR' });

  const created = await tx.enrollment.create({
    data: {
      workspaceId,
      studentId: student.id,
      groupId: null,
      teacherId,
      status: 'ACTIVE',
      billingType: 'PACKAGE',
      priceMinor: resolvedPrice.priceMinor,
      currency: resolvedPrice.currency,
      cancellationDeadlineHours: input.defaultCancellationDeadlineHours ?? null,
    },
    select: { id: true },
  });

  return {
    enrollmentId: created.id,
    teacherId,
    priceMinor: resolvedPrice.priceMinor,
    currency: resolvedPrice.currency,
    createdEnrollment: true,
  };
}

/**
 * Returns the ids of busy lessons overlapping [start, start+duration) for the
 * teacher. Empty means the slot is free. `excludeLessonId` skips the lesson
 * being rescheduled so it does not conflict with itself.
 */
export async function findLessonConflicts(
  tx: Prisma.TransactionClient,
  params: {
    workspaceId: string;
    teacherId: string;
    start: Date;
    durationMin: number;
    excludeLessonId?: string;
  },
): Promise<string[]> {
  const candidate = toInterval(params.start, params.durationMin);
  const rows = await tx.lesson.findMany({
    where: {
      workspaceId: params.workspaceId,
      teacherId: params.teacherId,
      deletedAt: null,
      status: BUSY_STATUSES,
      ...(params.excludeLessonId
        ? { id: { not: params.excludeLessonId } }
        : {}),
      startsAtUtc: {
        gte: new Date(params.start.getTime() - MAX_DURATION_MIN * 60_000),
        lt: candidate.end,
      },
    },
    select: { id: true, startsAtUtc: true, durationMin: true },
  });
  const busy = rows.map((row) => ({
    ...toInterval(row.startsAtUtc, row.durationMin),
    id: row.id,
  }));
  return findConflicts(candidate, busy).map((conflict) => conflict.id);
}

/** The local wall-clock "HH:mm" of a UTC instant in `timezone`, using Intl only. */
export function localHourMinute(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}
