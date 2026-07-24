import { findConflicts, toInterval } from '@tutorio/domain';
import { Prisma } from '@prisma/client';
import type { LessonResponse, LessonSeriesResponse } from '@tutorio/validation';
import {
  groupNotFound,
  invalidWorkspaceRelation,
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
  enrollment: {
    select: { id: true, student: { select: { id: true, fullName: true } } },
  },
  group: { select: { id: true, name: true } },
  teacher: { select: { id: true, fullName: true, color: true } },
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
    student: row.enrollment?.student ?? null,
    group: row.group,
    teacher: { id: row.teacher.id, name: row.teacher.fullName, color: row.teacher.color },
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
    teacher: { id: row.teacher.id, name: row.teacher.fullName, color: row.teacher.color },
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
