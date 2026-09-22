import type { PackageResponse } from '@tutorio/validation';

/** A student at or below this many remaining credits is running out. */
export const LOW_CREDIT_THRESHOLD = 2;

export type CollectionMetrics = {
  /** Distinct students whose active package is running out. */
  lowOnCredits: number;
  /** Packages that still owe money. */
  unpaidPackages: number;
  /** Outstanding total, or null when the packages do not share one currency. */
  outstandingMinor: number | null;
  outstandingCurrency: string | null;
};

/**
 * Collection metrics derived from the workspace's active packages.
 *
 * Returns null when the supplied page does not cover every package: a partial
 * aggregate looks exactly like a real number and is not one, so the caller
 * shows that the metric is unavailable rather than an undercount.
 */
export function deriveCollectionMetrics(
  items: PackageResponse[],
  total: number,
): CollectionMetrics | null {
  if (items.length < total) {
    return null;
  }

  const lowStudents = new Set<string>();
  const currencies = new Set<string>();
  let unpaidPackages = 0;
  let outstandingMinor = 0;

  for (const item of items) {
    if (item.studentId && item.remainingCredits <= LOW_CREDIT_THRESHOLD) {
      lowStudents.add(item.studentId);
    }

    const owed = item.effectiveTotalMinor - item.paidMinor;
    if (owed > 0) {
      unpaidPackages += 1;
      outstandingMinor += owed;
      currencies.add(item.currency);
    }
  }

  // Minor units of different currencies are not addable.
  const mixedCurrency = currencies.size > 1;

  return {
    lowOnCredits: lowStudents.size,
    unpaidPackages,
    outstandingMinor: mixedCurrency ? null : outstandingMinor,
    outstandingCurrency: mixedCurrency ? null : ([...currencies][0] ?? null),
  };
}
