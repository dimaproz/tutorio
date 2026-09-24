import { describe, expect, it } from 'vitest';
import type { LessonResponse } from '@tutorio/validation';
import { isLessonRunning, lessonBuckets } from './buckets';

const NOW = Date.parse('2026-09-24T12:00:00.000Z');

function lesson(id: string, iso: string, status: LessonResponse['status'] = 'SCHEDULED') {
  return { id, startsAtUtc: iso, durationMin: 60, status } as LessonResponse;
}

describe('lesson buckets', () => {
  it('splits at now and highlights the next lesson that will take place', () => {
    const buckets = lessonBuckets(
      [
        lesson('past-old', '2026-09-10T14:00:00.000Z', 'COMPLETED'),
        lesson('cancelled-next', '2026-09-25T14:00:00.000Z', 'CANCELLED_UNCHARGED'),
        lesson('later', '2026-09-30T14:00:00.000Z'),
        lesson('soon', '2026-09-26T14:00:00.000Z'),
        lesson('past-recent', '2026-09-20T14:00:00.000Z', 'COMPLETED'),
      ],
      NOW,
    );
    expect(buckets.upcoming.map((row) => row.id)).toEqual(['cancelled-next', 'soon', 'later']);
    expect(buckets.past.map((row) => row.id)).toEqual(['past-recent', 'past-old']);
    expect(buckets.nextId).toBe('soon');
  });

  it('keeps a running lesson at the head of the upcoming rows', () => {
    const buckets = lessonBuckets(
      [
        lesson('ended', '2026-09-24T10:30:00.000Z'),
        lesson('running', '2026-09-24T11:30:00.000Z'),
        lesson('soon', '2026-09-25T14:00:00.000Z'),
      ],
      NOW,
    );
    expect(buckets.upcoming.map((row) => row.id)).toEqual(['running', 'soon']);
    expect(buckets.past.map((row) => row.id)).toEqual(['ended']);
    expect(buckets.nextId).toBe('running');
  });
});

describe('running lesson', () => {
  it('is a scheduled lesson between its start and its end', () => {
    expect(isLessonRunning(lesson('a', '2026-09-24T11:30:00.000Z'), NOW)).toBe(true);
    expect(isLessonRunning(lesson('a', '2026-09-24T11:00:00.000Z'), NOW)).toBe(false);
    expect(isLessonRunning(lesson('a', '2026-09-24T12:30:00.000Z'), NOW)).toBe(false);
    expect(
      isLessonRunning(lesson('a', '2026-09-24T11:30:00.000Z', 'CANCELLED_UNCHARGED'), NOW),
    ).toBe(false);
  });
});
