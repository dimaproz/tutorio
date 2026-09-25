import { isCancelled, lessonMarks, type CalendarLesson } from './lessons';

/**
 * The «Статус» filter: which lessons show. Makeup is a kind, not a status, so
 * a makeup counts under its status and under «Відпрацювання» both; hiding
 * either hides it. «Лише не оплачені» keeps only lessons not paid yet.
 */

export const STATUS_KEYS = ['scheduled', 'held', 'noShow', 'makeup', 'cancelled'] as const;
export type StatusKey = (typeof STATUS_KEYS)[number];

export type StatusFilter = {
  shown: Record<StatusKey, boolean>;
  unpaidOnly: boolean;
};

export const DEFAULT_STATUS_FILTER: StatusFilter = {
  shown: { scheduled: true, held: true, noShow: true, makeup: true, cancelled: true },
  unpaidOnly: false,
};

export function statusKey(status: CalendarLesson['status']): Exclude<StatusKey, 'makeup'> {
  if (isCancelled(status)) return 'cancelled';
  if (status === 'COMPLETED') return 'held';
  if (status === 'NO_SHOW') return 'noShow';
  return 'scheduled';
}

export function matchesStatus(lesson: CalendarLesson, filter: StatusFilter): boolean {
  if (!filter.shown[statusKey(lesson.status)]) return false;
  if (lesson.kind === 'MAKEUP' && !filter.shown.makeup) return false;
  return !filter.unpaidOnly || lessonMarks(lesson).unpaid;
}

/** How many of the period's lessons each line would show. */
export function statusCounts(lessons: readonly CalendarLesson[]): Record<StatusKey, number> {
  const counts: Record<StatusKey, number> = {
    scheduled: 0,
    held: 0,
    noShow: 0,
    makeup: 0,
    cancelled: 0,
  };
  for (const lesson of lessons) {
    counts[statusKey(lesson.status)] += 1;
    if (lesson.kind === 'MAKEUP') counts.makeup += 1;
  }
  return counts;
}

export function isDefaultStatusFilter(filter: StatusFilter): boolean {
  return !filter.unpaidOnly && STATUS_KEYS.every((key) => filter.shown[key]);
}

/** The pill's count while filtered: the lines left on (and the unpaid switch). */
export function statusFilterCount(filter: StatusFilter): number {
  if (isDefaultStatusFilter(filter)) return 0;
  return STATUS_KEYS.filter((key) => filter.shown[key]).length + (filter.unpaidOnly ? 1 : 0);
}
