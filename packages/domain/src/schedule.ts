/**
 * Schedules (product/scheduling.md L-20…L-27): weekdays, each with its own
 * local start time, one duration, generated a rolling number of weeks ahead.
 * A change takes effect from a date and moves the lessons it can instead of
 * deleting them, so their topic, notes and history survive.
 */

import { formatInTimeZone } from 'date-fns-tz';
import { expandSeries } from './recurrence';

/** One weekday of a schedule and its local start time ("HH:mm"). */
export interface ScheduleSlot {
  weekday: number;
  localTime: string;
}

export class DuplicateScheduleDayError extends Error {
  constructor(weekday: number) {
    super(`A schedule has one start time per weekday (weekday ${weekday} twice)`);
    this.name = 'DuplicateScheduleDayError';
  }
}

/** Monday first, then by weekday; one slot per weekday. */
export function normalizeSlots(slots: readonly ScheduleSlot[]): ScheduleSlot[] {
  const seen = new Set<number>();
  for (const slot of slots) {
    if (seen.has(slot.weekday)) throw new DuplicateScheduleDayError(slot.weekday);
    seen.add(slot.weekday);
  }
  return [...slots].sort((a, b) => mondayFirst(a.weekday) - mondayFirst(b.weekday));
}

function mondayFirst(weekday: number): number {
  return (weekday + 6) % 7;
}

/**
 * Replaces one weekday's slot (L-41, "this and following"): the slot on
 * `fromWeekday` becomes `next`, and a slot already on `next.weekday` gives way
 * to it. Other days are untouched.
 */
export function replaceSlot(
  slots: readonly ScheduleSlot[],
  fromWeekday: number,
  next: ScheduleSlot,
): ScheduleSlot[] {
  return normalizeSlots([
    ...slots.filter((slot) => slot.weekday !== fromWeekday && slot.weekday !== next.weekday),
    next,
  ]);
}

/** Adds a day to a schedule (L-23), replacing the time if the day is there. */
export function mergeSlot(slots: readonly ScheduleSlot[], slot: ScheduleSlot): ScheduleSlot[] {
  return replaceSlot(slots, slot.weekday, slot);
}

/** One lesson a schedule produces, with its local week and weekday. */
export interface ScheduleOccurrence {
  startsAtUtc: Date;
  weekday: number;
  /** The local Monday ("yyyy-MM-dd") of the week the lesson falls in. */
  weekKey: string;
}

/** The local Monday ("yyyy-MM-dd") of the week containing `instant`. */
export function weekKeyOf(instant: Date, timezone: string): string {
  const [y, m, d, isoWeekday] = formatInTimeZone(instant, timezone, 'yyyy-MM-dd-i')
    .split('-')
    .map(Number) as [number, number, number, number];
  const monday = new Date(Date.UTC(y, m - 1, d - (isoWeekday - 1)));
  return monday.toISOString().slice(0, 10);
}

/** The local weekday (0 = Sunday … 6 = Saturday) of an instant. */
export function localWeekdayOf(instant: Date, timezone: string): number {
  return Number(formatInTimeZone(instant, timezone, 'i')) % 7;
}

/** Every lesson `slots` produce in `[from, until)`, in time order. */
export function expandSchedule(
  slots: readonly ScheduleSlot[],
  options: { timezone: string; startDate: Date; from: Date; until: Date },
): ScheduleOccurrence[] {
  return slots
    .flatMap((slot) =>
      expandSeries(
        {
          weekdays: [slot.weekday],
          localTime: slot.localTime,
          timezone: options.timezone,
          startDate: options.startDate,
        },
        { from: options.from, until: options.until },
      ).map((startsAtUtc) => ({
        startsAtUtc,
        weekday: slot.weekday,
        weekKey: weekKeyOf(startsAtUtc, options.timezone),
      })),
    )
    .sort((a, b) => a.startsAtUtc.getTime() - b.startsAtUtc.getTime());
}

/** A booked lesson a change may move or remove. */
export interface ChangeableLesson {
  id: string;
  startsAtUtc: Date;
  weekday: number;
  weekKey: string;
}

export interface ScheduleChangePlan {
  /** Existing lessons that take a new occurrence's time (same id). */
  moves: { lessonId: string; to: ScheduleOccurrence }[];
  /** Occurrences no existing lesson takes: new lessons. */
  creates: ScheduleOccurrence[];
  /** Existing lessons left without an occurrence: removed (soft). */
  removes: string[];
}

/**
 * Pairs the lessons a change affects with the occurrences of the new rule
 * (L-26). Within each local week, a lesson first takes the new occurrence on
 * its own weekday, then any remaining one in time order; lessons left over
 * are removed and occurrences left over are created. Lessons never move to
 * another week.
 */
export function planScheduleChange(
  existing: readonly ChangeableLesson[],
  proposed: readonly ScheduleOccurrence[],
): ScheduleChangePlan {
  const byTime = <T extends { startsAtUtc: Date }>(a: T, b: T) =>
    a.startsAtUtc.getTime() - b.startsAtUtc.getTime();
  const weeks = new Set([...existing.map((l) => l.weekKey), ...proposed.map((o) => o.weekKey)]);

  const plan: ScheduleChangePlan = { moves: [], creates: [], removes: [] };
  for (const week of [...weeks].sort()) {
    const lessons = existing.filter((l) => l.weekKey === week).sort(byTime);
    const occurrences = proposed.filter((o) => o.weekKey === week).sort(byTime);
    const taken = new Set<ScheduleOccurrence>();
    const paired = new Set<string>();

    for (const lesson of lessons) {
      const sameDay = occurrences.find((o) => !taken.has(o) && o.weekday === lesson.weekday);
      if (sameDay) {
        taken.add(sameDay);
        paired.add(lesson.id);
        plan.moves.push({ lessonId: lesson.id, to: sameDay });
      }
    }
    const freeOccurrences = occurrences.filter((o) => !taken.has(o));
    for (const lesson of lessons.filter((l) => !paired.has(l.id))) {
      const next = freeOccurrences.shift();
      if (next) {
        plan.moves.push({ lessonId: lesson.id, to: next });
      } else {
        plan.removes.push(lesson.id);
      }
    }
    plan.creates.push(...freeOccurrences);
  }
  plan.creates.sort(byTime);
  return plan;
}
