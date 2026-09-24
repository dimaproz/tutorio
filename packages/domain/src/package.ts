/**
 * Lesson-package math: how many lessons a package holds, its price, and how
 * much of it may still be paid.
 *
 * Every amount here is in **minor units**; nothing in this module touches
 * floating point, and no function ever mixes currencies.
 */

import { expandSeries, type RecurrenceRule } from './recurrence';

export type PackageSizingMode = 'FIXED_COUNT' | 'BY_PERIOD';

export interface PackagePlanInput {
  sizingMode: PackageSizingMode;
  pricePerLessonMinor: number;
  /** Required for FIXED_COUNT. */
  lessonsTotal?: number | null;
  /** Required for BY_PERIOD — the recurrence and the window it runs over. */
  /** Kept for backwards compatibility with a single-slot schedule. */
  rule?: RecurrenceRule | null;
  /** One recurrence rule per weekday/time slot. */
  rules?: readonly RecurrenceRule[] | null;
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
    const rules = input.rules ?? (input.rule ? [input.rule] : []);
    if (rules.length === 0 || !input.startsAt || !input.endDate) {
      throw new InvalidPackagePlanError(
        'A by-period package needs a recurrence rule, a start and an end date',
      );
    }
    // The end date is inclusive for the tutor, exclusive for the expansion.
    lessonsTotal = expandPackageSchedule(rules, {
      from: input.startsAt,
      until: new Date(input.endDate.getTime() + 1),
    }).length;
    if (lessonsTotal < 1) {
      throw new InvalidPackagePlanError('A by-period package needs at least one scheduled lesson');
    }
  }

  return {
    lessonsTotal,
    pricePerLessonMinor: input.pricePerLessonMinor,
    totalPriceMinor: lessonsTotal * input.pricePerLessonMinor,
  };
}

/** Expands all package slots into one ordered list without duplicate instants. */
export function expandPackageSchedule(
  rules: readonly RecurrenceRule[],
  window: { from: Date; until: Date },
): Date[] {
  const unique = new Map<number, Date>();
  for (const rule of rules) {
    for (const start of expandSeries(rule, window)) {
      unique.set(start.getTime(), start);
    }
  }
  return [...unique.values()].sort((a, b) => a.getTime() - b.getTime());
}

export type PaymentStatus = 'PAID' | 'PENDING' | 'PARTIAL';

export class OverpaymentError extends Error {
  constructor(totalMinor: number, paidMinor: number, amountMinor: number) {
    super(`Payment of ${amountMinor} exceeds outstanding balance of ${totalMinor - paidMinor}`);
    this.name = 'OverpaymentError';
  }
}

/** Rejects a payment that would settle more than the agreed amount. */
export function assertPaymentWithinOutstanding(
  totalMinor: number,
  paidMinor: number,
  amountMinor: number,
): void {
  if (
    !Number.isSafeInteger(totalMinor) ||
    !Number.isSafeInteger(paidMinor) ||
    !Number.isSafeInteger(amountMinor) ||
    totalMinor < 0 ||
    paidMinor < 0 ||
    amountMinor <= 0 ||
    paidMinor + amountMinor > totalMinor
  ) {
    throw new OverpaymentError(totalMinor, paidMinor, amountMinor);
  }
}

/** Payment status derived from what is owed versus what has been paid. */
export function paymentStatusOf(oweMinor: number, paidMinor: number): PaymentStatus {
  if (paidMinor <= 0) {
    return 'PENDING';
  }
  return paidMinor >= oweMinor ? 'PAID' : 'PARTIAL';
}
