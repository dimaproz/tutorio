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

/** A lesson (booked or proposed) with who is in it. */
export interface ParticipantInterval extends Interval {
  id: string;
  teacherId: string;
  /** Students taking part: the individual student, or a group's members. */
  studentIds: readonly string[];
}

export interface ScheduleConflictMatch {
  /** The proposed lesson that overlaps. */
  candidateId: string;
  /** The booked (or earlier proposed) lesson it overlaps. */
  busyId: string;
  /** TEACHER when the teacher is double-booked, else STUDENT. */
  reason: 'TEACHER' | 'STUDENT';
  /** The students double-booked, when the reason is STUDENT. */
  studentIds: string[];
}

/**
 * Every overlap of a proposed lesson with a booked one, or with an earlier
 * proposed lesson of the same batch (product/scheduling.md L-110): the same
 * teacher, or a student taking part in both. A teacher clash wins over a
 * student clash for the same pair, so each pair is reported once.
 */
export function findScheduleConflicts(
  candidates: readonly ParticipantInterval[],
  busy: readonly ParticipantInterval[],
): ScheduleConflictMatch[] {
  const matches: ScheduleConflictMatch[] = [];
  const accepted: ParticipantInterval[] = [];
  for (const candidate of candidates) {
    const students = new Set(candidate.studentIds);
    for (const other of [...busy, ...accepted]) {
      if (other.id === candidate.id || !intervalsOverlap(candidate, other)) continue;
      if (other.teacherId === candidate.teacherId) {
        matches.push({
          candidateId: candidate.id,
          busyId: other.id,
          reason: 'TEACHER',
          studentIds: [],
        });
        continue;
      }
      const shared = other.studentIds.filter((id) => students.has(id));
      if (shared.length > 0) {
        matches.push({
          candidateId: candidate.id,
          busyId: other.id,
          reason: 'STUDENT',
          studentIds: shared,
        });
      }
    }
    accepted.push(candidate);
  }
  return matches;
}
