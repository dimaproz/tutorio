import { describe, expect, it } from 'vitest';
import {
  ATTENTION_KINDS,
  debtorsOf,
  dueForecast,
  expectsRenewal,
  expiresUnused,
  needsAttendance,
  pauseAttention,
  receivedTotals,
  studioPeriods,
  summaryNames,
} from './dashboard';

const KYIV = 'Europe/Kyiv';
// Saturday 26 September 2026, 13:05 in Kyiv (UTC+3).
const now = new Date('2026-09-26T10:05:00.000Z');
const days = (n: number) => n * 24 * 60 * 60 * 1000;

describe('the studio periods', () => {
  it('starts the day and the month on the studio clock', () => {
    expect(studioPeriods(now, KYIV)).toEqual({
      today: '2026-09-26',
      dayStart: new Date('2026-09-25T21:00:00.000Z'),
      dayEnd: new Date('2026-09-26T21:00:00.000Z'),
      monthStart: new Date('2026-08-31T21:00:00.000Z'),
      monthEnd: new Date('2026-09-30T21:00:00.000Z'),
    });
  });

  it('keeps an early-morning instant in its own studio day', () => {
    // 1 October 00:30 in Kyiv is still 30 September in UTC.
    const early = new Date('2026-09-30T21:30:00.000Z');
    expect(studioPeriods(early, KYIV).today).toBe('2026-10-01');
    expect(studioPeriods(early, KYIV).monthStart).toEqual(new Date('2026-09-30T21:00:00.000Z'));
  });
});

describe('unconfirmed attendance (L-72, L-74)', () => {
  const group = {
    isGroup: true,
    status: 'COMPLETED' as const,
    startsAtUtc: new Date('2026-09-26T08:15:00.000Z'),
    durationMin: 60,
    confirmed: false,
  };

  it('flags a group lesson that is over and nobody marked', () => {
    expect(needsAttendance(group, now)).toBe(true);
  });

  it('flags a finished lesson the automation has not held yet', () => {
    expect(needsAttendance({ ...group, status: 'SCHEDULED' }, now)).toBe(true);
  });

  it('leaves out a confirmed, running, cancelled or individual lesson', () => {
    expect(needsAttendance({ ...group, confirmed: true }, now)).toBe(false);
    expect(
      needsAttendance({ ...group, startsAtUtc: new Date('2026-09-26T09:30:00.000Z') }, now),
    ).toBe(false);
    expect(needsAttendance({ ...group, status: 'CANCELLED_UNCHARGED' }, now)).toBe(false);
    expect(needsAttendance({ ...group, isGroup: false }, now)).toBe(false);
  });
});

describe('packages that would expire unused (L-84)', () => {
  it('flags a live package whose window closes within three days', () => {
    expect(
      expiresUnused({ remainingCredits: 3, expiresAt: new Date(now.getTime() + days(3)) }, now),
    ).toBe(true);
  });

  it('leaves out a later end, a used-up, an expired or an open package', () => {
    const later = new Date(now.getTime() + days(3) + 1);
    expect(expiresUnused({ remainingCredits: 3, expiresAt: later }, now)).toBe(false);
    expect(
      expiresUnused({ remainingCredits: 0, expiresAt: new Date(now.getTime() + days(1)) }, now),
    ).toBe(false);
    expect(
      expiresUnused({ remainingCredits: 2, expiresAt: new Date(now.getTime() - 1) }, now),
    ).toBe(false);
    expect(expiresUnused({ remainingCredits: 2, expiresAt: null }, now)).toBe(false);
  });
});

describe('pauses to look at (L-103)', () => {
  it('flags a running pause that ends within three days', () => {
    const pause = {
      startsAt: new Date(now.getTime() - days(10)),
      endsAt: new Date(now.getTime() + days(2)),
    };
    expect(pauseAttention(pause, now)).toBe('RETURNING');
  });

  it('flags an open pause after thirty days', () => {
    expect(
      pauseAttention({ startsAt: new Date(now.getTime() - days(45)), endsAt: null }, now),
    ).toBe('OPEN_LONG');
    expect(
      pauseAttention({ startsAt: new Date(now.getTime() - days(29)), endsAt: null }, now),
    ).toBeNull();
  });

  it('leaves out a later return, a planned or an ended pause', () => {
    const running = { startsAt: new Date(now.getTime() - days(1)) };
    expect(
      pauseAttention({ ...running, endsAt: new Date(now.getTime() + days(4)) }, now),
    ).toBeNull();
    expect(
      pauseAttention(
        { startsAt: new Date(now.getTime() + days(1)), endsAt: new Date(now.getTime() + days(2)) },
        now,
      ),
    ).toBeNull();
    expect(
      pauseAttention(
        {
          ...running,
          endsAt: new Date(now.getTime() + days(2)),
          endedAt: new Date(now.getTime() - 1),
        },
        now,
      ),
    ).toBeNull();
  });
});

describe('the seven-day forecast', () => {
  it('expects a renewal when the credits or the window run out within seven days', () => {
    expect(expectsRenewal({ creditsLeft: 2, expiresAt: null, upcomingLessons: 2 }, now)).toBe(true);
    expect(
      expectsRenewal(
        { creditsLeft: 6, expiresAt: new Date(now.getTime() + days(5)), upcomingLessons: 1 },
        now,
      ),
    ).toBe(true);
  });

  it('expects nothing while the credits outlast the week or no lesson comes', () => {
    expect(expectsRenewal({ creditsLeft: 3, expiresAt: null, upcomingLessons: 2 }, now)).toBe(
      false,
    );
    expect(expectsRenewal({ creditsLeft: 1, expiresAt: null, upcomingLessons: 0 }, now)).toBe(
      false,
    );
  });

  it('sums renewals and unpaid rests per currency, never across', () => {
    expect(
      dueForecast([
        { currency: 'UAH', renewalMinor: 320000, owedMinor: 0 },
        { currency: 'UAH', renewalMinor: null, owedMinor: 220000 },
        { currency: 'UAH', renewalMinor: 320000, owedMinor: 100000 },
        { currency: 'PLN', renewalMinor: 48000, owedMinor: 0 },
        { currency: 'PLN', renewalMinor: null, owedMinor: 0 },
      ]),
    ).toEqual([
      { currency: 'PLN', amountMinor: 48000, packages: 1 },
      { currency: 'UAH', amountMinor: 960000, packages: 3 },
    ]);
  });
});

describe('money received', () => {
  const periods = studioPeriods(now, KYIV);

  it('sums this month and today per currency, refunds taken off', () => {
    const totals = receivedTotals(
      [
        {
          amountMinor: 320000,
          currency: 'UAH',
          status: 'PAID',
          paidAt: new Date('2026-09-26T07:00:00.000Z'),
        },
        {
          amountMinor: 1000000,
          currency: 'UAH',
          status: 'PAID',
          paidAt: new Date('2026-09-02T07:00:00.000Z'),
        },
        {
          amountMinor: 50000,
          currency: 'UAH',
          status: 'REFUNDED',
          paidAt: new Date('2026-09-10T07:00:00.000Z'),
        },
        {
          amountMinor: 20000,
          currency: 'PLN',
          status: 'PAID',
          paidAt: new Date('2026-09-05T07:00:00.000Z'),
        },
        // Before the studio's month began.
        {
          amountMinor: 90000,
          currency: 'UAH',
          status: 'PAID',
          paidAt: new Date('2026-08-31T20:59:00.000Z'),
        },
      ],
      periods,
    );
    expect(totals).toEqual([
      { currency: 'PLN', monthMinor: 20000, todayMinor: 0 },
      { currency: 'UAH', monthMinor: 1270000, todayMinor: 320000 },
    ]);
  });
});

describe('debtors', () => {
  it('keeps the direction of a debt that comes from one direction', () => {
    const one = {
      studentId: 'a',
      currency: 'UAH',
      amountMinor: 100,
      lessons: 1,
      oldestAt: new Date(1),
    };
    expect(
      debtorsOf([
        { ...one, enrollmentId: 'e1' },
        { ...one, enrollmentId: 'e1' },
      ]).rows[0]?.enrollmentId,
    ).toBe('e1');
    expect(
      debtorsOf([
        { ...one, enrollmentId: 'e1' },
        { ...one, enrollmentId: 'e2' },
      ]).rows[0]?.enrollmentId,
    ).toBe(undefined);
  });

  it('groups debts by student and currency, the largest first', () => {
    const debtors = debtorsOf([
      { studentId: 'b', currency: 'UAH', amountMinor: 40000, lessons: 1, oldestAt: new Date(1) },
      { studentId: 'a', currency: 'UAH', amountMinor: 60000, lessons: 2, oldestAt: new Date(5) },
      { studentId: 'b', currency: 'UAH', amountMinor: 40000, lessons: 1, oldestAt: new Date(3) },
      { studentId: 'b', currency: 'PLN', amountMinor: 12000, lessons: 1, oldestAt: new Date(2) },
      { studentId: 'c', currency: 'UAH', amountMinor: 0, lessons: 0, oldestAt: new Date(2) },
    ]);
    expect(debtors.rows).toEqual([
      { studentId: 'b', currency: 'UAH', amountMinor: 80000, lessons: 2, oldestAt: new Date(1) },
      { studentId: 'a', currency: 'UAH', amountMinor: 60000, lessons: 2, oldestAt: new Date(5) },
      { studentId: 'b', currency: 'PLN', amountMinor: 12000, lessons: 1, oldestAt: new Date(2) },
    ]);
    expect(debtors.rows.map((row) => row.enrollmentId)).toEqual([undefined, undefined, undefined]);
    expect(debtors.totals).toEqual([
      { currency: 'PLN', amountMinor: 12000, students: 1 },
      { currency: 'UAH', amountMinor: 140000, students: 2 },
    ]);
  });
});

describe('a category summary', () => {
  it('names the first two, each once', () => {
    expect(summaryNames(['Anna', 'Anna', 'Petro', 'Ira'])).toEqual(['Anna', 'Petro']);
  });

  it('keeps the brief order of the categories', () => {
    expect(ATTENTION_KINDS).toEqual([
      'attendance',
      'makeups',
      'debtors',
      'unpaidPackages',
      'endingPackages',
      'expiringPackages',
      'pauses',
    ]);
  });
});
