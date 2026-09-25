import { afterEach, describe, expect, it } from 'vitest';
import {
  addCalendarDays,
  addCalendarMonths,
  calendarDaysBetween,
  calendarWeekStart,
  calendarWeekday,
  isCalendarDate,
  zonedDate,
  zonedDateTime,
  zonedDayEnd,
  zonedDayStart,
  zonedMinutesOfDay,
  zonedTime,
  zonedWeekday,
} from './wall-clock';

const KYIV = 'Europe/Kyiv';
const originalTz = process.env.TZ;

/** Runs the same checks with the process in several zones: none may leak in. */
const RUNTIME_ZONES = ['UTC', 'Asia/Tbilisi', 'Europe/Warsaw', 'America/New_York'];

afterEach(() => {
  process.env.TZ = originalTz;
});

describe.each(RUNTIME_ZONES)('the studio wall clock with the runtime in %s', (runtimeZone) => {
  const inRuntime = () => {
    process.env.TZ = runtimeZone;
  };

  it('reads a typed date and time on the studio clock', () => {
    inRuntime();
    expect(zonedDateTime('2026-10-30', '17:00', KYIV).toISOString()).toBe(
      '2026-10-30T15:00:00.000Z',
    );
    expect(zonedDateTime('2026-09-30', '17:00', KYIV).toISOString()).toBe(
      '2026-09-30T14:00:00.000Z',
    );
  });

  it('ends a day at the studio midnight', () => {
    inRuntime();
    expect(zonedDayStart('2026-10-30', KYIV).toISOString()).toBe('2026-10-29T22:00:00.000Z');
    expect(zonedDayEnd('2026-10-30', KYIV).toISOString()).toBe('2026-10-30T22:00:00.000Z');
  });

  it('keeps a 25-hour day on the autumn switch (25 October 2026 in Kyiv)', () => {
    inRuntime();
    const start = zonedDayStart('2026-10-25', KYIV);
    const end = zonedDayEnd('2026-10-25', KYIV);
    expect(start.toISOString()).toBe('2026-10-24T21:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-25T22:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(25 * 60 * 60 * 1000);
    // The same wall time a day apart is 25 hours apart across the switch.
    expect(
      zonedDateTime('2026-10-25', '17:00', KYIV).getTime() -
        zonedDateTime('2026-10-24', '17:00', KYIV).getTime(),
    ).toBe(25 * 60 * 60 * 1000);
  });

  it('keeps a 23-hour day on the spring switch', () => {
    inRuntime();
    const start = zonedDayStart('2026-03-29', KYIV);
    expect(zonedDayEnd('2026-03-29', KYIV).getTime() - start.getTime()).toBe(23 * 3_600_000);
  });

  it('resolves the times the clock skips and repeats', () => {
    inRuntime();
    // 29 March 2026: 03:00 → 04:00 in Kyiv; 03:30 does not exist and reads 04:30.
    expect(zonedDateTime('2026-03-29', '03:30', KYIV).toISOString()).toBe(
      '2026-03-29T01:30:00.000Z',
    );
    // 25 October 2026: 04:00 → 03:00; 03:30 happens twice, the first one wins.
    expect(zonedDateTime('2026-10-25', '03:30', KYIV).toISOString()).toBe(
      '2026-10-25T00:30:00.000Z',
    );
  });

  it('reads an instant back as the studio date, time and weekday', () => {
    inRuntime();
    // 21:30 UTC on Friday 30 October is already Saturday 31 October in Kyiv.
    const late = '2026-10-30T22:30:00.000Z';
    expect(zonedDate(late, KYIV)).toBe('2026-10-31');
    expect(zonedTime(late, KYIV)).toBe('00:30');
    expect(zonedWeekday(late, KYIV)).toBe(6);
    expect(zonedMinutesOfDay(late, KYIV)).toBe(30);
  });

  it('tells today around the studio midnight', () => {
    inRuntime();
    expect(zonedDate(new Date('2026-09-24T20:59:00Z'), KYIV)).toBe('2026-09-24');
    expect(zonedDate(new Date('2026-09-24T21:00:00Z'), KYIV)).toBe('2026-09-25');
  });

  it('round-trips a wall time', () => {
    inRuntime();
    const instant = zonedDateTime('2026-10-25', '09:15', KYIV);
    expect(zonedDate(instant, KYIV)).toBe('2026-10-25');
    expect(zonedTime(instant, KYIV)).toBe('09:15');
  });
});

describe('the cached offsets', () => {
  it('read two years of instants as Intl does, across switches and in odd zones', () => {
    const zones = [
      KYIV,
      'America/New_York',
      'Asia/Kathmandu',
      'Australia/Lord_Howe',
      'Pacific/Chatham',
      'UTC',
    ];
    const from = Date.parse('2026-01-01T00:07:00Z');
    for (const zone of zones) {
      // Swedish writes "2026-03-29 02:07": the same shape as the helpers.
      const reference = new Intl.DateTimeFormat('sv-SE', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
      for (let ms = from; ms < from + 2 * 365 * 86_400_000; ms += 3 * 3_600_000 + 15 * 60_000) {
        expect(`${zonedDate(ms, zone)} ${zonedTime(ms, zone)}`).toBe(reference.format(ms));
      }
    }
    // The hour before the spring switch in Kyiv (01:00 UTC) is still winter time.
    expect(zonedTime('2026-03-29T00:07:00Z', KYIV)).toBe('02:07');
    expect(zonedTime('2026-03-29T01:07:00Z', KYIV)).toBe('04:07');
  });

  it('refuses a zone that does not exist', () => {
    expect(() => zonedDate(Date.now(), 'Mars/Olympus')).toThrow(RangeError);
  });
});

describe('calendar dates', () => {
  it('adds days across months, years and the DST switch', () => {
    expect(addCalendarDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addCalendarDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addCalendarDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('adds months, clamping to the last day', () => {
    expect(addCalendarMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addCalendarMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addCalendarMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addCalendarMonths('2026-03-31', -1)).toBe('2026-02-28');
  });

  it('knows weekdays and weeks', () => {
    expect(calendarWeekday('2026-10-25')).toBe(0);
    expect(calendarWeekStart('2026-10-25')).toBe('2026-10-19');
    expect(calendarWeekStart('2026-10-19')).toBe('2026-10-19');
  });

  it('counts days between dates', () => {
    expect(calendarDaysBetween('2026-09-25', '2026-10-30')).toBe(35);
    expect(calendarDaysBetween('2026-10-30', '2026-09-25')).toBe(-35);
  });

  it('validates a calendar date', () => {
    expect(isCalendarDate('2026-02-28')).toBe(true);
    expect(isCalendarDate('2026-02-30')).toBe(false);
    expect(isCalendarDate('2026-2-3')).toBe(false);
  });
});
