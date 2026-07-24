import { describe, expect, it } from 'vitest';
import { expandSeries, InvalidLocalTimeError, type RecurrenceRule } from './recurrence';

const EPOCH = new Date(0); // startDate floor that excludes nothing

function rule(partial: Partial<RecurrenceRule>): RecurrenceRule {
  return {
    weekdays: [1],
    localTime: '10:00',
    timezone: 'Europe/Berlin',
    startDate: EPOCH,
    ...partial,
  };
}

describe('expandSeries', () => {
  it('keeps the local wall-clock time constant across a DST boundary (no drift)', () => {
    // Same rule (Monday 10:00 Berlin) yields different UTC offsets in winter
    // (CET, UTC+1) and summer (CEST, UTC+2) — the point of storing the rule
    // in local time and materializing to UTC.
    const winter = expandSeries(rule({}), {
      from: new Date(Date.UTC(2026, 0, 5)),
      until: new Date(Date.UTC(2026, 0, 6)),
    });
    const summer = expandSeries(rule({}), {
      from: new Date(Date.UTC(2026, 6, 6)),
      until: new Date(Date.UTC(2026, 6, 7)),
    });

    expect(winter).toHaveLength(1);
    expect(summer).toHaveLength(1);
    expect(winter[0]!.getTime()).toBe(Date.UTC(2026, 0, 5, 9, 0)); // 10:00 CET
    expect(summer[0]!.getTime()).toBe(Date.UTC(2026, 6, 6, 8, 0)); // 10:00 CEST
  });

  it('skips a non-existent local time in the spring-forward gap', () => {
    // 2026-03-29 Berlin: clocks jump 02:00 → 03:00, so 02:30 does not exist.
    const gap = expandSeries(rule({ weekdays: [0], localTime: '02:30' }), {
      from: new Date(Date.UTC(2026, 2, 29)),
      until: new Date(Date.UTC(2026, 2, 30)),
    });
    expect(gap).toHaveLength(0);

    // The previous Sunday has a normal 02:30 (CET, UTC+1 → 01:30Z).
    const normal = expandSeries(rule({ weekdays: [0], localTime: '02:30' }), {
      from: new Date(Date.UTC(2026, 2, 22)),
      until: new Date(Date.UTC(2026, 2, 23)),
    });
    expect(normal).toHaveLength(1);
    expect(normal[0]!.getTime()).toBe(Date.UTC(2026, 2, 22, 1, 30));
  });

  it('keeps an ambiguous local time in the fall-back overlap', () => {
    // 2026-10-25 Berlin: clocks fall 03:00 → 02:00, so 02:30 occurs twice.
    // Both instants are valid; we keep exactly one slot.
    const ambiguous = expandSeries(rule({ weekdays: [0], localTime: '02:30' }), {
      from: new Date(Date.UTC(2026, 9, 25)),
      until: new Date(Date.UTC(2026, 9, 26)),
    });
    expect(ambiguous).toHaveLength(1);
  });

  it('uses the local calendar weekday, not the UTC weekday', () => {
    // Monday 23:00 Los Angeles (PST, UTC-8) is Tuesday 07:00 UTC. Selecting
    // weekday Monday must still produce this slot.
    const slots = expandSeries(
      rule({ weekdays: [1], localTime: '23:00', timezone: 'America/Los_Angeles' }),
      {
        from: new Date(Date.UTC(2026, 0, 5)),
        until: new Date(Date.UTC(2026, 0, 7)),
      },
    );
    expect(slots).toHaveLength(1);
    expect(slots[0]!.getTime()).toBe(Date.UTC(2026, 0, 6, 7, 0)); // Tue 07:00Z
    expect(slots[0]!.getUTCDay()).toBe(2); // Tuesday in UTC
  });

  it('expands multiple weekdays across several weeks, ascending', () => {
    const slots = expandSeries(rule({ weekdays: [1, 3] }), {
      from: new Date(Date.UTC(2026, 0, 1)),
      until: new Date(Date.UTC(2026, 0, 15)),
    });
    // Mon/Wed for two weeks: Jan 5, 7, 12, 14.
    expect(slots).toHaveLength(4);
    expect(slots.map((s) => s.getUTCDate())).toEqual([5, 7, 12, 14]);
    for (let i = 1; i < slots.length; i += 1) {
      expect(slots[i]!.getTime()).toBeGreaterThan(slots[i - 1]!.getTime());
    }
  });

  it('respects the startDate floor and half-open window bounds', () => {
    const floored = expandSeries(
      rule({ startDate: new Date(Date.UTC(2026, 0, 12)) }),
      { from: new Date(Date.UTC(2026, 0, 1)), until: new Date(Date.UTC(2026, 0, 20)) },
    );
    // Mondays Jan 5 & 12 & 19; startDate excludes Jan 5.
    expect(floored.map((s) => s.getUTCDate())).toEqual([12, 19]);
  });

  it('returns nothing for an empty or inverted window', () => {
    const t = new Date(Date.UTC(2026, 0, 5));
    expect(expandSeries(rule({}), { from: t, until: t })).toEqual([]);
    expect(
      expandSeries(rule({}), { from: t, until: new Date(t.getTime() - 1000) }),
    ).toEqual([]);
  });

  it('rejects a malformed local time', () => {
    for (const bad of ['9:00', '24:00', '10:60', '1000', '', 'aa:bb']) {
      expect(() => expandSeries(rule({ localTime: bad }), {
        from: new Date(Date.UTC(2026, 0, 1)),
        until: new Date(Date.UTC(2026, 0, 2)),
      })).toThrow(InvalidLocalTimeError);
    }
  });
});
