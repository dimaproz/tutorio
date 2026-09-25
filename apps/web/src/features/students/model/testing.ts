import type { PauseResponse } from '@tutorio/validation';
import type { BillingDirection, BillingPackage } from './learning';

/** A package of the billing read: 6 of 8 left, 4 000 ₴ paid in full. */
export function billingPackage(overrides: Partial<BillingPackage> = {}): BillingPackage {
  return {
    id: 'aaaaaaaa-0000-4000-8000-000000000001',
    name: 'B2 preparation',
    purchasedAt: '2026-09-01T10:00:00.000Z',
    validFrom: null,
    expiresAt: '2026-10-30T21:00:00.000Z',
    lessonsTotal: 8,
    remainingCredits: 6,
    usable: true,
    totalPriceMinor: 400000,
    paidMinor: 400000,
    paymentStatus: 'PAID',
    ...overrides,
  };
}

/** An individual direction with Dmytro paid by packages, nothing owed. */
export function billingDirection(overrides: Partial<BillingDirection> = {}): BillingDirection {
  return {
    enrollmentId: 'bbbbbbbb-0000-4000-8000-000000000001',
    billingType: 'PACKAGE',
    rateMinor: 50000,
    currency: 'UAH',
    packages: [billingPackage()],
    creditsLeft: 6,
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
    teacher: {
      id: 'cccccccc-0000-4000-8000-000000000001',
      name: 'Dmytro Tutor',
      avatarKey: null,
      subjects: ['English'],
    },
    group: null,
    cancellationDeadlineHours: null,
    ...overrides,
  };
}

/** A pay-per-lesson direction owing two lessons of 500 ₴ (Mon 21 and Wed 23 Sep). */
export function debtDirection(overrides: Partial<BillingDirection> = {}): BillingDirection {
  return billingDirection({
    billingType: 'PER_LESSON',
    packages: [],
    creditsLeft: 0,
    balance: {
      chargedMinor: 400000,
      paidMinor: 300000,
      debtMinor: 100000,
      advanceMinor: 0,
      unpaidLessons: 2,
      unpaid: [
        {
          lessonId: 'dddddddd-0000-4000-8000-000000000021',
          startsAt: '2026-09-21T14:00:00.000Z',
          outstandingMinor: 50000,
        },
        {
          lessonId: 'dddddddd-0000-4000-8000-000000000023',
          startsAt: '2026-09-23T14:00:00.000Z',
          outstandingMinor: 50000,
        },
      ],
    },
    ...overrides,
  });
}

/** A pause of the whole student, running until 4 October. */
export function samplePause(overrides: Partial<PauseResponse> = {}): PauseResponse {
  return {
    id: 'eeeeeeee-0000-4000-8000-000000000001',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    studentId: 'ffffffff-0000-4000-8000-000000000001',
    enrollmentId: null,
    startsAt: '2026-09-20T21:00:00.000Z',
    endsAt: '2026-10-04T21:00:00.000Z',
    endedAt: null,
    state: 'ACTIVE',
    reason: 'HOLIDAY',
    removedLessons: 6,
    extensions: [],
    student: { id: 'ffffffff-0000-4000-8000-000000000001', fullName: 'Anna Shevchenko' },
    createdAt: '2026-09-15T10:00:00.000Z',
    updatedAt: '2026-09-15T10:00:00.000Z',
    ...overrides,
  };
}
