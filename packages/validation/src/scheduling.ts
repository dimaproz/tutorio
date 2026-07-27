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

/**
 * Lesson booking accepts a third, tutor-facing target: a bare `studentId`. The
 * API then resolves (or creates) the enrollment behind it, so the product never
 * asks a tutor to think in "enrollments" just to book a lesson.
 */
function requireExactlyOneLessonTarget<
  T extends {
    enrollmentId?: string | null;
    studentId?: string | null;
    groupId?: string | null;
  },
>(value: T, ctx: z.RefinementCtx): void {
  const provided = [
    value.enrollmentId != null,
    value.studentId != null,
    value.groupId != null,
  ].filter(Boolean).length;
  if (provided !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide exactly one of enrollmentId, studentId or groupId',
      path: ['studentId'],
    });
  }
}

// ---------------------------------------------------------------------------
// Lesson series (recurring pattern)
// ---------------------------------------------------------------------------

// Like a lesson, a recurring pattern can be created for a bare `studentId`;
// the API resolves the enrollment, teacher and price behind it.
export const createLessonSeriesSchema = z
  .object({
    enrollmentId: uuidSchema.nullable().optional(),
    studentId: uuidSchema.nullable().optional(),
    groupId: uuidSchema.nullable().optional(),
    teacherId: uuidSchema.optional(),
    weekdays: weekdaysSchema,
    localTime: localTimeSchema,
    timezone: timezoneSchema,
    durationMin: durationMinSchema,
    priceMinor: priceMinorSchema.optional(),
    currency: currencyCodeSchema.optional(),
    startDate: isoDateTimeSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    requireExactlyOneLessonTarget(value, ctx);
    if (value.studentId == null) {
      if (value.teacherId == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'teacherId is required unless a studentId is provided',
          path: ['teacherId'],
        });
      }
      if (value.priceMinor == null || value.currency == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'priceMinor and currency are required unless a studentId is provided',
          path: ['priceMinor'],
        });
      }
    }
    if ((value.priceMinor == null) !== (value.currency == null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'priceMinor and currency must be provided together',
        path: ['currency'],
      });
    }
  });

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
// `studentId` books without naming an enrollment; `teacherId`, `priceMinor` and
// `currency` are then optional and resolved server-side from the student's
// active enrollment (or its defaults). Explicit values always win.
/** Cancelling always records who cancelled; nothing else may. */
function requireCancellationAuthor(
  status: z.infer<typeof lessonStatusSchema>,
  cancelledBy: z.infer<typeof cancelledBySchema> | undefined,
  ctx: z.RefinementCtx,
): void {
  const isCancel =
    status === 'CANCELLED_CHARGED' || status === 'CANCELLED_UNCHARGED';
  if (isCancel && cancelledBy == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'cancelledBy is required when cancelling',
      path: ['cancelledBy'],
    });
  }
  if (!isCancel && cancelledBy != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'cancelledBy is only allowed when cancelling',
      path: ['cancelledBy'],
    });
  }
}

export const createLessonSchema = z
  .object({
    enrollmentId: uuidSchema.nullable().optional(),
    studentId: uuidSchema.nullable().optional(),
    groupId: uuidSchema.nullable().optional(),
    teacherId: uuidSchema.optional(),
    startsAt: z.array(isoDateTimeSchema).min(1).max(50),
    durationMin: durationMinSchema,
    priceMinor: priceMinorSchema.optional(),
    currency: currencyCodeSchema.optional(),
    // A lesson may be booked in a state other than SCHEDULED: tutors record
    // lessons after the fact ("this one already happened"). The server runs the
    // very same transition the status endpoint would, so the credit ledger sees
    // one code path whichever way a lesson reaches its status.
    status: lessonStatusSchema.default('SCHEDULED'),
    cancelledBy: cancelledBySchema.optional(),
    cancelledReason: notesSchema.nullable().optional(),
    // When the money arrived. Null on a completed lesson means "paid on the day".
    paidAt: isoDateTimeSchema.nullable().optional(),
    notes: notesSchema.nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    requireExactlyOneLessonTarget(value, ctx);
    requireCancellationAuthor(value.status, value.cancelledBy, ctx);
    // Only the studentId path may omit the teacher and the price.
    if (value.studentId == null) {
      if (value.teacherId == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'teacherId is required unless a studentId is provided',
          path: ['teacherId'],
        });
      }
      if (value.priceMinor == null || value.currency == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'priceMinor and currency are required unless a studentId is provided',
          path: ['priceMinor'],
        });
      }
    }
    // A price without its currency (or the reverse) is never usable.
    if ((value.priceMinor == null) !== (value.currency == null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'priceMinor and currency must be provided together',
        path: ['currency'],
      });
    }
  });

export type CreateLessonDto = z.infer<typeof createLessonSchema>;

// The fields a tutor can correct on a booked lesson. Time is not here: moving a
// lesson goes through /reschedule, which also handles the series scope and the
// conflict check.
export const updateLessonSchema = z
  .object({
    notes: notesSchema.nullable(),
    priceMinor: priceMinorSchema,
    currency: currencyCodeSchema,
    paidAt: isoDateTimeSchema.nullable(),
  })
  .partial()
  .strict()
  .refine(
    (value) => (value.priceMinor == null) === (value.currency == null),
    { message: 'priceMinor and currency must be provided together', path: ['currency'] },
  );

export type UpdateLessonDto = z.infer<typeof updateLessonSchema>;

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
    requireCancellationAuthor(value.targetStatus, value.cancelledBy, ctx);
  });

export type TransitionLessonDto = z.infer<typeof transitionLessonSchema>;

// Calendar feed: a bounded time window rather than offset pagination.
export const listLessonsQuerySchema = z
  .object({
    from: isoDateTimeSchema,
    to: isoDateTimeSchema,
    teacherId: uuidSchema.optional(),
    enrollmentId: uuidSchema.optional(),
    // Every lesson of one student, across all of their enrollments.
    studentId: uuidSchema.optional(),
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
  // How many times this lesson has been moved, and when it was moved last.
  // No lesson status expresses "rescheduled" — these carry that history.
  rescheduledCount: z.number().int().nonnegative(),
  rescheduledAt: isoDateTimeSchema.nullable(),
  cancelledBy: cancelledBySchema.nullable(),
  cancelledReason: z.string().nullable(),
  cancelledAt: isoDateTimeSchema.nullable(),
  completedAt: isoDateTimeSchema.nullable(),
  paidAt: isoDateTimeSchema.nullable(),
  notes: z.string().nullable(),
  // The cancellation deadline that applies to this lesson (the enrollment's own
  // value, else the workspace default). Lets the UI say whether cancelling now
  // is late before the tutor commits to charging.
  cancellationDeadlineHours: z.number().int(),
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
