/**
 * Time-interval overlap detection for lesson scheduling. Two lessons for the
 * same teacher may not overlap; back-to-back lessons (one ends exactly when the
 * next begins) do NOT conflict.
 */

export interface Interval {
  start: Date;
  end: Date;
}

/** Builds an interval from a start instant and a duration in minutes. */
export function toInterval(start: Date, durationMin: number): Interval {
  return { start, end: new Date(start.getTime() + durationMin * 60_000) };
}

/**
 * True when the two intervals share a positive-length span. Half-open
 * semantics: touching endpoints (a.end === b.start) are not an overlap.
 */
export function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

export interface BusyInterval extends Interval {
  /** Opaque identifier of the occupying lesson, echoed back in conflicts. */
  id: string;
}

/** Returns every busy interval that overlaps `candidate` (empty = free slot). */
export function findConflicts(
  candidate: Interval,
  existing: readonly BusyInterval[],
): BusyInterval[] {
  return existing.filter((busy) => intervalsOverlap(candidate, busy));
}
