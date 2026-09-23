import type { Group, Prisma } from '@prisma/client';
import type {
  GroupDetail,
  GroupListItem,
  GroupResponse,
  GroupTeacherRef,
} from '@tutorio/validation';

/**
 * A live group membership: not removed, active or paused, of a student who is
 * not archived. The roster, the list counts, the status and the filters all
 * use this one definition. A membership suspended by a student archive has the
 * ARCHIVED status and so is excluded until that student is restored.
 */
export const liveEnrollmentWhere = {
  deletedAt: null,
  status: { in: ['ACTIVE', 'PAUSED'] },
  student: { deletedAt: null, status: { not: 'ARCHIVED' } },
} satisfies Prisma.EnrollmentWhereInput;

/**
 * The group's schedule: a live series, or one an empty roster suspended (it
 * comes back with the first active student). Group archive clears the
 * suspension token, so an archived group's series never match.
 */
export const groupScheduleWhere = {
  OR: [{ deletedAt: null }, { scheduleSuspensionToken: { not: null } }],
} satisfies Prisma.LessonSeriesWhereInput;

/** A package whose money is not fully in: the "unpaid" filter and metric. */
export const unpaidPackageWhere = {
  deletedAt: null,
  paymentStatus: { in: ['PENDING', 'PARTIAL'] },
} satisfies Prisma.LessonPackageWhereInput;

export const teacherRefSelect = {
  id: true,
  fullName: true,
  avatarKey: true,
  color: true,
} satisfies Prisma.TeacherSelect;

type TeacherRow = Prisma.TeacherGetPayload<{ select: typeof teacherRefSelect }>;

export function toTeacherRef(row: TeacherRow): GroupTeacherRef {
  return {
    id: row.id,
    name: row.fullName,
    avatarKey: row.avatarKey as GroupTeacherRef['avatarKey'],
    color: row.color,
  };
}

export function toGroupResponse(row: Group): GroupResponse {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    teacherId: row.teacherId,
    capacity: row.capacity,
    pricePerLesson: row.pricePerLesson,
    currency: row.currency as GroupResponse['currency'],
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

/**
 * The teacher who shows for a group: its own, else the most common teacher of
 * its roster (legacy groups predate the column); a tie goes to the teacher who
 * appears first in the given order.
 */
export function resolveGroupTeacher<T extends { id: string }>(
  own: T | null,
  rosterTeachers: readonly T[],
): T | null {
  if (own) return own;
  const counts = new Map<string, { teacher: T; count: number }>();
  for (const teacher of rosterTeachers) {
    const entry = counts.get(teacher.id);
    if (entry) entry.count += 1;
    else counts.set(teacher.id, { teacher, count: 1 });
  }
  let best: { teacher: T; count: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  return best?.teacher ?? null;
}

type ScheduleKeySource = {
  schedules: readonly Pick<
    GroupListItem['schedules'][number],
    'weekdays' | 'localTime' | 'timezone'
  >[];
};

/** Sort key for "by schedule": the earliest pattern's time, then weekdays. */
export function firstScheduleKey(group: ScheduleKeySource): string | null {
  const first = group.schedules[0];
  if (!first) {
    return null;
  }
  return `${first.localTime}:${first.weekdays.join(',')}:${first.timezone}`;
}

export function compareNullable<T>(
  left: T | null,
  right: T | null,
  compare: (a: T, b: T) => number,
): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return compare(left, right);
}

export type GroupDetailEnrollment = GroupDetail['enrollments'][number];
