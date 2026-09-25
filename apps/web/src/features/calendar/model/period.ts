import {
  addCalendarDays,
  addCalendarMonths,
  calendarDaysBetween,
  calendarMonthStart,
  calendarWeekStart,
  zonedDate,
  zonedDateTime,
  zonedDayStart,
  zonedMinutesOfDay,
} from '@/lib/datetime';

/**
 * The calendar's periods on the studio's wall clock — the same clock the
 * lesson form reads a clicked slot in (`lib/datetime`), wherever the browser
 * is. A day is the instant of the studio's midnight that starts it. Weeks
 * start on Monday.
 */

export const CALENDAR_VIEWS = ['day', 'week', 'month'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export type CalendarPeriod = {
  view: CalendarView;
  /** The first moment of the period (a day's, a week's or the month grid's). */
  from: Date;
  /** The first moment after it. */
  to: Date;
  /** Every day shown: 1, 7, or the month grid's whole weeks. */
  days: Date[];
};

/** "2026-09-24": the studio's day of an instant — the lesson form's date and the day keys. */
export function dayKey(date: Date, timeZone: string): string {
  return zonedDate(date, timeZone);
}

/** The studio's midnight that starts the day of `date`. */
export function startOfDay(date: Date, timeZone: string): Date {
  return zonedDayStart(zonedDate(date, timeZone), timeZone);
}

/** Calendar days, not 24-hour steps, so a DST change keeps midnight. */
export function addDays(date: Date, days: number, timeZone: string): Date {
  return zonedDayStart(addCalendarDays(zonedDate(date, timeZone), days), timeZone);
}

export function isSameDay(left: Date, right: Date, timeZone: string): boolean {
  return zonedDate(left, timeZone) === zonedDate(right, timeZone);
}

/** The day of the month, «24». */
export function dayOfMonth(date: Date, timeZone: string): number {
  return Number(zonedDate(date, timeZone).slice(8));
}

/** Minutes since the day's midnight, on the studio's clock. */
export function minutesOfDay(date: Date, timeZone: string): number {
  return zonedMinutesOfDay(date, timeZone);
}

/** A day's wall-clock minute as an instant. */
export function atMinute(day: Date, minutes: number, timeZone: string): Date {
  return zonedDateTime(zonedDate(day, timeZone), clockLabel(minutes), timeZone);
}

/** "14:00". */
export function clockLabel(minutes: number): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
}

function days(from: string, count: number, timeZone: string): Date[] {
  return Array.from({ length: count }, (_, index) =>
    zonedDayStart(addCalendarDays(from, index), timeZone),
  );
}

/** The period around `anchor`: its day, its week, or its month's grid. */
export function calendarPeriod(view: CalendarView, anchor: Date, timeZone: string): CalendarPeriod {
  const today = zonedDate(anchor, timeZone);
  if (view === 'day') {
    const [from] = days(today, 1, timeZone) as [Date];
    return { view, from, to: zonedDayStart(addCalendarDays(today, 1), timeZone), days: [from] };
  }
  if (view === 'week') {
    const monday = calendarWeekStart(today);
    return {
      view,
      from: zonedDayStart(monday, timeZone),
      to: zonedDayStart(addCalendarDays(monday, 7), timeZone),
      days: days(monday, 7, timeZone),
    };
  }
  const first = calendarMonthStart(today);
  const last = addCalendarDays(addCalendarMonths(first, 1), -1);
  const monday = calendarWeekStart(first);
  const end = addCalendarDays(calendarWeekStart(last), 7);
  return {
    view,
    from: zonedDayStart(monday, timeZone),
    to: zonedDayStart(end, timeZone),
    days: days(monday, calendarDaysBetween(monday, end), timeZone),
  };
}

/** The next or previous period's anchor. */
export function shiftAnchor(
  view: CalendarView,
  anchor: Date,
  step: 1 | -1,
  timeZone: string,
): Date {
  const day = zonedDate(anchor, timeZone);
  if (view === 'day') return zonedDayStart(addCalendarDays(day, step), timeZone);
  if (view === 'week') return zonedDayStart(addCalendarDays(day, 7 * step), timeZone);
  return zonedDayStart(addCalendarMonths(calendarMonthStart(day), step), timeZone);
}

/** Whether a month grid's day belongs to the month shown. */
export function inMonth(day: Date, anchor: Date, timeZone: string): boolean {
  return zonedDate(day, timeZone).slice(0, 7) === zonedDate(anchor, timeZone).slice(0, 7);
}
