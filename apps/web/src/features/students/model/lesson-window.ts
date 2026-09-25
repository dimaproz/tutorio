import type { LessonResponse } from '@tutorio/validation';
import { addCalendarDays, calendarWeekStart, zonedDate, zonedDayStart } from '@/lib/datetime';

const DAY_MS = 24 * 60 * 60 * 1000;
/** How far ahead the collection looks for each student's next lesson. */
export const UPCOMING_DAYS = 60;

export type CollectionLessonWindow = {
  /** The calendar week the "lessons this week" metric counts, Monday first. */
  week: { from: Date; to: Date };
  /**
   * The one lesson read behind the collection: from the start of the week to
   * the end of the upcoming horizon. Both ends are whole days, so the query
   * key — and its cache entry — stays the same all day instead of changing
   * with every mount's millisecond clock.
   */
  query: { from: string; to: string };
};

/** The window on the studio's clock: its week, Monday to Monday, and its days. */
export function collectionLessonWindow(now: number, timeZone: string): CollectionLessonWindow {
  const today = zonedDate(now, timeZone);
  const monday = calendarWeekStart(today);
  const week = {
    from: zonedDayStart(monday, timeZone),
    to: zonedDayStart(addCalendarDays(monday, 7), timeZone),
  };
  return {
    week,
    query: {
      from: week.from.toISOString(),
      // One day past the horizon, so a lesson later today + 60 days still fits.
      to: zonedDayStart(addCalendarDays(today, UPCOMING_DAYS + 1), timeZone).toISOString(),
    },
  };
}

/**
 * Splits the collection's one lesson read into what the page shows: every
 * lesson of this week, and the scheduled lessons from the precise `now` to
 * the upcoming horizon. Only the query window is rounded; "upcoming" is not.
 */
export function splitCollectionLessons(
  lessons: readonly LessonResponse[],
  window: CollectionLessonWindow,
  now: number,
): { week: LessonResponse[]; upcoming: LessonResponse[] } {
  const weekFrom = window.week.from.getTime();
  const weekTo = window.week.to.getTime();
  const horizon = now + UPCOMING_DAYS * DAY_MS;
  const week: LessonResponse[] = [];
  const upcoming: LessonResponse[] = [];
  for (const lesson of lessons) {
    const at = new Date(lesson.startsAtUtc).getTime();
    if (at >= weekFrom && at < weekTo) week.push(lesson);
    if (lesson.status === 'SCHEDULED' && at >= now && at < horizon) upcoming.push(lesson);
  }
  return { week, upcoming };
}
