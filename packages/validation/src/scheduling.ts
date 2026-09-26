import { z } from 'zod';
import {
  avatarKeySchema,
  currencyCodeSchema,
  isoDateTimeSchema,
  notesSchema,
  recordStateSchema,
  timezoneSchema,
  uuidSchema,
} from './common';
import { auditLogResponseSchema } from './audit';
import { lessonChargeResponseSchema } from './billing';
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
  // The student did not come without notice; individual lessons only.
  'NO_SHOW',
]);
export type LessonStatusDto = z.infer<typeof lessonStatusSchema>;

export const lessonKindSchema = z.enum(['REGULAR', 'MAKEUP']);
export type LessonKindDto = z.infer<typeof lessonKindSchema>;

/** A short lesson title shown in the calendar and lists. */
export const lessonTopicSchema = z.string().trim().max(200);

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
  const isCancel = status === 'CANCELLED_CHARGED' || status === 'CANCELLED_UNCHARGED';
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
    // very same transition the status endpoint would, so billing sees one
    // code path whichever way a lesson reaches its status.
    status: lessonStatusSchema.default('SCHEDULED'),
    cancelledBy: cancelledBySchema.optional(),
    cancelledReason: notesSchema.nullable().optional(),
    // When the money arrived. Null on a completed lesson means "paid on the day".
    paidAt: isoDateTimeSchema.nullable().optional(),
    topic: lessonTopicSchema.nullable().optional(),
    notes: notesSchema.nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    requireExactlyOneLessonTarget(value, ctx);
    requireCancellationAuthor(value.status, value.cancelledBy, ctx);
    if (value.status === 'NO_SHOW' && value.groupId != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A group lesson records absences through attendance',
        path: ['status'],
      });
    }
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

// The fields a tutor can change on a booked lesson (product/scheduling.md
// L-40). Moving it in time goes through /reschedule, which also handles the
// schedule scope. A new duration or teacher is conflict-checked (`?force`)
// and takes a schedule lesson out of its schedule's regeneration.
export const updateLessonSchema = z
  .object({
    topic: lessonTopicSchema.nullable(),
    notes: notesSchema.nullable(),
    durationMin: durationMinSchema,
    // A substitute for this lesson only; the schedule keeps its teacher.
    teacherId: uuidSchema,
    priceMinor: priceMinorSchema,
    currency: currencyCodeSchema,
    paidAt: isoDateTimeSchema.nullable(),
  })
  .partial()
  .strict()
  .refine((value) => (value.priceMinor == null) === (value.currency == null), {
    message: 'priceMinor and currency must be provided together',
    path: ['currency'],
  });

export type UpdateLessonDto = z.infer<typeof updateLessonSchema>;

// A makeup for a cancelled or no-show individual lesson (L-60): the same
// student and, unless named, the same teacher and duration.
export const createMakeupSchema = z
  .object({
    startsAtUtc: isoDateTimeSchema,
    durationMin: durationMinSchema.optional(),
    teacherId: uuidSchema.optional(),
    topic: lessonTopicSchema.nullable().optional(),
    notes: notesSchema.nullable().optional(),
  })
  .strict();

export type CreateMakeupDto = z.infer<typeof createMakeupSchema>;

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
// Query values arrive as strings, so boolean coercion would turn "false" into
// true through JavaScript truthiness. Only explicit boolean spellings are valid.
const forceQueryValueSchema = z
  .union([z.boolean(), z.literal('true'), z.literal('false')])
  .transform((value) => value === true || value === 'true');

export const forceQuerySchema = z.object({ force: forceQueryValueSchema.default(false) }).strict();

export type ForceQueryDto = z.infer<typeof forceQuerySchema>;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

const studentRefSchema = z.object({ id: uuidSchema, fullName: z.string() });
/** The lesson's student with the avatar the calendar's cards show. */
const lessonStudentRefSchema = studentRefSchema.extend({
  avatarKey: avatarKeySchema.nullable(),
});
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
  teacherId: uuidSchema,
  startsAtUtc: isoDateTimeSchema,
  durationMin: durationMinSchema,
  priceMinor: priceMinorSchema,
  currency: currencyCodeSchema,
  status: lessonStatusSchema,
  kind: lessonKindSchema,
  // The lesson this makeup replaces, and the makeup given for this lesson.
  originalLessonId: uuidSchema.nullable(),
  /** When the lesson this makeup replaces was, for «за 19 вересня». */
  originalStartsAtUtc: isoDateTimeSchema.nullable(),
  makeupLessonId: uuidSchema.nullable(),
  topic: z.string().nullable(),
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
  // Who came, for a group lesson that has attendance marks; null otherwise.
  // `confirmed`: a person marked or confirmed it — the marks the automation
  // sets when it holds the lesson (everyone present, L-72) are not.
  attendance: z
    .object({
      present: z.number().int().nonnegative(),
      marked: z.number().int().nonnegative(),
      confirmed: z.boolean(),
    })
    .nullable(),
  // What each participant owes for the lesson and what pays for it (L-70);
  // empty until the lesson is held, charged-cancelled or a no-show.
  charges: z.array(lessonChargeResponseSchema),
  // Compact refs for calendar event rendering (avoids request waterfalls).
  student: lessonStudentRefSchema.nullable(),
  group: groupRefSchema.nullable(),
  /** A group lesson: the group's live members now («група · 4 учнів»); null otherwise. */
  groupMembers: z.number().int().nonnegative().nullable(),
  teacher: teacherRefSchema,
  /** What an individual lesson teaches: its teacher's first subject; null for a group. */
  subject: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
});

export type LessonResponse = z.infer<typeof lessonResponseSchema>;

/**
 * One overlap in a 409 SCHEDULE_CONFLICT (`details.conflicts`, L-110): the
 * proposed time, the booked lesson it overlaps, and whether the teacher or a
 * student is double-booked. The caller may repeat the request with
 * `?force=true` to save anyway (L-111).
 */
export const scheduleConflictSchema = z.object({
  candidateStartsAtUtc: isoDateTimeSchema,
  lessonId: uuidSchema,
  startsAtUtc: isoDateTimeSchema,
  durationMin: durationMinSchema,
  /** The booked lesson's kind: a makeup is named so in the conflict. */
  kind: lessonKindSchema,
  reason: z.enum(['TEACHER', 'STUDENT']),
  teacher: z.object({ id: uuidSchema, name: z.string() }),
  student: studentRefSchema.nullable(),
  group: groupRefSchema.nullable(),
  // The students double-booked, when the reason is STUDENT.
  students: z.array(studentRefSchema),
});

export type ScheduleConflict = z.infer<typeof scheduleConflictSchema>;

// The calendar window returns a flat list (already bounded by the query).
export const lessonListResponseSchema = z.object({
  items: z.array(lessonResponseSchema),
});

export type LessonListResponse = z.infer<typeof lessonListResponseSchema>;

/**
 * The Lessons list quick filters (product/scheduling.md, Pages): lessons not
 * paid yet (on debt, or a pay-per-lesson charge payments have not reached),
 * cancelled, no-shows, cancelled or missed individual lessons with no
 * makeup yet, and group lessons of the last 7 days that are over with
 * attendance nobody confirmed (L-72, L-74).
 */
export const lessonQuickFilterSchema = z.enum([
  'unpaid',
  'cancelled',
  'no_show',
  'needs_makeup',
  'unconfirmed',
]);
export type LessonQuickFilterDto = z.infer<typeof lessonQuickFilterSchema>;

/**
 * One or more lesson statuses, as `status=A,B` or a repeated `status`; the
 * list shows lessons in any of them.
 */
export const lessonStatusListSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.split(',') : value),
  z.array(lessonStatusSchema).min(1).max(5),
);

/** The Lessons list: every lesson, paged, newest first by default. */
export const listLessonPageQuerySchema = paginationQuerySchema
  .extend({
    from: isoDateTimeSchema.optional(),
    to: isoDateTimeSchema.optional(),
    teacherId: uuidSchema.optional(),
    studentId: uuidSchema.optional(),
    groupId: uuidSchema.optional(),
    status: lessonStatusListSchema.optional(),
    /** Part of the student's, the group's or the teacher's name. */
    search: z.string().trim().min(1).max(120).optional(),
    filter: lessonQuickFilterSchema.optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict()
  .refine((value) => !value.from || !value.to || new Date(value.to) > new Date(value.from), {
    message: 'to must be after from',
    path: ['to'],
  });

export type ListLessonPageQueryDto = z.infer<typeof listLessonPageQuerySchema>;

export const lessonPageResponseSchema = paginatedResponseSchema(lessonResponseSchema).extend({
  /** How many lessons each quick filter would show with the other filters applied. */
  counts: z.object({
    /** Every lesson the other filters let through, whatever the quick filter. */
    all: z.number().int().nonnegative(),
    unpaid: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
    noShow: z.number().int().nonnegative(),
    needsMakeup: z.number().int().nonnegative(),
    unconfirmed: z.number().int().nonnegative(),
  }),
  /**
   * The package each of the page's package-paid directions uses now: the
   * oldest valid one with a credit left (L-81), else the latest valid one;
   * its credits left and its size («Пакет · 3 з 8»).
   */
  packages: z.array(
    z.object({
      enrollmentId: uuidSchema,
      packageId: uuidSchema,
      left: z.number().int(),
      total: z.number().int().nonnegative(),
    }),
  ),
});

export type LessonPageResponse = z.infer<typeof lessonPageResponseSchema>;

const lessonLinkSchema = z.object({
  id: uuidSchema,
  startsAtUtc: isoDateTimeSchema,
  status: lessonStatusSchema,
});

/**
 * One lesson for the side panel: the lesson itself, the lesson its makeup
 * replaces or the makeup given for it, the schedule it comes from, and its
 * history (newest first).
 */
export const lessonDetailResponseSchema = lessonResponseSchema.extend({
  original: lessonLinkSchema.nullable(),
  makeup: lessonLinkSchema.nullable(),
  schedule: z.object({ id: uuidSchema, state: z.enum(['ACTIVE', 'ENDED']) }).nullable(),
  history: z.array(auditLogResponseSchema),
});

export type LessonDetailResponse = z.infer<typeof lessonDetailResponseSchema>;

export const lessonSeriesResponseSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  // The schedule this row is one weekday (and one version) of.
  scheduleId: uuidSchema,
  enrollmentId: uuidSchema.nullable(),
  groupId: uuidSchema.nullable(),
  teacherId: uuidSchema,
  weekdays: z.array(weekdaySchema),
  localTime: localTimeSchema,
  timezone: z.string(),
  durationMin: durationMinSchema,
  priceMinor: priceMinorSchema,
  currency: currencyCodeSchema,
  startDate: isoDateTimeSchema,
  endsAt: isoDateTimeSchema.nullable(),
  horizonMaterializedUntil: isoDateTimeSchema,
  student: studentRefSchema.nullable(),
  group: groupRefSchema.nullable(),
  teacher: teacherRefSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
});

export type LessonSeriesResponse = z.infer<typeof lessonSeriesResponseSchema>;

export const lessonSeriesListResponseSchema = paginatedResponseSchema(lessonSeriesResponseSchema);

export type LessonSeriesListResponse = z.infer<typeof lessonSeriesListResponseSchema>;

// ---------------------------------------------------------------------------
// Bulk cancel (product/scheduling.md L-54)
// ---------------------------------------------------------------------------

/** The longest period one bulk cancel may cover. */
export const BULK_CANCEL_MAX_DAYS = 366;

/**
 * Cancels every scheduled lesson of one teacher, or of the whole studio, in
 * `[from, to)`: free, cancelled by the teacher, with an optional reason.
 */
export const bulkCancelSchema = z
  .object({
    from: isoDateTimeSchema,
    to: isoDateTimeSchema,
    /** Omitted: every teacher of the studio. */
    teacherId: uuidSchema.optional(),
    reason: notesSchema.nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const span = new Date(value.to).getTime() - new Date(value.from).getTime();
    if (span <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'to must be after from',
        path: ['to'],
      });
    } else if (span > BULK_CANCEL_MAX_DAYS * 24 * 60 * 60 * 1000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `A bulk cancel covers at most ${BULK_CANCEL_MAX_DAYS} days`,
        path: ['to'],
      });
    }
  });

export type BulkCancelDto = z.infer<typeof bulkCancelSchema>;

/** One lesson a bulk cancel would call off. */
const bulkCancelLessonSchema = z.object({
  id: uuidSchema,
  startsAtUtc: isoDateTimeSchema,
  durationMin: durationMinSchema,
  student: studentRefSchema.nullable(),
  group: groupRefSchema.nullable(),
  teacher: teacherRefSchema,
});

/** What a bulk cancel would do; the apply cancels exactly these lessons. */
export const bulkCancelPreviewSchema = z.object({
  count: z.number().int().nonnegative(),
  byTeacher: z.array(z.object({ teacher: teacherRefSchema, count: z.number().int().positive() })),
  /** The lessons, soonest first; at most the first 200. */
  lessons: z.array(bulkCancelLessonSchema),
  truncated: z.boolean(),
});

export type BulkCancelPreview = z.infer<typeof bulkCancelPreviewSchema>;

export const bulkCancelResultSchema = z.object({
  cancelled: z.number().int().nonnegative(),
  lessonIds: z.array(uuidSchema),
});

export type BulkCancelResult = z.infer<typeof bulkCancelResultSchema>;
