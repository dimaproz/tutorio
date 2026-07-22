import { z } from 'zod';
import { isoDateTimeSchema, notesSchema, phoneSchema, recordStateSchema, uuidSchema } from './common';
import { paginatedResponseSchema, paginationQuerySchema } from './pagination';

export const parentFullNameSchema = z.string().trim().min(1).max(120);

export const telegramUsernameSchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^@?\w{2,32}$/, 'Invalid Telegram username');

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
    phone: optionalField(phoneSchema),
    telegramUsername: optionalField(telegramUsernameSchema),
    notes: optionalField(notesSchema),
  })
  .strict();

export type CreateParentDto = z.infer<typeof createParentSchema>;

// PATCH semantics: omitted = unchanged, null = clear the optional field.
export const updateParentSchema = z
  .object({
    fullName: parentFullNameSchema,
    phone: phoneSchema.nullable(),
    telegramUsername: telegramUsernameSchema.nullable(),
    notes: notesSchema.nullable(),
  })
  .partial()
  .strict();

export type UpdateParentDto = z.infer<typeof updateParentSchema>;

export const listParentsQuerySchema = paginationQuerySchema
  .extend({
    search: z.string().trim().min(1).max(120).optional(),
    // deleted/all are OWNER-only (enforced by the service).
    state: recordStateSchema.default('active'),
  })
  .strict();

export type ListParentsQueryDto = z.infer<typeof listParentsQuerySchema>;

export const parentResponseSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  fullName: z.string(),
  phone: z.string().nullable(),
  telegramUsername: z.string().nullable(),
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
});

export type ParentStudentRef = z.infer<typeof parentStudentRefSchema>;

// Lean list row: enough for cards/table without extra requests.
export const parentListItemSchema = z.object({
  id: uuidSchema,
  fullName: z.string(),
  phone: z.string().nullable(),
  telegramUsername: z.string().nullable(),
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
