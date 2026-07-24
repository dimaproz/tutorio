import { z } from 'zod';
import {
  avatarKeySchema,
  currencyCodeSchema,
  isoDateTimeSchema,
  notesSchema,
  phoneSchema,
  recordStateSchema,
  uuidSchema,
} from './common';
import { priceMinorSchema } from './enrollments';
import { paginatedResponseSchema, paginationQuerySchema } from './pagination';
import { studentSubjectSchema } from './students';

export const teacherStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);
export type TeacherStatusDto = z.infer<typeof teacherStatusSchema>;

export const teacherFullNameSchema = z.string().trim().min(1).max(120);
export const teacherBioSchema = z.string().trim().max(2000);
const teacherTelegramSchema = z.string().trim().max(64);

// Per-teacher calendar tint, "#RRGGBB".
export const teacherColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a hex color like #465FFF');

// Subjects reuse the shared student-subject catalogue.
export const teacherSubjectsSchema = z.array(studentSubjectSchema).max(30);

export const createTeacherSchema = z
  .object({
    fullName: teacherFullNameSchema,
    email: z.string().trim().email().optional(),
    phone: phoneSchema.optional(),
    telegramUsername: teacherTelegramSchema.optional(),
    subjects: teacherSubjectsSchema.optional(),
    bio: teacherBioSchema.optional(),
    // Default per-lesson rate (minor units) prefilled onto new enrollments.
    defaultRateMinor: priceMinorSchema.optional(),
    currency: currencyCodeSchema.optional(),
    color: teacherColorSchema.optional(),
    avatarKey: avatarKeySchema.optional(),
    status: teacherStatusSchema.default('ACTIVE'),
    // Optional link to a login account (workspace member).
    workspaceMemberId: uuidSchema.optional(),
    notes: notesSchema.optional(),
  })
  .strict();

export type CreateTeacherDto = z.infer<typeof createTeacherSchema>;

// PATCH semantics: omitted = unchanged, null = clear the optional field.
export const updateTeacherSchema = z
  .object({
    fullName: teacherFullNameSchema,
    email: z.string().trim().email().nullable(),
    phone: phoneSchema.nullable(),
    telegramUsername: teacherTelegramSchema.nullable(),
    subjects: teacherSubjectsSchema,
    bio: teacherBioSchema.nullable(),
    defaultRateMinor: priceMinorSchema.nullable(),
    currency: currencyCodeSchema.nullable(),
    color: teacherColorSchema.nullable(),
    avatarKey: avatarKeySchema.nullable(),
    status: teacherStatusSchema,
    workspaceMemberId: uuidSchema.nullable(),
    notes: notesSchema.nullable(),
  })
  .partial()
  .strict();

export type UpdateTeacherDto = z.infer<typeof updateTeacherSchema>;

export const listTeachersQuerySchema = paginationQuerySchema
  .extend({
    search: z.string().trim().min(1).max(120).optional(),
    status: teacherStatusSchema.optional(),
    // deleted/all are OWNER-only (enforced by the service).
    state: recordStateSchema.default('active'),
  })
  .strict();

export type ListTeachersQueryDto = z.infer<typeof listTeachersQuerySchema>;

// Compact reference embedded in enrollment/lesson responses.
export const teacherRefSchema = z.object({
  id: uuidSchema,
  fullName: z.string(),
  color: teacherColorSchema.nullable(),
  avatarKey: avatarKeySchema.nullable(),
});
export type TeacherRef = z.infer<typeof teacherRefSchema>;

export const teacherResponseSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  fullName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  telegramUsername: z.string().nullable(),
  subjects: z.array(studentSubjectSchema),
  bio: z.string().nullable(),
  defaultRateMinor: z.number().int().nonnegative().nullable(),
  currency: currencyCodeSchema.nullable(),
  color: teacherColorSchema.nullable(),
  avatarKey: avatarKeySchema.nullable(),
  status: teacherStatusSchema,
  workspaceMemberId: uuidSchema.nullable(),
  notes: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
});

export type TeacherResponse = z.infer<typeof teacherResponseSchema>;

export const teacherListItemSchema = teacherResponseSchema.extend({
  // Live enrollments taught by this teacher — shown on the list.
  activeEnrollmentCount: z.number().int().nonnegative(),
});

export type TeacherListItem = z.infer<typeof teacherListItemSchema>;

export const teacherListResponseSchema = paginatedResponseSchema(teacherListItemSchema);
export type TeacherListResponse = z.infer<typeof teacherListResponseSchema>;
