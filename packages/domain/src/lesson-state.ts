/**
 * Lesson status state machine and its credit effect (product/scheduling.md
 * L-50…L-53). A lesson is either still SCHEDULED or in a final status; a final
 * status is either charged (held, charged cancellation, no-show) or free.
 *
 * - SCHEDULED → any final status.
 * - A final status → another final status: a correction ("it was actually a
 *   no-show"). Only a change in whether the lesson is charged moves credits.
 * - A final status → SCHEDULED: undoing a mistake, for a lesson that has not
 *   ended yet (the service enforces the time rule; L-53).
 */

export type LessonStatus =
  'SCHEDULED' | 'COMPLETED' | 'CANCELLED_CHARGED' | 'CANCELLED_UNCHARGED' | 'NO_SHOW';

export type FinalLessonStatus = Exclude<LessonStatus, 'SCHEDULED'>;

export type CreditEntryType =
  'lesson_completed' | 'late_cancellation' | 'no_show' | 'teacher_cancellation_refund';

export interface CreditEffectDescriptor {
  /** Change to the lesson-credit balance, in lesson units (e.g. -1 or +1). */
  delta: number;
  /** The ledger entry type recorded for this transition. */
  type: CreditEntryType;
}

export class InvalidTransitionError extends Error {
  constructor(from: LessonStatus, to: LessonStatus) {
    super(`Invalid lesson status transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

/** The ledger entry a charged final status writes when it is entered. */
const DEBIT_TYPE: Partial<Record<FinalLessonStatus, CreditEntryType>> = {
  COMPLETED: 'lesson_completed',
  CANCELLED_CHARGED: 'late_cancellation',
  NO_SHOW: 'no_show',
};

/** Whether a lesson in this status costs the participant a lesson. */
export function isChargedStatus(status: LessonStatus): boolean {
  return status in DEBIT_TYPE;
}

export function isFinalStatus(status: LessonStatus): status is FinalLessonStatus {
  return status !== 'SCHEDULED';
}

/** A cancellation of either kind (charged or free). */
export function isCancelledStatus(status: LessonStatus): boolean {
  return status === 'CANCELLED_CHARGED' || status === 'CANCELLED_UNCHARGED';
}

export function canTransition(from: LessonStatus, to: LessonStatus): boolean {
  return from !== to;
}

/**
 * The credit-ledger effect of a transition, or `null` when whether the lesson
 * is charged does not change. Throws `InvalidTransitionError` for a no-op.
 *
 * - Becoming charged debits one credit, typed by the status entered.
 * - Stopping being charged refunds one credit, typed by the status left, so
 *   the compensation mirrors the entry it reverses.
 */
export function transitionEffect(
  from: LessonStatus,
  to: LessonStatus,
): CreditEffectDescriptor | null {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
  const wasCharged = isChargedStatus(from);
  const willBeCharged = isChargedStatus(to);
  if (wasCharged === willBeCharged) {
    return null;
  }
  if (willBeCharged) {
    return { delta: -1, type: DEBIT_TYPE[to as FinalLessonStatus]! };
  }
  return { delta: 1, type: DEBIT_TYPE[from as FinalLessonStatus]! };
}

/**
 * Makeup pairing (L-61): exactly one of a lesson and its makeup is charged.
 * When the original was charged (late cancellation or no-show), the makeup is
 * free; otherwise the makeup is charged like any lesson.
 */
export function makeupIsFree(originalStatus: LessonStatus): boolean {
  return isChargedStatus(originalStatus);
}

/** Whether a lesson may receive a makeup: it was cancelled or missed (L-60). */
export function canHaveMakeup(status: LessonStatus): boolean {
  return isCancelledStatus(status) || status === 'NO_SHOW';
}
