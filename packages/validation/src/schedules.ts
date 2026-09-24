import { z } from 'zod';
import { currencyCodeSchema, isoDateTimeSchema, timezoneSchema, uuidSchema } from './common';
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

export const listSchedulesQuerySchema = paginationQuerySchema
  .extend({
    studentId: uuidSchema.optional(),
    groupId: uuidSchema.optional(),
    teacherId: uuidSchema.optional(),
    state: z.enum(['ACTIVE', 'ENDED', 'all']).default('ACTIVE'),
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
  student: z.object({ id: uuidSchema, fullName: z.string() }).nullable(),
  group: refSchema.nullable(),
  teacher: refSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type ScheduleResponse = z.infer<typeof scheduleResponseSchema>;

export const scheduleListResponseSchema = paginatedResponseSchema(scheduleResponseSchema);
export type ScheduleListResponse = z.infer<typeof scheduleListResponseSchema>;

/** A lesson that would lose its topic or notes because the change removes it. */
const lostContentSchema = z.object({
  lessonId: uuidSchema,
  startsAtUtc: isoDateTimeSchema,
  topic: z.string().nullable(),
  hasNotes: z.boolean(),
});

/**
 * What a change or a stop would do (L-24, L-25), computed exactly as the
 * apply would do it.
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
});

export type ScheduleChangePreview = z.infer<typeof scheduleChangePreviewSchema>;

export const scheduleChangeResultSchema = z.object({
  schedule: scheduleResponseSchema,
  summary: scheduleChangePreviewSchema,
});

export type ScheduleChangeResult = z.infer<typeof scheduleChangeResultSchema>;
