/**
 * Lesson-package math: how many lessons a package holds, what it really costs
 * once uncharged cancellations are taken into account, and how a group package
 * splits across its members.
 *
 * Every amount here is in **minor units**; nothing in this module touches
 * floating point, and no function ever mixes currencies.
 */

import { creditBalance, type LedgerEntryLike } from './ledger';
import { expandSeries, type RecurrenceRule } from './recurrence';

export type PackageSizingMode = 'FIXED_COUNT' | 'BY_PERIOD';

export interface PackagePlanInput {
  sizingMode: PackageSizingMode;
  pricePerLessonMinor: number;
  /** Required for FIXED_COUNT. */
  lessonsTotal?: number | null;
  /** Required for BY_PERIOD — the recurrence and the window it runs over. */
  rule?: RecurrenceRule | null;
  startsAt?: Date | null;
  endDate?: Date | null;
}

export interface PackagePlan {
  lessonsTotal: number;
  pricePerLessonMinor: number;
  totalPriceMinor: number;
}

export class InvalidPackagePlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPackagePlanError';
  }
}

/**
 * Resolves a package's size and total price. A fixed-count package states its
 * lesson count outright; a by-period package derives it by expanding the
 * recurrence up to (and including) the end date.
 */
export function planPackage(input: PackagePlanInput): PackagePlan {
  if (!Number.isSafeInteger(input.pricePerLessonMinor) || input.pricePerLessonMinor < 0) {
    throw new InvalidPackagePlanError('pricePerLessonMinor must be a non-negative integer');
  }

  let lessonsTotal: number;
  if (input.sizingMode === 'FIXED_COUNT') {
    if (!Number.isSafeInteger(input.lessonsTotal ?? NaN) || (input.lessonsTotal ?? 0) < 1) {
      throw new InvalidPackagePlanError('A fixed-count package needs lessonsTotal >= 1');
    }
    lessonsTotal = input.lessonsTotal as number;
  } else {
    if (!input.rule || !input.startsAt || !input.endDate) {
      throw new InvalidPackagePlanError(
        'A by-period package needs a recurrence rule, a start and an end date',
      );
    }
    // The end date is inclusive for the tutor, exclusive for the expansion.
    lessonsTotal = expandSeries(input.rule, {
      from: input.startsAt,
      until: new Date(input.endDate.getTime() + 1),
    }).length;
  }

  return {
    lessonsTotal,
    pricePerLessonMinor: input.pricePerLessonMinor,
    totalPriceMinor: lessonsTotal * input.pricePerLessonMinor,
  };
}

/**
 * What the package is *actually* worth today. Lessons cancelled without charge
 * never consume a credit, so the tutor sees the purchase-time snapshot struck
 * through next to this adjusted figure. The stored snapshot is never rewritten.
 */
export function effectiveTotalMinor(
  totalPriceMinorSnapshot: number,
  pricePerLessonMinorSnapshot: number,
  unchargedCancellations: number,
): number {
  const adjusted =
    totalPriceMinorSnapshot - unchargedCancellations * pricePerLessonMinorSnapshot;
  return Math.max(0, adjusted);
}

/** Credits still available on a package. */
export function remainingCredits(entries: readonly LedgerEntryLike[]): number {
  return creditBalance(entries);
}

export interface ParticipantShare<TId extends string = string> {
  enrollmentId: TId;
  oweMinor: number;
}

/**
 * Splits a group package's price across its members. The division is exact:
 * the remainder from an uneven split is absorbed by the last share, so the
 * shares always sum back to the total — a group must never owe more or less
 * than the package costs.
 */
export function splitShares<TId extends string>(
  totalMinor: number,
  enrollmentIds: readonly TId[],
): ParticipantShare<TId>[] {
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0) {
    throw new InvalidPackagePlanError('totalMinor must be a non-negative integer');
  }
  if (enrollmentIds.length === 0) {
    return [];
  }
  const base = Math.floor(totalMinor / enrollmentIds.length);
  const remainder = totalMinor - base * enrollmentIds.length;

  return enrollmentIds.map((enrollmentId, index) => ({
    enrollmentId,
    oweMinor: index === enrollmentIds.length - 1 ? base + remainder : base,
  }));
}

export type PaymentStatus = 'PAID' | 'PENDING' | 'PARTIAL';

/** Payment status derived from what is owed versus what has been paid. */
export function paymentStatusOf(oweMinor: number, paidMinor: number): PaymentStatus {
  if (paidMinor <= 0) {
    return 'PENDING';
  }
  return paidMinor >= oweMinor ? 'PAID' : 'PARTIAL';
}
