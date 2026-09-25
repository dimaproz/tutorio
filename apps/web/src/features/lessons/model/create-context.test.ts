import { describe, expect, it } from 'vitest';
import type { PauseResponse, StudentBillingResponse } from '@tutorio/validation';
import { pauseAt, payingPackage, primaryDirection, resolveStudentBooking } from './create-context';

type Direction = StudentBillingResponse['directions'][number];

function direction(fields: Partial<Direction> & Pick<Direction, 'enrollmentId'>): Direction {
  return {
    billingType: 'PER_LESSON',
    rateMinor: 50000,
    currency: 'UAH',
    packages: [],
    creditsLeft: 0,
    debtLessons: 0,
    balance: {
      chargedMinor: 0,
      paidMinor: 0,
      debtMinor: 0,
      advanceMinor: 0,
      unpaidLessons: 0,
      unpaid: [],
    },
    warning: null,
    status: 'ACTIVE',
    teacher: { id: 'dmytro', name: 'Dmytro Tutor', avatarKey: null, subjects: [] },
    group: null,
    cancellationDeadlineHours: null,
    ...fields,
  };
}

const billing = (directions: Direction[]): StudentBillingResponse => ({
  studentId: 'anna',
  cancellationDeadlineHours: 12,
  lowCreditThreshold: 2,
  directions,
  totals: [],
});

const base = {
  studentId: 'anna',
  teacherRate: { amountMinor: 45000, currency: 'UAH' },
  studentRate: { amountMinor: 50000, currency: 'UAH' },
  defaultCurrency: 'UAH',
};

describe('resolveStudentBooking', () => {
  it('books into the direction with the picked teacher', () => {
    const booking = resolveStudentBooking({
      ...base,
      teacherId: 'dmytro',
      billing: billing([direction({ enrollmentId: 'e1', billingType: 'PACKAGE' })]),
    });
    expect(booking).toMatchObject({
      substitute: false,
      target: { kind: 'direction', enrollmentId: 'e1' },
      priceMode: 'package',
    });
  });

  it('treats another teacher as a substitute on the direction, at that teacher rate', () => {
    const booking = resolveStudentBooking({
      ...base,
      teacherId: 'iryna',
      billing: billing([direction({ enrollmentId: 'e1' })]),
    });
    expect(booking).toMatchObject({
      substitute: true,
      target: { kind: 'direction', enrollmentId: 'e1' },
      priceMode: 'amount',
      rateMinor: 45000,
    });
  });

  it('opens a new direction for a student with none, at the default rate (L-10, L-11)', () => {
    const booking = resolveStudentBooking({ ...base, teacherId: 'iryna', billing: billing([]) });
    expect(booking).toMatchObject({
      direction: null,
      target: { kind: 'newDirection', studentId: 'anna' },
      priceMode: 'amount',
      rateMinor: 50000,
    });
  });

  it('ignores group and archived directions', () => {
    const directions = [
      direction({ enrollmentId: 'g', group: { id: 'g1', name: 'B2' } }),
      direction({ enrollmentId: 'old', status: 'ARCHIVED' }),
    ];
    expect(primaryDirection(billing(directions))).toBeNull();
  });
});

describe('payingPackage and pauseAt', () => {
  it('picks the oldest usable package with credits', () => {
    const pkg = (id: string, purchasedAt: string, remainingCredits: number, usable = true) => ({
      id,
      name: null,
      purchasedAt,
      expiresAt: null,
      remainingCredits,
      usable,
      validFrom: null,
      lessonsTotal: 8,
      totalPriceMinor: 400000,
      paidMinor: 400000,
      paymentStatus: 'PAID' as const,
    });
    const found = payingPackage(
      direction({
        enrollmentId: 'e1',
        packages: [
          pkg('newer', '2026-09-10T00:00:00.000Z', 4),
          pkg('empty', '2026-08-01T00:00:00.000Z', 0),
          pkg('older', '2026-09-01T00:00:00.000Z', 2),
        ],
      }),
    );
    expect(found?.id).toBe('older');
  });

  it('finds the pause in force at an instant', () => {
    const pause = {
      id: 'p1',
      studentId: 'anna',
      enrollmentId: null,
      startsAt: '2026-09-20T00:00:00.000Z',
      endsAt: '2026-10-12T00:00:00.000Z',
    } as PauseResponse;
    expect(pauseAt([pause], 'anna', Date.parse('2026-10-01T14:00:00.000Z'))?.id).toBe('p1');
    expect(pauseAt([pause], 'anna', Date.parse('2026-10-13T14:00:00.000Z'))).toBeNull();
    expect(pauseAt([pause], 'sofiia', Date.parse('2026-10-01T14:00:00.000Z'))).toBeNull();
  });
});
