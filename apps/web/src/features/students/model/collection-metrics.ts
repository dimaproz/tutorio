import type { PackageResponse } from '@tutorio/validation';

/** A student at or below this many remaining credits is running out. */
export const LOW_CREDIT_THRESHOLD = 2;

export type StudentCredits = { left: number; total: number };

/**
 * The credits of the package each student is using now: the newest purchase
 * that still has credits, or the newest one when every package is used up.
 */
export function currentCreditsByStudent(packages: PackageResponse[]): Map<string, StudentCredits> {
  const current = new Map<string, StudentCredits>();
  const byPurchase = [...packages].sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
  for (const pkg of byPurchase) {
    const credits = { left: Math.max(pkg.remainingCredits, 0), total: pkg.lessonsTotal };
    const existing = current.get(pkg.studentId);
    if (!existing || (existing.left === 0 && credits.left > 0)) {
      current.set(pkg.studentId, credits);
    }
  }
  return current;
}

/** A package is running out at or below the collection's low-credit threshold. */
export function isLowOnCredits(credits: StudentCredits | undefined): boolean {
  return Boolean(credits && credits.total > 0 && credits.left <= LOW_CREDIT_THRESHOLD);
}

export type CollectionMetrics = {
  /** Distinct students whose current package is running out. */
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

  const currencies = new Set<string>();
  let unpaidPackages = 0;
  let outstandingMinor = 0;

  for (const item of items) {
    const owed = item.totalPriceMinorSnapshot - item.paidMinor;
    if (owed > 0) {
      unpaidPackages += 1;
      outstandingMinor += owed;
      currencies.add(item.currency);
    }
  }

  // Minor units of different currencies are not addable.
  const mixedCurrency = currencies.size > 1;

  // A depleted old package does not make a student run out while a newer one
  // still has credits, so the count follows each student's current package.
  const lowOnCredits = [...currentCreditsByStudent(items).values()].filter(isLowOnCredits).length;

  return {
    lowOnCredits,
    unpaidPackages,
    outstandingMinor: mixedCurrency ? null : outstandingMinor,
    outstandingCurrency: mixedCurrency ? null : ([...currencies][0] ?? null),
  };
}
