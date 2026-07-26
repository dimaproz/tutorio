/**
 * Conversions between instants and the strings native date/time inputs expect.
 *
 * `datetime-local` and `date` inputs have no timezone: they speak the browser's
 * local wall clock. These helpers are the single place that crossing is done,
 * so no component has to hand-roll an offset calculation.
 */

/** An instant → the "YYYY-MM-DDTHH:mm" a `datetime-local` input expects. */
export function toLocalDateTimeInput(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

/** An instant → the "YYYY-MM-DD" a `date` input expects. */
export function toLocalDateInput(date: Date): string {
  return toLocalDateTimeInput(date).slice(0, 10);
}

/** A `datetime-local` / `date` input value → an ISO instant in UTC. */
export function localInputToIso(value: string): string {
  return new Date(value).toISOString();
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

/** Parses an input value back to a Date, or `undefined` when blank/invalid. */
export function parseLocalInput(value: string): Date | undefined {
  if (!value.trim()) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Splits a "YYYY-MM-DDTHH:mm" value into its two halves, which is how the date
 * and time controls of a datetime picker are driven independently.
 */
export function splitDateTimeInput(value: string): { date: string; time: string } {
  const [date = '', time = ''] = value.split('T');
  return { date, time: time.slice(0, 5) };
}

/**
 * Joins a date and a time back into a `datetime-local` value. A date with no
 * time defaults to `fallbackTime` so picking a day alone still yields a usable
 * instant; a blank date yields a blank value.
 */
export function joinDateTimeInput(
  date: string,
  time: string,
  fallbackTime = '09:00',
): string {
  if (!date) {
    return '';
  }
  return `${date}T${time || fallbackTime}`;
}
