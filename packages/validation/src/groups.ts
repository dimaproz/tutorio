import { z } from 'zod';
import {
  isoDateTimeSchema,
  recordStateSchema,
  uuidSchema,
} from './common';
import {
  billingTypeSchema,
  enrollmentStatusSchema,
} from './enrollments';
import { paginatedResponseSchema, paginationQuerySchema } from './pagination';

export const groupNameSchema = z.string().trim().min(1).max(120);

export const groupNotesSchema = z.string().trim().max(2000);

export const createGroupSchema = z
  .object({
    name: groupNameSchema,
    notes: groupNotesSchema.optional(),
  })
  .strict();

export type CreateGroupDto = z.infer<typeof createGroupSchema>;

// PATCH semantics: omitted = unchanged, null = clear the optional field.
export const updateGroupSchema = z
  .object({
    name: groupNameSchema,
    notes: groupNotesSchema.nullable(),
  })
  .partial()
  .strict();

export type UpdateGroupDto = z.infer<typeof updateGroupSchema>;

export const listGroupsQuerySchema = paginationQuerySchema
  .extend({
    search: z.string().trim().min(1).max(120).optional(),
    // deleted/all are OWNER-only (enforced by the service).
    state: recordStateSchema.default('active'),
  })
  .strict();

export type ListGroupsQueryDto = z.infer<typeof listGroupsQuerySchema>;

export const groupResponseSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  name: z.string(),
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
});

export type GroupMemberSummary = z.infer<typeof groupMemberSummarySchema>;

// Lean list row: distinct students in live enrollments, both as a count and
// as a deduped mini roster (for an avatar stack), plus notes for a preview.
export const groupListItemSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  notes: z.string().nullable(),
  deletedAt: isoDateTimeSchema.nullable(),
  activeStudentCount: z.number().int().nonnegative(),
  students: z.array(groupMemberSummarySchema),
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
  teacher: z.object({ id: uuidSchema, name: z.string() }),
});

export type GroupEnrollmentSummary = z.infer<typeof groupEnrollmentSummarySchema>;

export const groupDetailSchema = groupResponseSchema.extend({
  enrollments: z.array(groupEnrollmentSummarySchema),
});

export type GroupDetail = z.infer<typeof groupDetailSchema>;
