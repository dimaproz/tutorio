import { describe, expect, it } from 'vitest';
import { DEFAULT_STATUS_FILTER, matchesStatus, statusCounts, statusFilterCount } from './filters';
import {
  dropConflict,
  isMovable,
  lessonMarks,
  lessonTime,
  lessonType,
  placeDay,
  snapMinutes,
  type CalendarLesson,
} from './lessons';
import { zonedDateTime, zonedIso } from '@/lib/datetime';
import { calendarPeriod, dayKey, minutesOfDay, shiftAnchor } from './period';
import { daySummary } from './summary';

/** The studio's zone; the process runs in another one (vitest config). */
const TZ = 'Europe/Kyiv';
const pad = (value: number) => String(value).padStart(2, '0');

/** A wall-clock time on a September 2026 day, on the studio's clock. */
const at = (day: number, hour: number, minute = 0) =>
  zonedIso(`2026-09-${pad(day)}`, `${pad(hour)}:${pad(minute)}`, TZ);
const key = (date: Date) => dayKey(date, TZ);

let next = 0;
function lesson(fields: Partial<CalendarLesson> = {}): CalendarLesson {
  next += 1;
  return {
    id: `lesson-${next}`,
    startsAtUtc: at(24, 10),
    durationMin: 60,
    status: 'SCHEDULED',
    kind: 'REGULAR',
    groupId: null,
    teacherId: 'teacher-1',
    seriesId: null,
    isDetached: false,
    topic: null,
    charges: [],
    student: { id: 'student-1', fullName: 'Anna Shevchenko', avatarKey: null },
    group: null,
    teacher: { id: 'teacher-1', name: 'Dmytro Tutor', color: null },
    originalLessonId: null,
    enrollmentId: null,
    attendance: null,
    cancelledBy: null,
    rescheduledCount: 0,
    priceMinor: 50000,
    groupMembers: null,
    originalStartsAtUtc: null,
    ...fields,
  };
}

describe('calendarPeriod', () => {
  it('starts a week on Monday and a month grid on the Monday before the 1st', () => {
    const thursday = new Date(at(24, 18, 40));
    const week = calendarPeriod('week', thursday, TZ);
    expect(week.days.map(key)).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ]);
    expect(week.from.toISOString()).toBe('2026-09-20T21:00:00.000Z');
    expect(week.to.toISOString()).toBe('2026-09-27T21:00:00.000Z');
    const month = calendarPeriod('month', thursday, TZ);
    expect(key(month.days[0]!)).toBe('2026-08-31');
    expect(key(month.days.at(-1)!)).toBe('2026-10-04');
    expect(month.days).toHaveLength(35);
    expect(calendarPeriod('day', thursday, TZ).days.map(key)).toEqual(['2026-09-24']);
  });

  it('cuts days at the studio midnight, not the browser one', () => {
    // 23:30 on Thursday in Kyiv is already Friday in Tbilisi and still Thursday in UTC.
    const late = new Date(at(24, 23, 30));
    expect(calendarPeriod('day', late, TZ).days.map(key)).toEqual(['2026-09-24']);
    expect(calendarPeriod('day', late, TZ).from.toISOString()).toBe('2026-09-23T21:00:00.000Z');
  });

  it('keeps the 25-hour day of the autumn switch and midnight after it', () => {
    const week = calendarPeriod('week', zonedDateTime('2026-10-25', '12:00', TZ), TZ);
    expect(week.days.map(key)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
    expect(week.days.map((day) => minutesOfDay(day, TZ))).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(week.to.getTime() - week.from.getTime()).toBe((7 * 24 + 1) * 3_600_000);
  });

  it('steps by a day, a week or a month', () => {
    const thursday = new Date(at(24, 0));
    expect(key(shiftAnchor('day', thursday, -1, TZ))).toBe('2026-09-23');
    expect(key(shiftAnchor('week', thursday, 1, TZ))).toBe('2026-10-01');
    expect(key(shiftAnchor('month', thursday, 1, TZ))).toBe('2026-10-01');
  });
});

describe('lesson appearance', () => {
  const now = Date.parse(at(24, 18, 40));

  it('colours by kind: makeup first, then group, then individual', () => {
    expect(lessonType(lesson({ kind: 'MAKEUP', groupId: 'g' }))).toBe('makeup');
    expect(lessonType(lesson({ groupId: 'g' }))).toBe('group');
    expect(lessonType(lesson())).toBe('individual');
  });

  it('fills by time: upcoming, past, running, cancelled', () => {
    expect(lessonTime(lesson({ startsAtUtc: at(24, 19, 45) }), now)).toBe('upcoming');
    expect(lessonTime(lesson({ startsAtUtc: at(24, 15), status: 'COMPLETED' }), now)).toBe('past');
    expect(lessonTime(lesson({ startsAtUtc: at(24, 18), durationMin: 90 }), now)).toBe('running');
    expect(lessonTime(lesson({ status: 'CANCELLED_UNCHARGED' }), now)).toBe('cancelled');
  });

  it('marks what happened and what is unpaid', () => {
    const unpaid = lessonMarks(
      lesson({
        status: 'COMPLETED',
        charges: [
          {
            id: 'c',
            enrollmentId: 'e',
            source: 'BALANCE',
            packageId: null,
            amountMinor: 40000,
            currency: 'UAH',
            paid: false,
            student: { id: 'student-1', fullName: 'Anna' },
          },
        ],
      }),
    );
    expect(unpaid).toMatchObject({ held: true, unpaid: true, noShow: false });
    expect(isMovable(lesson({ status: 'COMPLETED' }))).toBe(false);
    expect(isMovable(lesson())).toBe(true);
  });
});

describe('placeDay', () => {
  it('splits overlapping lessons into lanes and leaves the rest full width', () => {
    const a = lesson({ startsAtUtc: at(24, 18), durationMin: 90 });
    const b = lesson({ startsAtUtc: at(24, 18, 30) });
    const c = lesson({ startsAtUtc: at(24, 19, 45) });
    const placed = placeDay([c, b, a], TZ);
    const of = (item: CalendarLesson) => placed.find((entry) => entry.lesson.id === item.id)!;
    expect(of(a)).toMatchObject({ lane: 0, lanes: 2, startMin: 1080, endMin: 1170 });
    expect(of(b)).toMatchObject({ lane: 1, lanes: 2 });
    expect(of(c)).toMatchObject({ lane: 0, lanes: 1 });
  });

  it('snaps to 15 minutes inside the day', () => {
    expect(snapMinutes(847)).toBe(840);
    expect(snapMinutes(853)).toBe(855);
    expect(snapMinutes(-20)).toBe(0);
    expect(snapMinutes(1500)).toBe(1425);
  });
});

describe('dropConflict', () => {
  it('finds a lesson of the same teacher, student or group at the new time', () => {
    const moving = lesson({ startsAtUtc: at(25, 17) });
    const other = lesson({
      startsAtUtc: at(25, 18, 30),
      student: { id: 'student-2', fullName: 'Sofiia Melnyk', avatarKey: null },
    });
    const friday = new Date(at(25, 0));
    expect(dropConflict(moving, friday, 18 * 60, [moving, other], TZ)?.id).toBe(other.id);
    expect(dropConflict(moving, friday, 14 * 60, [moving, other], TZ)).toBeNull();
    const cancelled = { ...other, status: 'CANCELLED_UNCHARGED' as const };
    expect(dropConflict(moving, friday, 18 * 60, [moving, cancelled], TZ)).toBeNull();
  });
});

describe('status filter', () => {
  const lessons = [
    lesson(),
    lesson({ status: 'COMPLETED' }),
    lesson({ status: 'NO_SHOW' }),
    lesson({ kind: 'MAKEUP' }),
    lesson({ status: 'CANCELLED_CHARGED' }),
  ];

  it('counts a makeup under its status and as a makeup', () => {
    expect(statusCounts(lessons)).toEqual({
      scheduled: 2,
      held: 1,
      noShow: 1,
      makeup: 1,
      cancelled: 1,
    });
  });

  it('hides a line and counts the lines left', () => {
    const noCancelled = {
      ...DEFAULT_STATUS_FILTER,
      shown: { ...DEFAULT_STATUS_FILTER.shown, cancelled: false },
    };
    expect(lessons.filter((item) => matchesStatus(item, noCancelled))).toHaveLength(4);
    expect(statusFilterCount(noCancelled)).toBe(4);
    expect(statusFilterCount(DEFAULT_STATUS_FILTER)).toBe(0);
    const noMakeup = {
      ...DEFAULT_STATUS_FILTER,
      shown: { ...DEFAULT_STATUS_FILTER.shown, makeup: false },
    };
    expect(matchesStatus(lessons[3]!, noMakeup)).toBe(false);
  });
});

describe('daySummary', () => {
  it('sums the day, finds its makeup and the free windows between lessons', () => {
    const original = lesson({ id: 'original', startsAtUtc: at(21, 10) });
    const day = [
      lesson({ startsAtUtc: at(24, 15), status: 'COMPLETED' }),
      lesson({ startsAtUtc: at(24, 18), durationMin: 90 }),
      lesson({ startsAtUtc: at(24, 19, 45), kind: 'MAKEUP', originalLessonId: 'original' }),
      lesson({ startsAtUtc: at(24, 12), status: 'CANCELLED_UNCHARGED' }),
    ];
    const summary = daySummary(day, Date.parse(at(24, 18, 40)), TZ, [...day, original]);
    expect(summary).toMatchObject({ count: 3, minutes: 210, held: 1, running: 1, upcoming: 1 });
    expect(summary.makeup?.original?.id).toBe('original');
    expect(summary.gaps).toEqual([{ startMin: 960, endMin: 1080 }]);
  });
});
