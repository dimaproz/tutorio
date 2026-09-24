import { describe, expect, it } from 'vitest';
import {
  assertPaymentWithinOutstanding,
  InvalidPackagePlanError,
  OverpaymentError,
  paymentStatusOf,
  planPackage,
  transferCredits,
  weeksInPeriod,
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

  it('sizes a weekly package as lessons a week times the weeks in the window', () => {
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

  it('counts at least one week', () => {
    expect(weeksInPeriod(start, new Date('2026-10-02T00:00:00.000Z'))).toBe(1);
    expect(weeksInPeriod(start, new Date('2026-11-01T00:00:00.000Z'))).toBe(4);
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
