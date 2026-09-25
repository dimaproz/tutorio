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
import { scheduleConflictSchema } from './scheduling';

export const teacherStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);
export type TeacherStatusDto = z.infer<typeof teacherStatusSchema>;

export const teacherFullNameSchema = z.string().trim().min(1).max(120);
export const teacherBioSchema = z.string().trim().max(2000);
const teacherTelegramSchema = z.string().trim().max(64);

// Per-teacher calendar tint, "#RRGGBB".
export const teacherColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a hex color like #465FFF');

export const TEACHER_SUBJECTS_MAX = 20;

/** One subject a teacher teaches: free text, the studio's own names. */
export const teacherSubjectSchema = z.string().trim().min(1).max(60);

/**
 * A teacher's subjects. Duplicates that differ only in case collapse to the
 * first spelling, so "english" after "English" is dropped.
 */
export const teacherSubjectsSchema = z
  .array(teacherSubjectSchema)
  .max(TEACHER_SUBJECTS_MAX)
  .transform((subjects) => {
    const seen = new Set<string>();
    return subjects.filter((subject) => {
      const key = subject.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

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

// PATCH semantics: omitted = unchanged, null = clear the optional field;
// `subjects: []` clears the subjects.
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

export const teacherSortSchema = z.enum(['name', 'workload', 'created']);
export type TeacherSortDto = z.infer<typeof teacherSortSchema>;

export const listTeachersQuerySchema = paginationQuerySchema
  .extend({
    /** Part of the name, email, phone, Telegram or a subject. */
    search: z.string().trim().min(1).max(120).optional(),
    status: teacherStatusSchema.optional(),
    /** Teachers who teach this subject (any case). */
    subject: teacherSubjectSchema.optional(),
    /**
     * By name; by this week's lessons, most first; or newest first. The
     * caller's own profile always comes first.
     */
    sort: teacherSortSchema.default('name'),
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
  subjects: z.array(z.string()),
  bio: z.string().nullable(),
  defaultRateMinor: z.number().int().nonnegative().nullable(),
  currency: currencyCodeSchema.nullable(),
  color: teacherColorSchema.nullable(),
  avatarKey: avatarKeySchema.nullable(),
  status: teacherStatusSchema,
  /** When the teacher was archived (or the owner stopped teaching). */
  archivedAt: isoDateTimeSchema.nullable(),
  workspaceMemberId: uuidSchema.nullable(),
  // True when this profile belongs to the caller's own account — the UI
  // labels it instead of offering it as just another teacher.
  isMe: z.boolean(),
  notes: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
});

export type TeacherResponse = z.infer<typeof teacherResponseSchema>;

export const teacherListItemSchema = teacherResponseSchema.extend({
  // Live enrollments taught by this teacher.
  activeEnrollmentCount: z.number().int().nonnegative(),
  /** Distinct students with a live direction or group membership with them. */
  studentCount: z.number().int().nonnegative(),
  /** Live groups the teacher leads. */
  groupCount: z.number().int().nonnegative(),
  /**
   * This studio week's lessons that are not cancelled: the total and per
   * day, Monday first.
   */
  week: z.object({
    lessonCount: z.number().int().nonnegative(),
    days: z.array(z.number().int().nonnegative()).length(7),
  }),
});

export type TeacherListItem = z.infer<typeof teacherListItemSchema>;

export const teacherListResponseSchema = paginatedResponseSchema(teacherListItemSchema).extend({
  /**
   * Live teachers by status, whatever the search. The caller's own profile
   * is never counted or listed as archived: turning your own teaching off is
   * not leaving the studio.
   */
  counts: z.object({
    active: z.number().int().nonnegative(),
    archived: z.number().int().nonnegative(),
    all: z.number().int().nonnegative(),
  }),
  /** The caller's own teaching profile, whatever the filters. */
  me: teacherListItemSchema.nullable(),
});
export type TeacherListResponse = z.infer<typeof teacherListResponseSchema>;

/** The profile's metrics (`GET /teachers/:id/summary`). */
export const teacherSummarySchema = z.object({
  /**
   * Minutes of lessons that are not cancelled in each of the last six studio
   * weeks, oldest first; the last one is this week.
   */
  weeks: z.array(z.object({ weekStart: z.string(), minutes: z.number().int().nonnegative() })),
  students: z.object({
    total: z.number().int().nonnegative(),
    /** Students with an individual direction with the teacher. */
    individual: z.number().int().nonnegative(),
    /** Students in a group the teacher leads. */
    inGroups: z.number().int().nonnegative(),
  }),
  groupCount: z.number().int().nonnegative(),
  /** This studio month. */
  month: z.object({
    /** First day of the month, "yyyy-MM-dd". */
    start: z.string(),
    held: z.number().int().nonnegative(),
    noShows: z.number().int().nonnegative(),
    cancelledByStudents: z.number().int().nonnegative(),
  }),
});
export type TeacherSummary = z.infer<typeof teacherSummarySchema>;

export const teacherStudentsQuerySchema = paginationQuerySchema;
export type TeacherStudentsQueryDto = z.infer<typeof teacherStudentsQuerySchema>;

/** A student as the teacher's profile lists them, by name. */
export const teacherStudentSchema = z.object({
  id: uuidSchema,
  fullName: z.string(),
  avatarKey: avatarKeySchema.nullable(),
  languageLevel: z.string().nullable(),
  subject: z.string().nullable(),
  /** Studies with the teacher one to one. */
  individual: z.boolean(),
  /** The teacher's groups the student attends. */
  groups: z.array(z.object({ id: uuidSchema, name: z.string() })),
});
export type TeacherStudent = z.infer<typeof teacherStudentSchema>;

export const teacherStudentsResponseSchema = paginatedResponseSchema(teacherStudentSchema);
export type TeacherStudentsResponse = z.infer<typeof teacherStudentsResponseSchema>;

/**
 * Archive a teacher, or turn one's own teaching off. `transferTo` hands the
 * future lessons, the active schedules and the groups to another active
 * teacher; without it they stay with the archived teacher.
 */
export const archiveTeacherSchema = z
  .object({ transferTo: uuidSchema.nullable().optional() })
  .strict();
export type ArchiveTeacherDto = z.infer<typeof archiveTeacherSchema>;

/** What archiving changes, before it runs. */
export const teacherArchivePreviewSchema = z.object({
  /** Active schedules taught by the teacher. */
  scheduleCount: z.number().int().nonnegative(),
  /** Future scheduled lessons taught by the teacher. */
  futureLessonCount: z.number().int().nonnegative(),
  lastLessonAt: isoDateTimeSchema.nullable(),
  /** Distinct students in those lessons. */
  studentCount: z.number().int().nonnegative(),
  /** Groups the teacher leads. */
  groups: z.array(z.object({ id: uuidSchema, name: z.string() })),
  /** The new teacher's overlaps with the handed-over lessons (L-110). */
  conflicts: z.array(scheduleConflictSchema),
});
export type TeacherArchivePreview = z.infer<typeof teacherArchivePreviewSchema>;
