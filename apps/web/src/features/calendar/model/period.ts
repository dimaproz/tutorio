/**
 * The calendar's periods, in the browser's wall clock — the same clock the
 * lesson form reads a clicked slot in (`lib/datetime`). Weeks start on Monday.
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

export function startOfDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

/** Calendar days, not 24-hour steps, so a DST change keeps midnight. */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  return addDays(day, -((day.getDay() + 6) % 7));
}

export function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

/** "2026-09-24": the lesson form's date and the calendar's day keys. */
export function dayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Minutes since the day's midnight. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** A day's wall-clock minute as an instant. */
export function atMinute(day: Date, minutes: number): Date {
  const moment = startOfDay(day);
  moment.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return moment;
}

/** "14:00". */
export function clockLabel(minutes: number): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
}

function range(from: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, index) => addDays(from, index));
}

/** The period around `anchor`: its day, its week, or its month's grid. */
export function calendarPeriod(view: CalendarView, anchor: Date): CalendarPeriod {
  if (view === 'day') {
    const from = startOfDay(anchor);
    return { view, from, to: addDays(from, 1), days: [from] };
  }
  if (view === 'week') {
    const from = startOfWeek(anchor);
    return { view, from, to: addDays(from, 7), days: range(from, 7) };
  }
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const from = startOfWeek(first);
  const to = addDays(startOfWeek(last), 7);
  const count = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  return { view, from, to, days: range(from, count) };
}

/** The next or previous period's anchor. */
export function shiftAnchor(view: CalendarView, anchor: Date, step: 1 | -1): Date {
  if (view === 'day') return addDays(startOfDay(anchor), step);
  if (view === 'week') return addDays(startOfDay(anchor), 7 * step);
  return new Date(anchor.getFullYear(), anchor.getMonth() + step, 1);
}

/** Whether a month grid's day belongs to the month shown. */
export function inMonth(day: Date, anchor: Date): boolean {
  return day.getFullYear() === anchor.getFullYear() && day.getMonth() === anchor.getMonth();
}
