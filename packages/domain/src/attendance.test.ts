import { describe, expect, it } from 'vitest';
import {
  attendanceMarkKey,
  selectAttendanceWindow,
  summarizeAttendance,
  type AttendanceLesson,
  type AttendanceMark,
} from './attendance';

const day = (n: number) => new Date(Date.UTC(2026, 8, n, 14));

function lesson(id: string, n: number, status: AttendanceLesson['status'] = 'COMPLETED') {
  return { id, startsAt: day(n), status };
}

function marks(entries: [string, string, AttendanceMark][]) {
  return new Map(entries.map(([l, e, m]) => [attendanceMarkKey(l, e), m]));
}

describe('selectAttendanceWindow', () => {
  const lessons = [
    lesson('a', 1),
    lesson('b', 3, 'CANCELLED_CHARGED'),
    lesson('c', 5),
    lesson('d', 7, 'SCHEDULED'),
    lesson('e', 30),
  ];

  it('keeps the newest held lessons that already started, oldest first', () => {
    const window = selectAttendanceWindow(lessons, day(10), 2);
    expect(window.map((l) => l.id)).toEqual(['b', 'c']);
  });

  it('skips lessons still scheduled and lessons in the future', () => {
    const window = selectAttendanceWindow(lessons, day(10), 8);
    expect(window.map((l) => l.id)).toEqual(['a', 'b', 'c']);
  });

  it('reads the window before the current one with an offset', () => {
    const window = selectAttendanceWindow(lessons, day(10), 2, 2);
    expect(window.map((l) => l.id)).toEqual(['a']);
  });
});

describe('summarizeAttendance', () => {
  const lessons = [
    lesson('l1', 1),
    lesson('l2', 3),
    lesson('l3', 5, 'CANCELLED_UNCHARGED'),
    lesson('l4', 7),
    lesson('l5', 9),
  ];

  it('leaves cancelled lessons out of every rate and counts them apart', () => {
    const summary = summarizeAttendance({
      lessons,
      participants: [{ enrollmentId: 'anna', hold: false }],
      marks: marks([
        ['l1', 'anna', 'PRESENT'],
        ['l2', 'anna', 'PRESENT'],
        ['l4', 'anna', 'ABSENT'],
        ['l5', 'anna', 'PRESENT'],
      ]),
    });
    const [row] = summary.rows;
    expect(row!.cells).toEqual(['present', 'present', 'cancelled', 'absent', 'present']);
    expect(row!.rate).toBe(0.75);
    expect(summary.stats).toMatchObject({
      lessons: 5,
      held: 4,
      cancelled: 1,
      cancelledCharged: 0,
      cancelledFree: 1,
      misses: 1,
      expected: 4,
      rate: 0.75,
    });
  });

  it('flags two absences in a row at the end as a risk and sorts it first', () => {
    const summary = summarizeAttendance({
      lessons,
      participants: [
        { enrollmentId: 'mark', hold: false },
        { enrollmentId: 'artem', hold: false },
      ],
      marks: marks([
        ['l1', 'mark', 'ABSENT'],
        ['l2', 'mark', 'PRESENT'],
        ['l4', 'mark', 'PRESENT'],
        ['l5', 'mark', 'PRESENT'],
        ['l1', 'artem', 'PRESENT'],
        ['l2', 'artem', 'PRESENT'],
        ['l4', 'artem', 'ABSENT'],
        ['l5', 'artem', 'ABSENT'],
      ]),
    });
    expect(summary.rows.map((row) => row.enrollmentId)).toEqual(['artem', 'mark']);
    expect(summary.rows[0]).toMatchObject({ risk: true, trailingMisses: 2 });
    // One early absence is a lower rate, not a risk.
    expect(summary.rows[1]).toMatchObject({ risk: false, rate: 0.75 });
    expect(summary.rows[0]!.lastPresentAt).toEqual(day(3));
  });

  it('does not let a cancelled lesson break an absence streak', () => {
    const summary = summarizeAttendance({
      lessons: [lesson('x1', 1), lesson('x2', 2, 'CANCELLED_CHARGED'), lesson('x3', 3)],
      participants: [{ enrollmentId: 'e', hold: false }],
      marks: marks([
        ['x1', 'e', 'ABSENT'],
        ['x3', 'e', 'ABSENT'],
      ]),
    });
    expect(summary.rows[0]).toMatchObject({ trailingMisses: 2, risk: true, rate: 0 });
  });

  it('keeps a participant on hold out of the group figures', () => {
    const summary = summarizeAttendance({
      lessons,
      participants: [
        { enrollmentId: 'anna', hold: false },
        { enrollmentId: 'kate', hold: true },
      ],
      marks: marks([
        ['l1', 'anna', 'PRESENT'],
        ['l2', 'anna', 'PRESENT'],
        ['l1', 'kate', 'ABSENT'],
        ['l2', 'kate', 'ABSENT'],
      ]),
    });
    const kate = summary.rows.find((row) => row.enrollmentId === 'kate')!;
    expect(kate).toMatchObject({ hold: true, rate: null, risk: false });
    expect(summary.stats.rate).toBe(1);
    expect(summary.stats.misses).toBe(0);
    expect(summary.rows.map((row) => row.enrollmentId)).toEqual(['kate', 'anna']);
  });

  it('treats an excused absence as neither a presence nor a miss', () => {
    const summary = summarizeAttendance({
      lessons: [lesson('y1', 1), lesson('y2', 2)],
      participants: [{ enrollmentId: 'e', hold: false }],
      marks: marks([
        ['y1', 'e', 'EXCUSED'],
        ['y2', 'e', 'PRESENT'],
      ]),
    });
    expect(summary.rows[0]).toMatchObject({ cells: ['excused', 'present'], rate: 1, misses: 0 });
  });

  it('reports no rate when nothing was marked, and a previous-window rate for the trend', () => {
    const previous = [lesson('p1', 1)];
    const current = [lesson('c1', 20)];
    const summary = summarizeAttendance({
      lessons: current,
      previousLessons: previous,
      participants: [{ enrollmentId: 'e', hold: false }],
      marks: marks([['p1', 'e', 'ABSENT']]),
    });
    expect(summary.rows[0]!.cells).toEqual(['unmarked']);
    expect(summary.stats.rate).toBeNull();
    expect(summary.stats.previousRate).toBe(0);
  });

  it('handles a window of only cancelled lessons', () => {
    const summary = summarizeAttendance({
      lessons: [lesson('z1', 1, 'CANCELLED_CHARGED'), lesson('z2', 2, 'CANCELLED_UNCHARGED')],
      participants: [{ enrollmentId: 'e', hold: false }],
      marks: new Map(),
    });
    expect(summary.stats).toMatchObject({
      lessons: 2,
      held: 0,
      rate: null,
      cancelled: 2,
      cancelledCharged: 1,
      cancelledFree: 1,
    });
    expect(summary.rows[0]!.rate).toBeNull();
  });
});
