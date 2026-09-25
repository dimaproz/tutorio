/**
 * Dates and times on the studio's wall clock.
 *
 * A date ("yyyy-MM-dd") or a time ("HH:mm") a person types or reads means the
 * studio's clock (`Workspace.timezone`), wherever the browser is: a tutor on a
 * trip still books 17:00 Kyiv time and «Діє до 30.10» still ends at the Kyiv
 * midnight. Every crossing between the clock and an instant goes through
 * these helpers with the studio's zone (`useStudioTimeZone`); nothing reads
 * the browser's zone, its `Date#getHours` or `setDate`.
 */

import { zonedDateTime, zonedDayEnd, zonedDayStart } from '@tutorio/domain';

export {
  addCalendarDays,
  addCalendarMonths,
  calendarDaysBetween,
  calendarMonthStart,
  calendarWeekStart,
  calendarWeekday,
  isCalendarDate,
  isWallTime,
  zonedDate,
  zonedDateTime,
  zonedDayEnd,
  zonedDayStart,
  zonedMinutesOfDay,
  zonedTime,
  zonedWeekday,
} from '@tutorio/domain';

/** The zone a studio gets by default, and the one before a session is known. */
export const DEFAULT_TIME_ZONE = 'Europe/Kyiv';

/** A date and a time on the studio's clock → the ISO instant the API takes. */
export function zonedIso(date: string, time: string, timeZone: string): string {
  return zonedDateTime(date, time, timeZone).toISOString();
}

/** The studio's midnight that starts a date, as an ISO instant. */
export function dayStartIso(date: string, timeZone: string): string {
  return zonedDayStart(date, timeZone).toISOString();
}

/** The studio's midnight that ends a date (the next one), as an ISO instant. */
export function dayEndIso(date: string, timeZone: string): string {
  return zonedDayEnd(date, timeZone).toISOString();
}

/** A bookable time of day, "HH:mm". */
export interface TimeSlotRange {
  /** First slot, inclusive. */
  from: string;
  /** Last slot, inclusive. */
  to: string;
  /** Minutes between slots. */
  stepMin: number;
}

const minutesOf = (time: string): number => {
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
};

const toTimeString = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * Every slot in a working window, e.g. 09:00 → 18:00 every 30 minutes. Used by
 * the appointment picker so the caller states business hours, not a hand-written
 * list of times.
 */
export function buildTimeSlots({ from, to, stepMin }: TimeSlotRange): string[] {
  if (stepMin <= 0) {
    return [];
  }
  const slots: string[] = [];
  for (let at = minutesOf(from); at <= minutesOf(to); at += stepMin) {
    slots.push(toTimeString(at));
  }
  return slots;
}
