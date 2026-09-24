/**
 * Lesson-package math (product/scheduling.md L-80, L-85): how many lessons a
 * package holds, its price, what its credits are worth elsewhere, and how
 * much of it may still be paid.
 *
 * Every amount here is in **minor units**; nothing in this module touches
 * floating point, and no function ever mixes currencies.
 */

import { expandSeries, type RecurrenceRule } from './recurrence';

/**
 * By count; by period, sized by the schedule in the window; by period,
 * sized as X lessons a week.
 */
export type PackageSizingMode = 'FIXED_COUNT' | 'BY_PERIOD' | 'BY_PERIOD_WEEKLY';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface PackagePlanInput {
  sizingMode: PackageSizingMode;
  /** Price per lesson; the total is this times the credits. */
  pricePerLessonMinor?: number | null;
  /** Or a total for the whole package (L-80); the per-lesson price follows. */
  totalPriceMinor?: number | null;
  /** Required for FIXED_COUNT; for a period package, the tutor's override. */
  lessonsTotal?: number | null;
  /** BY_PERIOD_WEEKLY: how many lessons a week. */
  lessonsPerWeek?: number | null;
  /** Required for BY_PERIOD — the recurrence and the window it runs over. */
  /** Kept for backwards compatibility with a single-slot schedule. */
  rule?: RecurrenceRule | null;
  /** One recurrence rule per weekday/time slot. */
  rules?: readonly RecurrenceRule[] | null;
  /** A period package's first day. */
  startsAt?: Date | null;
  /** A period package's last instant (inclusive). */
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
 * lesson count outright; a by-period package derives it from the schedule in
 * the window (or takes the tutor's override); a weekly package is X lessons a
 * week times the weeks in the window.
 */
export function planPackage(input: PackagePlanInput): PackagePlan {
  const lessonsTotal = plannedLessons(input);
  const hasTotal = input.totalPriceMinor != null;
  const price = hasTotal ? input.totalPriceMinor : input.pricePerLessonMinor;
  if (!Number.isSafeInteger(price ?? NaN) || (price as number) < 0) {
    throw new InvalidPackagePlanError(
      hasTotal
        ? 'totalPriceMinor must be a non-negative integer'
        : 'pricePerLessonMinor must be a non-negative integer',
    );
  }
  if (hasTotal) {
    const totalPriceMinor = price as number;
    return {
      lessonsTotal,
      pricePerLessonMinor: Math.round(totalPriceMinor / lessonsTotal),
      totalPriceMinor,
    };
  }
  return {
    lessonsTotal,
    pricePerLessonMinor: price as number,
    totalPriceMinor: lessonsTotal * (price as number),
  };
}

function plannedLessons(input: PackagePlanInput): number {
  const override = input.lessonsTotal;
  if (override != null) {
    if (!Number.isSafeInteger(override) || override < 1) {
      throw new InvalidPackagePlanError('lessonsTotal must be at least 1');
    }
    if (input.sizingMode === 'FIXED_COUNT') return override;
  } else if (input.sizingMode === 'FIXED_COUNT') {
    throw new InvalidPackagePlanError('A fixed-count package needs lessonsTotal >= 1');
  }
  if (!input.startsAt || !input.endDate) {
    throw new InvalidPackagePlanError('A by-period package needs a start and an end date');
  }
  // The end date is inclusive for the tutor, exclusive for the expansion.
  const until = new Date(input.endDate.getTime() + 1);
  if (until.getTime() <= input.startsAt.getTime()) {
    throw new InvalidPackagePlanError('A by-period package ends after it starts');
  }
  if (override != null) return override;

  if (input.sizingMode === 'BY_PERIOD_WEEKLY') {
    const perWeek = input.lessonsPerWeek ?? NaN;
    if (!Number.isSafeInteger(perWeek) || perWeek < 1) {
      throw new InvalidPackagePlanError('A weekly package needs lessonsPerWeek >= 1');
    }
    return perWeek * weeksInPeriod(input.startsAt, until);
  }
  const rules = input.rules ?? (input.rule ? [input.rule] : []);
  if (rules.length === 0) {
    throw new InvalidPackagePlanError(
      'A by-period package needs a schedule to count its lessons, or lessonsTotal',
    );
  }
  const counted = expandPackageSchedule(rules, { from: input.startsAt, until }).length;
  if (counted < 1) {
    throw new InvalidPackagePlanError('A by-period package needs at least one scheduled lesson');
  }
  return counted;
}

/** Whole weeks in `[from, until)`, rounded to the nearest week, at least one. */
export function weeksInPeriod(from: Date, until: Date): number {
  return Math.max(1, Math.round((until.getTime() - from.getTime()) / WEEK_MS));
}

export interface CreditTransfer {
  /** What the credits moved are worth at the price they were bought at. */
  valueMinor: number;
  /** Lessons the target direction receives at its own price, rounded down. */
  lessons: number;
  /** The value left over after rounding down. */
  remainderMinor: number;
}

/**
 * Moves unused credits to another direction of the same student, recalculated
 * by price and rounded down (L-85): three lessons at 400 become two at 500,
 * with 200 left over. A free target takes the lessons one for one.
 */
export function transferCredits(
  credits: number,
  fromPriceMinor: number,
  toPriceMinor: number,
): CreditTransfer {
  if (!Number.isSafeInteger(credits) || credits < 1) {
    throw new InvalidPackagePlanError('A transfer moves at least one credit');
  }
  const valueMinor = credits * fromPriceMinor;
  if (toPriceMinor <= 0) {
    return { valueMinor, lessons: credits, remainderMinor: 0 };
  }
  const lessons = Math.floor(valueMinor / toPriceMinor);
  return { valueMinor, lessons, remainderMinor: valueMinor - lessons * toPriceMinor };
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

/**
 * Payment status derived from what is owed versus what has been paid. Nothing
 * owed (a package received by a transfer) is paid.
 */
export function paymentStatusOf(oweMinor: number, paidMinor: number): PaymentStatus {
  if (oweMinor <= 0) {
    return 'PAID';
  }
  if (paidMinor <= 0) {
    return 'PENDING';
  }
  return paidMinor >= oweMinor ? 'PAID' : 'PARTIAL';
}
