import { describe, expect, it } from 'vitest';
import type { LessonResponse } from '@tutorio/validation';
import { awaitsAttendance, canMarkAttendance, isLessonRunning, lessonBuckets } from './buckets';

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

describe('attendance to mark (S08)', () => {
  const group = (
    iso: string,
    status: LessonResponse['status'],
    attendance: LessonResponse['attendance'] = null,
  ) => ({ groupId: 'g', startsAtUtc: iso, durationMin: 60, status, attendance }) as LessonResponse;

  it('asks for marks on a held group lesson nobody marked (L-72, L-74)', () => {
    const auto = { present: 6, marked: 6, confirmed: false };
    const tutor = { present: 5, marked: 6, confirmed: true };
    expect(awaitsAttendance(group('2026-09-22T14:00:00.000Z', 'COMPLETED', auto), NOW)).toBe(true);
    expect(awaitsAttendance(group('2026-09-22T14:00:00.000Z', 'COMPLETED'), NOW)).toBe(true);
    expect(awaitsAttendance(group('2026-09-22T14:00:00.000Z', 'COMPLETED', tutor), NOW)).toBe(
      false,
    );
    // Ended but not held yet by the automation.
    expect(awaitsAttendance(group('2026-09-24T10:00:00.000Z', 'SCHEDULED'), NOW)).toBe(true);
    // Running: marked in the panel, not flagged in the list.
    expect(awaitsAttendance(group('2026-09-24T11:30:00.000Z', 'SCHEDULED'), NOW)).toBe(false);
    expect(canMarkAttendance(group('2026-09-24T11:30:00.000Z', 'SCHEDULED'), NOW)).toBe(true);
    expect(awaitsAttendance(group('2026-09-22T14:00:00.000Z', 'CANCELLED_UNCHARGED'), NOW)).toBe(
      false,
    );
    expect(
      awaitsAttendance({ ...group('2026-09-22T14:00:00.000Z', 'COMPLETED'), groupId: null }, NOW),
    ).toBe(false);
  });
});
