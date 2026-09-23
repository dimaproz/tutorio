// Group attendance over a window of recently held lessons.
//
// The rules are product decisions, not rendering details:
// - a cancelled lesson is nobody's miss: it is a grey cell for everyone and is
//   left out of every rate;
// - an excused absence is neither a presence nor a miss;
// - a participant on hold is left out of the group figures and has no rate;
// - "at risk" means two or more absences in a row at the end of the window,
//   not a low rate — a low rate usually means one illness weeks ago.

export type AttendanceMark = 'PRESENT' | 'ABSENT' | 'EXCUSED';

export type AttendanceLessonStatus =
  'SCHEDULED' | 'COMPLETED' | 'CANCELLED_CHARGED' | 'CANCELLED_UNCHARGED';

export type AttendanceCell = 'present' | 'absent' | 'excused' | 'cancelled' | 'unmarked';

export interface AttendanceLesson {
  id: string;
  startsAt: Date;
  status: AttendanceLessonStatus;
}

export interface AttendanceParticipant {
  enrollmentId: string;
  /** On a break: shown, but kept out of the group figures. */
  hold: boolean;
}

export interface AttendanceRow {
  enrollmentId: string;
  /** One cell per window lesson, oldest first. */
  cells: AttendanceCell[];
  present: number;
  misses: number;
  /** present / (present + misses); null with nothing to count or on hold. */
  rate: number | null;
  /** Absences in a row at the end of the window, skipping neutral cells. */
  trailingMisses: number;
  lastPresentAt: Date | null;
  hold: boolean;
  risk: boolean;
}

export interface AttendanceSummary {
  /** Lessons in the window, oldest first. */
  lessons: AttendanceLesson[];
  stats: {
    lessons: number;
    held: number;
    /** Group rate over participants not on hold; null when nothing counts. */
    rate: number | null;
    /** The same rate over the window before this one, for the trend. */
    previousRate: number | null;
    misses: number;
    /** Presences plus misses: every visit that was expected and counted. */
    expected: number;
    cancelled: number;
    cancelledCharged: number;
    cancelledFree: number;
  };
  /** Worst first: at risk, then on hold, then by rate, then as given. */
  rows: AttendanceRow[];
}

/** Consecutive absences that make a participant "at risk". */
export const ATTENDANCE_RISK_STREAK = 2;

/** Default number of held lessons the group page looks back over. */
export const ATTENDANCE_DEFAULT_WINDOW = 8;

const markKey = (lessonId: string, enrollmentId: string) => `${lessonId}:${enrollmentId}`;

function isCancelled(status: AttendanceLessonStatus): boolean {
  return status === 'CANCELLED_CHARGED' || status === 'CANCELLED_UNCHARGED';
}

/**
 * The lessons a window counts: held (completed or cancelled) and already
 * started, newest `size` of them, returned oldest first. A lesson that is
 * still SCHEDULED after its start has not been confirmed as held.
 */
export function selectAttendanceWindow(
  lessons: readonly AttendanceLesson[],
  now: Date,
  size: number,
  offset = 0,
): AttendanceLesson[] {
  return lessons
    .filter((lesson) => lesson.status !== 'SCHEDULED' && lesson.startsAt.getTime() <= now.getTime())
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime() || a.id.localeCompare(b.id))
    .slice(offset, offset + size)
    .reverse();
}

function cellFor(
  lesson: AttendanceLesson,
  enrollmentId: string,
  marks: ReadonlyMap<string, AttendanceMark>,
): AttendanceCell {
  if (isCancelled(lesson.status)) return 'cancelled';
  const mark = marks.get(markKey(lesson.id, enrollmentId));
  if (mark === 'PRESENT') return 'present';
  if (mark === 'ABSENT') return 'absent';
  if (mark === 'EXCUSED') return 'excused';
  return 'unmarked';
}

function rowFor(
  participant: AttendanceParticipant,
  lessons: readonly AttendanceLesson[],
  marks: ReadonlyMap<string, AttendanceMark>,
): AttendanceRow {
  const cells = lessons.map((lesson) => cellFor(lesson, participant.enrollmentId, marks));
  const present = cells.filter((cell) => cell === 'present').length;
  const misses = cells.filter((cell) => cell === 'absent').length;

  let trailingMisses = 0;
  for (let index = cells.length - 1; index >= 0; index -= 1) {
    const cell = cells[index];
    if (cell === 'absent') trailingMisses += 1;
    else if (cell === 'present') break;
    // cancelled, excused and unmarked neither break nor extend a streak
  }

  let lastPresentAt: Date | null = null;
  cells.forEach((cell, index) => {
    if (cell === 'present') lastPresentAt = lessons[index]!.startsAt;
  });

  const counted = present + misses;
  return {
    enrollmentId: participant.enrollmentId,
    cells,
    present,
    misses,
    rate: participant.hold || counted === 0 ? null : present / counted,
    trailingMisses,
    lastPresentAt,
    hold: participant.hold,
    risk: !participant.hold && trailingMisses >= ATTENDANCE_RISK_STREAK,
  };
}

function groupRate(rows: readonly AttendanceRow[]): number | null {
  const counted = rows.filter((row) => !row.hold);
  const present = counted.reduce((sum, row) => sum + row.present, 0);
  const expected = counted.reduce((sum, row) => sum + row.present + row.misses, 0);
  return expected === 0 ? null : present / expected;
}

function rank(row: AttendanceRow): number {
  if (row.risk) return 0;
  if (row.hold) return 1;
  return 2;
}

/**
 * Summarizes attendance for a group over the given window lessons (and the
 * window before it, for the trend). `marks` is keyed by lesson and
 * enrollment; `participants` keep their given order as the final tie-break,
 * so the caller decides it (by name, usually).
 */
export function summarizeAttendance(input: {
  lessons: readonly AttendanceLesson[];
  previousLessons?: readonly AttendanceLesson[];
  participants: readonly AttendanceParticipant[];
  marks: ReadonlyMap<string, AttendanceMark>;
}): AttendanceSummary {
  const { lessons, participants, marks } = input;
  const rows = participants.map((participant) => rowFor(participant, lessons, marks));
  const previousRows = participants.map((participant) =>
    rowFor(participant, input.previousLessons ?? [], marks),
  );

  const counted = rows.filter((row) => !row.hold);
  const cancelled = lessons.filter((lesson) => isCancelled(lesson.status));

  const order = new Map(
    participants.map((participant, index) => [participant.enrollmentId, index]),
  );
  const sorted = [...rows].sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    if (a.risk && b.risk && a.trailingMisses !== b.trailingMisses) {
      return b.trailingMisses - a.trailingMisses;
    }
    const aRate = a.rate ?? Number.POSITIVE_INFINITY;
    const bRate = b.rate ?? Number.POSITIVE_INFINITY;
    if (aRate !== bRate) return aRate - bRate;
    return (order.get(a.enrollmentId) ?? 0) - (order.get(b.enrollmentId) ?? 0);
  });

  return {
    lessons: [...lessons],
    stats: {
      lessons: lessons.length,
      held: lessons.filter((lesson) => lesson.status === 'COMPLETED').length,
      rate: groupRate(rows),
      previousRate: input.previousLessons?.length ? groupRate(previousRows) : null,
      misses: counted.reduce((sum, row) => sum + row.misses, 0),
      expected: counted.reduce((sum, row) => sum + row.present + row.misses, 0),
      cancelled: cancelled.length,
      cancelledCharged: cancelled.filter((lesson) => lesson.status === 'CANCELLED_CHARGED').length,
      cancelledFree: cancelled.filter((lesson) => lesson.status === 'CANCELLED_UNCHARGED').length,
    },
    rows: sorted,
  };
}

/** The key `summarizeAttendance` looks marks up by. */
export function attendanceMarkKey(lessonId: string, enrollmentId: string): string {
  return markKey(lessonId, enrollmentId);
}
