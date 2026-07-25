/**
 * Cancellation policy: whether calling off a lesson is still "on time".
 *
 * A student who cancels inside the deadline has effectively consumed the slot —
 * the tutor could no longer fill it — so the lesson is charged. Outside the
 * deadline it is free. The deadline itself is configurable per enrollment, with
 * the workspace value as the fallback.
 */

export type CancellationTiming = 'on_time' | 'late';

/** The deadline that applies, in hours: the enrollment's own, else the workspace's. */
export function effectiveDeadlineHours(
  enrollmentHours: number | null | undefined,
  workspaceHours: number,
): number {
  return enrollmentHours ?? workspaceHours;
}

/** Whole hours left until the lesson starts; negative once it has begun. */
export function hoursUntil(startsAt: Date, now: Date): number {
  return Math.floor((startsAt.getTime() - now.getTime()) / 3_600_000);
}

/**
 * Whether a cancellation right now is on time or late.
 *
 * Exactly at the deadline still counts as on time — the boundary favours the
 * student, and a tutor can always override the charge by hand.
 */
export function cancellationTiming(
  startsAt: Date,
  now: Date,
  deadlineHours: number,
): CancellationTiming {
  return hoursUntil(startsAt, now) >= deadlineHours ? 'on_time' : 'late';
}

/**
 * The status a cancellation should default to. Late cancellations consume the
 * credit; on-time ones keep the slot paid but unconsumed. The tutor can still
 * choose otherwise — this is the suggestion, not the rule.
 */
export function suggestedCancellationStatus(
  timing: CancellationTiming,
): 'CANCELLED_CHARGED' | 'CANCELLED_UNCHARGED' {
  return timing === 'late' ? 'CANCELLED_CHARGED' : 'CANCELLED_UNCHARGED';
}
