import { describe, expect, it } from 'vitest';
import type { LessonResponse, PackageResponse } from '@tutorio/validation';
import { deriveStudentRollups, isLowOnCredits, isSameLocalDay } from './rollups';

const NOW = Date.parse('2026-09-09T12:00:00.000Z');

function pkg(overrides: Partial<PackageResponse>): PackageResponse {
  return {
    id: 'p1',
    workspaceId: 'w1',
    enrollmentId: 'e1',
    studentId: 's1',
    groupId: null,
    name: null,
    sizingMode: 'FIXED_COUNT',
    lessonsTotal: 8,
    endDate: null,
    pricePerLessonMinorSnapshot: 50000,
    totalPriceMinorSnapshot: 400000,
    remainingCredits: 6,
    consumedCredits: 2,
    paidMinor: 400000,
    currency: 'UAH',
    paymentStatus: 'PAID',
    purchasedAt: '2026-09-01T10:00:00.000Z',
    expiresAt: null,
    notes: null,
    student: { id: 's1', fullName: 'Anna' },
    group: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    deletedAt: null,
    ...overrides,
  } as PackageResponse;
}

function lesson(overrides: Partial<LessonResponse>): LessonResponse {
  return {
    id: 'l1',
    status: 'SCHEDULED',
    startsAtUtc: '2026-09-11T14:00:00.000Z',
    durationMin: 60,
    student: { id: 's1', fullName: 'Anna' },
    group: null,
    teacher: { id: 't1', name: 'Dmytro Tutor', color: null },
    ...overrides,
  } as LessonResponse;
}

describe('deriveStudentRollups', () => {
  it('reports credits, a settled balance and the nearest scheduled lesson', () => {
    const rollups = deriveStudentRollups({
      packages: [pkg({})],
      packagesComplete: true,
      lessons: [
        lesson({ id: 'later', startsAtUtc: '2026-09-16T14:00:00.000Z' }),
        lesson({ id: 'sooner' }),
        lesson({ id: 'past', startsAtUtc: '2026-09-01T14:00:00.000Z' }),
      ],
      now: NOW,
    });

    expect(rollups.get('s1')).toEqual({
      credits: { left: 6, total: 8 },
      balance: { kind: 'paid' },
      next: {
        startsAtUtc: '2026-09-11T14:00:00.000Z',
        durationMin: 60,
        teacherName: 'Dmytro Tutor',
      },
      teacherName: 'Dmytro Tutor',
    });
  });

  it('distinguishes an unpaid debt from a partly paid one', () => {
    const rollups = deriveStudentRollups({
      packages: [
        pkg({ id: 'due', studentId: 's1', paidMinor: 0 }),
        pkg({ id: 'partial', studentId: 's2', paidMinor: 100000 }),
      ],
      packagesComplete: true,
      lessons: [],
      now: NOW,
    });

    expect(rollups.get('s1')?.balance).toEqual({ kind: 'due', owedMinor: 400000, currency: 'UAH' });
    expect(rollups.get('s2')?.balance).toEqual({
      kind: 'partial',
      owedMinor: 300000,
      currency: 'UAH',
    });
  });

  it('prefers the newest package that still has credits', () => {
    const rollups = deriveStudentRollups({
      packages: [
        pkg({ id: 'old', remainingCredits: 3, purchasedAt: '2026-08-01T10:00:00.000Z' }),
        pkg({ id: 'spent', remainingCredits: 0, purchasedAt: '2026-09-05T10:00:00.000Z' }),
      ],
      packagesComplete: true,
      lessons: [],
      now: NOW,
    });

    expect(rollups.get('s1')?.credits).toEqual({ left: 3, total: 8 });
  });

  it("counts a member's own package for a group like any other package", () => {
    const rollups = deriveStudentRollups({
      packages: [
        pkg({
          studentId: 's3',
          groupId: 'g1',
          remainingCredits: 5,
          lessonsTotal: 10,
          totalPriceMinorSnapshot: 200000,
          paidMinor: 200000,
        }),
      ],
      packagesComplete: true,
      lessons: [],
      now: NOW,
    });

    expect(rollups.get('s3')).toEqual({
      credits: { left: 5, total: 10 },
      balance: { kind: 'paid' },
    });
  });

  it('reports no package figures from a partial package read', () => {
    const rollups = deriveStudentRollups({
      packages: [pkg({})],
      packagesComplete: false,
      lessons: [],
      now: NOW,
    });

    expect(rollups.get('s1')).toBeUndefined();
  });

  it('never adds debts in different currencies', () => {
    const rollups = deriveStudentRollups({
      packages: [
        pkg({ id: 'uah', paidMinor: 0 }),
        pkg({ id: 'eur', paidMinor: 0, currency: 'EUR' }),
      ],
      packagesComplete: true,
      lessons: [],
      now: NOW,
    });

    expect(rollups.get('s1')?.balance).toBeUndefined();
  });

  it('ignores lessons that are not scheduled', () => {
    const rollups = deriveStudentRollups({
      packages: [],
      packagesComplete: true,
      lessons: [lesson({ status: 'CANCELLED_UNCHARGED' })],
      now: NOW,
    });

    expect(rollups.get('s1')).toBeUndefined();
  });
});

describe('isLowOnCredits', () => {
  it('flags two or fewer credits of a real package', () => {
    expect(isLowOnCredits({ left: 2, total: 8 })).toBe(true);
    expect(isLowOnCredits({ left: 3, total: 8 })).toBe(false);
    expect(isLowOnCredits({ left: 0, total: 0 })).toBe(false);
    expect(isLowOnCredits(undefined)).toBe(false);
  });
});

describe('isSameLocalDay', () => {
  it('compares calendar days in the given timezone', () => {
    expect(isSameLocalDay('2026-09-09T20:30:00.000Z', NOW, 'Europe/Kyiv')).toBe(true);
    expect(isSameLocalDay('2026-09-09T21:30:00.000Z', NOW, 'Europe/Kyiv')).toBe(false);
  });
});
