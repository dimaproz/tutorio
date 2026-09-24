import { describe, expect, it } from 'vitest';
import type { LessonResponse, PackageResponse } from '@tutorio/validation';
import { deriveStudentProfileMetrics } from './profile-metrics';

const NOW = Date.parse('2026-09-09T12:00:00.000Z');

const pkg = (overrides: Partial<PackageResponse>) =>
  ({
    id: 'p',
    name: 'B2 prep',
    lessonsTotal: 8,
    remainingCredits: 6,
    consumedCredits: 2,
    paidMinor: 400000,
    totalPriceMinorSnapshot: 400000,
    currency: 'UAH',
    purchasedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  }) as PackageResponse;

const lesson = (startsAtUtc: string, status: LessonResponse['status']) =>
  ({ id: startsAtUtc, startsAtUtc, status, durationMin: 60 }) as LessonResponse;

describe('deriveStudentProfileMetrics', () => {
  it('reports nothing for a fresh student', () => {
    expect(deriveStudentProfileMetrics({ packages: [], lessons: [], now: NOW })).toEqual({
      credits: null,
      paid: null,
      attendance: null,
      next: null,
      packagesUnavailable: false,
      lessonsUnavailable: false,
      mixedCurrency: false,
    });
  });

  it('reports unknown rather than empty when a read failed', () => {
    const metrics = deriveStudentProfileMetrics({
      packages: [pkg({})],
      lessons: [lesson('2026-09-01T10:00:00.000Z', 'COMPLETED')],
      now: NOW,
      packagesUnavailable: true,
      lessonsUnavailable: true,
    });
    expect(metrics).toMatchObject({
      credits: null,
      paid: null,
      attendance: null,
      next: null,
      packagesUnavailable: true,
      lessonsUnavailable: true,
      mixedCurrency: false,
    });
  });

  it('reads credits from the newest package that still has some', () => {
    const metrics = deriveStudentProfileMetrics({
      packages: [
        pkg({ id: 'old', remainingCredits: 3, purchasedAt: '2026-08-01T10:00:00.000Z' }),
        pkg({ id: 'spent', remainingCredits: 0, purchasedAt: '2026-09-05T10:00:00.000Z' }),
      ],
      lessons: [],
      now: NOW,
    });
    expect(metrics.credits).toEqual({ left: 3, total: 8, used: 2, packageName: 'B2 prep' });
    expect(metrics.paid).toEqual({
      paidMinor: 800000,
      owedMinor: 0,
      currency: 'UAH',
      packages: 2,
      lastPurchaseAt: '2026-09-05T10:00:00.000Z',
    });
  });

  it('does not add payments in different currencies', () => {
    const metrics = deriveStudentProfileMetrics({
      packages: [pkg({}), pkg({ id: 'eur', currency: 'EUR' })],
      lessons: [],
      now: NOW,
    });
    expect(metrics.paid).toBeNull();
    expect(metrics.mixedCurrency).toBe(true);
  });

  it('counts attendance over finished lessons and finds the next one', () => {
    const metrics = deriveStudentProfileMetrics({
      packages: [],
      lessons: [
        lesson('2026-09-01T10:00:00.000Z', 'COMPLETED'),
        lesson('2026-09-03T10:00:00.000Z', 'CANCELLED_CHARGED'),
        lesson('2026-09-05T10:00:00.000Z', 'COMPLETED'),
        lesson('2026-09-06T10:00:00.000Z', 'CANCELLED_UNCHARGED'),
        lesson('2026-09-16T10:00:00.000Z', 'SCHEDULED'),
        lesson('2026-09-11T10:00:00.000Z', 'SCHEDULED'),
      ],
      now: NOW,
    });
    expect(metrics.attendance).toEqual({
      marks: ['ok', 'miss', 'ok'],
      attended: 2,
      charged: 1,
      percent: 67,
    });
    expect(metrics.next?.startsAtUtc).toBe('2026-09-11T10:00:00.000Z');
  });

  it('keeps a running lesson as the next one until it ends', () => {
    const metrics = deriveStudentProfileMetrics({
      packages: [],
      lessons: [
        lesson('2026-09-09T10:30:00.000Z', 'SCHEDULED'),
        lesson('2026-09-09T11:30:00.000Z', 'SCHEDULED'),
        lesson('2026-09-11T10:00:00.000Z', 'SCHEDULED'),
      ],
      now: NOW,
    });
    expect(metrics.next?.startsAtUtc).toBe('2026-09-09T11:30:00.000Z');
  });
});
