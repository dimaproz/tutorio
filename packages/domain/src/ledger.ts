/**
 * The credit ledger: what a lesson status transition does to a package balance.
 *
 * The ledger is **append-only and expressed in lesson units**, never in money —
 * money lives in `Payment`. A balance is always the sum of its entries, so the
 * product can answer "why is the balance this?" from stored rows instead of a
 * mutable counter. Corrections are compensating entries, never edits.
 *
 * Stage 3 shipped `transitionEffect`, which *describes* the effect of a
 * transition. This module turns that description into a concrete, idempotent
 * write intent that the API persists.
 */

import {
  transitionEffect,
  type CreditEntryType,
  type LessonStatus,
} from './lesson-state';

export type LedgerEntryType = CreditEntryType | 'purchase' | 'manual_adjustment';

export interface CreditEntryIntent {
  /** Signed change in lesson units. */
  delta: number;
  type: LedgerEntryType;
  /**
   * Unique per (lesson, entry type) so a double click, a retry, or a replayed
   * webhook can never charge the same lesson twice.
   */
  idempotencyKey: string;
  lessonId?: string;
  note?: string;
}

export interface TransitionLedgerPlan {
  /** The entry to append, or `null` when the transition has no ledger effect. */
  entry: CreditEntryIntent | null;
  /**
   * Cancelling without charge keeps the paid slot alive: the tutor owes the
   * student a replacement lesson from the same pattern.
   */
  rebookReplacement: boolean;
}

/** Stable idempotency key for a lesson-driven entry. */
export function lessonEntryKey(
  lessonId: string,
  type: LedgerEntryType,
  attempt = 0,
): string {
  // `attempt` distinguishes a compensating entry from the original when a
  // lesson legitimately re-enters the same status after a revert.
  return attempt === 0
    ? `lesson:${lessonId}:${type}`
    : `lesson:${lessonId}:${type}:${attempt}`;
}

/**
 * What to write when a lesson moves between statuses. Throws
 * `InvalidTransitionError` (from the state machine) for an illegal move.
 *
 * `priorEntryCount` is how many entries this lesson already produced for the
 * resulting entry type; it keeps the idempotency key unique across a
 * cancel → revert → cancel cycle while still blocking a genuine duplicate.
 */
export function planTransition(
  from: LessonStatus,
  to: LessonStatus,
  lessonId: string,
  priorEntryCount = 0,
): TransitionLedgerPlan {
  const effect = transitionEffect(from, to);

  // An uncharged cancellation consumes no credit but owes a replacement slot.
  const rebookReplacement =
    to === 'CANCELLED_UNCHARGED' && effect.type === 'teacher_cancellation_refund';

  // A zero-delta effect still records *why* nothing moved — the tutor needs the
  // audit line, and Stage 7's student page shows it.
  return {
    entry: {
      delta: effect.delta,
      type: effect.type,
      idempotencyKey: lessonEntryKey(lessonId, effect.type, priorEntryCount),
      lessonId,
    },
    rebookReplacement,
  };
}

export interface LedgerEntryLike {
  delta: number;
  type: LedgerEntryType;
}

/** Remaining lesson credits: the sum of every entry, nothing else. */
export function creditBalance(entries: readonly LedgerEntryLike[]): number {
  return entries.reduce((sum, entry) => sum + entry.delta, 0);
}

/** Credits already consumed (completed lessons and charged cancellations). */
export function consumedCredits(entries: readonly LedgerEntryLike[]): number {
  return entries
    .filter((entry) => entry.delta < 0)
    .reduce((sum, entry) => sum - entry.delta, 0);
}
