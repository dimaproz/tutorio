import { describe, expect, it } from 'vitest';
import {
  busySlots,
  daysWindow,
  localInstant,
  overlapping,
  teacherBusyAt,
  type BusyLesson,
} from './busy';

/** The studio's zone; the process runs in another one (vitest config). */
const TZ = 'Europe/Kyiv';
const iso = (date: string, time: string) => new Date(localInstant(date, time, TZ)).toISOString();

function lesson(fields: Partial<BusyLesson> & Pick<BusyLesson, 'id'>): BusyLesson {
  return {
    startsAtUtc: iso('2026-10-01', '18:00'),
    durationMin: 90,
    status: 'SCHEDULED',
    teacherId: 'dmytro',
    groupId: null,
    student: null,
    group: null,
    ...fields,
  };
}

const B2 = lesson({ id: 'b2', groupId: 'g1', group: { id: 'g1', name: 'B2 prep' } });
const ANNA = lesson({
  id: 'anna',
  teacherId: 'iryna',
  startsAtUtc: iso('2026-10-01', '10:00'),
  durationMin: 60,
  student: { id: 's1', fullName: 'Anna Shevchenko' },
});
const CANCELLED = lesson({
  id: 'x',
  status: 'CANCELLED_UNCHARGED',
  startsAtUtc: iso('2026-10-01', '12:00'),
});

describe('busySlots', () => {
  it('marks the slots that start while a lesson is on, with the name', () => {
    const marks = busySlots(
      [B2],
      { teacherId: 'dmytro' },
      '2026-10-01',
      ['17:45', '18:00', '18:30', '19:15', '19:30'],
      TZ,
    );
    expect(marks).toEqual({ '18:00': 'B2 prep', '18:30': 'B2 prep', '19:15': 'B2 prep' });
  });

  it('checks the student and their groups, not other teachers', () => {
    const lessons = [B2, ANNA];
    expect(
      busySlots(lessons, { teacherId: 'oleh', studentId: 's1' }, '2026-10-01', ['10:00'], TZ),
    ).toEqual({
      '10:00': 'Anna Shevchenko',
    });
    expect(
      busySlots(lessons, { teacherId: 'oleh', groupIds: ['g1'] }, '2026-10-01', ['18:30'], TZ),
    ).toEqual({
      '18:30': 'B2 prep',
    });
    expect(busySlots(lessons, { teacherId: 'oleh' }, '2026-10-01', ['10:00', '18:30'], TZ)).toEqual(
      {},
    );
  });

  it('ignores cancelled lessons and the lesson being edited', () => {
    expect(busySlots([CANCELLED], { teacherId: 'dmytro' }, '2026-10-01', ['12:00'], TZ)).toEqual(
      {},
    );
    expect(
      busySlots([B2], { teacherId: 'dmytro', excludeLessonId: 'b2' }, '2026-10-01', ['18:00'], TZ),
    ).toEqual({});
  });

  it('marks nothing without a date', () => {
    expect(busySlots([B2], { teacherId: 'dmytro' }, '', ['18:00'], TZ)).toEqual({});
  });
});

describe('teacherBusyAt and overlapping', () => {
  it('finds the teacher lesson across the new slot', () => {
    expect(
      teacherBusyAt([B2, ANNA], 'dmytro', localInstant('2026-10-01', '17:30', TZ), 60)?.id,
    ).toBe('b2');
    expect(
      teacherBusyAt([B2, ANNA], 'dmytro', localInstant('2026-10-01', '16:00', TZ), 60),
    ).toBeUndefined();
    expect(
      overlapping([B2], { teacherId: 'dmytro' }, localInstant('2026-10-01', '19:30', TZ), 30),
    ).toEqual([]);
  });
});

describe('daysWindow', () => {
  it('spans the first to the day after the last date', () => {
    const window = daysWindow(['2026-10-08', '', '2026-10-01'], TZ);
    expect(window).toEqual({
      from: '2026-09-30T21:00:00.000Z',
      to: '2026-10-08T21:00:00.000Z',
    });
    expect(daysWindow(['', 'x'], TZ)).toBeNull();
  });
});
