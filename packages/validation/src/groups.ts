import { z } from 'zod';
import {
  avatarKeySchema,
  currencyCodeSchema,
  isoDateTimeSchema,
  recordStateSchema,
  sortOrderSchema,
  uuidSchema,
} from './common';
import { billingTypeSchema, enrollmentStatusSchema, priceMinorSchema } from './enrollments';
import { paginatedResponseSchema, paginationQuerySchema } from './pagination';

export const groupNameSchema = z.string().trim().min(1).max(120);

export const groupNotesSchema = z.string().trim().max(2000);

/**
 * The group roster as the UI sees it: the complete set of students plus the
 * teacher who runs them. The server owns the translation into enrollments
 * (create the missing ones, archive the dropped ones) so that saving a group
 * is a single atomic request instead of one call per student.
 */
export const groupStudentsSchema = z
  .object({
    studentIds: z.array(uuidSchema).max(200),
    teacherId: uuidSchema,
  })
  .strict();

export type GroupStudentsDto = z.infer<typeof groupStudentsSchema>;

export const createGroupSchema = z
  .object({
    name: groupNameSchema,
    // Group-level default price/currency; Enrollment.priceMinor overrides it.
    pricePerLesson: priceMinorSchema.optional(),
    currency: currencyCodeSchema.optional(),
    notes: groupNotesSchema.optional(),
    /** Optional initial roster, enrolled in the same transaction. */
    students: groupStudentsSchema.optional(),
  })
  .strict();

export type CreateGroupDto = z.infer<typeof createGroupSchema>;

// PATCH semantics: omitted = unchanged, null = clear the optional field.
// `students` is replace-semantics like the parent link list: the payload is the
// complete roster, and omitting it leaves the enrollments alone.
export const updateGroupSchema = z
  .object({
    name: groupNameSchema,
    pricePerLesson: priceMinorSchema.nullable(),
    currency: currencyCodeSchema.nullable(),
    notes: groupNotesSchema.nullable(),
    students: groupStudentsSchema,
  })
  .partial()
  .strict();

export type UpdateGroupDto = z.infer<typeof updateGroupSchema>;

// A group has no status column: what a tutor calls its state is whether anyone
// is still enrolled, and whether the group was removed. Derived on read so the
// two can never fall out of sync with the enrollments.
export const GROUP_STATUSES = ['ACTIVE', 'EMPTY', 'ARCHIVED'] as const;
export const groupStatusSchema = z.enum(GROUP_STATUSES);
export type GroupStatusDto = z.infer<typeof groupStatusSchema>;

// Relation aggregates are sorted by the list service after it derives them.
export const GROUP_SORT_FIELDS = [
  'name',
  'pricePerLesson',
  'activeStudentCount',
  'schedule',
] as const;
export const groupSortFieldSchema = z.enum(GROUP_SORT_FIELDS);
export type GroupSortField = z.infer<typeof groupSortFieldSchema>;

export const listGroupsQuerySchema = paginationQuerySchema
  .extend({
    search: z.string().trim().min(1).max(120).optional(),
    // deleted/all are OWNER-only (enforced by the service).
    state: recordStateSchema.default('active'),
    // ARCHIVED is expressed through `state`; this narrows the live groups.
    status: z.enum(['ACTIVE', 'EMPTY']).optional(),
    schedule: z.enum(['WITH_SCHEDULE', 'WITHOUT_SCHEDULE']).optional(),
    /** Only groups this student is enrolled in. */
    studentId: uuidSchema.optional(),
    sort: groupSortFieldSchema.default('name'),
    order: sortOrderSchema.default('asc'),
  })
  .strict();

export type ListGroupsQueryDto = z.infer<typeof listGroupsQuerySchema>;

export const groupResponseSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  name: z.string(),
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

// When the group meets: one entry per live recurring pattern.
export const groupScheduleSchema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)),
  /** "HH:mm" in the pattern's own timezone. */
  localTime: z.string(),
  timezone: z.string(),
});

export type GroupSchedule = z.infer<typeof groupScheduleSchema>;

export type GroupMemberSummary = z.infer<typeof groupMemberSummarySchema>;

// Lean list row: distinct students in live enrollments, both as a count and
// as a deduped mini roster (for an avatar stack), plus notes for a preview.
export const groupListItemSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  pricePerLesson: z.number().int().nonnegative().nullable(),
  currency: currencyCodeSchema.nullable(),
  notes: z.string().nullable(),
  deletedAt: isoDateTimeSchema.nullable(),
  status: groupStatusSchema,
  activeStudentCount: z.number().int().nonnegative(),
  students: z.array(groupMemberSummarySchema),
  schedules: z.array(groupScheduleSchema),
});

export type GroupListItem = z.infer<typeof groupListItemSchema>;

export const groupListResponseSchema = paginatedResponseSchema(groupListItemSchema);

export type GroupListResponse = z.infer<typeof groupListResponseSchema>;

// Compact enrollment summary shown on the group page.
export const groupEnrollmentSummarySchema = z.object({
  id: uuidSchema,
  status: enrollmentStatusSchema,
  billingType: billingTypeSchema,
  priceMinor: z.number().int().nonnegative(),
  currency: z.string(),
  student: z.object({ id: uuidSchema, fullName: z.string() }),
  teacher: z.object({ id: uuidSchema, name: z.string(), color: z.string().nullable() }),
});

export type GroupEnrollmentSummary = z.infer<typeof groupEnrollmentSummarySchema>;

export const groupDetailSchema = groupResponseSchema.extend({
  enrollments: z.array(groupEnrollmentSummarySchema),
});

export type GroupDetail = z.infer<typeof groupDetailSchema>;
