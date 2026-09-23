import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { findConflicts, toInterval, type BusyInterval } from '@tutorio/domain';
import { scheduleConflict } from '../common/business.errors';
import { BUSY_STATUSES, MAX_DURATION_MIN } from './scheduling.shared';

export type ScheduledLessonSlot = {
  id: string;
  teacherId: string;
  startsAtUtc: Date;
  durationMin: number;
};

/**
 * Takes transaction-scoped advisory locks for every key in one statement.
 * Keys are locked in byte order (JS sort and `COLLATE "C"` agree), so every
 * caller acquires overlapping key sets in the same order and cannot deadlock.
 */
async function lockKeys(
  tx: Prisma.TransactionClient,
  keys: Iterable<string>,
): Promise<void> {
  if (typeof tx.$executeRaw !== 'function') return;
  const sorted = [...new Set(keys)].sort();
  if (sorted.length === 0) return;
  if (sorted.length === 1) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${sorted[0]}))`;
    return;
  }
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(s.k)) FROM (SELECT u.k FROM unnest(${sorted}::text[]) AS u(k) ORDER BY u.k COLLATE "C") AS s`;
}

/**
 * PostgreSQL transaction advisory locks serialize schedule decisions without a
 * coarse table lock. The guard keeps focused unit mocks lightweight; production
 * Prisma transaction clients always provide $executeRaw.
 */
export async function lockTeacherSchedules(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  teacherIds: Iterable<string>,
): Promise<void> {
  await lockKeys(
    tx,
    [...teacherIds].map((teacherId) => `${workspaceId}:teacher:${teacherId}`),
  );
}

export async function lockGroupSchedule(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  groupId: string,
): Promise<void> {
  await lockKeys(tx, [`${workspaceId}:group:${groupId}`]);
}

/**
 * Student lifecycle changes are ordered before group and teacher schedule
 * locks. Enrollment creation takes the same lock, so an archive cannot miss a
 * concurrently-added membership or individual target.
 */
export async function lockStudentLifecycles(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  studentIds: Iterable<string>,
): Promise<void> {
  await lockKeys(
    tx,
    [...studentIds].map((studentId) => `${workspaceId}:student:${studentId}`),
  );
}

/**
 * Throws SCHEDULE_CONFLICT when any lesson would overlap a live busy lesson of
 * its teacher, or another lesson in the same batch. One query covers the whole
 * batch: every busy lesson of the involved teachers that starts within
 * [earliest start − longest duration, latest end), then overlaps are checked
 * in memory. The batch's own ids and `excludeIds` never count as busy, so a
 * lesson being moved does not conflict with its current slot.
 */
export async function assertLessonsAreFree(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  lessons: readonly ScheduledLessonSlot[],
  options: { excludeIds?: Iterable<string> } = {},
): Promise<void> {
  if (lessons.length === 0) return;

  const candidates = lessons.map((lesson) => ({
    ...toInterval(lesson.startsAtUtc, lesson.durationMin),
    id: lesson.id,
    teacherId: lesson.teacherId,
  }));
  const excluded = [
    ...new Set([
      ...candidates.map((candidate) => candidate.id),
      ...(options.excludeIds ?? []),
    ]),
  ];
  const earliestStart = Math.min(
    ...candidates.map((candidate) => candidate.start.getTime()),
  );
  const latestEnd = Math.max(
    ...candidates.map((candidate) => candidate.end.getTime()),
  );

  const rows = await tx.lesson.findMany({
    where: {
      workspaceId,
      teacherId: {
        in: [...new Set(candidates.map((candidate) => candidate.teacherId))],
      },
      deletedAt: null,
      status: BUSY_STATUSES,
      id: { notIn: excluded },
      startsAtUtc: {
        gte: new Date(earliestStart - MAX_DURATION_MIN * 60_000),
        lt: new Date(latestEnd),
      },
    },
    select: { id: true, teacherId: true, startsAtUtc: true, durationMin: true },
  });

  const busyByTeacher = new Map<string, BusyInterval[]>();
  for (const row of rows) {
    const busy = busyByTeacher.get(row.teacherId) ?? [];
    busy.push({ ...toInterval(row.startsAtUtc, row.durationMin), id: row.id });
    busyByTeacher.set(row.teacherId, busy);
  }

  const conflictIds = new Set<string>();
  const accepted = new Map<string, BusyInterval[]>();
  for (const candidate of candidates) {
    const earlier = accepted.get(candidate.teacherId) ?? [];
    for (const conflict of findConflicts(candidate, [
      ...(busyByTeacher.get(candidate.teacherId) ?? []),
      ...earlier,
    ])) {
      conflictIds.add(conflict.id);
    }
    earlier.push({
      start: candidate.start,
      end: candidate.end,
      id: candidate.id,
    });
    accepted.set(candidate.teacherId, earlier);
  }
  if (conflictIds.size) {
    throw scheduleConflict([...conflictIds]);
  }
}

export async function suspendEnrollmentSchedule(
  tx: Prisma.TransactionClient,
  enrollmentId: string,
  now: Date,
): Promise<string> {
  const token = randomUUID();
  await tx.lessonSeries.updateMany({
    where: { enrollmentId, deletedAt: null },
    data: { deletedAt: now, scheduleSuspensionToken: token },
  });
  await tx.lesson.updateMany({
    where: {
      enrollmentId,
      status: 'SCHEDULED',
      deletedAt: null,
      startsAtUtc: { gte: now },
    },
    data: { deletedAt: now, scheduleSuspensionToken: token },
  });
  return token;
}

export async function restoreEnrollmentSchedule(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  enrollmentId: string,
  token: string,
  now: Date,
): Promise<void> {
  const lessons = await tx.lesson.findMany({
    where: {
      workspaceId,
      enrollmentId,
      status: 'SCHEDULED',
      scheduleSuspensionToken: token,
      startsAtUtc: { gte: now },
    },
    select: { id: true, teacherId: true, startsAtUtc: true, durationMin: true },
  });
  await lockTeacherSchedules(
    tx,
    workspaceId,
    lessons.map((lesson) => lesson.teacherId),
  );
  await assertLessonsAreFree(tx, workspaceId, lessons);
  await tx.lessonSeries.updateMany({
    where: { enrollmentId, scheduleSuspensionToken: token },
    data: { deletedAt: null, scheduleSuspensionToken: null },
  });
  await tx.lesson.updateMany({
    where: {
      enrollmentId,
      status: 'SCHEDULED',
      scheduleSuspensionToken: token,
      startsAtUtc: { gte: now },
    },
    data: { deletedAt: null, scheduleSuspensionToken: null },
  });
}

/** Reconciles the one shared group schedule when the active roster changes. */
export async function reconcileGroupSchedule(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  groupId: string,
  now: Date,
): Promise<void> {
  await lockGroupSchedule(tx, workspaceId, groupId);
  const group = await tx.group.findFirst({
    where: { id: groupId, workspaceId },
    select: { id: true, deletedAt: true, rosterSuspensionToken: true },
  });
  if (!group || group.deletedAt) return;

  const activeCount = await tx.enrollment.count({
    where: {
      workspaceId,
      groupId,
      deletedAt: null,
      status: 'ACTIVE',
      student: { deletedAt: null, status: { not: 'ARCHIVED' } },
    },
  });
  if (activeCount === 0 && !group.rosterSuspensionToken) {
    const token = randomUUID();
    const marked = await tx.group.updateMany({
      where: { id: groupId, rosterSuspensionToken: null },
      data: { rosterSuspensionToken: token },
    });
    if (!marked.count) return;
    await tx.lessonSeries.updateMany({
      where: { groupId, deletedAt: null },
      data: { deletedAt: now, scheduleSuspensionToken: token },
    });
    await tx.lesson.updateMany({
      where: {
        groupId,
        status: 'SCHEDULED',
        deletedAt: null,
        startsAtUtc: { gte: now },
      },
      data: { deletedAt: now, scheduleSuspensionToken: token },
    });
    return;
  }
  if (activeCount === 0 || !group.rosterSuspensionToken) return;

  const token = group.rosterSuspensionToken;
  const lessons = await tx.lesson.findMany({
    where: {
      workspaceId,
      groupId,
      status: 'SCHEDULED',
      scheduleSuspensionToken: token,
      startsAtUtc: { gte: now },
    },
    select: { id: true, teacherId: true, startsAtUtc: true, durationMin: true },
  });
  await lockTeacherSchedules(
    tx,
    workspaceId,
    lessons.map((lesson) => lesson.teacherId),
  );
  await assertLessonsAreFree(tx, workspaceId, lessons);
  await tx.lessonSeries.updateMany({
    where: { groupId, scheduleSuspensionToken: token },
    data: { deletedAt: null, scheduleSuspensionToken: null },
  });
  await tx.lesson.updateMany({
    where: {
      groupId,
      status: 'SCHEDULED',
      scheduleSuspensionToken: token,
      startsAtUtc: { gte: now },
    },
    data: { deletedAt: null, scheduleSuspensionToken: null },
  });
  await tx.group.updateMany({
    where: { id: groupId, rosterSuspensionToken: token },
    data: { rosterSuspensionToken: null },
  });
}
