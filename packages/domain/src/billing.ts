/**
 * Per-participant charging (product/scheduling.md L-10…L-12, L-61, L-70…L-74,
 * L-81…L-83, L-90, L-91; ADR 0007).
 *
 * A lesson produces one charge per participant: an individual lesson one, a
 * group lesson one per member taking part. Whether a participant owes the
 * lesson follows from the lesson's status, the makeup pairing and the
 * participant's attendance mark. What pays for it follows from the
 * direction's billing mode:
 *
 * - package mode: one credit from the oldest valid package with credits left,
 *   else the lesson is held on debt until the next credits cover it;
 * - pay-per-lesson: the lesson's price goes on the direction's balance, and
 *   payments settle the oldest lessons first.
 */

import type { AttendanceMark } from './attendance';
import { isChargedStatus, makeupIsFree, type LessonStatus } from './lesson-state';

export type BillingMode = 'PACKAGE' | 'PER_LESSON';

/** What pays for one charge. */
export type ChargeSource = 'PACKAGE' | 'DEBT' | 'BALANCE';

export interface ChargeableLesson {
  status: LessonStatus;
  isGroup: boolean;
  /** For a makeup: the status of the lesson it replaces. */
  originalStatus?: LessonStatus | null;
}

/**
 * Whether one participant owes a lesson: its status is charged (held, charged
 * cancellation, no-show), it is not a makeup whose original was charged
 * (L-61), and in a group the participant was not excused (L-71). No mark in a
 * group counts as present (L-72).
 */
export function participantIsCharged(
  lesson: ChargeableLesson,
  mark: AttendanceMark | null,
): boolean {
  if (!isChargedStatus(lesson.status)) return false;
  if (lesson.originalStatus && makeupIsFree(lesson.originalStatus)) return false;
  if (lesson.isGroup && mark === 'EXCUSED') return false;
  return true;
}

/** The source a new charge takes before any package is looked at. */
export function initialSource(mode: BillingMode): ChargeSource {
  return mode === 'PACKAGE' ? 'DEBT' : 'BALANCE';
}

export interface CreditPackage {
  id: string;
  purchasedAt: Date;
  /** Exclusive end of validity; null when the package does not expire. */
  expiresAt: Date | null;
  /** Credits granted and adjusted, minus the charges it already pays. */
  remaining: number;
}

/** A package pays only for lessons before it expires (L-84). */
export function isPackageValidAt(pkg: Pick<CreditPackage, 'expiresAt'>, at: Date): boolean {
  return pkg.expiresAt === null || pkg.expiresAt.getTime() > at.getTime();
}

function oldestFirst<T extends { purchasedAt: Date; id: string }>(packages: readonly T[]): T[] {
  return [...packages].sort(
    (a, b) => a.purchasedAt.getTime() - b.purchasedAt.getTime() || a.id.localeCompare(b.id),
  );
}

/**
 * The package a lesson at `lessonAt` uses: the oldest one valid then with a
 * credit left (L-81), or null — the lesson goes on debt (L-82).
 */
export function pickPackage(packages: readonly CreditPackage[], lessonAt: Date): string | null {
  const pick = oldestFirst(packages).find(
    (pkg) => pkg.remaining > 0 && isPackageValidAt(pkg, lessonAt),
  );
  return pick?.id ?? null;
}

export interface DebtCharge {
  id: string;
  lessonAt: Date;
}

export interface DebtCover {
  chargeId: string;
  packageId: string;
}

/**
 * New credits cover the lessons on debt first, oldest lesson first, each
 * from the oldest package valid at that lesson (L-82). Debts no package can
 * pay stay on debt.
 */
export function coverDebts(
  debts: readonly DebtCharge[],
  packages: readonly CreditPackage[],
): DebtCover[] {
  const pool = oldestFirst(packages).map((pkg) => ({ ...pkg }));
  const covers: DebtCover[] = [];
  const ordered = [...debts].sort(
    (a, b) => a.lessonAt.getTime() - b.lessonAt.getTime() || a.id.localeCompare(b.id),
  );
  for (const debt of ordered) {
    const pkg = pool.find((item) => item.remaining > 0 && isPackageValidAt(item, debt.lessonAt));
    if (!pkg) continue;
    pkg.remaining -= 1;
    covers.push({ chargeId: debt.id, packageId: pkg.id });
  }
  return covers;
}

export interface BalanceCharge {
  id: string;
  lessonAt: Date;
  amountMinor: number;
}

export interface UnpaidCharge {
  id: string;
  lessonAt: Date;
  /** What is still owed for this lesson. */
  outstandingMinor: number;
}

export interface BalanceAllocation {
  chargedMinor: number;
  paidMinor: number;
  /** What the direction owes now; zero when it is paid up or in advance. */
  debtMinor: number;
  /** Money paid ahead of the lessons; zero while anything is owed. */
  advanceMinor: number;
  /** Lessons fully paid, oldest first. */
  settledIds: string[];
  /** Lessons not (fully) paid yet, oldest first. */
  unpaid: UnpaidCharge[];
}

/**
 * Pay-per-lesson balance (L-90): charged lessons add their price, payments
 * settle the oldest lessons first. "Debt: 1 200 ₴ · 3 lessons" is
 * `debtMinor` and `unpaid.length`.
 */
export function allocatePayments(
  charges: readonly BalanceCharge[],
  paidMinor: number,
): BalanceAllocation {
  const ordered = [...charges].sort(
    (a, b) => a.lessonAt.getTime() - b.lessonAt.getTime() || a.id.localeCompare(b.id),
  );
  let available = paidMinor;
  const settledIds: string[] = [];
  const unpaid: UnpaidCharge[] = [];
  for (const charge of ordered) {
    if (available >= charge.amountMinor) {
      available -= charge.amountMinor;
      settledIds.push(charge.id);
      continue;
    }
    unpaid.push({
      id: charge.id,
      lessonAt: charge.lessonAt,
      outstandingMinor: charge.amountMinor - available,
    });
    available = 0;
  }
  const chargedMinor = ordered.reduce((sum, charge) => sum + charge.amountMinor, 0);
  return {
    chargedMinor,
    paidMinor,
    debtMinor: Math.max(0, chargedMinor - paidMinor),
    advanceMinor: Math.max(0, paidMinor - chargedMinor),
    settledIds,
    unpaid,
  };
}
