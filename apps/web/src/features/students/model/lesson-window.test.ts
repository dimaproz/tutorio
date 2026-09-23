import { describe, expect, it } from 'vitest';
import { addDays, addHours, startOfDay, startOfWeek } from 'date-fns';
import type { LessonResponse } from '@tutorio/validation';
import { collectionLessonWindow, splitCollectionLessons } from './lesson-window';

const lesson = (at: Date, status: LessonResponse['status'] = 'SCHEDULED') =>
  ({ id: at.toISOString(), startsAtUtc: at.toISOString(), status, durationMin: 60 }) as LessonResponse;

// A Wednesday afternoon, local time.
const now = new Date(2026, 8, 9, 14, 37, 12, 345).getTime();

describe('collectionLessonWindow', () => {
  it('keeps the same query all day, whatever the millisecond clock', () => {
    const morning = collectionLessonWindow(new Date(2026, 8, 9, 0, 0, 1).getTime());
    const evening = collectionLessonWindow(new Date(2026, 8, 9, 23, 59, 59, 999).getTime());
    expect(collectionLessonWindow(now).query).toEqual(morning.query);
    expect(evening.query).toEqual(morning.query);
  });

  it('reads from the start of the week to a whole day past the upcoming horizon', () => {
    const { query, week } = collectionLessonWindow(now);
    expect(query.from).toBe(startOfWeek(now, { weekStartsOn: 1 }).toISOString());
    expect(query.to).toBe(addDays(startOfDay(now), 61).toISOString());
    expect(week.from.toISOString()).toBe(query.from);
  });
});

describe('splitCollectionLessons', () => {
  const window = collectionLessonWindow(now);

  it('counts every lesson of the week and only scheduled lessons from the precise now', () => {
    const monday = lesson(addHours(startOfWeek(now, { weekStartsOn: 1 }), 10), 'COMPLETED');
    const earlierToday = lesson(new Date(now - 60_000));
    const laterToday = lesson(new Date(now + 60_000));
    const cancelledLater = lesson(new Date(now + 120_000), 'CANCELLED_UNCHARGED');
    const nextMonth = lesson(addDays(new Date(now), 30));
    const pastHorizon = lesson(addDays(new Date(now), 60.5));

    const split = splitCollectionLessons(
      [monday, earlierToday, laterToday, cancelledLater, nextMonth, pastHorizon],
      window,
      now,
    );

    expect(split.week).toEqual([monday, earlierToday, laterToday, cancelledLater]);
    expect(split.upcoming).toEqual([laterToday, nextMonth]);
  });
});
