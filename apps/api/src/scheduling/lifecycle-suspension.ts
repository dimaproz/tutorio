import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { findConflicts, toInterval } from '@tutorio/domain';
import { scheduleConflict } from '../common/business.errors';

type SuspendedLesson = {
  id: string;
  teacherId: string;
  startsAtUtc: Date;
  durationMin: number;
};

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
  if (typeof tx.$executeRaw !== 'function') return;
  for (const teacherId of [...new Set(teacherIds)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${workspaceId}:teacher:${teacherId}`}))`;
  }
}

export async function lockGroupSchedule(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  groupId: string,
): Promise<void> {
  if (typeof tx.$executeRaw !== 'function') return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${workspaceId}:group:${groupId}`}))`;
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
  if (typeof tx.$executeRaw !== 'function') return;
  for (const studentId of [...new Set(studentIds)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${workspaceId}:student:${studentId}`}))`;
  }
}

async function assertRestorableLessonsAreFree(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  lessons: SuspendedLesson[],
): Promise<void> {
  const conflictIds = new Set<string>();
  const accepted: {
    id: string;
    teacherId: string;
    start: Date;
    end: Date;
  }[] = [];

  for (const lesson of lessons) {
    const candidate = toInterval(lesson.startsAtUtc, lesson.durationMin);
    const rows = await tx.lesson.findMany({
      where: {
        workspaceId,
        teacherId: lesson.teacherId,
        deletedAt: null,
        status: { in: ['SCHEDULED', 'COMPLETED'] },
        startsAtUtc: {
          gte: new Date(lesson.startsAtUtc.getTime() - 720 * 60_000),
          lt: candidate.end,
        },
      },
      select: { id: true, startsAtUtc: true, durationMin: true },
    });
    for (const row of rows) {
      if (
        findConflicts(candidate, [
          { ...toInterval(row.startsAtUtc, row.durationMin), id: row.id },
        ]).length
      ) {
        conflictIds.add(row.id);
      }
    }
    for (const conflict of findConflicts(
      candidate,
      accepted.filter((item) => item.teacherId === lesson.teacherId),
    )) {
      conflictIds.add(conflict.id);
    }
    accepted.push({ ...candidate, id: lesson.id, teacherId: lesson.teacherId });
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
  await assertRestorableLessonsAreFree(tx, workspaceId, lessons);
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
  await assertRestorableLessonsAreFree(tx, workspaceId, lessons);
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
