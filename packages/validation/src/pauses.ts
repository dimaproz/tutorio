import { z } from 'zod';
import { isoDateTimeSchema, notesSchema, uuidSchema } from './common';
import { paginatedResponseSchema, paginationQuerySchema } from './pagination';
import { scheduleConflictSchema } from './scheduling';

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

/**
 * What a pause would do before it is saved: the same body as the create, and
 * the pause it replaces when the tutor changes one (`replacesPauseId`).
 */
export const pausePreviewSchema = z
  .object({
    studentId: uuidSchema,
    enrollmentId: uuidSchema.nullable().optional(),
    startsAt: isoDateTimeSchema.optional(),
    endsAt: isoDateTimeSchema.nullable().optional(),
    reason: notesSchema.nullable().optional(),
    replacesPauseId: uuidSchema.optional(),
  })
  .strict();

export type PausePreviewDto = z.infer<typeof pausePreviewSchema>;

/** How a pause pushes one package's end (L-102). */
const pauseExtensionPreviewSchema = z.object({
  packageId: uuidSchema,
  name: z.string().nullable(),
  /** The end the package has now. */
  expiresAt: isoDateTimeSchema,
  /** The end it gets. */
  nextExpiresAt: isoDateTimeSchema,
});

export const pausePreviewResponseSchema = z.object({
  /** The window as it would be saved (a start in the past becomes now). */
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema.nullable(),
  /** Per paused direction: its individual lessons taken out, and the group lessons the student misses (L-101). */
  directions: z.array(
    z.object({
      enrollmentId: uuidSchema,
      removedLessons: z.number().int().nonnegative(),
      groupLessons: z.number().int().nonnegative(),
    }),
  ),
  /** Packages pushed later; empty for an open pause, which extends them on return. */
  extensions: z.array(pauseExtensionPreviewSchema),
  /** Whether the student's status becomes "on hold" for the window (a whole-student pause, L-104). */
  holdsStudent: z.boolean(),
});

export type PausePreviewResponse = z.infer<typeof pausePreviewResponseSchema>;

/**
 * Changes a pause: a scheduled one takes a new window, direction and reason;
 * a running one a new end and reason. The old pause ends and the new one
 * starts in one step, so the lessons and packages follow the new window.
 */
export const updatePauseSchema = z
  .object({
    enrollmentId: uuidSchema.nullable().optional(),
    startsAt: isoDateTimeSchema.optional(),
    endsAt: isoDateTimeSchema.nullable().optional(),
    reason: notesSchema.nullable().optional(),
  })
  .strict();

export type UpdatePauseDto = z.infer<typeof updatePauseSchema>;

const booleanQuerySchema = z
  .union([z.boolean(), z.literal('true'), z.literal('false')])
  .transform((value) => value === true || value === 'true');

/**
 * Ending a pause brings its lessons back, checked for overlaps (L-103,
 * L-110): `force` brings them back anyway (L-111); `skipConflicts` brings
 * back only the free ones and leaves the overlapping ones off.
 */
export const pauseEndQuerySchema = z
  .object({
    force: booleanQuerySchema.default(false),
    skipConflicts: booleanQuerySchema.default(false),
  })
  .strict();

export type PauseEndQueryDto = z.infer<typeof pauseEndQuerySchema>;

/** What ending (or cancelling) a pause now would do, before it is done. */
export const pauseEndPreviewResponseSchema = z.object({
  /** END for a running pause, CANCEL for one that has not begun. */
  action: z.enum(['END', 'CANCEL']),
  /** The lessons that come back, oldest first. */
  lessons: z.array(
    z.object({
      startsAtUtc: isoDateTimeSchema,
      durationMin: z.number().int().positive(),
      enrollmentId: uuidSchema.nullable(),
      groupId: uuidSchema.nullable(),
    }),
  ),
  /** Returning lessons whose time is taken since (L-110); `candidateStartsAtUtc` names the lesson. */
  conflicts: z.array(scheduleConflictSchema),
  /** Packages whose extension changes: an early end keeps only what the pause used (L-102). */
  extensions: z.array(pauseExtensionPreviewSchema),
});

export type PauseEndPreviewResponse = z.infer<typeof pauseEndPreviewResponseSchema>;
