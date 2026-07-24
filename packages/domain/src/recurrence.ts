/**
 * Timezone-aware expansion of a recurring lesson schedule into concrete UTC
 * instants. The rule is stored in the teacher's local timezone (weekday + local
 * clock time); concrete lessons are materialized in UTC so a DST switch does not
 * drift the whole series by an hour.
 */

import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/** JS `Date.getUTCDay()` convention: 0 = Sunday … 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface RecurrenceRule {
  /** Weekdays the lesson repeats on (0 = Sunday … 6 = Saturday). */
  weekdays: readonly number[];
  /** Local wall-clock start time, "HH:mm" (24h). */
  localTime: string;
  /** IANA timezone the rule lives in, e.g. "Europe/Kyiv". */
  timezone: string;
  /** Rule is inactive before this instant; slots strictly earlier are skipped. */
  startDate: Date;
}

export interface ExpansionWindow {
  /** Inclusive lower bound (UTC). */
  from: Date;
  /** Exclusive upper bound (UTC) — the materialization horizon. */
  until: Date;
}

const LOCAL_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class InvalidLocalTimeError extends Error {
  constructor(value: string) {
    super(`Invalid local time (expected "HH:mm"): "${value}"`);
    this.name = 'InvalidLocalTimeError';
  }
}

interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

/** A tz-independent anchor (noon UTC) whose calendar date is `date`. */
function anchor(date: CalendarDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day, 12));
}

/** Weekday of a calendar date, independent of any timezone. */
function weekdayOf(date: CalendarDate): number {
  return anchor(date).getUTCDay();
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  const next = new Date(anchor(date).getTime() + days * 86_400_000);
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function isOnOrBefore(a: CalendarDate, b: CalendarDate): boolean {
  return anchor(a).getTime() <= anchor(b).getTime();
}

/** The local calendar date (in `timezone`) of a UTC instant. */
function localCalendarDate(instant: Date, timezone: string): CalendarDate {
  const parts = formatInTimeZone(instant, timezone, 'yyyy-MM-dd').split('-');
  return { year: Number(parts[0]), month: Number(parts[1]), day: Number(parts[2]) };
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Expands `rule` into the UTC instants that fall inside `window`.
 *
 * DST policy:
 * - A local time that does not exist (spring-forward gap, e.g. 02:30 when the
 *   clock jumps 02:00 → 03:00) is skipped — `fromZonedTime` would otherwise
 *   silently shift it, so we detect the shift via a round-trip and drop the slot.
 * - An ambiguous local time (fall-back, occurring twice) resolves to whatever
 *   offset `date-fns-tz` picks; both instants are valid, so we keep it.
 */
export function expandSeries(rule: RecurrenceRule, window: ExpansionWindow): Date[] {
  if (!LOCAL_TIME_RE.test(rule.localTime)) {
    throw new InvalidLocalTimeError(rule.localTime);
  }
  if (window.until <= window.from) {
    return [];
  }

  const weekdays = new Set(rule.weekdays);
  const results: Date[] = [];

  // Iterate local calendar days. Pad by one day on each side so a slot near the
  // window edge whose UTC instant lands inside the window is not missed.
  let cursor = addDays(localCalendarDate(window.from, rule.timezone), -1);
  const lastDay = addDays(localCalendarDate(window.until, rule.timezone), 1);

  while (isOnOrBefore(cursor, lastDay)) {
    if (weekdays.has(weekdayOf(cursor))) {
      const localIso = `${cursor.year}-${pad2(cursor.month)}-${pad2(cursor.day)}T${rule.localTime}:00`;
      const utc = fromZonedTime(localIso, rule.timezone);

      // Round-trip: if the instant renders back to a different local time, the
      // requested time did not exist on this day (spring-forward gap) — skip it.
      const roundTrip = formatInTimeZone(utc, rule.timezone, 'HH:mm');
      const existed = roundTrip === rule.localTime;

      if (
        existed &&
        utc.getTime() >= window.from.getTime() &&
        utc.getTime() < window.until.getTime() &&
        utc.getTime() >= rule.startDate.getTime()
      ) {
        results.push(utc);
      }
    }
    cursor = addDays(cursor, 1);
  }

  results.sort((a, b) => a.getTime() - b.getTime());
  return results;
}
