import { describe, expect, it } from 'vitest';
import type { PackageResponse } from '@tutorio/validation';
import { deriveCollectionMetrics } from './collection-metrics';

function pkg(overrides: Partial<PackageResponse>): PackageResponse {
  return {
    studentId: 'student-1',
    remainingCredits: 8,
    effectiveTotalMinor: 100_000,
    paidMinor: 100_000,
    currency: 'UAH',
    ...overrides,
  } as PackageResponse;
}

describe('collection metrics', () => {
  it('counts each running-out student once, however many packages they hold', () => {
    const metrics = deriveCollectionMetrics(
      [
        pkg({ studentId: 'a', remainingCredits: 1 }),
        pkg({ studentId: 'a', remainingCredits: 0 }),
        pkg({ studentId: 'b', remainingCredits: 2 }),
        pkg({ studentId: 'c', remainingCredits: 3 }),
      ],
      4,
    );

    expect(metrics?.lowOnCredits).toBe(2);
  });

  it('sums only what is still owed', () => {
    const metrics = deriveCollectionMetrics(
      [
        pkg({ effectiveTotalMinor: 100_000, paidMinor: 40_000 }),
        pkg({ effectiveTotalMinor: 50_000, paidMinor: 50_000 }),
        pkg({ effectiveTotalMinor: 30_000, paidMinor: 0 }),
      ],
      3,
    );

    expect(metrics?.unpaidPackages).toBe(2);
    expect(metrics?.outstandingMinor).toBe(90_000);
    expect(metrics?.outstandingCurrency).toBe('UAH');
  });

  it('refuses to add minor units of different currencies', () => {
    const metrics = deriveCollectionMetrics(
      [
        pkg({ effectiveTotalMinor: 100_000, paidMinor: 0, currency: 'UAH' }),
        pkg({ effectiveTotalMinor: 100_000, paidMinor: 0, currency: 'EUR' }),
      ],
      2,
    );

    expect(metrics?.unpaidPackages).toBe(2);
    expect(metrics?.outstandingMinor).toBeNull();
    expect(metrics?.outstandingCurrency).toBeNull();
  });

  it('reports nothing rather than an undercount when the page is partial', () => {
    expect(deriveCollectionMetrics([pkg({ remainingCredits: 1 })], 40)).toBeNull();
  });

  it('reads a settled workspace as zero, not as missing data', () => {
    const metrics = deriveCollectionMetrics([pkg({})], 1);

    expect(metrics?.lowOnCredits).toBe(0);
    expect(metrics?.unpaidPackages).toBe(0);
    expect(metrics?.outstandingMinor).toBe(0);
  });
});
