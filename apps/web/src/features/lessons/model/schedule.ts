import type {
  CreateScheduleDto,
  ScheduleChangeDto,
  ScheduleChangePreview,
  ScheduleConflict,
  ScheduleResponse,
  ScheduleSlotDto,
} from '@tutorio/validation';
import { z } from 'zod';
import { dayStartIso, zonedTime, zonedWeekday } from '@/lib/datetime';
import { lessonDurationString } from './fields';
import { weeklySlots } from './create';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The horizons the form and the dialog offer, in weeks (L-22). */
export const HORIZON_CHOICES = [2, 4, 6, 8, 12] as const;

const issueOf = (ctx: z.RefinementCtx) => (path: (string | number)[], key: string) =>
  ctx.addIssue({ code: z.ZodIssueCode.custom, path, params: { key } });

/** Weekdays, each with a valid time (L-21). */
function checkSlots(
  values: { weekdays: number[]; times: Record<string, string> },
  issue: ReturnType<typeof issueOf>,
) {
  if (values.weekdays.length === 0) issue(['weekdays'], 'weekdaysRequired');
  for (const day of values.weekdays) {
    if (!TIME_RE.test(values.times[String(day)] ?? '')) {
      issue(['times', String(day)], 'lessonTimeInvalid');
    }
  }
}

/**
 * «Новий розклад» (S05): a student with a teacher, or a group (taught by its
 * teacher); weekdays each with a time, one length, the horizon, the first
 * day and an optional last one (L-20…L-22). `frequency` and `dates` keep the
 * shape of the lesson form, whose band and weekly block the form reuses.
 */
export const scheduleFormSchema = z
  .object({
    who: z.enum(['student', 'group']),
    studentId: z.string(),
    groupId: z.string(),
    teacherId: z.string(),
    frequency: z.literal('weekly'),
    dates: z.array(z.object({ date: z.string(), time: z.string() })),
    weekdays: z.array(z.number().int().min(0).max(6)),
    times: z.record(z.string(), z.string()),
    from: z.string(),
    until: z.string(),
    durationMin: lessonDurationString,
    horizonWeeks: z.string(),
  })
  .superRefine((values, ctx) => {
    const issue = issueOf(ctx);
    if (values.who === 'student' && !values.studentId)
      issue(['studentId'], 'lessonStudentRequired');
    if (values.who === 'group' && !values.groupId) issue(['groupId'], 'lessonGroupRequired');
    if (values.who === 'student' && !values.teacherId) issue(['teacherId'], 'teacherRequired');
    checkSlots(values, issue);
    if (!DATE_RE.test(values.from)) issue(['from'], 'lessonDateRequired');
    if (values.until && DATE_RE.test(values.from) && values.until < values.from) {
      issue(['until'], 'endDateBeforeStart');
    }
  });

export type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;

export function scheduleFormDefaults({
  who = 'student',
  studentId = '',
  groupId = '',
  from,
  horizonWeeks,
}: {
  who?: 'student' | 'group';
  studentId?: string;
  groupId?: string;
  from: string;
  horizonWeeks: number;
}): ScheduleFormValues {
  return {
    who,
    studentId,
    groupId,
    teacherId: '',
    frequency: 'weekly',
    dates: [{ date: from, time: '17:00' }],
    weekdays: [],
    times: {},
    from,
    until: '',
    durationMin: '60',
    horizonWeeks: String(horizonWeeks),
  };
}

/** The request of a new schedule; the price comes from the direction or the group. */
export function scheduleCreateDto(values: ScheduleFormValues, timeZone: string): CreateScheduleDto {
  return {
    ...(values.who === 'group' ? { groupId: values.groupId } : { studentId: values.studentId }),
    ...(values.who === 'student' ? { teacherId: values.teacherId } : {}),
    slots: weeklySlots(values),
    durationMin: Number(values.durationMin),
    startDate: dayStartIso(values.from, timeZone),
    endsOn: values.until || null,
    horizonWeeks: Number(values.horizonWeeks),
  };
}

/** Whether the form has what a preview needs (the same as a save would). */
export function scheduleFormReady(values: ScheduleFormValues): boolean {
  return scheduleFormSchema.safeParse(values).success;
}

/**
 * «Змінити розклад» (S05): the days, a time for each, the length, and the
 * date the change takes effect from (L-25). `dates` and `until` keep the
 * shape of the weekly block the form reuses.
 */
export const scheduleChangeFormSchema = z
  .object({
    frequency: z.literal('weekly'),
    dates: z.array(z.object({ date: z.string(), time: z.string() })),
    weekdays: z.array(z.number().int().min(0).max(6)),
    times: z.record(z.string(), z.string()),
    from: z.string(),
    until: z.string(),
    durationMin: lessonDurationString,
  })
  .superRefine((values, ctx) => {
    const issue = issueOf(ctx);
    checkSlots(values, issue);
    if (!DATE_RE.test(values.from)) issue(['from'], 'lessonDateRequired');
  });

export type ScheduleChangeFormValues = z.infer<typeof scheduleChangeFormSchema>;

export function scheduleChangeDefaults(
  schedule: Pick<ScheduleResponse, 'slots' | 'durationMin'>,
  from: string,
): ScheduleChangeFormValues {
  return {
    frequency: 'weekly',
    dates: [{ date: from, time: schedule.slots[0]?.localTime ?? '17:00' }],
    weekdays: schedule.slots.map((slot) => slot.weekday),
    times: Object.fromEntries(schedule.slots.map((slot) => [String(slot.weekday), slot.localTime])),
    from,
    until: '',
    durationMin: String(schedule.durationMin),
  };
}

export function scheduleChangeFormDto(
  values: ScheduleChangeFormValues,
  timeZone: string,
): ScheduleChangeDto {
  return {
    effectiveFrom: dayStartIso(values.from, timeZone),
    slots: weeklySlots(values),
    durationMin: Number(values.durationMin),
  };
}

/** The rule now against the rule after a change, one weekday at a time (S05 board 03). */
export type SlotChange = {
  weekday: number;
  before: string | null;
  after: string | null;
};

export function slotChanges(
  before: readonly ScheduleSlotDto[],
  after: readonly ScheduleSlotDto[],
): SlotChange[] {
  const days = new Set([...before, ...after].map((slot) => slot.weekday));
  return [...days]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((weekday) => ({
      weekday,
      before: before.find((slot) => slot.weekday === weekday)?.localTime ?? null,
      after: after.find((slot) => slot.weekday === weekday)?.localTime ?? null,
    }));
}

/**
 * The moved lessons as the consequences say them: when they all land on one
 * weekday and time (the studio's), «4 вівторки — на 18:00»; otherwise just
 * the count.
 */
export function movedSummary(moves: ScheduleChangePreview['moves'], timeZone: string) {
  if (moves.length === 0) return null;
  const targets = new Set(
    moves.map(
      (move) =>
        `${zonedWeekday(move.toStartsAtUtc, timeZone)}|${zonedTime(move.toStartsAtUtc, timeZone)}`,
    ),
  );
  if (targets.size !== 1) return { count: moves.length, weekday: null, time: null };
  const [weekday, time] = [...targets][0]!.split('|');
  return { count: moves.length, weekday: Number(weekday), time: time! };
}

/** The removed lessons: one weekday («3 п'ятниці») or several, with their dates. */
export function removedSummary(removals: ScheduleChangePreview['removals'], timeZone: string) {
  if (removals.length === 0) return null;
  const weekdays = new Set(removals.map((removal) => zonedWeekday(removal.startsAtUtc, timeZone)));
  return {
    count: removals.length,
    weekday: weekdays.size === 1 ? [...weekdays][0]! : null,
    dates: removals.map((removal) => removal.startsAtUtc).sort(),
  };
}

/** Conflicts by the new lesson they hit, soonest first (one pair per date, S05 decision 4). */
export function conflictPairs(conflicts: readonly ScheduleConflict[]) {
  const byStart = new Map<string, ScheduleConflict[]>();
  for (const conflict of conflicts) {
    byStart.set(conflict.candidateStartsAtUtc, [
      ...(byStart.get(conflict.candidateStartsAtUtc) ?? []),
      conflict,
    ]);
  }
  return [...byStart]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([candidateStartsAtUtc, hits]) => ({ candidateStartsAtUtc, hits }));
}
