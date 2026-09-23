import { z } from 'zod';
import {
  avatarKeySchema,
  currencyCodeSchema,
  isoDateTimeSchema,
  recordStateSchema,
  sortOrderSchema,
  studentLanguageLevelSchema,
  uuidSchema,
} from './common';
import { billingTypeSchema, enrollmentStatusSchema, priceMinorSchema } from './enrollments';
import { paginatedResponseSchema, paginationQuerySchema } from './pagination';
import {
  durationMinSchema,
  lessonStatusSchema,
  localTimeSchema,
  weekdaysSchema,
} from './scheduling';

export const groupNameSchema = z.string().trim().min(1).max(120);

export const groupNotesSchema = z.string().trim().max(2000);

/** Seats in a group. Informational: a full group never refuses a student. */
export const GROUP_CAPACITY_MAX = 500;
export const groupCapacitySchema = z.number().int().min(1).max(GROUP_CAPACITY_MAX);

/**
 * The group roster as the UI sees it: the complete set of students. The
 * server owns the translation into enrollments (create the missing ones,
 * remove the dropped ones) so that saving a group is a single atomic request
 * instead of one call per student. `teacherId` is optional: new enrollments
 * default to the group's own teacher.
 */
export const groupStudentsSchema = z
  .object({
    studentIds: z.array(uuidSchema).max(200),
    teacherId: uuidSchema.optional(),
  })
  .strict();

export type GroupStudentsDto = z.infer<typeof groupStudentsSchema>;

/**
 * The recurring schedule a group is created with: weekdays and a wall-clock
 * start in the workspace timezone. The server turns it into a lesson series
 * owned by the group's teacher, priced at the group price, starting today.
 */
export const groupScheduleInputSchema = z
  .object({
    weekdays: weekdaysSchema,
    localTime: localTimeSchema,
    durationMin: durationMinSchema,
  })
  .strict();

export type GroupScheduleInputDto = z.infer<typeof groupScheduleInputSchema>;

export const createGroupSchema = z
  .object({
    name: groupNameSchema,
    /** The teacher who runs the group; SOLO workspaces may omit it. */
    teacherId: uuidSchema.optional(),
    capacity: groupCapacitySchema.optional(),
    // Group-level default price/currency; Enrollment.priceMinor overrides it.
    pricePerLesson: priceMinorSchema.optional(),
    currency: currencyCodeSchema.optional(),
    notes: groupNotesSchema.optional(),
    /** Optional initial roster, enrolled in the same transaction. */
    students: groupStudentsSchema.optional(),
    /** Optional recurring schedule, created in the same transaction. */
    schedule: groupScheduleInputSchema.optional(),
  })
  .strict();

export type CreateGroupDto = z.infer<typeof createGroupSchema>;

// PATCH semantics: omitted = unchanged, null = clear the optional field.
// `students` is replace-semantics like the parent link list: the payload is the
// complete roster, and omitting it leaves the enrollments alone. `schedule`
// only creates the first schedule of a group that has none; an existing
// schedule changes through the recurring-pattern screen, which says how many
// booked lessons it rebuilds.
export const updateGroupSchema = z
  .object({
    name: groupNameSchema,
    teacherId: uuidSchema,
    capacity: groupCapacitySchema.nullable(),
    pricePerLesson: priceMinorSchema.nullable(),
    currency: currencyCodeSchema.nullable(),
    notes: groupNotesSchema.nullable(),
    students: groupStudentsSchema,
    schedule: groupScheduleInputSchema,
  })
  .partial()
  .strict();

export type UpdateGroupDto = z.infer<typeof updateGroupSchema>;

// A group has no stored lifecycle status. Its user-facing status is derived
// from its live roster; archive remains a separate record state (`deletedAt`).
export const GROUP_STATUSES = ['ACTIVE', 'EMPTY'] as const;
export const groupStatusSchema = z.enum(GROUP_STATUSES);
export type GroupStatusDto = z.infer<typeof groupStatusSchema>;

// `name`, `pricePerLesson` and `createdAt` sort in the database; the two
// relation aggregates are sorted by the service after it derives them.
export const GROUP_SORT_FIELDS = [
  'name',
  'pricePerLesson',
  'activeStudentCount',
  'schedule',
  'createdAt',
] as const;
export const groupSortFieldSchema = z.enum(GROUP_SORT_FIELDS);
export type GroupSortField = z.infer<typeof groupSortFieldSchema>;

export const listGroupsQuerySchema = paginationQuerySchema
  .extend({
    search: z.string().trim().min(1).max(120).optional(),
    // deleted/all are OWNER-only (enforced by the service).
    state: recordStateSchema.default('active'),
    // Archive is expressed through `state`; this narrows the live groups.
    status: groupStatusSchema.optional(),
    /** Only groups this student is enrolled in. */
    studentId: uuidSchema.optional(),
    /** Only groups run by this teacher. */
    teacherId: uuidSchema.optional(),
    /** Only groups that meet on this weekday (0 = Sunday … 6 = Saturday). */
    weekday: z.coerce.number().int().min(0).max(6).optional(),
    /** `unpaid`: groups whose live package still has money outstanding. */
    payment: z.enum(['unpaid']).optional(),
    sort: groupSortFieldSchema.default('name'),
    order: sortOrderSchema.default('asc'),
  })
  .strict();

export type ListGroupsQueryDto = z.infer<typeof listGroupsQuerySchema>;

export const groupResponseSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  name: z.string(),
  teacherId: uuidSchema.nullable(),
  capacity: z.number().int().positive().nullable(),
  pricePerLesson: z.number().int().nonnegative().nullable(),
  currency: currencyCodeSchema.nullable(),
  notes: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
});

export type GroupResponse = z.infer<typeof groupResponseSchema>;

// Mirrors groupEnrollmentSummarySchema.student — a bare id+name reference.
export const groupMemberSummarySchema = z.object({
  id: uuidSchema,
  fullName: z.string(),
  avatarKey: avatarKeySchema.nullable(),
});

export type GroupMemberSummary = z.infer<typeof groupMemberSummarySchema>;

// When the group meets: one entry per live recurring pattern.
export const groupScheduleSchema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)),
  /** "HH:mm" in the pattern's own timezone. */
  localTime: z.string(),
  durationMin: z.number().int().positive(),
  timezone: z.string(),
});

export type GroupSchedule = z.infer<typeof groupScheduleSchema>;

export const groupTeacherRefSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  avatarKey: avatarKeySchema.nullable(),
  color: z.string().nullable(),
});

export type GroupTeacherRef = z.infer<typeof groupTeacherRefSchema>;

export const groupNextLessonRefSchema = z.object({
  id: uuidSchema,
  startsAtUtc: isoDateTimeSchema,
  durationMin: z.number().int().positive(),
});

// Lean list row: distinct students in live enrollments, both as a count and
// as a deduped mini roster (for an avatar stack), the schedule, the next
// scheduled lesson and whether money is outstanding on the live package.
export const groupListItemSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  teacher: groupTeacherRefSchema.nullable(),
  capacity: z.number().int().positive().nullable(),
  pricePerLesson: z.number().int().nonnegative().nullable(),
  currency: currencyCodeSchema.nullable(),
  notes: z.string().nullable(),
  deletedAt: isoDateTimeSchema.nullable(),
  status: groupStatusSchema,
  activeStudentCount: z.number().int().nonnegative(),
  students: z.array(groupMemberSummarySchema),
  schedules: z.array(groupScheduleSchema),
  nextLesson: groupNextLessonRefSchema.nullable(),
  paymentDue: z.boolean(),
});

export type GroupListItem = z.infer<typeof groupListItemSchema>;

export const groupListResponseSchema = paginatedResponseSchema(groupListItemSchema);

export type GroupListResponse = z.infer<typeof groupListResponseSchema>;

/** A group picker option: just enough to name the group. */
export const groupOptionSchema = z.object({ id: uuidSchema, name: z.string() });
export const groupOptionsResponseSchema = z.object({ items: z.array(groupOptionSchema) });
export type GroupOptionsResponse = z.infer<typeof groupOptionsResponseSchema>;

/**
 * The collection headline in one read: the tab counts, the four metrics and
 * the week they were counted in (workspace timezone, Monday to Sunday).
 */
export const groupSummaryResponseSchema = z.object({
  /** Live groups. */
  total: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  empty: z.number().int().nonnegative(),
  archived: z.number().int().nonnegative(),
  /** Distinct students with a live membership in a live group. */
  studentsInGroups: z.number().int().nonnegative(),
  /** Students of the workspace who are not archived. */
  studioStudents: z.number().int().nonnegative(),
  /** Free seats across the groups that set a capacity; null when none do. */
  freeSeats: z.number().int().nonnegative().nullable(),
  /** Group lessons planned or taught this week, and today. */
  lessonsThisWeek: z.number().int().nonnegative(),
  lessonsToday: z.number().int().nonnegative(),
  /** Live groups whose live package still has money outstanding. */
  unpaidGroups: z.number().int().nonnegative(),
  weekStart: isoDateTimeSchema,
  weekEnd: isoDateTimeSchema,
});

export type GroupSummaryResponse = z.infer<typeof groupSummaryResponseSchema>;

// A roster row on the group page.
export const groupEnrollmentSummarySchema = z.object({
  id: uuidSchema,
  studentId: uuidSchema,
  groupId: uuidSchema,
  teacherId: uuidSchema,
  status: enrollmentStatusSchema,
  billingType: billingTypeSchema,
  priceMinor: z.number().int().nonnegative(),
  currency: currencyCodeSchema,
  cancellationDeadlineHours: z.number().int().nonnegative().nullable(),
  student: z.object({
    id: uuidSchema,
    fullName: z.string(),
    avatarKey: avatarKeySchema.nullable(),
    status: z.enum(['ACTIVE', 'ON_HOLD', 'ARCHIVED']),
    languageLevel: studentLanguageLevelSchema.nullable(),
  }),
  teacher: z.object({ id: uuidSchema, name: z.string(), color: z.string().nullable() }),
});

export type GroupEnrollmentSummary = z.infer<typeof groupEnrollmentSummarySchema>;

/** A live recurring pattern of the group, as the page's schedule card shows it. */
export const groupSeriesSummarySchema = groupScheduleSchema.extend({ id: uuidSchema });

export type GroupSeriesSummary = z.infer<typeof groupSeriesSummarySchema>;

export const groupDetailSchema = groupResponseSchema.extend({
  status: groupStatusSchema,
  /** The group's teacher, else the most common teacher of its roster. */
  teacher: groupTeacherRefSchema.nullable(),
  /** Some roster enrollments are taught by another teacher (legacy data). */
  teacherMismatch: z.boolean(),
  enrollments: z.array(groupEnrollmentSummarySchema),
  schedules: z.array(groupSeriesSummarySchema),
  nextLesson: groupNextLessonRefSchema
    .extend({ notes: z.string().nullable(), status: lessonStatusSchema })
    .nullable(),
  /** All-time counts of the group's lessons. */
  lessonCounts: z.object({
    completed: z.number().int().nonnegative(),
    upcoming: z.number().int().nonnegative(),
  }),
});

export type GroupDetail = z.infer<typeof groupDetailSchema>;
