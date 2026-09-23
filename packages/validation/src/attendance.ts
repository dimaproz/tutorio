import { z } from 'zod';
import { avatarKeySchema, isoDateTimeSchema, uuidSchema } from './common';
import { lessonStatusSchema } from './scheduling';

// Whether one participant was at one lesson. EXCUSED is an absence the tutor
// accepted; it is neither a presence nor a miss in any rate.
export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'EXCUSED'] as const;
export const attendanceStatusSchema = z.enum(ATTENDANCE_STATUSES);
export type AttendanceStatusDto = z.infer<typeof attendanceStatusSchema>;

/**
 * Marks for one lesson. Each entry sets (or replaces) one participant's mark;
 * participants left out keep whatever they had.
 */
export const setLessonAttendanceSchema = z
  .object({
    marks: z
      .array(z.object({ enrollmentId: uuidSchema, status: attendanceStatusSchema }).strict())
      .min(1)
      .max(200)
      .refine((marks) => new Set(marks.map((mark) => mark.enrollmentId)).size === marks.length, {
        message: 'Each participant can be marked once',
      }),
  })
  .strict();

export type SetLessonAttendanceDto = z.infer<typeof setLessonAttendanceSchema>;

const participantStudentSchema = z.object({
  id: uuidSchema,
  fullName: z.string(),
  avatarKey: avatarKeySchema.nullable(),
});

/** Who a lesson is for, and the mark each of them has so far. */
export const lessonAttendanceResponseSchema = z.object({
  lessonId: uuidSchema,
  startsAtUtc: isoDateTimeSchema,
  status: lessonStatusSchema,
  /** Marks are accepted only once a lesson has started and was not cancelled. */
  markable: z.boolean(),
  participants: z.array(
    z.object({
      enrollmentId: uuidSchema,
      student: participantStudentSchema,
      status: attendanceStatusSchema.nullable(),
      markedAt: isoDateTimeSchema.nullable(),
    }),
  ),
});

export type LessonAttendanceResponse = z.infer<typeof lessonAttendanceResponseSchema>;

export const ATTENDANCE_WINDOW_MAX = 24;

export const groupAttendanceQuerySchema = z
  .object({
    window: z.coerce.number().int().min(1).max(ATTENDANCE_WINDOW_MAX).default(8),
  })
  .strict();

export type GroupAttendanceQueryDto = z.infer<typeof groupAttendanceQuerySchema>;

export const attendanceCellSchema = z.enum([
  'present',
  'absent',
  'excused',
  'cancelled',
  'unmarked',
]);
export type AttendanceCellDto = z.infer<typeof attendanceCellSchema>;

const rateSchema = z.number().min(0).max(1).nullable();

/**
 * A group's attendance over its last `window` held lessons: the tiles and one
 * row per participant, worst first. Cancelled lessons are nobody's miss;
 * participants on hold stay out of the group figures.
 */
export const groupAttendanceResponseSchema = z.object({
  window: z.number().int().positive(),
  lessons: z.array(
    z.object({ id: uuidSchema, startsAtUtc: isoDateTimeSchema, status: lessonStatusSchema }),
  ),
  stats: z.object({
    lessons: z.number().int().nonnegative(),
    held: z.number().int().nonnegative(),
    rate: rateSchema,
    previousRate: rateSchema,
    misses: z.number().int().nonnegative(),
    expected: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
    cancelledCharged: z.number().int().nonnegative(),
    cancelledFree: z.number().int().nonnegative(),
  }),
  rows: z.array(
    z.object({
      enrollmentId: uuidSchema,
      student: participantStudentSchema,
      cells: z.array(attendanceCellSchema),
      rate: rateSchema,
      misses: z.number().int().nonnegative(),
      trailingMisses: z.number().int().nonnegative(),
      lastPresentAt: isoDateTimeSchema.nullable(),
      hold: z.boolean(),
      risk: z.boolean(),
    }),
  ),
});

export type GroupAttendanceResponse = z.infer<typeof groupAttendanceResponseSchema>;
