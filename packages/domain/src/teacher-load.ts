/**
 * A teacher's load on the studio's clock: lessons bucketed into the studio's
 * Monday-to-Sunday weeks and their days (the teacher collection's week bars,
 * the profile's «Навантаження»).
 */

import {
  addCalendarDays,
  addCalendarMonths,
  calendarDaysBetween,
  calendarMonthStart,
  calendarWeekStart,
  zonedDate,
  zonedDayStart,
} from './wall-clock';

/** One lesson counted towards a load. */
export interface LoadLesson {
  startsAt: Date;
  durationMin: number;
}

/** [from, to) of the studio week holding `now`, and its Monday. */
export function studioWeekRange(
  now: Date,
  timeZone: string,
): { monday: string; from: Date; to: Date } {
  const monday = calendarWeekStart(zonedDate(now, timeZone));
  return {
    monday,
    from: zonedDayStart(monday, timeZone),
    to: zonedDayStart(addCalendarDays(monday, 7), timeZone),
  };
}

/** [from, to) of the studio month holding `now`. */
export function studioMonthRange(now: Date, timeZone: string): { from: Date; to: Date } {
  const first = calendarMonthStart(zonedDate(now, timeZone));
  return {
    from: zonedDayStart(first, timeZone),
    to: zonedDayStart(addCalendarMonths(first, 1), timeZone),
  };
}

/**
 * How many lessons fall on each day of the week starting on `monday`, Monday
 * first; lessons outside the week are ignored.
 */
export function lessonsPerWeekday(
  starts: readonly Date[],
  monday: string,
  timeZone: string,
): number[] {
  const days = [0, 0, 0, 0, 0, 0, 0];
  for (const startsAt of starts) {
    const index = calendarDaysBetween(monday, zonedDate(startsAt, timeZone));
    if (index >= 0 && index < 7) days[index]! += 1;
  }
  return days;
}

/**
 * Minutes taught in each of the `weeks` studio weeks ending with the week of
 * `now`, oldest first, each with its Monday.
 */
export function weeklyMinutes(
  lessons: readonly LoadLesson[],
  now: Date,
  timeZone: string,
  weeks: number,
): { weekStart: string; minutes: number }[] {
  const current = calendarWeekStart(zonedDate(now, timeZone));
  const first = addCalendarDays(current, -7 * (weeks - 1));
  const buckets = Array.from({ length: weeks }, (_, index) => ({
    weekStart: addCalendarDays(first, 7 * index),
    minutes: 0,
  }));
  for (const lesson of lessons) {
    const index = Math.floor(calendarDaysBetween(first, zonedDate(lesson.startsAt, timeZone)) / 7);
    if (index >= 0 && index < weeks) buckets[index]!.minutes += lesson.durationMin;
  }
  return buckets;
}
