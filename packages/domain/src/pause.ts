/**
 * Pauses (freeze) — product/scheduling.md L-100…L-104.
 *
 * A pause covers the whole student or one direction from `startsAt` until
 * `endsAt` (exclusive; open-ended when null). Ending it early, or cancelling
 * one that has not started, records `endedAt`; the pause then covers
 * `[startsAt, endedAt)`. While it covers an instant, the student takes no part
 * in the paused directions' lessons and nothing is charged, and every package
 * valid at its start is extended by its length.
 */

export interface PauseWindow {
  startsAt: Date;
  /** Planned end, exclusive; null for an open-ended pause. */
  endsAt: Date | null;
  /** When the pause actually ended, if it ended before its planned end. */
  endedAt?: Date | null;
}

export type PauseState = 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'CANCELLED';

/** Where a pause stops covering time: its actual end, else its planned end. */
export function pauseEnd(pause: PauseWindow): Date | null {
  return pause.endedAt ?? pause.endsAt;
}

/** Whether a pause covers an instant. */
export function pauseCovers(pause: PauseWindow, at: Date): boolean {
  const end = pauseEnd(pause);
  return pause.startsAt.getTime() <= at.getTime() && (end === null || at.getTime() < end.getTime());
}

/** Whether any of the pauses covers an instant. */
export function isPausedAt(pauses: readonly PauseWindow[], at: Date): boolean {
  return pauses.some((pause) => pauseCovers(pause, at));
}

/** Whether two pauses share any instant. */
export function pausesOverlap(a: PauseWindow, b: PauseWindow): boolean {
  const aEnd = pauseEnd(a);
  const bEnd = pauseEnd(b);
  const aBeforeB = aEnd !== null && aEnd.getTime() <= b.startsAt.getTime();
  const bBeforeA = bEnd !== null && bEnd.getTime() <= a.startsAt.getTime();
  return !aBeforeB && !bBeforeA;
}

/** A pause's state at an instant; one that ended before it began was cancelled. */
export function pauseStateAt(pause: PauseWindow, now: Date): PauseState {
  const end = pauseEnd(pause);
  if (end !== null && end.getTime() <= pause.startsAt.getTime()) return 'CANCELLED';
  if (now.getTime() < pause.startsAt.getTime()) return 'SCHEDULED';
  if (end !== null && end.getTime() <= now.getTime()) return 'ENDED';
  return 'ACTIVE';
}

/**
 * How far a pause pushes packages (L-102), in whole seconds: its covered
 * length. An open-ended pause that is still running has no length yet — it
 * extends on return.
 */
export function pauseLengthSeconds(pause: PauseWindow): number | null {
  const end = pauseEnd(pause);
  if (end === null) return null;
  return Math.max(0, Math.round((end.getTime() - pause.startsAt.getTime()) / 1000));
}

/** Whether a package is valid at a pause's start, so the pause extends it. */
export function extendsPackage(
  pkg: { validFrom: Date | null; expiresAt: Date | null },
  pauseStartsAt: Date,
): boolean {
  if (pkg.expiresAt === null) return false;
  const started = pkg.validFrom === null || pkg.validFrom.getTime() <= pauseStartsAt.getTime();
  return started && pkg.expiresAt.getTime() > pauseStartsAt.getTime();
}
