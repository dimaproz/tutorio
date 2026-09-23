import { z } from 'zod';
import { emailSchema } from './auth';
import {
  avatarKeySchema,
  currencyCodeSchema,
  isoDateTimeSchema,
  phoneSchema,
  recordStateSchema,
  sortOrderSchema,
  timezoneSchema,
  uuidSchema,
  studentLanguageLevelSchema,
} from './common';
import { enrollmentResponseSchema, priceMinorSchema } from './enrollments';
import { paginatedResponseSchema, paginationQuerySchema } from './pagination';
import { telegramUsernameSchema } from './parents';

export const studentFullNameSchema = z.string().trim().min(1).max(120);

export const personNameSchema = z.string().trim().min(1).max(120);

export const studentNotesSchema = z.string().trim().max(4000);

export const studentStatusSchema = z.enum(['ACTIVE', 'ON_HOLD', 'ARCHIVED']);
export type StudentStatusDto = z.infer<typeof studentStatusSchema>;
const studentOperationalStatusSchema = z.enum(['ACTIVE', 'ON_HOLD']);

export const STUDENT_KNOWLEDGE_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
export const studentKnowledgeLevelSchema = z.enum(STUDENT_KNOWLEDGE_LEVELS);
export type StudentKnowledgeLevelDto = z.infer<typeof studentKnowledgeLevelSchema>;

export const studentAgeSchema = z.number().int().min(0).max(120);

// Ukrainian school system: grades 1-12 (inclusive of vocational years).
export const studentGradeSchema = z.number().int().min(1).max(12);

// Reasonable cap: a student rarely has more than a couple of guardians.
const parentIdsSchema = z.array(uuidSchema).max(20);

// HTML forms submit empty strings for untouched optional inputs; the API
// treats them as "not provided".
const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

function optionalField<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(emptyToUndefined, schema.optional());
}

export const createStudentSchema = z
  .object({
    fullName: studentFullNameSchema,
    email: optionalField(emailSchema),
    phone: optionalField(phoneSchema),
    timezone: timezoneSchema,
    telegramUsername: optionalField(telegramUsernameSchema),
    hourlyRateMinor: priceMinorSchema.optional(),
    currency: optionalField(currencyCodeSchema),
    // A new student has no archive operation to restore. ARCHIVED is reached
    // only through the dedicated archive command.
    status: studentOperationalStatusSchema.default('ACTIVE'),
    languageLevel: optionalField(studentLanguageLevelSchema),
    knowledgeLevel: optionalField(studentKnowledgeLevelSchema),
    age: studentAgeSchema.optional(),
    grade: studentGradeSchema.optional(),
    avatarKey: optionalField(avatarKeySchema),
    // Existing parents to link at creation time; omitted/empty = none yet.
    parentIds: parentIdsSchema.optional(),
    notes: optionalField(studentNotesSchema),
  })
  .strict();

export type CreateStudentDto = z.infer<typeof createStudentSchema>;

// PATCH semantics: omitted = unchanged, null = clear the optional field.
// parentIds has no "clear via null" — pass [] to unlink every parent.
export const updateStudentSchema = z
  .object({
    fullName: studentFullNameSchema,
    email: emailSchema.nullable(),
    phone: phoneSchema.nullable(),
    timezone: timezoneSchema,
    telegramUsername: telegramUsernameSchema.nullable(),
    hourlyRateMinor: priceMinorSchema.nullable(),
    currency: currencyCodeSchema.nullable(),
    // Archive has additional scheduling side effects, so it has a dedicated
    // lifecycle command rather than being a generic profile PATCH.
    status: studentOperationalStatusSchema,
    languageLevel: studentLanguageLevelSchema.nullable(),
    knowledgeLevel: studentKnowledgeLevelSchema.nullable(),
    age: studentAgeSchema.nullable(),
    grade: studentGradeSchema.nullable(),
    avatarKey: avatarKeySchema.nullable(),
    parentIds: parentIdsSchema,
    notes: studentNotesSchema.nullable(),
  })
  .partial()
  .strict();

export type UpdateStudentDto = z.infer<typeof updateStudentSchema>;

// Columns the list can be sorted by. Scalar student fields only: relation
// aggregates (group names, enrollment counts) are computed per row and cannot
// be ordered by the database without changing the query shape.
export const STUDENT_SORT_FIELDS = ['fullName', 'status', 'createdAt'] as const;
export const studentSortFieldSchema = z.enum(STUDENT_SORT_FIELDS);
export type StudentSortField = z.infer<typeof studentSortFieldSchema>;

export const listStudentsQuerySchema = paginationQuerySchema
  .extend({
    search: z.string().trim().min(1).max(120).optional(),
    // Students are archived (status ARCHIVED), never soft-deleted, so for
    // students `state` selects by status. deleted/all are OWNER-only
    // (enforced by the service).
    state: recordStateSchema
      .default('active')
      .describe(
        'active = every student that is not ARCHIVED; deleted = ARCHIVED ' +
          'students; all = every status. An explicit `status` wins over `state`.',
      ),
    // Optional facet filters, combined with AND.
    status: studentStatusSchema.optional(),
    // Students with a live membership: ACTIVE or PAUSED enrollment in a group
    // that is not archived.
    groupId: uuidSchema.optional(),
    // Sorting is server-side so it applies to the whole collection, not just
    // the page the client happens to hold.
    sort: studentSortFieldSchema.default('fullName'),
    order: sortOrderSchema.default('asc'),
  })
  .strict();

export type ListStudentsQueryDto = z.infer<typeof listStudentsQuerySchema>;

// Compact parent reference shown on the student form/detail — avoids a
// request waterfall to load full parent records. Carries enough contact detail
// for the shared ParentMiniCard to look identical in the form and on the page.
export const studentParentRefSchema = z.object({
  id: uuidSchema,
  fullName: z.string(),
  avatarKey: avatarKeySchema.nullable(),
  phone: z.string().nullable(),
  telegramUsername: z.string().nullable(),
});

export type StudentParentRef = z.infer<typeof studentParentRefSchema>;

export const studentResponseSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  fullName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  timezone: z.string(),
  telegramUsername: z.string().nullable(),
  hourlyRateMinor: z.number().int().nonnegative().nullable(),
  currency: currencyCodeSchema.nullable(),
  status: studentStatusSchema,
  languageLevel: studentLanguageLevelSchema.nullable(),
  knowledgeLevel: studentKnowledgeLevelSchema.nullable(),
  age: z.number().int().nonnegative().nullable(),
  grade: z.number().int().nonnegative().nullable(),
  avatarKey: avatarKeySchema.nullable(),
  parents: z.array(studentParentRefSchema),
  notes: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
});

export type StudentResponse = z.infer<typeof studentResponseSchema>;

// Lean list row: enough for cards/table without extra requests.
export const studentListItemSchema = z.object({
  id: uuidSchema,
  fullName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  telegramUsername: z.string().nullable(),
  timezone: z.string(),
  status: studentStatusSchema,
  hourlyRateMinor: z.number().int().nonnegative().nullable(),
  currency: currencyCodeSchema.nullable(),
  avatarKey: avatarKeySchema.nullable(),
  createdAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
  activeEnrollmentCount: z.number().int().nonnegative(),
  groupNames: z.array(z.string()),
});

export type StudentListItem = z.infer<typeof studentListItemSchema>;

export const studentListResponseSchema = paginatedResponseSchema(studentListItemSchema);

export type StudentListResponse = z.infer<typeof studentListResponseSchema>;

// Enrollment shown on the student profile. It is the full enrollment
// response, so the profile can open the enrollment editor without fetching
// each enrollment again.
export const studentEnrollmentSummarySchema = enrollmentResponseSchema;

export type StudentEnrollmentSummary = z.infer<typeof studentEnrollmentSummarySchema>;

export const studentDetailSchema = studentResponseSchema.extend({
  enrollments: z.array(studentEnrollmentSummarySchema),
});

export type StudentDetail = z.infer<typeof studentDetailSchema>;

// Tab and header counts for the students collection, from one grouped query.
// `all` counts every student that is not ARCHIVED (the default list state).
export const studentsSummarySchema = z.object({
  all: z.number().int().nonnegative(),
  ACTIVE: z.number().int().nonnegative(),
  ON_HOLD: z.number().int().nonnegative(),
  ARCHIVED: z.number().int().nonnegative(),
});

export type StudentsSummary = z.infer<typeof studentsSummarySchema>;
