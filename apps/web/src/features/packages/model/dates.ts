/**
 * The package dates the forms speak in: a "yyyy-MM-dd" day on the studio's
 * clock, and the instants the API stores. A package's `expiresAt` is
 * exclusive — the studio's midnight after its last day —, so the last day it
 * pays for is the day before it.
 */

import {
  addCalendarDays,
  addCalendarMonths,
  calendarDaysBetween,
  isCalendarDate,
  zonedDate,
  zonedDayEnd,
  zonedDayStart,
} from '@/lib/datetime';

/** "2026-10-30": the studio's day of an instant. */
export function dayKey(date: Date | number | string, timeZone: string): string {
  return zonedDate(date, timeZone);
}

/** The studio's midnight that starts a "yyyy-MM-dd" day. */
export function startOfDay(day: string, timeZone: string): Date {
  return zonedDayStart(day, timeZone);
}

/** The studio's midnight after the day: an exclusive end. */
export function endOfDayExclusive(day: string, timeZone: string): Date {
  return zonedDayEnd(day, timeZone);
}

/** The last day a package with this exclusive end pays for (its last instant). */
export function lastDayOf(expiresAt: string): Date {
  return new Date(Date.parse(expiresAt) - 1);
}

/** The day `days` after a "yyyy-MM-dd" day. */
export function addDays(day: string, days: number): string {
  return addCalendarDays(day, days);
}

/** The same day a month later (the last day of a shorter month). */
export function addMonth(day: string): string {
  return addCalendarMonths(day, 1);
}

/** Whole studio days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: Date, to: Date, timeZone: string): number {
  return calendarDaysBetween(zonedDate(from, timeZone), zonedDate(to, timeZone));
}

export const isDayKey = (value: string) => isCalendarDate(value);
