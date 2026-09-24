import { describe, expect, it } from 'vitest';
import { localInputToIso } from '@/lib/datetime';
import {
  chargedCount,
  createFormDefaults,
  createFormSchema,
  createLessonRequests,
  createScheduleDto,
  newScheduleLessonCount,
  packageCoverage,
  pastRows,
  scheduleChangeDto,
  weekAfter,
  type CreateFormValues,
} from './create';

const TEACHER = '55555555-5555-4555-8555-555555555555';
const at = (date: string, time: string) => Date.parse(localInputToIso(`${date}T${time}`));
const NOW = at('2026-09-30', '12:00');

function values(patch: Partial<CreateFormValues> = {}): CreateFormValues {
  return {
    ...createFormDefaults({
      who: 'student',
      studentId: 'student-1',
      teacherId: TEACHER,
      date: '2026-10-01',
      time: '17:00',
      durationMin: 60,
    }),
    priceMode: 'amount',
    price: '500',
    ...patch,
  };
}

const errorKeys = (input: CreateFormValues) => {
  const result = createFormSchema.safeParse(input);
  return result.success
    ? {}
    : Object.fromEntries(
        result.error.issues.map((issue) => [
          issue.path.join('.'),
          (issue as { params?: { key?: string } }).params?.key,
        ]),
      );
};

describe('createFormSchema', () => {
  it('accepts a complete one-off booking', () => {
    expect(errorKeys(values())).toEqual({});
  });

  it('names what is missing: the student, a date, a negative price', () => {
    expect(
      errorKeys(
        values({
          studentId: '',
          dates: [{ date: '', time: '' }],
          price: '-50',
        }),
      ),
    ).toEqual({
      studentId: 'lessonStudentRequired',
      'dates.0.date': 'lessonDateRequired',
      price: 'priceNegative',
    });
  });

  it('checks the group for a group lesson and needs no price for a package', () => {
    expect(errorKeys(values({ who: 'group', groupId: '', priceMode: 'group', price: '' }))).toEqual(
      { groupId: 'lessonGroupRequired' },
    );
    expect(errorKeys(values({ priceMode: 'package', price: '' }))).toEqual({});
  });

  it('checks the weekly block: days, a time for each, the start and the end', () => {
    expect(
      errorKeys(
        values({
          frequency: 'weekly',
          weekdays: [1, 5],
          times: { '1': '17:00', '5': '' },
          from: '2026-10-01',
          until: '2026-09-01',
        }),
      ),
    ).toEqual({ 'times.5': 'lessonTimeInvalid', until: 'endDateBeforeStart' });
    expect(errorKeys(values({ frequency: 'weekly', weekdays: [] }))).toEqual({
      weekdays: 'weekdaysRequired',
    });
  });

  it('keeps the length within 5 minutes and 8 hours', () => {
    expect(errorKeys(values({ durationMin: '' }))).toEqual({
      durationMin: 'lessonDurationRequired',
    });
    expect(errorKeys(values({ durationMin: '481' }))).toEqual({
      durationMin: 'lessonDurationRange',
    });
  });
});

describe('createLessonRequests', () => {
  it('books the dates ahead as scheduled lessons on the direction', () => {
    const requests = createLessonRequests(
      values({
        dates: [
          { date: '2026-10-01', time: '17:00' },
          { date: '2026-10-08', time: '18:30' },
        ],
        topic: '  Past Perfect ',
      }),
      {
        target: { kind: 'direction', enrollmentId: 'enrollment-1' },
        priceMinor: 50000,
        currency: 'UAH',
        now: NOW,
      },
    );
    expect(requests).toEqual([
      {
        enrollmentId: 'enrollment-1',
        teacherId: TEACHER,
        durationMin: 60,
        priceMinor: 50000,
        currency: 'UAH',
        topic: 'Past Perfect',
        notes: null,
        startsAt: [localInputToIso('2026-10-01T17:00'), localInputToIso('2026-10-08T18:30')],
        status: 'SCHEDULED',
      },
    ]);
  });

  it('records past dates with what they became, apart from the dates ahead (L-31)', () => {
    const requests = createLessonRequests(
      values({
        dates: [
          { date: '2026-09-22', time: '17:00' },
          { date: '2026-10-01', time: '17:00' },
        ],
        pastStatus: 'CANCELLED',
        cancelledBy: 'TEACHER',
        cancelCharge: 'free',
      }),
      {
        target: { kind: 'newDirection', studentId: 'student-1' },
        priceMinor: 50000,
        currency: 'UAH',
        now: NOW,
      },
    );
    expect(
      requests.map((request) => [request.status, request.cancelledBy, request.startsAt.length]),
    ).toEqual([
      ['SCHEDULED', undefined, 1],
      ['CANCELLED_UNCHARGED', 'TEACHER', 1],
    ]);
    expect(requests[0]!.studentId).toBe('student-1');
  });

  it('books a group by its id, and a group cancellation by the group', () => {
    const [request] = createLessonRequests(
      values({
        who: 'group',
        groupId: 'group-1',
        dates: [{ date: '2026-09-22', time: '18:00' }],
        pastStatus: 'CANCELLED',
        cancelledBy: 'STUDENT',
        cancelCharge: 'charge',
      }),
      {
        target: { kind: 'group', groupId: 'group-1' },
        priceMinor: 40000,
        currency: 'UAH',
        now: NOW,
      },
    );
    expect(request).toMatchObject({
      groupId: 'group-1',
      status: 'CANCELLED_CHARGED',
      cancelledBy: 'GROUP',
    });
  });
});

describe('the weekly block', () => {
  const weekly = values({
    frequency: 'weekly',
    weekdays: [5, 1],
    times: { '1': '17:00', '5': '17:00' },
    from: '2026-10-01',
  });

  it('creates a schedule with Monday first and no price for a package', () => {
    expect(createScheduleDto(weekly, { priceMinor: null, currency: 'UAH' })).toEqual({
      studentId: 'student-1',
      teacherId: TEACHER,
      slots: [
        { weekday: 1, localTime: '17:00' },
        { weekday: 5, localTime: '17:00' },
      ],
      durationMin: 60,
      startDate: localInputToIso('2026-10-01T00:00'),
      endsOn: null,
    });
  });

  it('adds the picked day to an existing schedule (L-23)', () => {
    const change = scheduleChangeDto(
      values({ frequency: 'weekly', weekdays: [3], times: { '3': '18:00' }, from: '2026-10-01' }),
      [
        { weekday: 1, localTime: '17:00' },
        { weekday: 5, localTime: '17:00' },
      ],
    );
    expect(change.slots).toEqual([
      { weekday: 1, localTime: '17:00' },
      { weekday: 3, localTime: '18:00' },
      { weekday: 5, localTime: '17:00' },
    ]);
  });

  it('counts the lessons a new schedule creates within the horizon', () => {
    const slots = [
      { weekday: 1, localTime: '17:00' },
      { weekday: 5, localTime: '17:00' },
    ];
    expect(
      newScheduleLessonCount({ slots, from: '2026-10-01', until: '', horizonWeeks: 4, now: NOW }),
    ).toBe(8);
    expect(
      newScheduleLessonCount({
        slots,
        from: '2026-10-01',
        until: '2026-10-09',
        horizonWeeks: 4,
        now: NOW,
      }),
    ).toBe(3);
    expect(
      newScheduleLessonCount({
        slots: [],
        from: '2026-10-01',
        until: '',
        horizonWeeks: 4,
        now: NOW,
      }),
    ).toBe(0);
  });
});

describe('helpers', () => {
  it('adds a row a week later', () => {
    expect(weekAfter('2026-10-01')).toBe('2026-10-08');
    expect(weekAfter('2026-12-29')).toBe('2027-01-05');
    expect(weekAfter('')).toBe('');
  });

  it('splits a package into the lessons it covers and the rest on debt (L-82)', () => {
    expect(packageCoverage(3, 1)).toEqual({ covered: 1, debt: 2, leftAfter: 0 });
    expect(packageCoverage(1, 5)).toEqual({ covered: 1, debt: 0, leftAfter: 4 });
    expect(packageCoverage(2, 0)).toEqual({ covered: 0, debt: 2, leftAfter: 0 });
  });

  it('finds the past rows and leaves a free cancellation uncharged', () => {
    const input = values({
      dates: [
        { date: '2026-09-22', time: '17:00' },
        { date: '2026-10-01', time: '17:00' },
      ],
    });
    expect(pastRows(input, NOW)).toEqual([true, false]);
    expect(chargedCount(input, NOW)).toBe(2);
    expect(chargedCount({ ...input, pastStatus: 'CANCELLED', cancelCharge: 'free' }, NOW)).toBe(1);
  });
});
