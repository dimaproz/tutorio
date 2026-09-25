import { describe, expect, it } from 'vitest';
import type { BulkCancelPreview } from '@tutorio/validation';
import {
  bulkCancelDefaults,
  bulkCancelDto,
  bulkCancelFormSchema,
  bulkCancelSplit,
  lessonsByDay,
  periodDays,
} from './bulk-cancel';

const keysOf = (values: unknown) => {
  const result = bulkCancelFormSchema.safeParse(values);
  return result.success
    ? []
    : result.error.issues.map((issue) => [
        issue.path.join('.'),
        (issue as { params?: { key?: string } }).params?.key,
      ]);
};

const label = (reason: string) => ({ holiday: 'Свято', sickLeave: 'Лікарняний' })[reason] ?? '';

const teacher = { id: 't1', name: 'Iryna Bondar', color: null };
const lesson = (startsAtUtc: string, group: boolean) => ({
  id: startsAtUtc,
  startsAtUtc,
  durationMin: 60,
  student: group ? null : { id: 's1', fullName: 'Anna' },
  group: group ? { id: 'g1', name: 'Kids A1' } : null,
  teacher,
});

describe('bulk cancel form (L-54)', () => {
  it('starts on one day for the whole studio with the holiday reason', () => {
    expect(bulkCancelDefaults('2026-10-14')).toEqual({
      from: '2026-10-14',
      to: '2026-10-14',
      scope: 'studio',
      teacherId: '',
      reason: 'holiday',
      ownReason: '',
    });
  });

  it('puts each error under its own field', () => {
    expect(keysOf({ ...bulkCancelDefaults('2026-10-14'), from: '', to: '2026-10-12' })).toEqual([
      ['from', 'periodStartRequired'],
    ]);
    expect(keysOf({ ...bulkCancelDefaults('2026-10-14'), to: '2026-10-12' })).toEqual([
      ['to', 'periodEndBeforeStart'],
    ]);
    expect(
      keysOf({ ...bulkCancelDefaults('2026-01-01'), to: '2027-01-02', scope: 'teacher' }),
    ).toEqual([
      ['to', 'periodTooLong'],
      ['teacherId', 'teacherPick'],
    ]);
  });

  it('counts both days of the period', () => {
    expect(periodDays('2026-10-14', '2026-10-14')).toBe(1);
    expect(periodDays('2026-10-26', '2026-11-01')).toBe(7);
  });

  it('includes the last day and joins the chip with the own reason', () => {
    const dto = bulkCancelDto(
      {
        ...bulkCancelDefaults('2026-10-14'),
        scope: 'teacher',
        teacherId: 't1',
        reason: 'sickLeave',
        ownReason: ' flu ',
      },
      label,
    );
    expect(dto).toEqual({
      from: new Date(2026, 9, 14).toISOString(),
      to: new Date(2026, 9, 15).toISOString(),
      teacherId: 't1',
      reason: 'Лікарняний · flu',
    });
    expect(
      bulkCancelDto({ ...bulkCancelDefaults('2026-10-14'), teacherId: 't1', reason: null }, label),
    ).toEqual({
      from: new Date(2026, 9, 14).toISOString(),
      to: new Date(2026, 9, 15).toISOString(),
      reason: null,
    });
  });

  it('splits the lessons into individual and group and groups them by day', () => {
    const preview: BulkCancelPreview = {
      count: 3,
      byTeacher: [{ teacher, count: 3 }],
      lessons: [
        lesson(new Date(2026, 9, 15, 10).toISOString(), false),
        lesson(new Date(2026, 9, 14, 17).toISOString(), true),
        lesson(new Date(2026, 9, 14, 10).toISOString(), false),
      ],
      truncated: false,
    };
    expect(bulkCancelSplit(preview)).toEqual({ individual: 2, group: 1 });
    expect(bulkCancelSplit({ ...preview, truncated: true })).toBeNull();
    const days = lessonsByDay(preview.lessons);
    expect(days.map((day) => day.lessons.length)).toEqual([2, 1]);
    expect(days[0]!.lessons[0]!.student?.fullName).toBe('Anna');
  });
});
