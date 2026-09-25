/**
 * The studio's wall clock ⇄ instants. A date ("yyyy-MM-dd") and a time
 * ("HH:mm") a person types or reads mean the studio's clock, wherever the
 * device showing them is: every conversion takes the studio's IANA timezone
 * and never reads the runtime's own zone.
 *
 * Calendar dates are plain strings, so their arithmetic (a day later, the
 * weekday, the days between) needs no timezone at all.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Every zone changes its offset on a quarter hour of UTC, never inside one. */
const QUARTER_MS = 15 * 60 * 1000;
const CACHE_LIMIT = 50_000;

type InstantLike = Date | number | string;

const toMs = (value: InstantLike): number =>
  value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);

const formats = new Map<string, Intl.DateTimeFormat>();
const offsets = new Map<string, Map<number, number>>();

/**
 * The zone's offset from UTC at an instant, read from the runtime's own
 * timezone database (`Intl`). `date-fns-tz` is not used here: its offsets
 * are wrong within an hour of a DST switch. Throws a RangeError for a zone
 * that does not exist.
 */
function exactOffset(timeZone: string, ms: number): number {
  let format = formats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formats.set(timeZone, format);
  }
  const part: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const { type, value } of format.formatToParts(new Date(ms))) part[type] = Number(value);
  const wall = Date.UTC(
    part.year!,
    part.month! - 1,
    part.day!,
    part.hour! % 24,
    part.minute!,
    part.second!,
  );
  return wall - (ms - (((ms % 1000) + 1000) % 1000));
}

/**
 * The zone's offset from UTC at an instant, in milliseconds. A calendar
 * screen asks it thousands of times per render, so the answer is kept per
 * quarter hour: the offset cannot change inside one.
 */
function offsetAt(timeZone: string, ms: number): number {
  let zone = offsets.get(timeZone);
  if (!zone) {
    zone = new Map();
    offsets.set(timeZone, zone);
  }
  const quarter = Math.floor(ms / QUARTER_MS);
  let offset = zone.get(quarter);
  if (offset === undefined) {
    offset = exactOffset(timeZone, quarter * QUARTER_MS);
    if (zone.size >= CACHE_LIMIT) zone.clear();
    zone.set(quarter, offset);
  }
  return offset;
}

/** The instant's wall clock in the zone as an ISO string: "yyyy-MM-ddTHH:mm:ss.sssZ". */
const wallIso = (instant: InstantLike, timeZone: string): string => {
  const ms = toMs(instant);
  return new Date(ms + offsetAt(timeZone, ms)).toISOString();
};

/** Whether a string is a calendar date "yyyy-MM-dd". */
export function isCalendarDate(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number) as [number, number, number, number];
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

/** Whether a string is a wall-clock time "HH:mm". */
export function isWallTime(value: string): boolean {
  return TIME_RE.test(value);
}

/**
 * A date and a time on the studio's clock → the instant. The clock's
 * irregular hours resolve the way `Temporal` does by default, and the same
 * on every device: a time the clock repeats (03:00–03:59 on the autumn switch
 * in Kyiv) takes the first of its two instants; a time it skips (03:00–03:59
 * on the spring switch) moves forward by the gap, to 04:00–04:59.
 */
export function zonedDateTime(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  const wall = Date.UTC(year, month - 1, day, hours, minutes);
  // A transition is never a day away from another, so the offsets a day
  // either side are the only two the wall time can have.
  const before = offsetAt(timeZone, wall - DAY_MS);
  const after = offsetAt(timeZone, wall + DAY_MS);
  const matches = [wall - before, wall - after].filter(
    (instant) => instant + offsetAt(timeZone, instant) === wall,
  );
  return new Date(matches.length > 0 ? Math.min(...matches) : wall - before);
}

/** The first instant of a calendar day on the studio's clock (its midnight). */
export function zonedDayStart(date: string, timeZone: string): Date {
  return zonedDateTime(date, '00:00', timeZone);
}

/**
 * The first instant after a calendar day on the studio's clock — the next
 * midnight. «Діє до 30.10» ends here: the whole of the 30th is included.
 */
export function zonedDayEnd(date: string, timeZone: string): Date {
  return zonedDayStart(addCalendarDays(date, 1), timeZone);
}

/** The studio's calendar date of an instant, "yyyy-MM-dd". */
export function zonedDate(instant: InstantLike, timeZone: string): string {
  return wallIso(instant, timeZone).slice(0, 10);
}

/** The studio's clock time of an instant, "HH:mm". */
export function zonedTime(instant: InstantLike, timeZone: string): string {
  return wallIso(instant, timeZone).slice(11, 16);
}

/** Minutes since the studio's midnight of the instant's day, by its clock. */
export function zonedMinutesOfDay(instant: InstantLike, timeZone: string): number {
  const wall = new Date(wallIso(instant, timeZone));
  return wall.getUTCHours() * 60 + wall.getUTCMinutes();
}

/** The studio's weekday of an instant: 0 = Sunday … 6 = Saturday. */
export function zonedWeekday(instant: InstantLike, timeZone: string): number {
  return calendarWeekday(zonedDate(instant, timeZone));
}

function civil(date: string): number {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day);
}

function fromCivil(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** A calendar date `days` later (or earlier), across months and years. */
export function addCalendarDays(date: string, days: number): string {
  return fromCivil(civil(date) + days * DAY_MS);
}

/**
 * The same day `months` later; a day the month does not have lands on its
 * last day (31 January + 1 month = 28 or 29 February).
 */
export function addCalendarMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, last));
  return fromCivil(first.getTime());
}

/** The weekday of a calendar date: 0 = Sunday … 6 = Saturday. */
export function calendarWeekday(date: string): number {
  return new Date(civil(date)).getUTCDay();
}

/** The Monday of a calendar date's Monday-to-Sunday week. */
export function calendarWeekStart(date: string): string {
  return addCalendarDays(date, -((calendarWeekday(date) + 6) % 7));
}

/** The first day of a calendar date's month. */
export function calendarMonthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** Whole calendar days from one date to another (negative when `to` is earlier). */
export function calendarDaysBetween(from: string, to: string): number {
  return Math.round((civil(to) - civil(from)) / DAY_MS);
}
