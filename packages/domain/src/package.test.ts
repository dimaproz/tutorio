import { describe, expect, it } from 'vitest';
import {
  effectiveTotalMinor,
  InvalidPackagePlanError,
  paymentStatusOf,
  planPackage,
  remainingCredits,
  splitShares,
} from './package';

describe('planPackage — fixed count', () => {
  it('multiplies the snapshot price by the lesson count', () => {
    expect(
      planPackage({
        sizingMode: 'FIXED_COUNT',
        lessonsTotal: 8,
        pricePerLessonMinor: 45000,
      }),
    ).toEqual({
      lessonsTotal: 8,
      pricePerLessonMinor: 45000,
      totalPriceMinor: 360000,
    });
  });

  it('rejects a package with no lessons', () => {
    expect(() =>
      planPackage({ sizingMode: 'FIXED_COUNT', lessonsTotal: 0, pricePerLessonMinor: 100 }),
    ).toThrow(InvalidPackagePlanError);
  });

  it('rejects a negative price', () => {
    expect(() =>
      planPackage({ sizingMode: 'FIXED_COUNT', lessonsTotal: 4, pricePerLessonMinor: -1 }),
    ).toThrow(InvalidPackagePlanError);
  });
});

describe('planPackage — by period', () => {
  it('counts the lessons the recurrence produces up to an inclusive end date', () => {
    const plan = planPackage({
      sizingMode: 'BY_PERIOD',
      pricePerLessonMinor: 30000,
      rule: {
        weekdays: [1, 3], // Monday and Wednesday
        localTime: '10:00',
        timezone: 'Europe/Kyiv',
        startDate: new Date('2026-09-01T00:00:00.000Z'),
      },
      startsAt: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-09-30T23:59:59.999Z'),
    });
    // September 2026: Mondays 7,14,21,28 and Wednesdays 2,9,16,23,30 → 9.
    expect(plan.lessonsTotal).toBe(9);
    expect(plan.totalPriceMinor).toBe(9 * 30000);
  });

  it('requires the full window', () => {
    expect(() =>
      planPackage({ sizingMode: 'BY_PERIOD', pricePerLessonMinor: 100 }),
    ).toThrow(InvalidPackagePlanError);
  });
});

describe('effectiveTotalMinor', () => {
  it('discounts the lessons cancelled without charge', () => {
    // 10 000 purchased, one uncharged cancellation at 500 → 9 500.
    expect(effectiveTotalMinor(1000000, 50000, 1)).toBe(950000);
  });

  it('leaves the total untouched when nothing was cancelled free', () => {
    expect(effectiveTotalMinor(1000000, 50000, 0)).toBe(1000000);
  });

  it('never goes below zero', () => {
    expect(effectiveTotalMinor(100000, 50000, 5)).toBe(0);
  });
});

describe('splitShares', () => {
  it('splits a group package evenly', () => {
    expect(splitShares(950000, ['e1', 'e2'])).toEqual([
      { enrollmentId: 'e1', oweMinor: 475000 },
      { enrollmentId: 'e2', oweMinor: 475000 },
    ]);
  });

  it('gives the rounding remainder to the last share so the sum is exact', () => {
    const shares = splitShares(1000, ['a', 'b', 'c']);
    expect(shares.map((share) => share.oweMinor)).toEqual([333, 333, 334]);
    expect(shares.reduce((sum, share) => sum + share.oweMinor, 0)).toBe(1000);
  });

  it('returns nothing for an empty group', () => {
    expect(splitShares(1000, [])).toEqual([]);
  });

  it('rejects a negative total', () => {
    expect(() => splitShares(-1, ['a'])).toThrow(InvalidPackagePlanError);
  });
});

describe('paymentStatusOf', () => {
  it('is pending before any money arrives', () => {
    expect(paymentStatusOf(500, 0)).toBe('PENDING');
  });

  it('is partial while something is still owed', () => {
    expect(paymentStatusOf(500, 200)).toBe('PARTIAL');
  });

  it('is paid once the full amount (or more) is settled', () => {
    expect(paymentStatusOf(500, 500)).toBe('PAID');
    expect(paymentStatusOf(500, 600)).toBe('PAID');
  });
});

describe('remainingCredits', () => {
  it('reads the balance straight off the ledger', () => {
    expect(
      remainingCredits([
        { delta: 10, type: 'purchase' },
        { delta: -1, type: 'lesson_completed' },
        { delta: -1, type: 'lesson_completed' },
      ]),
    ).toBe(8);
  });
});
