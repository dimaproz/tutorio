import { z } from 'zod';
import { emailSchema } from './auth';
import {
  isoDateTimeSchema,
  phoneSchema,
  recordStateSchema,
  timezoneSchema,
  uuidSchema,
} from './common';
import { enrollmentStatusSchema, billingTypeSchema } from './enrollments';
import { paginatedResponseSchema, paginationQuerySchema } from './pagination';

export const studentFullNameSchema = z.string().trim().min(1).max(120);

export const personNameSchema = z.string().trim().min(1).max(120);

export const studentNotesSchema = z.string().trim().max(4000);

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
    parentName: optionalField(personNameSchema),
    parentEmail: optionalField(emailSchema),
    parentPhone: optionalField(phoneSchema),
    notes: optionalField(studentNotesSchema),
  })
  .strict();

export type CreateStudentDto = z.infer<typeof createStudentSchema>;

// PATCH semantics: omitted = unchanged, null = clear the optional field.
export const updateStudentSchema = z
  .object({
    fullName: studentFullNameSchema,
    email: emailSchema.nullable(),
    phone: phoneSchema.nullable(),
    timezone: timezoneSchema,
    parentName: personNameSchema.nullable(),
    parentEmail: emailSchema.nullable(),
    parentPhone: phoneSchema.nullable(),
    notes: studentNotesSchema.nullable(),
  })
  .partial()
  .strict();

export type UpdateStudentDto = z.infer<typeof updateStudentSchema>;

export const listStudentsQuerySchema = paginationQuerySchema
  .extend({
    search: z.string().trim().min(1).max(120).optional(),
    // deleted/all are OWNER-only (enforced by the service).
    state: recordStateSchema.default('active'),
  })
  .strict();

export type ListStudentsQueryDto = z.infer<typeof listStudentsQuerySchema>;

export const studentResponseSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  fullName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  timezone: z.string(),
  parentName: z.string().nullable(),
  parentEmail: z.string().nullable(),
  parentPhone: z.string().nullable(),
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
  timezone: z.string(),
  deletedAt: isoDateTimeSchema.nullable(),
  activeEnrollmentCount: z.number().int().nonnegative(),
  groupNames: z.array(z.string()),
});

export type StudentListItem = z.infer<typeof studentListItemSchema>;

export const studentListResponseSchema = paginatedResponseSchema(studentListItemSchema);

export type StudentListResponse = z.infer<typeof studentListResponseSchema>;

// Compact enrollment summary shown on the student profile.
export const studentEnrollmentSummarySchema = z.object({
  id: uuidSchema,
  status: enrollmentStatusSchema,
  billingType: billingTypeSchema,
  priceMinor: z.number().int().nonnegative(),
  currency: z.string(),
  cancellationDeadlineHours: z.number().int().nonnegative().nullable(),
  effectiveCancellationDeadlineHours: z.number().int().nonnegative(),
  group: z.object({ id: uuidSchema, name: z.string() }).nullable(),
  teacher: z.object({ id: uuidSchema, name: z.string() }),
});

export type StudentEnrollmentSummary = z.infer<typeof studentEnrollmentSummarySchema>;

export const studentDetailSchema = studentResponseSchema.extend({
  enrollments: z.array(studentEnrollmentSummarySchema),
});

export type StudentDetail = z.infer<typeof studentDetailSchema>;
