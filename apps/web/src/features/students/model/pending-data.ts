/**
 * The Studio design shows fields the API does not provide yet. Every one of
 * them is listed in the handoff's "Data the current API does not provide"
 * section and is rendered as a placeholder here rather than invented.
 *
 * Keeping them in one module makes the backlog visible and makes each slot a
 * one-line change once its endpoint lands.
 */
export const PENDING_VALUE = '—';

/** Collection metrics that need an aggregate endpoint. */
export const PENDING_METRICS = ['lessonsThisWeek', 'lowOnCredits', 'awaitingPayment'] as const;

/** Row columns that need per-student package, schedule and balance rollups. */
export const PENDING_COLUMNS = ['credits', 'nextLesson', 'balance'] as const;

/** Collection controls the design shows that have no query support yet. */
export const PENDING_CONTROLS = ['teacherFilter', 'lowCreditsFilter', 'gridView'] as const;
