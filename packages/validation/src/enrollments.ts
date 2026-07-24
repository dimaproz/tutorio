import { z } from 'zod';
import {
  cancellationDeadlineHoursSchema,
  currencyCodeSchema,
  isoDateTimeSchema,
  recordStateSchema,
  uuidSchema,
} from './common';
import { paginatedResponseSchema, paginationQuerySchema } from './pagination';

export const enrollmentStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']);
export type EnrollmentStatusDto = z.infer<typeof enrollmentStatusSchema>;

export const billingTypeSchema = z.enum(['PACKAGE', 'MONTHLY', 'PER_LESSON']);
export type BillingTypeDto = z.infer<typeof billingTypeSchema>;

// PostgreSQL Int maximum — priceMinor is stored in an INTEGER column.
export const PRICE_MINOR_MAX = 2_147_483_647;

// The web form shows major units and converts to minor units on the client
// (@tutorio/domain decimalStringToMinorUnits); the API accepts integers only.
export const priceMinorSchema = z.number().int().min(0).max(PRICE_MINOR_MAX);

export const createEnrollmentSchema = z
  .object({
    studentId: uuidSchema,
    // null/omitted = individual (student + teacher) enrollment.
    groupId: uuidSchema.nullable().optional(),
    teacherId: uuidSchema,
    billingType: billingTypeSchema.default('PACKAGE'),
    priceMinor: priceMinorSchema,
    currency: currencyCodeSchema,
    // null/omitted = inherit the workspace default.
    cancellationDeadlineHours: cancellationDeadlineHoursSchema.nullable().optional(),
  })
  .strict();

export type CreateEnrollmentDto = z.infer<typeof createEnrollmentSchema>;

// PATCH semantics: omitted = unchanged, null = revert to the workspace default.
// Student/group/teacher are immutable — re-enroll instead of repointing money.
export const updateEnrollmentSchema = z
  .object({
    status: enrollmentStatusSchema,
    billingType: billingTypeSchema,
    priceMinor: priceMinorSchema,
    currency: currencyCodeSchema,
    cancellationDeadlineHours: cancellationDeadlineHoursSchema.nullable(),
  })
  .partial()
  .strict();

export type UpdateEnrollmentDto = z.infer<typeof updateEnrollmentSchema>;

export const listEnrollmentsQuerySchema = paginationQuerySchema
  .extend({
    studentId: uuidSchema.optional(),
    groupId: uuidSchema.optional(),
    teacherId: uuidSchema.optional(),
    status: enrollmentStatusSchema.optional(),
    // deleted/all are OWNER-only (enforced by the service).
    state: recordStateSchema.default('active'),
  })
  .strict();

export type ListEnrollmentsQueryDto = z.infer<typeof listEnrollmentsQuerySchema>;

// Compact nested representations prevent request waterfalls in the UI.
export const enrollmentStudentRefSchema = z.object({
  id: uuidSchema,
  fullName: z.string(),
});

export const enrollmentGroupRefSchema = z.object({
  id: uuidSchema,
  name: z.string(),
});

// Teacher is its own entity now (not the login member); the ref carries the
// display name plus optional calendar color.
export const enrollmentTeacherRefSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  color: z.string().nullable(),
});

export const enrollmentResponseSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  studentId: uuidSchema,
  groupId: uuidSchema.nullable(),
  teacherId: uuidSchema,
  student: enrollmentStudentRefSchema,
  group: enrollmentGroupRefSchema.nullable(),
  teacher: enrollmentTeacherRefSchema,
  status: enrollmentStatusSchema,
  billingType: billingTypeSchema,
  priceMinor: priceMinorSchema,
  currency: currencyCodeSchema,
  cancellationDeadlineHours: z.number().int().nonnegative().nullable(),
  // Resolved against the CURRENT workspace default when no override is set.
  effectiveCancellationDeadlineHours: z.number().int().nonnegative(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
});

export type EnrollmentResponse = z.infer<typeof enrollmentResponseSchema>;

export const enrollmentListResponseSchema = paginatedResponseSchema(enrollmentResponseSchema);

export type EnrollmentListResponse = z.infer<typeof enrollmentListResponseSchema>;
