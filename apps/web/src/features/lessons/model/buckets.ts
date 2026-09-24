import type { LessonResponse } from '@tutorio/validation';
import { lessonMoment } from './panel-actions';

export type LessonBuckets = {
  /** Running or still to come, soonest first. */
  upcoming: LessonResponse[];
  /** Over by now, most recent first. */
  past: LessonResponse[];
  /** The next lesson that will take place: the highlighted row. */
  nextId: string | null;
};

/**
 * Splits a lesson list at `now` by each lesson's end, so a lesson that has
 * started but is not over still leads the upcoming rows instead of sinking
 * into the history.
 */
export function lessonBuckets(lessons: readonly LessonResponse[], now: number): LessonBuckets {
  const upcoming = lessons
    .filter((lesson) => lessonMoment(lesson, now) !== 'ended')
    .sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc));
  const past = lessons
    .filter((lesson) => lessonMoment(lesson, now) === 'ended')
    .sort((a, b) => b.startsAtUtc.localeCompare(a.startsAtUtc));
  const next = upcoming.find((lesson) => lesson.status === 'SCHEDULED');
  return { upcoming, past, nextId: next?.id ?? null };
}

/** A scheduled lesson that has started and is not over. */
export function isLessonRunning(
  lesson: Pick<LessonResponse, 'status' | 'startsAtUtc' | 'durationMin'>,
  now: number,
): boolean {
  return lesson.status === 'SCHEDULED' && lessonMoment(lesson, now) === 'running';
}
