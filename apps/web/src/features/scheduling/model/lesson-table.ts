import type { LessonResponse } from '@tutorio/validation';

// The student's lesson table sorts in the browser: the profile already holds
// the whole window of lessons, so a round trip would buy nothing.

export const LESSON_SORT_FIELDS = [
  'startsAtUtc',
  'durationMin',
  'status',
  'kind',
  'priceMinor',
] as const;

export type LessonSortField = (typeof LESSON_SORT_FIELDS)[number];

export type LessonKind = 'INDIVIDUAL' | 'GROUP';

/** A lesson booked against a group is a group lesson; anything else is 1-to-1. */
export function lessonKind(lesson: LessonResponse): LessonKind {
  return lesson.group ? 'GROUP' : 'INDIVIDUAL';
}

function sortValue(lesson: LessonResponse, field: LessonSortField): string | number {
  switch (field) {
    case 'startsAtUtc':
      return new Date(lesson.startsAtUtc).getTime();
    case 'durationMin':
      return lesson.durationMin;
    case 'priceMinor':
      return lesson.priceMinor;
    case 'status':
      return lesson.status;
    case 'kind':
      return lessonKind(lesson);
  }
}

function compare(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a).localeCompare(String(b));
}

function isSortField(field: string | undefined): field is LessonSortField {
  return (LESSON_SORT_FIELDS as readonly string[]).includes(field ?? '');
}

/**
 * Copy of `items` in the requested order. Ties fall back to the start time and
 * then the id, so two lessons of the same length never swap places between
 * renders.
 */
export function sortLessons(
  items: readonly LessonResponse[],
  field: string | undefined,
  order: 'asc' | 'desc',
): LessonResponse[] {
  const sortField: LessonSortField = isSortField(field) ? field : 'startsAtUtc';
  const direction = order === 'desc' ? -1 : 1;

  return [...items].sort((a, b) => {
    const primary = compare(sortValue(a, sortField), sortValue(b, sortField));
    if (primary !== 0) {
      return primary * direction;
    }
    const byStart =
      new Date(a.startsAtUtc).getTime() - new Date(b.startsAtUtc).getTime();
    return byStart !== 0 ? byStart : a.id.localeCompare(b.id);
  });
}
