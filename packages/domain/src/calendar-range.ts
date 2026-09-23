/**
 * Calendar ranges in a timezone: "this week" and "today" as the tutor's
 * workspace sees them, returned as UTC instants for queries.
 */

import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const DAY_MS = 24 * 60 * 60 * 1000;

function localDate(
  instant: Date,
  timezone: string,
): { y: number; m: number; d: number; wd: number } {
  const [y, m, d, wd] = formatInTimeZone(instant, timezone, 'yyyy-MM-dd-i')
    .split('-')
    .map(Number) as [number, number, number, number];
  // ISO weekday: 1 = Monday … 7 = Sunday.
  return { y, m, d, wd };
}

function midnight(y: number, m: number, d: number, timezone: string): Date {
  // Build the civil date in UTC arithmetic so month and year roll over, then
  // read that wall-clock midnight in the zone.
  const civil = new Date(Date.UTC(y, m - 1, d));
  const iso = civil.toISOString().slice(0, 10);
  return fromZonedTime(`${iso}T00:00:00`, timezone);
}

/** [start, end) of the local day that contains `now`. */
export function zonedDayRange(now: Date, timezone: string): { start: Date; end: Date } {
  const { y, m, d } = localDate(now, timezone);
  return { start: midnight(y, m, d, timezone), end: midnight(y, m, d + 1, timezone) };
}

/** [start, end) of the local Monday-to-Sunday week that contains `now`. */
export function zonedWeekRange(now: Date, timezone: string): { start: Date; end: Date } {
  const { y, m, d, wd } = localDate(now, timezone);
  const monday = d - (wd - 1);
  return { start: midnight(y, m, monday, timezone), end: midnight(y, m, monday + 7, timezone) };
}

/** Whole local days between two instants' dates, ignoring the time of day. */
export function zonedDaysBetween(from: Date, to: Date, timezone: string): number {
  const a = localDate(from, timezone);
  const b = localDate(to, timezone);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / DAY_MS);
}
