/**
 * The package dates the forms speak in: a "yyyy-MM-dd" day in the tutor's
 * browser, and the instants the API stores. A package's `expiresAt` is
 * exclusive, so the last day it pays for is the day before it.
 */

const pad = (part: number) => String(part).padStart(2, '0');

/** "2026-10-30" for a local date. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of a "yyyy-MM-dd" day. */
export function startOfDay(day: string): Date {
  return new Date(`${day}T00:00`);
}

/** Local midnight after the day: an exclusive end. */
export function endOfDayExclusive(day: string): Date {
  const next = startOfDay(day);
  next.setDate(next.getDate() + 1);
  return next;
}

/** The last day a package with this exclusive end pays for. */
export function lastDayOf(expiresAt: string): Date {
  return new Date(Date.parse(expiresAt) - 1);
}

/** The day `days` after a "yyyy-MM-dd" day. */
export function addDays(day: string, days: number): string {
  const date = startOfDay(day);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

/** The same day a month later (the last day of a shorter month). */
export function addMonth(day: string): string {
  const date = startOfDay(day);
  const target = date.getMonth() + 1;
  date.setMonth(target);
  if (date.getMonth() !== target % 12) date.setDate(0);
  return dayKey(date);
}

/** Whole days from `from` to `to`, rounded (negative when `to` is earlier). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / 86_400_000);
}

function startOfLocalDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export const isDayKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
