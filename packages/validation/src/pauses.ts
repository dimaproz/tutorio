import { z } from 'zod';
import { isoDateTimeSchema, notesSchema, uuidSchema } from './common';
import { paginatedResponseSchema, paginationQuerySchema } from './pagination';

// ---------------------------------------------------------------------------
// Pauses (product/scheduling.md L-100…L-104)
// ---------------------------------------------------------------------------

export const pauseStateSchema = z.enum(['SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED']);
export type PauseStateDto = z.infer<typeof pauseStateSchema>;

/**
 * A pause of the whole student, or of one direction (`enrollmentId`: their
 * lessons with a teacher or their place in a group), from `startsAt` (default
 * now; never earlier) until `endsAt` (exclusive; omitted = until ended).
 */
export const createPauseSchema = z
  .object({
    studentId: uuidSchema,
    enrollmentId: uuidSchema.nullable().optional(),
    startsAt: isoDateTimeSchema.optional(),
    endsAt: isoDateTimeSchema.nullable().optional(),
    reason: notesSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.endsAt == null ||
      value.startsAt == null ||
      new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime(),
    { message: 'endsAt must be after startsAt', path: ['endsAt'] },
  );

export type CreatePauseDto = z.infer<typeof createPauseSchema>;

export const listPausesQuerySchema = paginationQuerySchema
  .extend({
    studentId: uuidSchema.optional(),
    state: z.enum(['current', 'all']).default('current'),
  })
  .strict();

export type ListPausesQueryDto = z.infer<typeof listPausesQuerySchema>;

export const pauseResponseSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  studentId: uuidSchema,
  /** Null: the whole student is paused. */
  enrollmentId: uuidSchema.nullable(),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema.nullable(),
  /** When it actually ended, if it ended or was cancelled. */
  endedAt: isoDateTimeSchema.nullable(),
  state: pauseStateSchema,
  reason: z.string().nullable(),
  /** Individual lessons the pause took out of its window (L-101). */
  removedLessons: z.number().int().nonnegative(),
  /** Packages it pushed later and by how much (L-102). */
  extensions: z.array(
    z.object({ packageId: uuidSchema, extendedBySeconds: z.number().int().nonnegative() }),
  ),
  student: z.object({ id: uuidSchema, fullName: z.string() }),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type PauseResponse = z.infer<typeof pauseResponseSchema>;

export const pauseListResponseSchema = paginatedResponseSchema(pauseResponseSchema);
export type PauseListResponse = z.infer<typeof pauseListResponseSchema>;
