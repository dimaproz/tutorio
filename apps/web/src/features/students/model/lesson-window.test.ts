import { describe, expect, it } from 'vitest';
import type { LessonResponse } from '@tutorio/validation';
import { collectionLessonWindow, splitCollectionLessons } from './lesson-window';

/** The studio's zone; the process runs in another one (vitest config). */
const TZ = 'Europe/Kyiv';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const lesson = (at: Date, status: LessonResponse['status'] = 'SCHEDULED') =>
  ({
    id: at.toISOString(),
    startsAtUtc: at.toISOString(),
    status,
    durationMin: 60,
  }) as LessonResponse;

// A Wednesday afternoon in Kyiv: 14:37:12.345 on 9 September 2026 (UTC+3).
const now = Date.parse('2026-09-09T11:37:12.345Z');

describe('collectionLessonWindow', () => {
  it("keeps the same query all the studio's day, whatever the millisecond clock", () => {
    const morning = collectionLessonWindow(Date.parse('2026-09-08T21:00:01.000Z'), TZ);
    const evening = collectionLessonWindow(Date.parse('2026-09-09T20:59:59.999Z'), TZ);
    expect(collectionLessonWindow(now, TZ).query).toEqual(morning.query);
    expect(evening.query).toEqual(morning.query);
  });

  it("reads from the studio's Monday to a whole day past the upcoming horizon", () => {
    const { query, week } = collectionLessonWindow(now, TZ);
    expect(query.from).toBe('2026-09-06T21:00:00.000Z');
    // 9 November, after the autumn switch (UTC+2).
    expect(query.to).toBe('2026-11-08T22:00:00.000Z');
    expect(week.from.toISOString()).toBe(query.from);
    expect(week.to.toISOString()).toBe('2026-09-13T21:00:00.000Z');
  });
});

describe('splitCollectionLessons', () => {
  const window = collectionLessonWindow(now, TZ);

  it('counts every lesson of the week and only scheduled lessons from the precise now', () => {
    const monday = lesson(new Date(window.week.from.getTime() + 10 * HOUR), 'COMPLETED');
    const earlierToday = lesson(new Date(now - 60_000));
    const laterToday = lesson(new Date(now + 60_000));
    const cancelledLater = lesson(new Date(now + 120_000), 'CANCELLED_UNCHARGED');
    const nextMonth = lesson(new Date(now + 30 * DAY));
    const pastHorizon = lesson(new Date(now + 60.5 * DAY));

    const split = splitCollectionLessons(
      [monday, earlierToday, laterToday, cancelledLater, nextMonth, pastHorizon],
      window,
      now,
    );

    expect(split.week).toEqual([monday, earlierToday, laterToday, cancelledLater]);
    expect(split.upcoming).toEqual([laterToday, nextMonth]);
  });
});
