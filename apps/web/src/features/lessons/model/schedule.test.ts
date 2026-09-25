import { describe, expect, it } from 'vitest';
import type { ScheduleConflict } from '@tutorio/validation';
import {
  conflictPairs,
  movedSummary,
  removedSummary,
  scheduleChangeDefaults,
  scheduleChangeFormDto,
  scheduleChangeFormSchema,
  scheduleCreateDto,
  scheduleFormDefaults,
  scheduleFormSchema,
  slotChanges,
} from './schedule';

const keys = (
  schema: typeof scheduleFormSchema | typeof scheduleChangeFormSchema,
  values: unknown,
) => {
  const result = schema.safeParse(values);
  return result.success
    ? []
    : result.error.issues.map((issue) => [
        issue.path.join('.'),
        (issue as { params?: { key?: string } }).params?.key,
      ]);
};

const local = (month: number, day: number, hour: number) =>
  new Date(2026, month - 1, day, hour).toISOString();

describe('new schedule form (L-20, L-21)', () => {
  const base = scheduleFormDefaults({ from: '2026-09-28', horizonWeeks: 4 });

  it('asks for the student, the teacher, a day and the first date', () => {
    expect(keys(scheduleFormSchema, { ...base, from: '' })).toEqual([
      ['studentId', 'lessonStudentRequired'],
      ['teacherId', 'teacherRequired'],
      ['weekdays', 'weekdaysRequired'],
      ['from', 'lessonDateRequired'],
    ]);
    // A group takes its teacher from the group.
    expect(
      keys(scheduleFormSchema, {
        ...base,
        who: 'group',
        groupId: 'g1',
        weekdays: [2],
        times: { '2': '18:00' },
      }),
    ).toEqual([]);
  });

  it('wants a time for every day and an end after the start', () => {
    expect(
      keys(scheduleFormSchema, {
        ...base,
        studentId: 's1',
        teacherId: 't1',
        weekdays: [1, 4],
        times: { '1': '17:00' },
        until: '2026-09-01',
      }),
    ).toEqual([
      ['times.4', 'lessonTimeInvalid'],
      ['until', 'endDateBeforeStart'],
    ]);
  });

  it('builds the request with a time per day and the horizon', () => {
    expect(
      scheduleCreateDto({
        ...base,
        studentId: 's1',
        teacherId: 't1',
        weekdays: [4, 1],
        times: { '1': '17:00', '4': '15:00' },
        horizonWeeks: '6',
      }),
    ).toEqual({
      studentId: 's1',
      teacherId: 't1',
      slots: [
        { weekday: 1, localTime: '17:00' },
        { weekday: 4, localTime: '15:00' },
      ],
      durationMin: 60,
      startDate: new Date(2026, 8, 28).toISOString(),
      endsOn: null,
      horizonWeeks: 6,
    });
  });
});

describe('schedule change (L-25, L-26)', () => {
  const schedule = {
    durationMin: 60,
    slots: [
      { weekday: 2, localTime: '17:00', seriesId: 'a' },
      { weekday: 5, localTime: '18:30', seriesId: 'b' },
    ],
  };

  it('starts from the rule in force and takes effect from a date', () => {
    const values = scheduleChangeDefaults(schedule, '2026-10-01');
    expect(values).toMatchObject({ weekdays: [2, 5], times: { '2': '17:00', '5': '18:30' } });
    expect(keys(scheduleChangeFormSchema, { ...values, weekdays: [] })).toEqual([
      ['weekdays', 'weekdaysRequired'],
    ]);
    expect(scheduleChangeFormDto({ ...values, weekdays: [2], times: { '2': '18:00' } })).toEqual({
      effectiveFrom: new Date(2026, 9, 1).toISOString(),
      slots: [{ weekday: 2, localTime: '18:00' }],
      durationMin: 60,
    });
  });

  it('pairs each weekday before and after', () => {
    expect(slotChanges(schedule.slots, [{ weekday: 2, localTime: '18:00' }])).toEqual([
      { weekday: 2, before: '17:00', after: '18:00' },
      { weekday: 5, before: '18:30', after: null },
    ]);
  });

  it('says moved and removed lessons by their weekday when there is one', () => {
    const moves = [6, 13, 20, 27].map((day) => ({
      lessonId: `m${day}`,
      startsAtUtc: local(10, day, 17),
      toStartsAtUtc: local(10, day, 18),
    }));
    expect(movedSummary(moves)).toEqual({ count: 4, weekday: 2, time: '18:00' });
    expect(movedSummary([])).toBeNull();
    expect(
      movedSummary([
        ...moves,
        { lessonId: 'x', startsAtUtc: local(10, 2, 9), toStartsAtUtc: local(10, 2, 9) },
      ]),
    ).toMatchObject({ count: 5, weekday: null });
    const removed = removedSummary(
      [2, 9, 23].map((day) => ({ lessonId: `r${day}`, startsAtUtc: local(10, day, 18) })),
    );
    expect(removed).toMatchObject({ count: 3, weekday: 5 });
  });

  it('pairs every conflict with the new lesson it hits', () => {
    const conflict = (candidate: string, lessonId: string) =>
      ({
        candidateStartsAtUtc: candidate,
        lessonId,
        startsAtUtc: candidate,
        durationMin: 90,
        reason: 'TEACHER',
        teacher: { id: 't', name: 'Dmytro' },
        student: null,
        group: { id: 'g', name: 'B2 prep' },
        students: [],
      }) satisfies ScheduleConflict;
    const pairs = conflictPairs([
      conflict(local(10, 15, 15), 'b'),
      conflict(local(10, 1, 15), 'a'),
      conflict(local(10, 1, 15), 'c'),
    ]);
    expect(pairs.map((pair) => pair.hits.map((hit) => hit.lessonId))).toEqual([['a', 'c'], ['b']]);
  });
});
