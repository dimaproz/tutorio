import { describe, expect, it } from 'vitest';
import {
  lessonsPerWeekday,
  studioMonthRange,
  studioWeekRange,
  weeklyMinutes,
} from './teacher-load';

const KYIV = 'Europe/Kyiv';

describe('teacher load', () => {
  it('finds the studio week and month around an instant', () => {
    // Sunday 13 September 2026, 23:30 in Kyiv is still that week.
    const now = new Date('2026-09-13T20:30:00Z');
    expect(studioWeekRange(now, KYIV)).toEqual({
      monday: '2026-09-07',
      from: new Date('2026-09-06T21:00:00Z'),
      to: new Date('2026-09-13T21:00:00Z'),
    });
    expect(studioMonthRange(now, KYIV)).toEqual({
      from: new Date('2026-08-31T21:00:00Z'),
      to: new Date('2026-09-30T21:00:00Z'),
    });
  });

  it('crosses a year in the month range and a DST switch in the week', () => {
    expect(studioMonthRange(new Date('2026-12-15T10:00:00Z'), KYIV)).toEqual({
      from: new Date('2026-11-30T22:00:00Z'),
      to: new Date('2026-12-31T22:00:00Z'),
    });
    // The week of 26 October 2026 starts in summer time and ends in winter.
    expect(studioWeekRange(new Date('2026-10-28T12:00:00Z'), KYIV)).toEqual({
      monday: '2026-10-26',
      from: new Date('2026-10-25T22:00:00Z'),
      to: new Date('2026-11-01T22:00:00Z'),
    });
  });

  it('counts lessons per weekday on the studio clock, Monday first', () => {
    const starts = [
      new Date('2026-09-06T21:30:00Z'), // Monday 00:30 in Kyiv
      new Date('2026-09-07T12:00:00Z'),
      new Date('2026-09-09T13:00:00Z'),
      new Date('2026-09-13T20:59:00Z'), // Sunday 23:59
      new Date('2026-09-13T21:00:00Z'), // next Monday: outside
      new Date('2026-09-06T20:59:00Z'), // previous Sunday: outside
    ];
    expect(lessonsPerWeekday(starts, '2026-09-07', KYIV)).toEqual([2, 0, 1, 0, 0, 0, 1]);
  });

  it('sums minutes per week for the last weeks, oldest first', () => {
    const now = new Date('2026-09-09T09:00:00Z');
    const weeks = weeklyMinutes(
      [
        { startsAt: new Date('2026-09-08T12:00:00Z'), durationMin: 60 },
        { startsAt: new Date('2026-09-13T20:00:00Z'), durationMin: 90 },
        { startsAt: new Date('2026-08-31T08:00:00Z'), durationMin: 45 },
        { startsAt: new Date('2026-07-01T08:00:00Z'), durationMin: 600 },
      ],
      now,
      KYIV,
      3,
    );
    expect(weeks).toEqual([
      { weekStart: '2026-08-24', minutes: 0 },
      { weekStart: '2026-08-31', minutes: 45 },
      { weekStart: '2026-09-07', minutes: 150 },
    ]);
  });
});
