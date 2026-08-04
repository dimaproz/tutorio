import { describe, expect, it } from 'vitest';
import type { LessonResponse } from '@tutorio/validation';
import { lessonKind, sortLessons } from './lesson-table';

function lesson(overrides: Partial<LessonResponse> & { id: string }): LessonResponse {
  return {
    workspaceId: 'w1',
    enrollmentId: null,
    groupId: null,
    seriesId: null,
    packageId: null,
    teacherId: 't1',
    startsAtUtc: '2026-08-03T10:00:00.000Z',
    durationMin: 60,
    priceMinor: 50000,
    currency: 'UAH',
    status: 'SCHEDULED',
    isDetached: false,
    rescheduledCount: 0,
    rescheduledAt: null,
    cancelledBy: null,
    cancelledReason: null,
    cancelledAt: null,
    completedAt: null,
    notes: null,
    cancellationDeadlineHours: 24,
    student: null,
    group: null,
    teacher: { id: 't1', name: 'Olena', color: null },
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  } as LessonResponse;
}

const ids = (items: LessonResponse[]) => items.map((item) => item.id);

describe('lessonKind', () => {
  it('reads the group ref, not the enrollment', () => {
    expect(lessonKind(lesson({ id: 'a' }))).toBe('INDIVIDUAL');
    expect(
      lessonKind(lesson({ id: 'b', group: { id: 'g1', name: 'B1' } })),
    ).toBe('GROUP');
  });
});

describe('sortLessons', () => {
  const items = [
    lesson({ id: 'b', startsAtUtc: '2026-08-03T12:00:00.000Z', durationMin: 45, priceMinor: 90000 }),
    lesson({ id: 'a', startsAtUtc: '2026-08-01T09:00:00.000Z', durationMin: 90, priceMinor: 30000 }),
    lesson({ id: 'c', startsAtUtc: '2026-08-05T08:00:00.000Z', durationMin: 60, priceMinor: 60000 }),
  ];

  it('orders by start time in both directions', () => {
    expect(ids(sortLessons(items, 'startsAtUtc', 'asc'))).toEqual(['a', 'b', 'c']);
    expect(ids(sortLessons(items, 'startsAtUtc', 'desc'))).toEqual(['c', 'b', 'a']);
  });

  it('orders numeric columns numerically', () => {
    expect(ids(sortLessons(items, 'durationMin', 'asc'))).toEqual(['b', 'c', 'a']);
    expect(ids(sortLessons(items, 'priceMinor', 'desc'))).toEqual(['b', 'c', 'a']);
  });

  it('breaks ties by start time so rows never swap', () => {
    const sameLength = [
      lesson({ id: 'z', startsAtUtc: '2026-08-09T10:00:00.000Z' }),
      lesson({ id: 'y', startsAtUtc: '2026-08-02T10:00:00.000Z' }),
    ];
    expect(ids(sortLessons(sameLength, 'durationMin', 'asc'))).toEqual(['y', 'z']);
    expect(ids(sortLessons(sameLength, 'durationMin', 'desc'))).toEqual(['y', 'z']);
  });

  it('falls back to the start time for an unknown column', () => {
    expect(ids(sortLessons(items, 'nonsense', 'asc'))).toEqual(['a', 'b', 'c']);
  });

  it('leaves the input untouched', () => {
    const original = ids(items);
    sortLessons(items, 'priceMinor', 'desc');
    expect(ids(items)).toEqual(original);
  });
});
