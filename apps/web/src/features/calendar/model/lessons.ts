import type { LessonResponse } from '@tutorio/validation';
import { atMinute, isSameDay, minutesOfDay } from './period';

/**
 * How a lesson reads on the calendar (the S03 decisions): its colour is its
 * kind, its fill is its time, and its marks are what happened to it.
 */

export type LessonType = 'individual' | 'group' | 'makeup';
export type LessonTime = 'upcoming' | 'past' | 'running' | 'cancelled';

export type CalendarLesson = Pick<
  LessonResponse,
  | 'id'
  | 'startsAtUtc'
  | 'durationMin'
  | 'status'
  | 'kind'
  | 'groupId'
  | 'teacherId'
  | 'seriesId'
  | 'isDetached'
  | 'topic'
  | 'charges'
  | 'student'
  | 'group'
  | 'teacher'
  | 'originalLessonId'
>;

export const LESSON_TYPE_CLASS: Record<LessonType, string> = {
  individual: 'lesson-individual',
  group: 'lesson-group',
  makeup: 'lesson-makeup',
};

export function lessonType(lesson: Pick<CalendarLesson, 'kind' | 'groupId'>): LessonType {
  if (lesson.kind === 'MAKEUP') return 'makeup';
  return lesson.groupId ? 'group' : 'individual';
}

export function isCancelled(status: CalendarLesson['status']): boolean {
  return status === 'CANCELLED_CHARGED' || status === 'CANCELLED_UNCHARGED';
}

export function lessonEndMs(lesson: Pick<CalendarLesson, 'startsAtUtc' | 'durationMin'>): number {
  return Date.parse(lesson.startsAtUtc) + lesson.durationMin * 60_000;
}

/**
 * Upcoming: a white card. Past (held, a no-show, or a time gone by): filled.
 * Running: filled with a ring. Cancelled: hatched, whatever its time.
 */
export function lessonTime(
  lesson: Pick<CalendarLesson, 'startsAtUtc' | 'durationMin' | 'status'>,
  nowMs: number,
): LessonTime {
  if (isCancelled(lesson.status)) return 'cancelled';
  const start = Date.parse(lesson.startsAtUtc);
  const end = lessonEndMs(lesson);
  if (lesson.status === 'COMPLETED' || lesson.status === 'NO_SHOW') {
    return start <= nowMs && nowMs < end ? 'running' : 'past';
  }
  if (start <= nowMs && nowMs < end) return 'running';
  return end <= nowMs ? 'past' : 'upcoming';
}

export type LessonMarks = {
  held: boolean;
  noShow: boolean;
  makeup: boolean;
  group: boolean;
  /** A charge payments have not reached (L-90), or a lesson on debt (L-82). */
  unpaid: boolean;
};

export function lessonMarks(lesson: CalendarLesson): LessonMarks {
  return {
    held: lesson.status === 'COMPLETED',
    noShow: lesson.status === 'NO_SHOW',
    makeup: lesson.kind === 'MAKEUP',
    group: lesson.groupId !== null,
    unpaid: lesson.charges.some((charge) => !charge.paid),
  };
}

export function lessonTitle(lesson: Pick<CalendarLesson, 'student' | 'group'>): string {
  return lesson.student?.fullName ?? lesson.group?.name ?? '';
}

/** Only a lesson still to happen moves (L-40); a held or cancelled one stays. */
export function isMovable(lesson: Pick<CalendarLesson, 'status'>): boolean {
  return lesson.status === 'SCHEDULED';
}

export function lessonsOnDay<T extends Pick<CalendarLesson, 'startsAtUtc'>>(
  lessons: readonly T[],
  day: Date,
): T[] {
  return lessons
    .filter((lesson) => isSameDay(new Date(lesson.startsAtUtc), day))
    .sort((left, right) => Date.parse(left.startsAtUtc) - Date.parse(right.startsAtUtc));
}

export type PlacedLesson<T> = {
  lesson: T;
  startMin: number;
  endMin: number;
  /** The lane within its cluster of overlapping lessons, and how many lanes it has. */
  lane: number;
  lanes: number;
};

/**
 * One day's lessons on the time grid: overlapping lessons split the column
 * into lanes, each lesson in the first lane free at its start. A cluster ends
 * where no lesson of it is still running.
 */
export function placeDay<T extends Pick<CalendarLesson, 'startsAtUtc' | 'durationMin'>>(
  lessons: readonly T[],
): PlacedLesson<T>[] {
  const items = lessons
    .map((lesson) => {
      const startMin = minutesOfDay(new Date(lesson.startsAtUtc));
      return { lesson, startMin, endMin: Math.min(1440, startMin + lesson.durationMin) };
    })
    .sort((left, right) => left.startMin - right.startMin || right.endMin - left.endMin);

  const placed: PlacedLesson<T>[] = [];
  let cluster: PlacedLesson<T>[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const close = () => {
    for (const item of cluster) item.lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };
  for (const item of items) {
    if (item.startMin >= clusterEnd) close();
    let lane = laneEnds.findIndex((end) => end <= item.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endMin);
    } else {
      laneEnds[lane] = item.endMin;
    }
    const entry = { ...item, lane, lanes: 1 };
    cluster.push(entry);
    placed.push(entry);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  close();
  return placed;
}

/** The time grid's step for a drop or a selection. */
export const SNAP_MIN = 15;

export function snapMinutes(minutes: number, step = SNAP_MIN): number {
  return Math.min(1440 - step, Math.max(0, Math.round(minutes / step) * step));
}

/**
 * The lesson a move onto `day` at `startMin` would overlap (L-110), as the
 * calendar can tell from what it shows: the same teacher, the same student or
 * the same group. The save still asks the API (L-111).
 */
export function dropConflict<T extends CalendarLesson>(
  moving: CalendarLesson,
  day: Date,
  startMin: number,
  lessons: readonly T[],
): T | null {
  const start = atMinute(day, startMin).getTime();
  const end = start + moving.durationMin * 60_000;
  return (
    lessons.find((other) => {
      if (other.id === moving.id || isCancelled(other.status)) return false;
      const otherStart = Date.parse(other.startsAtUtc);
      if (!(otherStart < end && start < lessonEndMs(other))) return false;
      return (
        other.teacherId === moving.teacherId ||
        (moving.student !== null && other.student?.id === moving.student.id) ||
        (moving.groupId !== null && other.groupId === moving.groupId)
      );
    }) ?? null
  );
}
