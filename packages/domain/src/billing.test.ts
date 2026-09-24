import { describe, expect, it } from 'vitest';
import {
  allocatePayments,
  coverDebts,
  creditWarning,
  initialSource,
  participantIsCharged,
  pickPackage,
  type CreditPackage,
} from './billing';

const day = (n: number) => new Date(Date.UTC(2026, 9, n, 10));

describe('participantIsCharged', () => {
  it('charges held, charged-cancelled and no-show lessons only (L-50…L-52)', () => {
    const lesson = (status: Parameters<typeof participantIsCharged>[0]['status']) => ({
      status,
      isGroup: false,
    });
    expect(participantIsCharged(lesson('COMPLETED'), null)).toBe(true);
    expect(participantIsCharged(lesson('CANCELLED_CHARGED'), null)).toBe(true);
    expect(participantIsCharged(lesson('NO_SHOW'), null)).toBe(true);
    expect(participantIsCharged(lesson('CANCELLED_UNCHARGED'), null)).toBe(false);
    expect(participantIsCharged(lesson('SCHEDULED'), null)).toBe(false);
  });

  it('charges exactly one of a lesson and its makeup (L-61)', () => {
    const makeup = (originalStatus: 'NO_SHOW' | 'CANCELLED_UNCHARGED') => ({
      status: 'COMPLETED' as const,
      isGroup: false,
      originalStatus,
    });
    expect(participantIsCharged(makeup('NO_SHOW'), null)).toBe(false);
    expect(participantIsCharged(makeup('CANCELLED_UNCHARGED'), null)).toBe(true);
  });

  it('charges a group participant unless excused; no mark counts as present (L-71, L-72)', () => {
    const lesson = { status: 'COMPLETED' as const, isGroup: true };
    expect(participantIsCharged(lesson, null)).toBe(true);
    expect(participantIsCharged(lesson, 'PRESENT')).toBe(true);
    expect(participantIsCharged(lesson, 'ABSENT')).toBe(true);
    expect(participantIsCharged(lesson, 'EXCUSED')).toBe(false);
  });
});

describe('initialSource', () => {
  it('puts a package direction on debt and a pay-per-lesson one on its balance', () => {
    expect(initialSource('PACKAGE')).toBe('DEBT');
    expect(initialSource('PER_LESSON')).toBe('BALANCE');
  });
});

describe('pickPackage', () => {
  const packages: CreditPackage[] = [
    { id: 'new', validFrom: null, purchasedAt: day(5), expiresAt: null, remaining: 3 },
    { id: 'old', validFrom: null, purchasedAt: day(1), expiresAt: day(20), remaining: 1 },
    { id: 'empty', validFrom: null, purchasedAt: day(0), expiresAt: null, remaining: 0 },
  ];

  it('uses the oldest valid package with a credit left (L-81)', () => {
    expect(pickPackage(packages, day(10))).toBe('old');
  });

  it('skips a package that expired before the lesson (L-84)', () => {
    expect(pickPackage(packages, day(21))).toBe('new');
  });

  it('skips a period package for a lesson before its window starts (L-80)', () => {
    const period: CreditPackage = {
      id: 'period',
      validFrom: day(15),
      purchasedAt: day(0),
      expiresAt: day(30),
      remaining: 8,
    };
    expect(pickPackage([period], day(10))).toBeNull();
    expect(pickPackage([period], day(16))).toBe('period');
  });

  it('returns null when nothing can pay: the lesson goes on debt (L-82)', () => {
    expect(pickPackage([packages[2]!], day(10))).toBeNull();
  });
});

describe('coverDebts', () => {
  it('covers the oldest debts first from the oldest valid packages (L-82)', () => {
    const covers = coverDebts(
      [
        { id: 'd3', lessonAt: day(3) },
        { id: 'd1', lessonAt: day(1) },
        { id: 'd2', lessonAt: day(2) },
      ],
      [
        { id: 'b', validFrom: null, purchasedAt: day(9), expiresAt: null, remaining: 5 },
        { id: 'a', validFrom: null, purchasedAt: day(8), expiresAt: null, remaining: 2 },
      ],
    );
    expect(covers).toEqual([
      { chargeId: 'd1', packageId: 'a' },
      { chargeId: 'd2', packageId: 'a' },
      { chargeId: 'd3', packageId: 'b' },
    ]);
  });

  it('leaves a debt on debt when the only package expired before it', () => {
    expect(
      coverDebts(
        [{ id: 'late', lessonAt: day(15) }],
        [{ id: 'p', validFrom: null, purchasedAt: day(1), expiresAt: day(10), remaining: 4 }],
      ),
    ).toEqual([]);
  });
});

describe('allocatePayments', () => {
  const charges = [
    { id: 'c2', lessonAt: day(2), amountMinor: 40000 },
    { id: 'c1', lessonAt: day(1), amountMinor: 40000 },
    { id: 'c3', lessonAt: day(3), amountMinor: 40000 },
  ];

  it('settles the oldest lessons first and reports the rest as debt (L-90)', () => {
    expect(allocatePayments(charges, 60000)).toEqual({
      chargedMinor: 120000,
      paidMinor: 60000,
      debtMinor: 60000,
      advanceMinor: 0,
      settledIds: ['c1'],
      unpaid: [
        { id: 'c2', lessonAt: day(2), outstandingMinor: 20000 },
        { id: 'c3', lessonAt: day(3), outstandingMinor: 40000 },
      ],
    });
  });

  it('keeps money paid ahead as an advance', () => {
    const allocation = allocatePayments(charges.slice(0, 1), 50000);
    expect(allocation).toMatchObject({ debtMinor: 0, advanceMinor: 10000, unpaid: [] });
  });
});

describe('creditWarning', () => {
  const packageMode = (creditsLeft: number, debtLessons = 0) => ({
    mode: 'PACKAGE' as const,
    creditsLeft,
    debtLessons,
  });

  it('warns when a package direction is nearly used up, at the threshold', () => {
    expect(creditWarning(packageMode(3), 2)).toBeNull();
    expect(creditWarning(packageMode(2), 2)).toBe('LOW_CREDITS');
    expect(creditWarning(packageMode(1), 2)).toBe('LOW_CREDITS');
  });

  it('says there are no credits, and that lessons went on debt, first', () => {
    expect(creditWarning(packageMode(0), 2)).toBe('NO_CREDITS');
    expect(creditWarning(packageMode(0, 3), 2)).toBe('ON_DEBT');
    expect(creditWarning(packageMode(4, 1), 2)).toBe('ON_DEBT');
  });

  it('leaves pay-per-lesson directions to their money balance', () => {
    expect(creditWarning({ mode: 'PER_LESSON', creditsLeft: 0, debtLessons: 0 }, 2)).toBeNull();
  });

  it('turns the low warning off with a zero threshold', () => {
    expect(creditWarning(packageMode(1), 0)).toBeNull();
  });
});
