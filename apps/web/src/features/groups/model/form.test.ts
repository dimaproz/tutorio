import { describe, expect, it } from 'vitest';
import type { GroupDetail } from '@tutorio/validation';
import {
  buildGroupCreateDto,
  buildGroupEditDto,
  emptyGroupForm,
  groupFormDefaults,
  groupFormSectionStatus,
  makeGroupFormSchema,
  type GroupFormValues,
} from './form';

const TEACHER = '11111111-1111-4111-8111-111111111111';
const OTHER_TEACHER = '22222222-2222-4222-8222-222222222222';
const ANNA = '33333333-3333-4333-8333-333333333333';
const MARK = '44444444-4444-4444-8444-444444444444';

const school = makeGroupFormSchema({ teacherRequired: true });
const solo = makeGroupFormSchema({ teacherRequired: false });

function values(patch: Partial<GroupFormValues> = {}): GroupFormValues {
  return { ...emptyGroupForm('UAH'), name: 'B2 evening', ...patch };
}

function issueKeys(result: ReturnType<typeof school.safeParse>) {
  return result.success
    ? []
    : result.error.issues.map(
        (issue) =>
          `${issue.path.join('.')}:${(issue as { params?: { key?: string } }).params?.key}`,
      );
}

describe('group form schema', () => {
  it('needs only a name', () => {
    expect(solo.safeParse(values()).success).toBe(true);
    expect(school.safeParse(values()).success).toBe(true);
    expect(solo.safeParse(values({ name: ' ' })).success).toBe(false);
  });

  it('asks for a start and a duration once a weekday is picked', () => {
    expect(
      issueKeys(
        school.safeParse(
          values({ teacherId: TEACHER, weekdays: [2], localTime: '', durationMin: '3' }),
        ),
      ),
    ).toEqual(['localTime:timeInvalid', 'durationMin:durationRange']);
    // Without weekdays the start and duration are not the schedule yet.
    expect(solo.safeParse(values({ localTime: '', durationMin: '' })).success).toBe(true);
  });

  it('in a school needs a teacher before students or a schedule', () => {
    expect(issueKeys(school.safeParse(values({ studentIds: [ANNA] })))).toEqual([
      'teacherId:teacherRequired',
    ]);
    expect(issueKeys(school.safeParse(values({ weekdays: [1] })))).toEqual([
      'teacherId:teacherRequired',
    ]);
    // A solo tutor never names a teacher: the API uses theirs.
    expect(solo.safeParse(values({ studentIds: [ANNA], weekdays: [1] })).success).toBe(true);
  });

  it('bounds the seats and checks the price', () => {
    expect(issueKeys(solo.safeParse(values({ capacity: '0' })))).toEqual([
      'capacity:capacityRange',
    ]);
    expect(issueKeys(solo.safeParse(values({ capacity: '12a' })))).toEqual([
      'capacity:capacityRange',
    ]);
    expect(solo.safeParse(values({ capacity: '8' })).success).toBe(true);
    expect(issueKeys(solo.safeParse(values({ pricePerLesson: '1.234' })))).toEqual([
      'pricePerLesson:priceInvalid',
    ]);
  });
});

describe('group form sections', () => {
  it('marks sections done by their meaningful field and errors first', () => {
    const status = groupFormSectionStatus(values({ weekdays: [2], studentIds: [ANNA] }), [
      'pricePerLesson',
    ]);
    expect(status).toEqual({
      basics: 'done',
      schedule: 'done',
      price: 'error',
      students: 'done',
      notes: 'none',
    });
  });

  it('counts a schedule kept on the patterns screen as done', () => {
    expect(groupFormSectionStatus(values(), [], { scheduleLocked: true }).schedule).toBe('done');
  });
});

describe('group requests', () => {
  it('omits what the create form left empty', () => {
    expect(buildGroupCreateDto(values({ name: '  A2 start  ' }))).toEqual({
      name: 'A2 start',
      teacherId: undefined,
      capacity: undefined,
      pricePerLesson: undefined,
      currency: undefined,
      notes: undefined,
      students: undefined,
      schedule: undefined,
    });
  });

  it('sends the roster, the seats, the price and a sorted schedule on create', () => {
    const dto = buildGroupCreateDto(
      values({
        teacherId: TEACHER,
        capacity: '8',
        pricePerLesson: '400',
        weekdays: [4, 2],
        localTime: '17:00',
        durationMin: '60',
        studentIds: [ANNA],
      }),
    );
    expect(dto).toMatchObject({
      teacherId: TEACHER,
      capacity: 8,
      pricePerLesson: 40000,
      currency: 'UAH',
      students: { studentIds: [ANNA], teacherId: TEACHER },
      schedule: { weekdays: [2, 4], localTime: '17:00', durationMin: 60 },
    });
  });

  it('on edit sends the roster and the teacher only when they changed', () => {
    const original = { teacherId: TEACHER, studentIds: [ANNA, MARK] };
    const unchanged = buildGroupEditDto(
      values({ teacherId: TEACHER, studentIds: [MARK, ANNA] }),
      original,
      {
        scheduleLocked: true,
      },
    );
    expect(unchanged).not.toHaveProperty('students');
    expect(unchanged).not.toHaveProperty('teacherId');
    expect(unchanged).toMatchObject({
      capacity: null,
      pricePerLesson: null,
      currency: null,
      notes: null,
    });

    const changed = buildGroupEditDto(
      values({ teacherId: OTHER_TEACHER, studentIds: [ANNA] }),
      original,
      { scheduleLocked: true },
    );
    expect(changed).toMatchObject({
      teacherId: OTHER_TEACHER,
      students: { studentIds: [ANNA], teacherId: OTHER_TEACHER },
    });
  });

  it('keeps a legacy group teacherless when the form keeps the roster teacher it opened with', () => {
    // No teacher of its own: the form opens with the roster's most common one.
    const legacy = {
      name: 'B2 evening',
      teacherId: null,
      teacher: { id: TEACHER, name: 'Dmytro', avatarKey: null, color: null },
      capacity: null,
      pricePerLesson: null,
      currency: null,
      notes: null,
      enrollments: [{ studentId: ANNA }],
    } as unknown as GroupDetail;
    const defaults = groupFormDefaults(legacy, 'UAH');
    const dto = buildGroupEditDto(
      { ...defaults, notes: 'Bring the workbook' },
      { teacherId: defaults.teacherId, studentIds: defaults.studentIds },
      { scheduleLocked: true },
    );
    // A teacher change would move every upcoming lesson; a notes save must not.
    expect(dto).not.toHaveProperty('teacherId');
    expect(dto).not.toHaveProperty('students');
  });

  it('adds a first schedule only when the group has none', () => {
    const scheduled = values({ weekdays: [1], localTime: '09:30', durationMin: '45' });
    const original = { teacherId: TEACHER, studentIds: [] };
    expect(buildGroupEditDto(scheduled, original, { scheduleLocked: false }).schedule).toEqual({
      weekdays: [1],
      localTime: '09:30',
      durationMin: 45,
    });
    expect(buildGroupEditDto(scheduled, original, { scheduleLocked: true })).not.toHaveProperty(
      'schedule',
    );
  });

  it('reads a saved group back into the form', () => {
    const group = {
      name: 'B2 evening',
      teacherId: null,
      teacher: { id: TEACHER, name: 'Dmytro', avatarKey: null, color: null },
      capacity: 8,
      pricePerLesson: 40050,
      currency: 'UAH',
      notes: null,
      enrollments: [{ studentId: ANNA }],
    } as unknown as GroupDetail;
    expect(groupFormDefaults(group, 'EUR')).toMatchObject({
      teacherId: TEACHER,
      capacity: '8',
      pricePerLesson: '400.50',
      currency: 'UAH',
      studentIds: [ANNA],
      notes: '',
    });
  });
});
