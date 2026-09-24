import type { LessonResponse } from '@tutorio/validation';

/** A lesson as the busy checks need it. */
export type BusyLesson = Pick<
  LessonResponse,
  'id' | 'startsAtUtc' | 'durationMin' | 'status' | 'teacherId' | 'groupId'
> & {
  student: { id: string; fullName: string } | null;
  group: { id: string; name: string } | null;
};

/** Who the new lesson must not overlap (L-110): its teacher and its student or group. */
export type BusyScope = {
  teacherId: string | null;
  studentId?: string | null;
  /** The groups the student takes part in, or the group of a group lesson. */
  groupIds?: readonly string[];
  /** The lesson being edited, which never overlaps itself. */
  excludeLessonId?: string;
};

const MINUTE = 60_000;

/** A local wall-clock "yyyy-MM-dd" + "HH:mm" as an instant, like the forms submit it. */
export function localInstant(date: string, time: string): number {
  return new Date(`${date}T${time}`).getTime();
}

/** A cancelled lesson frees its slot (the API does not count it as a conflict). */
function occupies(lesson: BusyLesson) {
  return lesson.status !== 'CANCELLED_CHARGED' && lesson.status !== 'CANCELLED_UNCHARGED';
}

function involves(lesson: BusyLesson, scope: BusyScope) {
  if (lesson.id === scope.excludeLessonId) return false;
  if (scope.teacherId && lesson.teacherId === scope.teacherId) return true;
  if (scope.studentId && lesson.student?.id === scope.studentId) return true;
  return Boolean(lesson.groupId && scope.groupIds?.includes(lesson.groupId));
}

/** The name a busy slot shows: the group, else the student. */
export function busyName(lesson: BusyLesson) {
  return lesson.group?.name ?? lesson.student?.fullName ?? '';
}

/** The lessons of the scope that overlap [start, start + minutes). */
export function overlapping(
  lessons: readonly BusyLesson[],
  scope: BusyScope,
  start: number,
  minutes: number,
): BusyLesson[] {
  const end = start + minutes * MINUTE;
  return lessons.filter((lesson) => {
    if (!occupies(lesson) || !involves(lesson, scope)) return false;
    const from = Date.parse(lesson.startsAtUtc);
    return from < end && from + lesson.durationMin * MINUTE > start;
  });
}

/**
 * The time list's busy marks for one day: every suggested slot that starts
 * while a lesson of the teacher, the student or the group is on, with that
 * lesson's name (the FieldsTime board marks 18:00 and 18:30 for an 18:00–19:30
 * lesson). The slots stay selectable (L-111); the row's overlap hint checks
 * the new lesson's whole length.
 */
export function busySlots(
  lessons: readonly BusyLesson[],
  scope: BusyScope,
  date: string,
  slots: readonly string[],
): Record<string, string> {
  const marks: Record<string, string> = {};
  if (!date) return marks;
  for (const slot of slots) {
    const hit = overlapping(lessons, scope, localInstant(date, slot), 1)[0];
    if (hit) marks[slot] = busyName(hit);
  }
  return marks;
}

/** The first lesson a teacher gives across [start, start + minutes), if any. */
export function teacherBusyAt(
  lessons: readonly BusyLesson[],
  teacherId: string,
  start: number,
  minutes: number,
  excludeLessonId?: string,
): BusyLesson | undefined {
  return overlapping(lessons, { teacherId, excludeLessonId }, start, minutes).find(
    (lesson) => lesson.teacherId === teacherId,
  );
}

/** The days a set of rows covers, as the one read window [first day, last day + 1). */
export function daysWindow(dates: readonly string[]): { from: string; to: string } | null {
  const valid = dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  if (valid.length === 0) return null;
  const from = new Date(`${valid[0]}T00:00`);
  const to = new Date(`${valid.at(-1)}T00:00`);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}
