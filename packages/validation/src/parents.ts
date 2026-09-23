import { z } from 'zod';
import { emailSchema } from './auth';
import {
  avatarKeySchema,
  isoDateTimeSchema,
  notesSchema,
  phoneSchema,
  recordStateSchema,
  sortOrderSchema,
  uuidSchema,
} from './common';
import { paginatedResponseSchema, paginationQuerySchema } from './pagination';

export const parentFullNameSchema = z.string().trim().min(1).max(120);

export const telegramUsernameSchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^@?\w{2,32}$/, 'Invalid Telegram username');

const studentIdsSchema = z.array(uuidSchema).max(20);

// HTML forms submit empty strings for untouched optional inputs; the API
// treats them as "not provided".
const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

function optionalField<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(emptyToUndefined, schema.optional());
}

export const createParentSchema = z
  .object({
    fullName: parentFullNameSchema,
    email: optionalField(emailSchema),
    phone: optionalField(phoneSchema),
    telegramUsername: optionalField(telegramUsernameSchema),
    avatarKey: optionalField(avatarKeySchema),
    studentIds: studentIdsSchema.optional(),
    notes: optionalField(notesSchema),
  })
  .strict();

export type CreateParentDto = z.infer<typeof createParentSchema>;

// PATCH semantics: omitted = unchanged, null = clear the optional field.
export const updateParentSchema = z
  .object({
    fullName: parentFullNameSchema,
    email: emailSchema.nullable(),
    phone: phoneSchema.nullable(),
    telegramUsername: telegramUsernameSchema.nullable(),
    avatarKey: avatarKeySchema.nullable(),
    studentIds: studentIdsSchema,
    notes: notesSchema.nullable(),
  })
  .partial()
  .strict();

export type UpdateParentDto = z.infer<typeof updateParentSchema>;

// Scalar columns only, so the database orders the whole collection.
export const PARENT_SORT_FIELDS = ['fullName', 'createdAt'] as const;
export const parentSortFieldSchema = z.enum(PARENT_SORT_FIELDS);
export type ParentSortField = z.infer<typeof parentSortFieldSchema>;

// `none` keeps only parents with no live linked student.
export const parentLinkFilterSchema = z.enum(['any', 'none']);
export type ParentLinkFilter = z.infer<typeof parentLinkFilterSchema>;

export const listParentsQuerySchema = paginationQuerySchema
  .extend({
    search: z.string().trim().min(1).max(120).optional(),
    // deleted/all are OWNER-only (enforced by the service).
    state: recordStateSchema.default('active'),
    // Filter to parents linked to a specific student.
    studentId: uuidSchema.optional(),
    linked: parentLinkFilterSchema.default('any'),
    // Sorting is server-side so it applies to every page, not just one.
    sort: parentSortFieldSchema.default('fullName'),
    order: sortOrderSchema.default('asc'),
  })
  .strict();

export type ListParentsQueryDto = z.infer<typeof listParentsQuerySchema>;

export const parentResponseSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  fullName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  telegramUsername: z.string().nullable(),
  avatarKey: avatarKeySchema.nullable(),
  notes: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
});

export type ParentResponse = z.infer<typeof parentResponseSchema>;

// Compact reference shown on the student form/detail and the parent's own
// student roster — avoids a request waterfall in either direction.
export const parentStudentRefSchema = z.object({
  id: uuidSchema,
  fullName: z.string(),
  avatarKey: avatarKeySchema.nullable(),
  status: z.enum(['ACTIVE', 'ON_HOLD', 'ARCHIVED']),
  // CEFR level, the second line of a student row on the parent's side.
  languageLevel: z.string().nullable(),
});

export type ParentStudentRef = z.infer<typeof parentStudentRefSchema>;

// Lean list row: enough for cards/table without extra requests.
export const parentListItemSchema = z.object({
  id: uuidSchema,
  fullName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  telegramUsername: z.string().nullable(),
  avatarKey: avatarKeySchema.nullable(),
  deletedAt: isoDateTimeSchema.nullable(),
  students: z.array(parentStudentRefSchema),
});

export type ParentListItem = z.infer<typeof parentListItemSchema>;

export const parentListResponseSchema = paginatedResponseSchema(parentListItemSchema);

export type ParentListResponse = z.infer<typeof parentListResponseSchema>;

export const parentDetailSchema = parentResponseSchema.extend({
  students: z.array(parentStudentRefSchema),
});

export type ParentDetail = z.infer<typeof parentDetailSchema>;
