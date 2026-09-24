import { describe, expect, it } from 'vitest';
import {
  DuplicateScheduleDayError,
  expandSchedule,
  localWeekdayOf,
  mergeSlot,
  normalizeSlots,
  planScheduleChange,
  replaceSlot,
  weekKeyOf,
  type ChangeableLesson,
} from './schedule';

const KYIV = 'Europe/Kyiv';
// Monday 5 October 2026, local midnight in Kyiv (UTC+3).
const MONDAY = new Date('2026-10-04T21:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

describe('slots', () => {
  it('orders the week from Monday and refuses a day twice (L-21)', () => {
    expect(
      normalizeSlots([
        { weekday: 0, localTime: '10:00' },
        { weekday: 4, localTime: '18:30' },
        { weekday: 1, localTime: '17:00' },
      ]).map((slot) => slot.weekday),
    ).toEqual([1, 4, 0]);
    expect(() =>
      normalizeSlots([
        { weekday: 1, localTime: '17:00' },
        { weekday: 1, localTime: '18:00' },
      ]),
    ).toThrow(DuplicateScheduleDayError);
  });

  it('moves one weekday and adds a day without touching the others (L-23, L-41)', () => {
    const tueThu = [
      { weekday: 2, localTime: '17:00' },
      { weekday: 4, localTime: '17:00' },
    ];
    expect(replaceSlot(tueThu, 2, { weekday: 3, localTime: '18:00' })).toEqual([
      { weekday: 3, localTime: '18:00' },
      { weekday: 4, localTime: '17:00' },
    ]);
    expect(mergeSlot(tueThu, { weekday: 4, localTime: '18:30' })).toEqual([
      { weekday: 2, localTime: '17:00' },
      { weekday: 4, localTime: '18:30' },
    ]);
  });
});

describe('expandSchedule', () => {
  it('gives each day its own time and tags the local week', () => {
    const lessons = expandSchedule(
      [
        { weekday: 1, localTime: '17:00' },
        { weekday: 4, localTime: '18:30' },
      ],
      {
        timezone: KYIV,
        startDate: MONDAY,
        from: MONDAY,
        until: new Date(MONDAY.getTime() + 14 * DAY),
      },
    );
    expect(lessons.map((l) => l.startsAtUtc.toISOString())).toEqual([
      '2026-10-05T14:00:00.000Z',
      '2026-10-08T15:30:00.000Z',
      '2026-10-12T14:00:00.000Z',
      '2026-10-15T15:30:00.000Z',
    ]);
    expect(lessons.map((l) => l.weekKey)).toEqual([
      '2026-10-05',
      '2026-10-05',
      '2026-10-12',
      '2026-10-12',
    ]);
  });

  it('reads the local week and weekday across midnight UTC', () => {
    // Sunday 23:30 in Kyiv is Sunday, not Monday.
    const sundayLate = new Date('2026-10-11T20:30:00Z');
    expect(weekKeyOf(sundayLate, KYIV)).toBe('2026-10-05');
    expect(localWeekdayOf(sundayLate, KYIV)).toBe(0);
  });
});

describe('planScheduleChange (L-26)', () => {
  const lesson = (id: string, iso: string): ChangeableLesson => {
    const startsAtUtc = new Date(iso);
    return {
      id,
      startsAtUtc,
      weekday: localWeekdayOf(startsAtUtc, KYIV),
      weekKey: weekKeyOf(startsAtUtc, KYIV),
    };
  };
  const week = (slots: { weekday: number; localTime: string }[]) =>
    expandSchedule(slots, {
      timezone: KYIV,
      startDate: MONDAY,
      from: MONDAY,
      until: new Date(MONDAY.getTime() + 7 * DAY),
    });

  it('moves a lesson to the new time on its own day', () => {
    const plan = planScheduleChange(
      [lesson('tue', '2026-10-06T14:00:00Z')],
      week([{ weekday: 2, localTime: '18:00' }]),
    );
    expect(plan.moves).toEqual([{ lessonId: 'tue', to: expect.objectContaining({ weekday: 2 }) }]);
    expect(plan.moves[0]!.to.startsAtUtc.toISOString()).toBe('2026-10-06T15:00:00.000Z');
    expect(plan.creates).toEqual([]);
    expect(plan.removes).toEqual([]);
  });

  it('moves a lesson to another day of the same week when its day is gone', () => {
    const plan = planScheduleChange(
      [lesson('tue', '2026-10-06T14:00:00Z'), lesson('thu', '2026-10-08T14:00:00Z')],
      week([
        { weekday: 3, localTime: '17:00' },
        { weekday: 4, localTime: '17:00' },
      ]),
    );
    expect(plan.moves.map((m) => [m.lessonId, m.to.weekday])).toEqual([
      ['thu', 4],
      ['tue', 3],
    ]);
  });

  it('removes what the new rule no longer has and creates what it adds', () => {
    const fewer = planScheduleChange(
      [lesson('tue', '2026-10-06T14:00:00Z'), lesson('thu', '2026-10-08T14:00:00Z')],
      week([{ weekday: 4, localTime: '17:00' }]),
    );
    expect(fewer.moves.map((m) => m.lessonId)).toEqual(['thu']);
    expect(fewer.removes).toEqual(['tue']);

    const more = planScheduleChange(
      [lesson('tue', '2026-10-06T14:00:00Z')],
      week([
        { weekday: 2, localTime: '17:00' },
        { weekday: 5, localTime: '17:00' },
      ]),
    );
    expect(more.moves.map((m) => m.lessonId)).toEqual(['tue']);
    expect(more.creates.map((o) => o.weekday)).toEqual([5]);
  });

  it('never moves a lesson into another week', () => {
    const plan = planScheduleChange(
      [lesson('this-week', '2026-10-06T14:00:00Z')],
      expandSchedule([{ weekday: 2, localTime: '17:00' }], {
        timezone: KYIV,
        startDate: MONDAY,
        from: new Date(MONDAY.getTime() + 7 * DAY),
        until: new Date(MONDAY.getTime() + 14 * DAY),
      }),
    );
    expect(plan.removes).toEqual(['this-week']);
    expect(plan.creates).toHaveLength(1);
  });
});
