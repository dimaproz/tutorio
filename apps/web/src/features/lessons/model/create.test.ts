import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { zonedDateTime } from '@/lib/datetime';
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
/** The studio's zone; the process runs in another one (vitest config). */
const TZ = 'Europe/Kyiv';
const at = (date: string, time: string) => zonedDateTime(date, time, TZ).getTime();
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
        timeZone: TZ,
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
        startsAt: ['2026-10-01T14:00:00.000Z', '2026-10-08T15:30:00.000Z'],
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
        timeZone: TZ,
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
        timeZone: TZ,
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
    expect(createScheduleDto(weekly, { priceMinor: null, currency: 'UAH', timeZone: TZ })).toEqual({
      studentId: 'student-1',
      teacherId: TEACHER,
      slots: [
        { weekday: 1, localTime: '17:00' },
        { weekday: 5, localTime: '17:00' },
      ],
      durationMin: 60,
      startDate: '2026-09-30T21:00:00.000Z',
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
      TZ,
    );
    expect(change.effectiveFrom).toBe('2026-09-30T21:00:00.000Z');
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
      newScheduleLessonCount({
        slots,
        from: '2026-10-01',
        until: '',
        horizonWeeks: 4,
        now: NOW,
        timeZone: TZ,
      }),
    ).toBe(8);
    expect(
      newScheduleLessonCount({
        slots,
        from: '2026-10-01',
        until: '2026-10-09',
        horizonWeeks: 4,
        now: NOW,
        timeZone: TZ,
      }),
    ).toBe(3);
    expect(
      newScheduleLessonCount({
        slots: [],
        from: '2026-10-01',
        until: '',
        horizonWeeks: 4,
        now: NOW,
        timeZone: TZ,
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
    expect(pastRows(input, NOW, TZ)).toEqual([true, false]);
    expect(chargedCount(input, NOW, TZ)).toBe(2);
    expect(chargedCount({ ...input, pastStatus: 'CANCELLED', cancelCharge: 'free' }, NOW, TZ)).toBe(
      1,
    );
  });

  it("tells a past row by the studio's clock", () => {
    // 11:30 in Kyiv is 08:30 in UTC: a row at 10:00 is over, whatever the browser says.
    const now = at('2026-09-30', '11:30');
    const input = values({ dates: [{ date: '2026-09-30', time: '10:00' }] });
    expect(pastRows(input, now, TZ)).toEqual([true]);
  });
});

/**
 * The same form sends the same instants wherever the browser is: a tutor on
 * a trip, or a computer set to the wrong zone, still books Kyiv's 17:00.
 */
describe.each(['Europe/Kyiv', 'UTC', 'Asia/Tbilisi', 'America/New_York'])(
  'the form in a browser set to %s',
  (browserZone) => {
    const original = process.env.TZ;
    beforeEach(() => {
      process.env.TZ = browserZone;
    });
    afterEach(() => {
      process.env.TZ = original;
    });

    it('books the studio wall clock, across the autumn switch', () => {
      const [request] = createLessonRequests(
        values({
          dates: [
            { date: '2026-10-24', time: '17:00' },
            { date: '2026-10-26', time: '17:00' },
          ],
        }),
        {
          target: { kind: 'direction', enrollmentId: 'enrollment-1' },
          priceMinor: 50000,
          currency: 'UAH',
          now: NOW,
          timeZone: TZ,
        },
      );
      expect(request!.startsAt).toEqual(['2026-10-24T14:00:00.000Z', '2026-10-26T15:00:00.000Z']);
    });

    it("starts a schedule at the studio's midnight and counts its lessons there", () => {
      const weekly = values({
        frequency: 'weekly',
        weekdays: [1, 5],
        times: { '1': '00:30', '5': '23:30' },
        from: '2026-10-01',
      });
      expect(
        createScheduleDto(weekly, { priceMinor: null, currency: 'UAH', timeZone: TZ }).startDate,
      ).toBe('2026-09-30T21:00:00.000Z');
      expect(
        newScheduleLessonCount({
          slots: [
            { weekday: 1, localTime: '00:30' },
            { weekday: 5, localTime: '23:30' },
          ],
          from: '2026-10-01',
          until: '2026-10-05',
          horizonWeeks: 4,
          now: NOW,
          timeZone: TZ,
        }),
      ).toBe(2);
    });
  },
);
