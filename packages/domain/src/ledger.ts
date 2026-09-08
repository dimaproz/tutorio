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

import { transitionEffect, type CreditEntryType, type LessonStatus } from './lesson-state';

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
}

/** Stable idempotency key for one persisted lesson state transition. */
export function lessonEntryKey(lessonId: string, transitionVersion = 1): string {
  return `lesson:${lessonId}:transition:${transitionVersion}`;
}

/**
 * What to write when a lesson moves between statuses. Throws
 * `InvalidTransitionError` (from the state machine) for an illegal move.
 *
 * `transitionVersion` is incremented atomically with lesson status. It makes
 * a retry of the same semantic transition stable while allowing a genuine
 * cancel → restore → cancel cycle to append separate entries.
 */
export function planTransition(
  from: LessonStatus,
  to: LessonStatus,
  lessonId: string,
  transitionVersion = 1,
): TransitionLedgerPlan {
  const effect = transitionEffect(from, to);
  if (!effect) {
    return { entry: null };
  }
  return {
    entry: {
      delta: effect.delta,
      type: effect.type,
      idempotencyKey: lessonEntryKey(lessonId, transitionVersion),
      lessonId,
    },
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

/**
 * Current lesson consumption, not the historical count of debit events.
 * Only lesson-driven entries participate: a compensating +1 reverses its
 * earlier debit, while purchases and manual corrections remain balance-only.
 */
export function consumedCredits(entries: readonly LedgerEntryLike[]): number {
  const lessonDelta = entries
    .filter((entry) => entry.type === 'lesson_completed' || entry.type === 'late_cancellation')
    .reduce((sum, entry) => sum + entry.delta, 0);
  return Math.max(0, -lessonDelta);
}
