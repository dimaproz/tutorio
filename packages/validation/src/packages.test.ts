import { describe, expect, it } from 'vitest';
import {
  createPackageSchema,
  recordPaymentSchema,
  refundPackageSchema,
  sellToMembersSchema,
} from './packages';
import { forceQuerySchema } from './scheduling';

const STUDENT_ID = '11111111-1111-4111-8111-111111111111';
const GROUP_ID = '22222222-2222-4222-8222-222222222222';
const schedule = {
  slots: [
    { weekday: 1, localTime: '09:00' },
    { weekday: 4, localTime: '18:30' },
  ],
  timezone: 'Europe/Paris',
  durationMin: 60,
  startDate: '2026-08-01T00:00:00.000Z',
};

describe('createPackageSchema', () => {
  it('accepts fixed and period schedules with independent slot times', () => {
    expect(
      createPackageSchema.safeParse({
        studentId: STUDENT_ID,
        sizingMode: 'FIXED_COUNT',
        lessonsTotal: 8,
        pricePerLessonMinor: 50000,
        currency: 'UAH',
        schedule,
      }).success,
    ).toBe(true);
    expect(
      createPackageSchema.safeParse({
        studentId: STUDENT_ID,
        groupId: GROUP_ID,
        sizingMode: 'BY_PERIOD',
        endDate: '2026-10-01T00:00:00.000Z',
        pricePerLessonMinor: 50000,
        currency: 'UAH',
        schedule,
      }).success,
    ).toBe(true);
  });

  it('rejects duplicate weekdays and partial initial group payment', () => {
    expect(
      createPackageSchema.safeParse({
        studentId: STUDENT_ID,
        groupId: GROUP_ID,
        sizingMode: 'FIXED_COUNT',
        lessonsTotal: 8,
        pricePerLessonMinor: 50000,
        currency: 'UAH',
        schedule: {
          ...schedule,
          slots: [
            { weekday: 1, localTime: '09:00' },
            { weekday: 1, localTime: '10:00' },
          ],
        },
        initialPayment: {
          amountMinor: 10000,
          paidAt: '2026-08-01T00:00:00.000Z',
        },
      }).success,
    ).toBe(false);
  });

  it('rejects future payment dates', () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    expect(
      createPackageSchema.safeParse({
        studentId: STUDENT_ID,
        sizingMode: 'FIXED_COUNT',
        lessonsTotal: 8,
        pricePerLessonMinor: 50000,
        currency: 'UAH',
        initialPayment: { amountMinor: 50000, paidAt: tomorrow },
      }).success,
    ).toBe(false);
  });
});

describe('recordPaymentSchema', () => {
  it('accepts a client idempotency key for a payment command', () => {
    expect(
      recordPaymentSchema.safeParse({
        enrollmentId: STUDENT_ID,
        amountMinor: 50000,
        currency: 'UAH',
        idempotencyKey: 'payment-2026-08-24-0001',
      }).success,
    ).toBe(true);
  });
});

describe('forceQuerySchema', () => {
  it('parses explicit query strings instead of JavaScript truthiness', () => {
    expect(forceQuerySchema.parse({}).force).toBe(false);
    expect(forceQuerySchema.parse({ force: 'false' }).force).toBe(false);
    expect(forceQuerySchema.parse({ force: 'true' }).force).toBe(true);
    expect(forceQuerySchema.safeParse({ force: '0' }).success).toBe(false);
  });
});

describe('package kinds and operations (L-80, L-85, L-86)', () => {
  const spec = { currency: 'UAH' as const, sizingMode: 'FIXED_COUNT' as const, lessonsTotal: 4 };

  it('prices a package per lesson or as a total, not both', () => {
    const base = { studentId: STUDENT_ID, ...spec };
    expect(createPackageSchema.safeParse({ ...base, pricePerLessonMinor: 100 }).success).toBe(true);
    expect(createPackageSchema.safeParse({ ...base, totalPriceMinor: 400 }).success).toBe(true);
    expect(
      createPackageSchema.safeParse({ ...base, pricePerLessonMinor: 100, totalPriceMinor: 400 })
        .success,
    ).toBe(false);
    expect(createPackageSchema.safeParse(base).success).toBe(false);
  });

  it('needs an end and a weekly count for a weekly period package', () => {
    const weekly = {
      studentId: STUDENT_ID,
      currency: 'UAH' as const,
      sizingMode: 'BY_PERIOD_WEEKLY' as const,
      pricePerLessonMinor: 100,
      validFrom: '2026-10-01T00:00:00.000Z',
      endDate: '2026-10-31T23:59:59.999Z',
    };
    expect(createPackageSchema.safeParse(weekly).success).toBe(false);
    expect(createPackageSchema.safeParse({ ...weekly, lessonsPerWeek: 2 }).success).toBe(true);
    expect(
      createPackageSchema.safeParse({ ...weekly, lessonsPerWeek: 2, endDate: undefined }).success,
    ).toBe(false);
  });

  it('refunds credits, money or both, never nothing', () => {
    const refund = { note: 'Moved abroad', method: 'CASH' as const };
    expect(refundPackageSchema.safeParse({ ...refund, credits: 2, amountMinor: 0 }).success).toBe(
      true,
    );
    expect(refundPackageSchema.safeParse({ ...refund, credits: 0, amountMinor: 0 }).success).toBe(
      false,
    );
  });

  it('sells to each member once', () => {
    const sale = { groupId: GROUP_ID, pricePerLessonMinor: 100, ...spec };
    expect(sellToMembersSchema.safeParse({ ...sale, studentIds: [STUDENT_ID] }).success).toBe(true);
    expect(
      sellToMembersSchema.safeParse({ ...sale, studentIds: [STUDENT_ID, STUDENT_ID] }).success,
    ).toBe(false);
  });
});
