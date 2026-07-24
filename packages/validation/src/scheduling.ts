import { z } from 'zod';
import {
  currencyCodeSchema,
  isoDateTimeSchema,
  notesSchema,
  recordStateSchema,
  timezoneSchema,
  uuidSchema,
} from './common';
import { priceMinorSchema } from './enrollments';
import { paginatedResponseSchema, paginationQuerySchema } from './pagination';

// ---------------------------------------------------------------------------
// Shared scheduling primitives
// ---------------------------------------------------------------------------

export const lessonStatusSchema = z.enum([
  'SCHEDULED',
  'COMPLETED',
  'CANCELLED_CHARGED',
  'CANCELLED_UNCHARGED',
]);
export type LessonStatusDto = z.infer<typeof lessonStatusSchema>;

export const cancelledBySchema = z.enum(['TEACHER', 'STUDENT', 'GROUP']);
export type CancelledByDto = z.infer<typeof cancelledBySchema>;

// 0 = Sunday … 6 = Saturday (JS Date.getUTCDay convention, shared with
// @tutorio/domain expandSeries).
export const weekdaySchema = z.number().int().min(0).max(6);

export const weekdaysSchema = z
  .array(weekdaySchema)
  .min(1)
  .max(7)
  .refine((days) => new Set(days).size === days.length, {
    message: 'Weekdays must be unique',
  });

// Local wall-clock time "HH:mm" (24h) — matches the domain LOCAL_TIME_RE.
export const localTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a 24h time "HH:mm"');

// Lesson length in minutes: 5 minutes to 12 hours.
export const durationMinSchema = z.number().int().min(5).max(720);

// Exactly one of enrollmentId / groupId identifies the lesson/series target.
function requireExactlyOneTarget<T extends { enrollmentId?: string | null; groupId?: string | null }>(
  value: T,
  ctx: z.RefinementCtx,
): void {
  const hasEnrollment = value.enrollmentId != null;
  const hasGroup = value.groupId != null;
  if (hasEnrollment === hasGroup) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide exactly one of enrollmentId or groupId',
      path: [hasEnrollment ? 'groupId' : 'enrollmentId'],
    });
  }
}

// ---------------------------------------------------------------------------
// Lesson series (recurring pattern)
// ---------------------------------------------------------------------------

export const createLessonSeriesSchema = z
  .object({
    enrollmentId: uuidSchema.nullable().optional(),
    groupId: uuidSchema.nullable().optional(),
    teacherId: uuidSchema,
    weekdays: weekdaysSchema,
    localTime: localTimeSchema,
    timezone: timezoneSchema,
    durationMin: durationMinSchema,
    priceMinor: priceMinorSchema,
    currency: currencyCodeSchema,
    startDate: isoDateTimeSchema,
  })
  .strict()
  .superRefine(requireExactlyOneTarget);

export type CreateLessonSeriesDto = z.infer<typeof createLessonSeriesSchema>;

// Schedule fields are mutable (they regenerate future non-detached lessons);
// the target and teacher are immutable — recreate the series to repoint it.
export const updateLessonSeriesSchema = z
  .object({
    weekdays: weekdaysSchema,
    localTime: localTimeSchema,
    timezone: timezoneSchema,
    durationMin: durationMinSchema,
    priceMinor: priceMinorSchema,
    currency: currencyCodeSchema,
    startDate: isoDateTimeSchema,
  })
  .partial()
  .strict();

export type UpdateLessonSeriesDto = z.infer<typeof updateLessonSeriesSchema>;

export const listLessonSeriesQuerySchema = paginationQuerySchema
  .extend({
    enrollmentId: uuidSchema.optional(),
    groupId: uuidSchema.optional(),
    teacherId: uuidSchema.optional(),
    state: recordStateSchema.default('active'),
  })
  .strict();

export type ListLessonSeriesQueryDto = z.infer<typeof listLessonSeriesQuerySchema>;

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------

// A single create call books one or many one-off lessons that share the same
// target/teacher/duration/price — the production "add another date" flow. One
// date is the common case; the array covers bulk creation.
export const createLessonSchema = z
  .object({
    enrollmentId: uuidSchema.nullable().optional(),
    groupId: uuidSchema.nullable().optional(),
    teacherId: uuidSchema,
    startsAt: z.array(isoDateTimeSchema).min(1).max(50),
    durationMin: durationMinSchema,
    priceMinor: priceMinorSchema,
    currency: currencyCodeSchema,
    notes: notesSchema.nullable().optional(),
  })
  .strict()
  .superRefine(requireExactlyOneTarget);

export type CreateLessonDto = z.infer<typeof createLessonSchema>;

export const rescheduleScopeSchema = z.enum(['this', 'this_and_following']);
export type RescheduleScopeDto = z.infer<typeof rescheduleScopeSchema>;

// scope 'this' detaches a single lesson from its series; 'this_and_following'
// shifts the series pattern from this lesson onward.
export const rescheduleLessonSchema = z
  .object({
    startsAtUtc: isoDateTimeSchema,
    durationMin: durationMinSchema.optional(),
    scope: rescheduleScopeSchema.default('this'),
  })
  .strict();

export type RescheduleLessonDto = z.infer<typeof rescheduleLessonSchema>;

// A cancelled target status requires attribution; completing/reverting must not
// carry cancellation metadata.
export const transitionLessonSchema = z
  .object({
    targetStatus: lessonStatusSchema,
    cancelledBy: cancelledBySchema.optional(),
    cancelledReason: notesSchema.nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const isCancel =
      value.targetStatus === 'CANCELLED_CHARGED' ||
      value.targetStatus === 'CANCELLED_UNCHARGED';
    if (isCancel && value.cancelledBy == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'cancelledBy is required when cancelling',
        path: ['cancelledBy'],
      });
    }
    if (!isCancel && value.cancelledBy != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'cancelledBy is only allowed when cancelling',
        path: ['cancelledBy'],
      });
    }
  });

export type TransitionLessonDto = z.infer<typeof transitionLessonSchema>;

// Calendar feed: a bounded time window rather than offset pagination.
export const listLessonsQuerySchema = z
  .object({
    from: isoDateTimeSchema,
    to: isoDateTimeSchema,
    teacherId: uuidSchema.optional(),
    enrollmentId: uuidSchema.optional(),
    groupId: uuidSchema.optional(),
    status: lessonStatusSchema.optional(),
  })
  .strict()
  .refine((value) => new Date(value.to) > new Date(value.from), {
    message: 'to must be after from',
    path: ['to'],
  });

export type ListLessonsQueryDto = z.infer<typeof listLessonsQuerySchema>;

// Override conflict rejection on create/reschedule (double-booking on purpose).
export const forceQuerySchema = z
  .object({ force: z.coerce.boolean().default(false) })
  .strict();

export type ForceQueryDto = z.infer<typeof forceQuerySchema>;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

const studentRefSchema = z.object({ id: uuidSchema, fullName: z.string() });
const groupRefSchema = z.object({ id: uuidSchema, name: z.string() });
const teacherRefSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  color: z.string().nullable(),
});

export const lessonResponseSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  enrollmentId: uuidSchema.nullable(),
  groupId: uuidSchema.nullable(),
  seriesId: uuidSchema.nullable(),
  packageId: uuidSchema.nullable(),
  teacherId: uuidSchema,
  startsAtUtc: isoDateTimeSchema,
  durationMin: durationMinSchema,
  priceMinor: priceMinorSchema,
  currency: currencyCodeSchema,
  status: lessonStatusSchema,
  isDetached: z.boolean(),
  cancelledBy: cancelledBySchema.nullable(),
  cancelledReason: z.string().nullable(),
  cancelledAt: isoDateTimeSchema.nullable(),
  completedAt: isoDateTimeSchema.nullable(),
  notes: z.string().nullable(),
  // Compact refs for calendar event rendering (avoids request waterfalls).
  student: studentRefSchema.nullable(),
  group: groupRefSchema.nullable(),
  teacher: teacherRefSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
});

export type LessonResponse = z.infer<typeof lessonResponseSchema>;

// The calendar window returns a flat list (already bounded by the query).
export const lessonListResponseSchema = z.object({
  items: z.array(lessonResponseSchema),
});

export type LessonListResponse = z.infer<typeof lessonListResponseSchema>;

export const lessonSeriesResponseSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  enrollmentId: uuidSchema.nullable(),
  groupId: uuidSchema.nullable(),
  packageId: uuidSchema.nullable(),
  teacherId: uuidSchema,
  weekdays: z.array(weekdaySchema),
  localTime: localTimeSchema,
  timezone: z.string(),
  durationMin: durationMinSchema,
  priceMinor: priceMinorSchema,
  currency: currencyCodeSchema,
  startDate: isoDateTimeSchema,
  horizonMaterializedUntil: isoDateTimeSchema,
  student: studentRefSchema.nullable(),
  group: groupRefSchema.nullable(),
  teacher: teacherRefSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
});

export type LessonSeriesResponse = z.infer<typeof lessonSeriesResponseSchema>;

export const lessonSeriesListResponseSchema = paginatedResponseSchema(
  lessonSeriesResponseSchema,
);

export type LessonSeriesListResponse = z.infer<typeof lessonSeriesListResponseSchema>;
