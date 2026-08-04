import { describe, expect, it } from 'vitest';
import { createPackageSchema } from './packages';

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
