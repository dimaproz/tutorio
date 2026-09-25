import {
  lessonTopicSchema,
  notesSchema,
  type CreateLessonDto,
  type CreateScheduleDto,
  type ScheduleChangeDto,
  type ScheduleSlotDto,
} from '@tutorio/validation';
import { z } from 'zod';
import { optionalText } from '@/lib/forms/helpers';
import {
  addCalendarDays,
  calendarWeekday,
  dayStartIso,
  isCalendarDate,
  zonedDateTime,
  zonedDayEnd,
  zonedDayStart,
  zonedIso,
} from '@/lib/datetime';
import { parsePriceInput } from '@/lib/money';
import { lessonDurationString, lessonPriceString } from './fields';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How the price field behaves for what is picked (FieldsTeacher board):
 * an editable amount, a package credit (no money), the group price (members
 * pay their own rate, L-11), or nothing picked yet.
 */
export type PriceMode = 'amount' | 'package' | 'group' | 'none';

export type PastStatus = 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

/**
 * The lesson form (S02): who, the teacher, when — date rows once or weekly
 * slots —, the length, the price, what a past lesson became (L-31), topic and
 * notes. `priceMode` is set by the form from what is picked; the price is
 * required only when it is an amount.
 */
export const createFormSchema = z
  .object({
    who: z.enum(['student', 'group']),
    studentId: z.string(),
    groupId: z.string(),
    teacherId: z.string(),
    frequency: z.enum(['once', 'weekly']),
    dates: z
      .array(z.object({ date: z.string(), time: z.string() }))
      .min(1)
      .max(50),
    weekdays: z.array(z.number().int().min(0).max(6)),
    times: z.record(z.string(), z.string()),
    from: z.string(),
    until: z.string(),
    durationMin: lessonDurationString,
    priceMode: z.enum(['amount', 'package', 'group', 'none']),
    price: z.string(),
    pastStatus: z.enum(['COMPLETED', 'CANCELLED', 'NO_SHOW']),
    cancelledBy: z.enum(['STUDENT', 'TEACHER', 'GROUP']),
    cancelCharge: z.enum(['charge', 'free']),
    topic: optionalText(lessonTopicSchema),
    notes: optionalText(notesSchema),
  })
  .superRefine((values, ctx) => {
    const issue = (path: (string | number)[], key: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, params: { key } });

    if (values.who === 'student' && !values.studentId)
      issue(['studentId'], 'lessonStudentRequired');
    if (values.who === 'group' && !values.groupId) issue(['groupId'], 'lessonGroupRequired');
    if (!values.teacherId) issue(['teacherId'], 'teacherRequired');

    if (values.frequency === 'once') {
      values.dates.forEach((row, index) => {
        if (!DATE_RE.test(row.date)) issue(['dates', index, 'date'], 'lessonDateRequired');
        else if (!TIME_RE.test(row.time)) issue(['dates', index, 'time'], 'lessonTimeInvalid');
      });
    } else {
      if (values.weekdays.length === 0) issue(['weekdays'], 'weekdaysRequired');
      for (const day of values.weekdays) {
        if (!TIME_RE.test(values.times[String(day)] ?? '')) {
          issue(['times', String(day)], 'lessonTimeInvalid');
        }
      }
      if (!DATE_RE.test(values.from)) issue(['from'], 'lessonDateRequired');
      if (values.until && DATE_RE.test(values.from) && values.until < values.from) {
        issue(['until'], 'endDateBeforeStart');
      }
    }

    if (values.priceMode === 'amount') {
      const price = lessonPriceString({ required: true }).safeParse(values.price);
      if (!price.success) {
        const key = (price.error.issues[0] as { params?: { key?: string } } | undefined)?.params
          ?.key;
        issue(['price'], key ?? 'priceInvalid');
      }
    }
  });

export type CreateFormValues = z.infer<typeof createFormSchema>;

/** The date a week after "yyyy-MM-dd": «Додати дату» adds a row seven days later. */
export function weekAfter(date: string): string {
  return isCalendarDate(date) ? addCalendarDays(date, 7) : '';
}

export function createFormDefaults({
  who,
  studentId = '',
  groupId = '',
  teacherId = '',
  date,
  time,
  durationMin,
}: {
  who: 'student' | 'group';
  studentId?: string;
  groupId?: string;
  teacherId?: string;
  date: string;
  time: string;
  durationMin: number;
}): CreateFormValues {
  return {
    who,
    studentId,
    groupId,
    teacherId,
    frequency: 'once',
    dates: [{ date, time }],
    weekdays: [],
    times: {},
    from: date,
    until: '',
    durationMin: String(durationMin),
    priceMode: 'none',
    price: '',
    pastStatus: 'COMPLETED',
    cancelledBy: who === 'group' ? 'GROUP' : 'STUDENT',
    cancelCharge: 'free',
    topic: '',
    notes: '',
  };
}

/** The dates of the rows that are already over when the form is saved (L-31). */
export function pastRows(values: Pick<CreateFormValues, 'dates'>, now: number, timeZone: string) {
  return values.dates.map(
    (row) =>
      DATE_RE.test(row.date) &&
      TIME_RE.test(row.time) &&
      zonedDateTime(row.date, row.time, timeZone).getTime() < now,
  );
}

/** Where the lessons go: an existing direction (also for a substitute), a new one, or a group. */
export type LessonTarget =
  | { kind: 'direction'; enrollmentId: string }
  | { kind: 'newDirection'; studentId: string }
  | { kind: 'group'; groupId: string };

function pastFields(values: CreateFormValues, group: boolean): Partial<CreateLessonDto> {
  switch (values.pastStatus) {
    case 'COMPLETED':
      return { status: 'COMPLETED' };
    case 'NO_SHOW':
      return group ? { status: 'COMPLETED' } : { status: 'NO_SHOW' };
    case 'CANCELLED':
      return {
        status: values.cancelCharge === 'charge' ? 'CANCELLED_CHARGED' : 'CANCELLED_UNCHARGED',
        cancelledBy: group && values.cancelledBy === 'STUDENT' ? 'GROUP' : values.cancelledBy,
      };
  }
}

/**
 * The `POST /lessons` bodies of a one-off booking: the dates still ahead as
 * scheduled lessons, the past ones with what they became (L-31). Each body
 * books one target with one teacher, length and price (the API takes up to 50
 * dates at once). A new direction lets the API resolve it from the student
 * and the teacher (L-2, L-10).
 */
export function createLessonRequests(
  values: CreateFormValues,
  {
    target,
    priceMinor,
    currency,
    now,
    timeZone,
  }: {
    target: LessonTarget;
    priceMinor: number;
    currency: string;
    now: number;
    /** The studio's zone: the rows are its wall clock. */
    timeZone: string;
  },
): CreateLessonDto[] {
  const past = pastRows(values, now, timeZone);
  const starts = values.dates.map((row) => zonedIso(row.date, row.time, timeZone));
  const group = target.kind === 'group';
  const base = {
    ...(target.kind === 'direction'
      ? { enrollmentId: target.enrollmentId }
      : target.kind === 'newDirection'
        ? { studentId: target.studentId }
        : { groupId: target.groupId }),
    teacherId: values.teacherId,
    durationMin: Number(values.durationMin),
    priceMinor,
    currency: currency as CreateLessonDto['currency'],
    topic: values.topic.trim() || null,
    notes: values.notes.trim() || null,
  };
  const ahead = starts.filter((_, index) => !past[index]);
  const behind = starts.filter((_, index) => past[index]);
  const requests: CreateLessonDto[] = [];
  if (ahead.length > 0) requests.push({ ...base, startsAt: ahead, status: 'SCHEDULED' });
  if (behind.length > 0) {
    requests.push({ ...base, startsAt: behind, ...pastFields(values, group) } as CreateLessonDto);
  }
  return requests;
}

/** The weekly block's slots, each selected weekday with its own time (L-21). */
export function weeklySlots(
  values: Pick<CreateFormValues, 'weekdays' | 'times'>,
): ScheduleSlotDto[] {
  return [...values.weekdays]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((weekday) => ({ weekday, localTime: values.times[String(weekday)] ?? '' }));
}

/** A new schedule for the student with the teacher, or for the group (L-20). */
export function createScheduleDto(
  values: CreateFormValues,
  {
    priceMinor,
    currency,
    timeZone,
  }: { priceMinor: number | null; currency: string; timeZone: string },
): CreateScheduleDto {
  return {
    ...(values.who === 'group' ? { groupId: values.groupId } : { studentId: values.studentId }),
    ...(values.who === 'student' ? { teacherId: values.teacherId } : {}),
    slots: weeklySlots(values),
    durationMin: Number(values.durationMin),
    startDate: dayStartIso(values.from, timeZone),
    endsOn: values.until || null,
    ...(priceMinor !== null
      ? { priceMinor, currency: currency as CreateScheduleDto['currency'] }
      : {}),
  };
}

/**
 * «Щотижня» for a direction that already has a schedule adds the picked days
 * to it (L-23): its slots plus the new ones (a picked day it already has takes
 * the new time), from the «З» date (L-25).
 */
export function scheduleChangeDto(
  values: CreateFormValues,
  existing: readonly ScheduleSlotDto[],
  timeZone: string,
): ScheduleChangeDto {
  const added = weeklySlots(values);
  const slots = [
    ...existing
      .filter((slot) => !added.some((next) => next.weekday === slot.weekday))
      .map(({ weekday, localTime }) => ({ weekday, localTime })),
    ...added,
  ].sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7));
  return {
    effectiveFrom: dayStartIso(values.from, timeZone),
    slots,
    durationMin: Number(values.durationMin),
  };
}

/**
 * How many lessons a new schedule creates at once: its occurrences from the
 * later of the start and now to the earlier of the end day and now + the
 * horizon (L-22), as the API generates them on the studio's clock.
 */
export function newScheduleLessonCount({
  slots,
  from,
  until,
  horizonWeeks,
  now,
  timeZone,
}: {
  slots: readonly ScheduleSlotDto[];
  from: string;
  until: string;
  horizonWeeks: number;
  now: number;
  timeZone: string;
}): number {
  if (!isCalendarDate(from) || slots.length === 0) return 0;
  const start = Math.max(zonedDayStart(from, timeZone).getTime(), now);
  let end = now + horizonWeeks * 7 * DAY_MS;
  if (isCalendarDate(until)) end = Math.min(end, zonedDayEnd(until, timeZone).getTime());
  let count = 0;
  for (
    let day = from;
    zonedDayStart(day, timeZone).getTime() < end;
    day = addCalendarDays(day, 1)
  ) {
    for (const slot of slots) {
      if (calendarWeekday(day) !== slot.weekday || !TIME_RE.test(slot.localTime)) continue;
      const at = zonedDateTime(day, slot.localTime, timeZone).getTime();
      if (at >= start && at < end) count += 1;
    }
  }
  return count;
}

/** A package's credits as the form counts them: the lessons they cover, the rest on debt (L-82). */
export function packageCoverage(count: number, creditsLeft: number) {
  const covered = Math.max(0, Math.min(count, creditsLeft));
  return { covered, debt: count - covered, leftAfter: Math.max(creditsLeft - covered, 0) };
}

/** The lessons of a one-off booking that are charged (L-31): a free cancellation is not. */
export function chargedCount(values: CreateFormValues, now: number, timeZone: string): number {
  const past = pastRows(values, now, timeZone);
  const behind = past.filter(Boolean).length;
  const freeBehind =
    values.pastStatus === 'CANCELLED' && values.cancelCharge === 'free' ? behind : 0;
  return values.dates.length - freeBehind;
}

/** The typed price in minor units, or null. */
export function typedPrice(values: Pick<CreateFormValues, 'price'>): number | null {
  const text = values.price.trim();
  if (text === '' || text.startsWith('-')) return null;
  return parsePriceInput(text);
}
