/**
 * Lesson status state machine. Stage 3 only enforces the legal transitions and
 * *describes* the credit-ledger effect each transition would have — it does not
 * persist anything. Stage 4 consumes `CreditEffectDescriptor` to write the
 * actual `LessonCreditEntry` rows.
 */

export type LessonStatus =
  | 'SCHEDULED'
  | 'COMPLETED'
  | 'CANCELLED_CHARGED'
  | 'CANCELLED_UNCHARGED';

export type CreditEntryType =
  | 'lesson_completed'
  | 'late_cancellation'
  | 'teacher_cancellation_refund';

export interface CreditEffectDescriptor {
  /** Change to the lesson-credit balance, in lesson units (e.g. -1, 0, +1). */
  delta: number;
  /** The ledger entry type Stage 4 will record for this transition. */
  type: CreditEntryType;
}

export class InvalidTransitionError extends Error {
  constructor(from: LessonStatus, to: LessonStatus) {
    super(`Invalid lesson status transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

// Forward transitions from SCHEDULED, plus reverts back to SCHEDULED (a mistake
// correction). A revert produces a compensating entry rather than deleting the
// original — see `transitionEffect`.
const ALLOWED: Record<LessonStatus, readonly LessonStatus[]> = {
  SCHEDULED: ['COMPLETED', 'CANCELLED_CHARGED', 'CANCELLED_UNCHARGED'],
  COMPLETED: ['SCHEDULED'],
  CANCELLED_CHARGED: ['SCHEDULED'],
  CANCELLED_UNCHARGED: ['SCHEDULED'],
};

// The effect of entering a terminal status from SCHEDULED. Reverting negates it.
const FORWARD_EFFECT: Record<
  Exclude<LessonStatus, 'SCHEDULED'>,
  CreditEffectDescriptor
> = {
  // Lesson happened — one credit consumed.
  COMPLETED: { delta: -1, type: 'lesson_completed' },
  // Cancelled but charged (late/held) — the credit is still consumed.
  CANCELLED_CHARGED: { delta: -1, type: 'late_cancellation' },
  // Cancelled without charge — paid slot kept open, no credit consumed.
  CANCELLED_UNCHARGED: { delta: 0, type: 'teacher_cancellation_refund' },
};

export function canTransition(from: LessonStatus, to: LessonStatus): boolean {
  return from !== to && ALLOWED[from].includes(to);
}

/**
 * The credit-ledger effect of a transition. Throws `InvalidTransitionError` for
 * an illegal transition. A revert to SCHEDULED returns the negation of the
 * effect that entering the source status produced (the compensating entry).
 */
export function transitionEffect(
  from: LessonStatus,
  to: LessonStatus,
): CreditEffectDescriptor {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
  if (to === 'SCHEDULED') {
    const undone = FORWARD_EFFECT[from as Exclude<LessonStatus, 'SCHEDULED'>];
    // `|| 0` collapses the `-0` that negating a 0 delta would otherwise yield.
    return { delta: -undone.delta || 0, type: undone.type };
  }
  return FORWARD_EFFECT[to as Exclude<LessonStatus, 'SCHEDULED'>];
}
