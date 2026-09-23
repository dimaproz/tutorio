import { describe, expect, it } from 'vitest';
import { zonedDayRange, zonedDaysBetween, zonedWeekRange } from './calendar-range';

describe('zoned calendar ranges', () => {
  it('finds the Kyiv Monday-to-Sunday week around an instant', () => {
    // Thursday 2026-09-24 10:00 UTC = 13:00 in Kyiv (UTC+3).
    const { start, end } = zonedWeekRange(new Date('2026-09-24T10:00:00Z'), 'Europe/Kyiv');
    expect(start.toISOString()).toBe('2026-09-20T21:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-27T21:00:00.000Z');
  });

  it('treats a late Sunday UTC instant as Monday in a zone ahead of UTC', () => {
    // Sunday 22:30 UTC is already Monday 01:30 in Kyiv: a new week.
    const { start } = zonedWeekRange(new Date('2026-09-27T22:30:00Z'), 'Europe/Kyiv');
    expect(start.toISOString()).toBe('2026-09-27T21:00:00.000Z');
  });

  it('keeps a 23-hour day across the spring DST switch', () => {
    const { start, end } = zonedDayRange(new Date('2026-03-29T12:00:00Z'), 'Europe/Kyiv');
    expect(end.getTime() - start.getTime()).toBe(23 * 60 * 60 * 1000);
  });

  it('rolls weeks over month and year ends', () => {
    const { start, end } = zonedWeekRange(new Date('2026-12-31T12:00:00Z'), 'UTC');
    expect(start.toISOString()).toBe('2026-12-28T00:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-04T00:00:00.000Z');
  });

  it('counts local days between two instants', () => {
    expect(
      zonedDaysBetween(
        new Date('2026-09-24T20:00:00Z'),
        new Date('2026-09-24T22:00:00Z'),
        'Europe/Kyiv',
      ),
    ).toBe(1);
  });
});
