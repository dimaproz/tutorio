import { describe, expect, it } from 'vitest';
import {
  assertPaymentWithinOutstanding,
  compareEndingFirst,
  isPackageEnding,
  packageLifecycle,
  InvalidPackagePlanError,
  OverpaymentError,
  paymentStatusOf,
  planPackage,
  transferCredits,
  weeklyLessons,
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
    expect(() => planPackage({ sizingMode: 'BY_PERIOD', pricePerLessonMinor: 100 })).toThrow(
      InvalidPackagePlanError,
    );
  });

  it('rejects a period that contains no scheduled lessons', () => {
    const startDate = new Date('2026-09-01T00:00:00.000Z');
    expect(() =>
      planPackage({
        sizingMode: 'BY_PERIOD',
        pricePerLessonMinor: 100,
        rules: [
          {
            weekdays: [6],
            localTime: '10:00',
            timezone: 'Europe/Paris',
            startDate,
          },
        ],
        startsAt: startDate,
        endDate: new Date('2026-09-01T23:59:59.999Z'),
      }),
    ).toThrow(InvalidPackagePlanError);
  });
});

describe('planPackage - multiple slots', () => {
  it('combines different weekday times through the inclusive end date', () => {
    const startDate = new Date('2026-09-01T00:00:00.000Z');
    const plan = planPackage({
      sizingMode: 'BY_PERIOD',
      pricePerLessonMinor: 100,
      rules: [
        {
          weekdays: [1],
          localTime: '09:00',
          timezone: 'Europe/Paris',
          startDate,
        },
        {
          weekdays: [6],
          localTime: '11:30',
          timezone: 'Europe/Paris',
          startDate,
        },
      ],
      startsAt: startDate,
      endDate: new Date('2026-09-12T23:59:59.999Z'),
    });

    expect(plan.lessonsTotal).toBe(3);
    expect(plan.totalPriceMinor).toBe(300);
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

describe('assertPaymentWithinOutstanding', () => {
  it('accepts partial and exact payments but rejects overpayment', () => {
    expect(() => assertPaymentWithinOutstanding(1000, 0, 400)).not.toThrow();
    expect(() => assertPaymentWithinOutstanding(1000, 400, 600)).not.toThrow();
    expect(() => assertPaymentWithinOutstanding(1000, 400, 601)).toThrow(OverpaymentError);
  });
});

describe('planPackage — period kinds and prices (L-80)', () => {
  const start = new Date('2026-10-01T00:00:00.000Z');
  const end = new Date('2026-10-28T23:59:59.999Z');

  it('sizes a weekly package by the days of its window', () => {
    expect(
      planPackage({
        sizingMode: 'BY_PERIOD_WEEKLY',
        lessonsPerWeek: 2,
        startsAt: start,
        endDate: end,
        pricePerLessonMinor: 40000,
      }),
    ).toEqual({ lessonsTotal: 8, pricePerLessonMinor: 40000, totalPriceMinor: 320000 });
  });

  it("takes the tutor's count over the schedule's", () => {
    expect(
      planPackage({
        sizingMode: 'BY_PERIOD',
        lessonsTotal: 7,
        startsAt: start,
        endDate: end,
        pricePerLessonMinor: 100,
      }).lessonsTotal,
    ).toBe(7);
  });

  it('refuses a period package without a schedule or a count', () => {
    expect(() =>
      planPackage({
        sizingMode: 'BY_PERIOD',
        startsAt: start,
        endDate: end,
        pricePerLessonMinor: 1,
      }),
    ).toThrow(InvalidPackagePlanError);
  });

  it('prices a package by its total and derives the per-lesson price', () => {
    expect(
      planPackage({ sizingMode: 'FIXED_COUNT', lessonsTotal: 3, totalPriceMinor: 100000 }),
    ).toEqual({ lessonsTotal: 3, pricePerLessonMinor: 33333, totalPriceMinor: 100000 });
  });

  it('counts the lessons that fall in the dates, not whole weeks', () => {
    // 3 a week over 1–31 October: 31 days × 3 ÷ 7 = 13.3.
    expect(weeklyLessons(start, new Date('2026-11-01T00:00:00.000Z'), 3)).toBe(13);
    // Two weeks and a half, 2 a week: 5 lessons.
    expect(weeklyLessons(start, new Date('2026-10-18T12:00:00.000Z'), 2)).toBe(5);
    // A clock change inside the window does not add a day.
    expect(
      weeklyLessons(
        new Date('2026-10-20T00:00:00+03:00'),
        new Date('2026-10-27T00:00:00+02:00'),
        2,
      ),
    ).toBe(2);
    // At least one lesson.
    expect(weeklyLessons(start, new Date('2026-10-02T00:00:00.000Z'), 1)).toBe(1);
  });
});

describe('transferCredits (L-85)', () => {
  it('recalculates by price, rounds down and shows the remainder', () => {
    expect(transferCredits(3, 40000, 50000)).toEqual({
      valueMinor: 120000,
      lessons: 2,
      remainderMinor: 20000,
    });
  });

  it('moves credits one for one to a free direction', () => {
    expect(transferCredits(2, 40000, 0)).toEqual({
      valueMinor: 80000,
      lessons: 2,
      remainderMinor: 0,
    });
  });

  it('moves at least one credit', () => {
    expect(() => transferCredits(0, 100, 100)).toThrow(InvalidPackagePlanError);
  });
});

describe('paymentStatusOf — nothing owed', () => {
  it('reports a package that costs nothing as paid', () => {
    expect(paymentStatusOf(0, 0)).toBe('PAID');
  });
});

describe('package lifecycle and running out (S07)', () => {
  const now = new Date('2026-09-25T12:00:00.000Z');
  const days = (count: number) => new Date(now.getTime() + count * 86_400_000);

  it('is active with credits in its window, used without credits, expired after its end', () => {
    expect(packageLifecycle({ remainingCredits: 3, expiresAt: days(10) }, now)).toBe('active');
    expect(packageLifecycle({ remainingCredits: 3, expiresAt: null }, now)).toBe('active');
    expect(packageLifecycle({ remainingCredits: 0, expiresAt: days(-2) }, now)).toBe('used');
    expect(packageLifecycle({ remainingCredits: 2, expiresAt: days(-5) }, now)).toBe('expired');
  });

  it('runs out with few credits left or a window closing within a week', () => {
    expect(isPackageEnding({ remainingCredits: 2, expiresAt: null }, now, 2)).toBe(true);
    expect(isPackageEnding({ remainingCredits: 3, expiresAt: null }, now, 2)).toBe(false);
    expect(isPackageEnding({ remainingCredits: 6, expiresAt: days(6) }, now, 2)).toBe(true);
    expect(isPackageEnding({ remainingCredits: 1, expiresAt: null }, now, 0)).toBe(false);
    expect(isPackageEnding({ remainingCredits: 1, expiresAt: days(-1) }, now, 2)).toBe(false);
  });

  it('orders the running-out packages first, then the nearest end', () => {
    const at = new Date('2026-09-01T00:00:00.000Z');
    const rows = [
      { id: 'used', remainingCredits: 0, expiresAt: null, purchasedAt: at },
      { id: 'late', remainingCredits: 6, expiresAt: days(40), purchasedAt: at },
      { id: 'low', remainingCredits: 1, expiresAt: null, purchasedAt: at },
      { id: 'soon', remainingCredits: 6, expiresAt: days(20), purchasedAt: at },
      { id: 'closing', remainingCredits: 5, expiresAt: days(3), purchasedAt: at },
    ];
    expect([...rows].sort(compareEndingFirst(now, 2)).map((row) => row.id)).toEqual([
      'closing',
      'low',
      'soon',
      'late',
      'used',
    ]);
  });
});
