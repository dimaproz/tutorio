/**
 * Lesson status state machine (product/scheduling.md L-50…L-53). A lesson is either still SCHEDULED or in a final status; a final
 * status is either charged (held, charged cancellation, no-show) or free.
 *
 * - SCHEDULED → any final status.
 * - A final status → another final status: a correction ("it was actually a
 *   no-show"). The billing service re-evaluates the charges after it.
 * - A final status → SCHEDULED: undoing a mistake, for a lesson that has not
 *   ended yet (the service enforces the time rule; L-53).
 */

export type LessonStatus =
  'SCHEDULED' | 'COMPLETED' | 'CANCELLED_CHARGED' | 'CANCELLED_UNCHARGED' | 'NO_SHOW';

export type FinalLessonStatus = Exclude<LessonStatus, 'SCHEDULED'>;

export class InvalidTransitionError extends Error {
  constructor(from: LessonStatus, to: LessonStatus) {
    super(`Invalid lesson status transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

const CHARGED: ReadonlySet<LessonStatus> = new Set([
  'COMPLETED',
  'CANCELLED_CHARGED',
  'NO_SHOW',
]);

/** Whether a lesson in this status costs the participant a lesson. */
export function isChargedStatus(status: LessonStatus): boolean {
  return CHARGED.has(status);
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
