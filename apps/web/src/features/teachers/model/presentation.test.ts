import { describe, expect, it } from 'vitest';
import type { LessonResponse, TeacherResponse } from '@tutorio/validation';
import { TEACHER_COLORS } from '@/lib/theme/user-colors';
import {
  currentMonday,
  freeTeacherColor,
  mondayFirstSlots,
  scheduleMark,
  shortName,
  studioSubjects,
  subjectOptions,
  teacherWeek,
  usedTeacherColors,
  withSubject,
  withoutSubject,
  workload,
} from './presentation';

const KYIV = 'Europe/Kyiv';
const [INDIGO, PINK, GREEN] = TEACHER_COLORS;

type Row = Pick<TeacherResponse, 'id' | 'fullName' | 'subjects' | 'status' | 'deletedAt' | 'color'>;
const teacher = (id: string, fields: Partial<Row> = {}): Row => ({
  id,
  fullName: `Teacher ${id}`,
  subjects: [],
  status: 'ACTIVE',
  deletedAt: null,
  color: null,
  ...fields,
});

function lesson(
  id: string,
  startsAtUtc: string,
  status: LessonResponse['status'],
  who: { student?: string; group?: string },
): LessonResponse {
  return {
    id,
    startsAtUtc,
    status,
    deletedAt: null,
    groupId: who.group ? `g-${id}` : null,
    group: who.group ? { id: `g-${id}`, name: who.group } : null,
    student: who.student ? { id: `s-${id}`, fullName: who.student, avatarKey: null } : null,
  } as LessonResponse;
}

describe('teacher presentation', () => {
  it('lists the picked subjects first, then what active colleagues teach', () => {
    const subjects = studioSubjects(
      [
        teacher('a', { fullName: 'Olena K', subjects: ['English', 'Business'] }),
        teacher('b', { fullName: 'Dmytro T', subjects: ['english', 'IELTS'] }),
        teacher('c', { subjects: ['Latin'], status: 'ARCHIVED' }),
        teacher('me', { subjects: ['Français'] }),
      ],
      ['Français', 'DELF'],
      'me',
    );
    expect(subjects.map((item) => [item.subject, item.selected, item.isNew])).toEqual([
      ['Français', true, true],
      ['DELF', true, true],
      ['English', false, false],
      ['Business', false, false],
      ['IELTS', false, false],
    ]);
    expect(subjects[2]!.teachers.map((item) => item.fullName)).toEqual(['Olena K', 'Dmytro T']);
  });

  it('adds a subject once in any case and removes it in any case', () => {
    expect(withSubject(['English'], ' english ')).toEqual(['English']);
    expect(withSubject(['English'], 'DELF')).toEqual(['English', 'DELF']);
    expect(withoutSubject(['English', 'DELF'], 'delf')).toEqual(['English']);
    expect(
      subjectOptions([
        teacher('a', { subjects: ['Kids', 'English'] }),
        teacher('b', { subjects: ['english'] }),
      ]),
    ).toEqual(['English', 'Kids']);
  });

  it('marks the colours other active teachers have and picks a free one', () => {
    const used = usedTeacherColors(
      [
        teacher('a', { color: INDIGO.toLowerCase() }),
        teacher('b', { color: PINK, status: 'ARCHIVED' }),
        teacher('me', { color: GREEN }),
      ],
      'me',
    );
    expect([...used]).toEqual([INDIGO]);
    expect(freeTeacherColor(used)).toBe(PINK);
  });

  it('builds the week on the studio clock: held, missed, next and planned', () => {
    const now = Date.parse('2026-09-09T13:00:00Z'); // Wednesday 16:00 in Kyiv
    const monday = currentMonday(now, KYIV);
    expect(monday).toBe('2026-09-07');
    const week = teacherWeek(
      [
        lesson('1', '2026-09-07T12:00:00Z', 'COMPLETED', { group: 'Kids A1' }),
        lesson('2', '2026-09-08T15:30:00Z', 'NO_SHOW', { student: 'Mila Savchuk' }),
        lesson('3', '2026-09-09T13:30:00Z', 'SCHEDULED', { student: 'Maksym Tkachenko' }),
        lesson('4', '2026-09-09T15:00:00Z', 'SCHEDULED', { student: 'Anna Shevchenko' }),
        lesson('5', '2026-09-10T12:00:00Z', 'CANCELLED_UNCHARGED', { student: 'Anna Shevchenko' }),
      ],
      monday,
      now,
      KYIV,
    );
    expect(week).toMatchObject({ total: 4, held: 2, ahead: 2 });
    expect(week.days[0]!.lessons[0]).toMatchObject({
      time: '15:00',
      title: 'Kids A1',
      group: true,
      state: 'done',
    });
    expect(week.days[1]!.lessons[0]).toMatchObject({ title: 'Mila S.', state: 'miss' });
    expect(week.days[2]!.today).toBe(true);
    expect(week.days[2]!.lessons.map((item) => item.state)).toEqual(['next', 'planned']);
    expect(week.days[3]!.lessons).toEqual([]);
    expect(shortName('Anna')).toBe('Anna');
  });

  it('reads the workload in whole hours with the six-week average', () => {
    const load = workload({
      weeks: [540, 600, 660, 720, 660, 780].map((minutes) => ({ weekStart: '', minutes })),
    });
    expect(load).toEqual({ hours: 13, averageHours: 11, bars: [540, 600, 660, 720, 660, 780] });
  });

  it('marks a schedule only with a planned change or an end date', () => {
    expect(scheduleMark({ nextChange: null, endsAt: null }, KYIV)).toBeNull();
    expect(
      scheduleMark(
        { nextChange: { effectiveFrom: '2026-09-30T21:00:00Z', slots: [] }, endsAt: null },
        KYIV,
      ),
    ).toEqual({ tone: 'info', from: '2026-10-01' });
    // The end is exclusive: the last day is the one before.
    expect(scheduleMark({ nextChange: null, endsAt: '2026-12-20T22:00:00Z' }, KYIV)).toEqual({
      tone: 'warning',
      until: '2026-12-20',
    });
    expect(
      mondayFirstSlots([
        { weekday: 0, localTime: '10:00' },
        { weekday: 3, localTime: '15:00' },
        { weekday: 1, localTime: '18:00' },
      ]).map((slot) => slot.weekday),
    ).toEqual([1, 3, 0]);
  });
});
