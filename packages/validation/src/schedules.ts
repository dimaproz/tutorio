import { z } from 'zod';
import {
  avatarKeySchema,
  currencyCodeSchema,
  isoDateTimeSchema,
  timezoneSchema,
  uuidSchema,
} from './common';
import { priceMinorSchema } from './enrollments';
import { paginatedResponseSchema, paginationQuerySchema } from './pagination';
import {
  durationMinSchema,
  localTimeSchema,
  scheduleConflictSchema,
  weekdaySchema,
} from './scheduling';

// ---------------------------------------------------------------------------
// Schedules (product/scheduling.md L-20…L-27)
// ---------------------------------------------------------------------------

/** How many weeks ahead a schedule keeps lessons generated. */
export const scheduleHorizonWeeksSchema = z.number().int().min(1).max(26);

/** A calendar date "yyyy-MM-dd" in the schedule's timezone. */
export const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected "yyyy-MM-dd"');

/** One weekday and its local start time. */
export const scheduleSlotSchema = z.object({
  weekday: weekdaySchema,
  localTime: localTimeSchema,
});

export type ScheduleSlotDto = z.infer<typeof scheduleSlotSchema>;

/** One to seven weekdays, each once, each with its own time (L-21). */
export const scheduleSlotsSchema = z
  .array(scheduleSlotSchema)
  .min(1)
  .max(7)
  .refine((slots) => new Set(slots.map((slot) => slot.weekday)).size === slots.length, {
    message: 'A schedule has one start time per weekday',
  });

export const scheduleStateSchema = z.enum(['ACTIVE', 'ENDED']);
export type ScheduleStateDto = z.infer<typeof scheduleStateSchema>;

/**
 * A new schedule for a student with one teacher, or for a group (L-20). A
 * student is booked by `studentId` (plus `teacherId` when the studio has
 * several teachers); a group uses its own teacher and price.
 */
export const createScheduleSchema = z
  .object({
    studentId: uuidSchema.nullable().optional(),
    enrollmentId: uuidSchema.nullable().optional(),
    groupId: uuidSchema.nullable().optional(),
    teacherId: uuidSchema.optional(),
    slots: scheduleSlotsSchema,
    durationMin: durationMinSchema,
    /** Defaults to the studio's timezone. */
    timezone: timezoneSchema.optional(),
    /** The first lesson is on or after this instant; defaults to now. */
    startDate: isoDateTimeSchema.optional(),
    /** Optional last day ("until 31 May"), inclusive, in the timezone. */
    endsOn: localDateSchema.nullable().optional(),
    /** Defaults to the studio's setting. */
    horizonWeeks: scheduleHorizonWeeksSchema.optional(),
    priceMinor: priceMinorSchema.optional(),
    currency: currencyCodeSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const targets = [value.studentId, value.enrollmentId, value.groupId].filter(
      (id) => id != null,
    ).length;
    if (targets !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide exactly one of studentId, enrollmentId or groupId',
        path: ['studentId'],
      });
    }
    if ((value.priceMinor == null) !== (value.currency == null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'priceMinor and currency must be provided together',
        path: ['currency'],
      });
    }
  });

export type CreateScheduleDto = z.infer<typeof createScheduleSchema>;

/**
 * A change of days, times or length that takes effect from a date (L-25).
 * Lessons before it are untouched; the ones after it move where they can.
 */
export const scheduleChangeSchema = z
  .object({
    /** Defaults to now; a past instant is treated as now. */
    effectiveFrom: isoDateTimeSchema.optional(),
    slots: scheduleSlotsSchema,
    durationMin: durationMinSchema,
  })
  .strict();

export type ScheduleChangeDto = z.infer<typeof scheduleChangeSchema>;

/** Stops a schedule from a date; lessons from it are removed (L-24). */
export const stopScheduleSchema = z
  .object({
    /** Defaults to now. A future date keeps the schedule until then. */
    from: isoDateTimeSchema.optional(),
  })
  .strict();

export type StopScheduleDto = z.infer<typeof stopScheduleSchema>;

export const updateScheduleSchema = z.object({ horizonWeeks: scheduleHorizonWeeksSchema }).strict();

export type UpdateScheduleDto = z.infer<typeof updateScheduleSchema>;

/**
 * Which schedules a list shows: active, active with a change planned for
 * later (`CHANGING`), ended, or every one.
 */
export const scheduleListStateSchema = z.enum(['ACTIVE', 'CHANGING', 'ENDED', 'all']);
export type ScheduleListStateDto = z.infer<typeof scheduleListStateSchema>;

export const listSchedulesQuerySchema = paginationQuerySchema
  .extend({
    studentId: uuidSchema.optional(),
    groupId: uuidSchema.optional(),
    teacherId: uuidSchema.optional(),
    state: scheduleListStateSchema.default('ACTIVE'),
    /** A student's schedules or a group's. */
    kind: z.enum(['individual', 'group']).optional(),
    /** Part of the student's, the group's or the teacher's name. */
    search: z.string().trim().min(1).max(120).optional(),
    /** Newest first, or by the next lesson (soonest first, none last). */
    sort: z.enum(['created', 'next']).default('created'),
  })
  .strict();

export type ListSchedulesQueryDto = z.infer<typeof listSchedulesQuerySchema>;

const refSchema = z.object({ id: uuidSchema, name: z.string() });

export const scheduleResponseSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  enrollmentId: uuidSchema.nullable(),
  groupId: uuidSchema.nullable(),
  teacherId: uuidSchema,
  timezone: z.string(),
  durationMin: durationMinSchema,
  horizonWeeks: scheduleHorizonWeeksSchema,
  /** Exclusive end instant of the schedule, when one is set. */
  endsAt: isoDateTimeSchema.nullable(),
  state: scheduleStateSchema,
  /** The rule in force now (or, before it starts, the first one). */
  slots: z.array(scheduleSlotSchema.extend({ seriesId: uuidSchema })),
  /** A change that takes effect later, when one is planned. */
  nextChange: z
    .object({ effectiveFrom: isoDateTimeSchema, slots: z.array(scheduleSlotSchema) })
    .nullable(),
  nextLessonAt: isoDateTimeSchema.nullable(),
  /** When the schedule's first rule starts. */
  startsAt: isoDateTimeSchema.nullable(),
  /** The last lesson generated so far: how far ahead the schedule is booked. */
  lastLessonAt: isoDateTimeSchema.nullable(),
  student: z
    .object({ id: uuidSchema, fullName: z.string(), avatarKey: avatarKeySchema.nullable() })
    .nullable(),
  /** The group, with how many active members it has. */
  group: refSchema.extend({ memberCount: z.number().int().nonnegative() }).nullable(),
  teacher: refSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type ScheduleResponse = z.infer<typeof scheduleResponseSchema>;

export const scheduleListResponseSchema = paginatedResponseSchema(scheduleResponseSchema).extend({
  /** How many schedules each state shows with the other filters applied. */
  counts: z.object({
    active: z.number().int().nonnegative(),
    changing: z.number().int().nonnegative(),
    ended: z.number().int().nonnegative(),
    all: z.number().int().nonnegative(),
  }),
});
export type ScheduleListResponse = z.infer<typeof scheduleListResponseSchema>;

/** A lesson that would lose its topic or notes because the change removes it. */
const lostContentSchema = z.object({
  lessonId: uuidSchema,
  startsAtUtc: isoDateTimeSchema,
  topic: z.string().nullable(),
  hasNotes: z.boolean(),
});

/** Why a change or a stop leaves a lesson alone (L-27). */
export const keptReasonSchema = z.enum(['HELD', 'CANCELLED', 'NO_SHOW', 'MOVED', 'MARKED']);
export type KeptReasonDto = z.infer<typeof keptReasonSchema>;

/**
 * What a change or a stop would do (L-24, L-25), computed exactly as the
 * apply would do it. The counts come with the lessons behind them.
 */
export const scheduleChangePreviewSchema = z.object({
  effectiveFrom: isoDateTimeSchema,
  /** Lessons that keep their id but get a new time or length. */
  moved: z.number().int().nonnegative(),
  /** Lessons the change leaves exactly as they are. */
  unchanged: z.number().int().nonnegative(),
  created: z.number().int().nonnegative(),
  removed: z.number().int().nonnegative(),
  /** Held, cancelled, hand-moved or marked lessons the change never touches. */
  kept: z.number().int().nonnegative(),
  notesLost: z.array(lostContentSchema),
  conflicts: z.array(scheduleConflictSchema),
  /** The moved lessons, each with its old and new start. */
  moves: z.array(
    z.object({
      lessonId: uuidSchema,
      startsAtUtc: isoDateTimeSchema,
      toStartsAtUtc: isoDateTimeSchema,
    }),
  ),
  /** The lessons removed. */
  removals: z.array(z.object({ lessonId: uuidSchema, startsAtUtc: isoDateTimeSchema })),
  /** The starts of the lessons created. */
  creates: z.array(isoDateTimeSchema),
  /** The lessons left alone, and why. */
  keptLessons: z.array(
    z.object({ lessonId: uuidSchema, startsAtUtc: isoDateTimeSchema, reason: keptReasonSchema }),
  ),
});

export type ScheduleChangePreview = z.infer<typeof scheduleChangePreviewSchema>;

/**
 * What creating a schedule would do (L-22, L-110), computed exactly as the
 * create would, before anything is written: the lessons it generates at once
 * within the horizon and what they overlap. A direction or group that already
 * has an active schedule is named, since creating would be refused.
 */
export const scheduleCreatePreviewSchema = z.object({
  /** Lessons generated at once, from the later of the start and now to the horizon or the end. */
  created: z.number().int().nonnegative(),
  /** The starts of those lessons, soonest first. */
  dates: z.array(isoDateTimeSchema),
  firstLessonAt: isoDateTimeSchema.nullable(),
  /** The active schedule of the same direction or group (create answers SCHEDULE_EXISTS). */
  existingScheduleId: uuidSchema.nullable(),
  conflicts: z.array(scheduleConflictSchema),
});

export type ScheduleCreatePreview = z.infer<typeof scheduleCreatePreviewSchema>;

/**
 * What a new horizon would do (L-22), computed exactly as saving it would: the
 * lessons generated now and how far ahead the schedule is booked then. A
 * shorter horizon keeps what is booked and adds nothing.
 */
export const scheduleHorizonPreviewSchema = z.object({
  horizonWeeks: scheduleHorizonWeeksSchema,
  added: z.number().int().nonnegative(),
  /** The starts of the lessons added, soonest first. */
  dates: z.array(isoDateTimeSchema),
  /** The last lesson booked once the horizon is saved. */
  lastLessonAt: isoDateTimeSchema.nullable(),
});

export type ScheduleHorizonPreview = z.infer<typeof scheduleHorizonPreviewSchema>;

export const scheduleChangeResultSchema = z.object({
  schedule: scheduleResponseSchema,
  summary: scheduleChangePreviewSchema,
});

export type ScheduleChangeResult = z.infer<typeof scheduleChangeResultSchema>;
