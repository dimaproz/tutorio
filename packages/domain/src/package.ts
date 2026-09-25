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

const DAY_MS = 24 * 60 * 60 * 1000;

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
    return weeklyLessons(input.startsAt, until, perWeek);
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

/**
 * The lessons of an N-a-week package that fall in its dates (L-80): N for
 * every 7 days of `[from, until)`, a part week in proportion, rounded to the
 * nearest lesson, at least one — 3 a week over 1–31 October is 13.
 */
export function weeklyLessons(from: Date, until: Date, perWeek: number): number {
  // Whole days: a clock change inside the window moves the length by an hour.
  const days = Math.round((until.getTime() - from.getTime()) / DAY_MS);
  return Math.max(1, Math.round((days * perWeek) / 7));
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

/**
 * Where a package is in its life (S07): it has credits to use in its window,
 * its credits are used up, or its window closed with credits left (L-84).
 */
export type PackageLifecycle = 'active' | 'used' | 'expired';

export interface PackageLifecycleInput {
  remainingCredits: number;
  /** Exclusive end of validity; null when it does not expire. */
  expiresAt: Date | null;
}

export function packageLifecycle(pkg: PackageLifecycleInput, now: Date): PackageLifecycle {
  if (pkg.remainingCredits <= 0) return 'used';
  if (pkg.expiresAt !== null && pkg.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'active';
}

/** A window closing within this many days reads as "running out". */
export const PACKAGE_ENDING_DAYS = 7;

/**
 * A live package running out: `lowCreditThreshold` credits left or fewer
 * (L-82, L-120; 0 turns that part off), or its window closing within
 * {@link PACKAGE_ENDING_DAYS}.
 */
export function isPackageEnding(
  pkg: PackageLifecycleInput,
  now: Date,
  lowCreditThreshold: number,
): boolean {
  if (packageLifecycle(pkg, now) !== 'active') return false;
  if (lowCreditThreshold > 0 && pkg.remainingCredits <= lowCreditThreshold) return true;
  return (
    pkg.expiresAt !== null &&
    pkg.expiresAt.getTime() - now.getTime() <= PACKAGE_ENDING_DAYS * DAY_MS
  );
}

export interface EndingOrderInput extends PackageLifecycleInput {
  id: string;
  purchasedAt: Date;
}

/**
 * «Спочатку ті, що закінчуються»: live packages before finished ones, the
 * running-out ones first, then the nearest end, the fewest credits left and
 * the newest sale.
 */
export function compareEndingFirst(
  now: Date,
  lowCreditThreshold: number,
): (a: EndingOrderInput, b: EndingOrderInput) => number {
  const rank = (pkg: EndingOrderInput) =>
    packageLifecycle(pkg, now) !== 'active'
      ? 2
      : isPackageEnding(pkg, now, lowCreditThreshold)
        ? 0
        : 1;
  const end = (pkg: EndingOrderInput) => pkg.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return (a, b) =>
    rank(a) - rank(b) ||
    end(a) - end(b) ||
    a.remainingCredits - b.remainingCredits ||
    b.purchasedAt.getTime() - a.purchasedAt.getTime() ||
    a.id.localeCompare(b.id);
}
