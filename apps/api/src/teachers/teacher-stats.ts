import type { Prisma } from '@prisma/client';
import { lessonsPerWeekday, studioWeekRange } from '@tutorio/domain';
import type { TeacherListItem } from '@tutorio/validation';
import { BUSY_STATUSES } from '../scheduling/scheduling.shared';

export type TeacherStats = Pick<
  TeacherListItem,
  'activeEnrollmentCount' | 'studentCount' | 'groupCount' | 'week'
>;

/**
 * A live student's live place with the teachers: an individual direction
 * taught by one of them, or a membership in a live group one of them leads;
 * active or paused, the student neither archived nor deleted.
 */
export function teacherMembershipWhere(
  workspaceId: string,
  teacherIds: readonly string[],
): Prisma.EnrollmentWhereInput {
  const ids = [...teacherIds];
  return {
    workspaceId,
    deletedAt: null,
    status: { in: ['ACTIVE', 'PAUSED'] },
    student: { deletedAt: null, status: { not: 'ARCHIVED' } },
    OR: [
      { groupId: null, teacherId: { in: ids } },
      { group: { teacherId: { in: ids }, deletedAt: null } },
    ],
  };
}

/**
 * The list's per-teacher figures in three queries, whatever the number of
 * teachers: the live memberships (and the distinct students in them), the
 * live groups led, and this studio week's lessons that are not cancelled,
 * per day.
 */
export async function loadTeacherStats(
  db: Prisma.TransactionClient,
  workspaceId: string,
  teacherIds: readonly string[],
  timeZone: string,
  now: Date,
): Promise<Map<string, TeacherStats>> {
  const stats = new Map<string, TeacherStats>(
    teacherIds.map((id) => [
      id,
      {
        activeEnrollmentCount: 0,
        studentCount: 0,
        groupCount: 0,
        week: { lessonCount: 0, days: [0, 0, 0, 0, 0, 0, 0] },
      },
    ]),
  );
  if (teacherIds.length === 0) return stats;

  const week = studioWeekRange(now, timeZone);
  const ids = [...teacherIds];
  const [memberships, groups, lessons] = await Promise.all([
    db.enrollment.findMany({
      where: teacherMembershipWhere(workspaceId, ids),
      select: {
        teacherId: true,
        studentId: true,
        status: true,
        group: { select: { teacherId: true } },
      },
    }),
    db.group.groupBy({
      by: ['teacherId'],
      where: { workspaceId, teacherId: { in: ids }, deletedAt: null },
      _count: { _all: true },
    }),
    db.lesson.findMany({
      where: {
        workspaceId,
        teacherId: { in: ids },
        deletedAt: null,
        status: BUSY_STATUSES,
        startsAtUtc: { gte: week.from, lt: week.to },
      },
      select: { teacherId: true, startsAtUtc: true },
    }),
  ]);

  const students = new Map<string, Set<string>>();
  for (const row of memberships) {
    const teacherId = row.group?.teacherId ?? row.teacherId;
    const entry = stats.get(teacherId);
    if (!entry) continue;
    if (row.status === 'ACTIVE') entry.activeEnrollmentCount += 1;
    const set = students.get(teacherId) ?? new Set<string>();
    set.add(row.studentId);
    students.set(teacherId, set);
  }
  for (const [teacherId, set] of students) {
    stats.get(teacherId)!.studentCount = set.size;
  }
  for (const row of groups) {
    if (row.teacherId) stats.get(row.teacherId)!.groupCount = row._count._all;
  }
  const starts = new Map<string, Date[]>();
  for (const row of lessons) {
    const list = starts.get(row.teacherId) ?? [];
    list.push(row.startsAtUtc);
    starts.set(row.teacherId, list);
  }
  for (const [teacherId, list] of starts) {
    stats.get(teacherId)!.week = {
      lessonCount: list.length,
      days: lessonsPerWeekday(list, week.monday, timeZone),
    };
  }
  return stats;
}
