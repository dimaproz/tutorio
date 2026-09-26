import { ATTENTION_KINDS } from '@tutorio/domain';
import { z } from 'zod';
import { avatarKeySchema, currencyCodeSchema, isoDateTimeSchema, uuidSchema } from './common';
import { creditWarningSchema } from './billing';
import { cancelledBySchema, lessonStatusSchema } from './scheduling';

// ---------------------------------------------------------------------------
// The owner's Today dashboard (S11). Each block has its own read so one slow
// or failing block never holds the page: the money, the exceptions to act on
// and the first-run checklist. The day and tomorrow are `GET /lessons`.
// ---------------------------------------------------------------------------

/** «Мої»: only the exceptions of one teacher's lessons, students and groups. */
export const dashboardAttentionQuerySchema = z
  .object({
    teacherId: uuidSchema.optional(),
  })
  .strict();

export type DashboardAttentionQueryDto = z.infer<typeof dashboardAttentionQuerySchema>;

export const attentionKindSchema = z.enum(ATTENTION_KINDS);
export type AttentionKindDto = z.infer<typeof attentionKindSchema>;

const personRefSchema = z.object({
  id: uuidSchema,
  fullName: z.string(),
  avatarKey: avatarKeySchema.nullable(),
});

/**
 * One row of a category. Every row names its student or group; the rest is
 * what its category needs:
 * - attendance and makeups: the lesson;
 * - debtors: the debt in one currency;
 * - unpaid, ending and expiring packages: the package (ending: the direction's
 *   credits and warning, the package being null with no valid one);
 * - pauses: the pause and why it needs a look.
 */
export const attentionItemSchema = z.object({
  /** Stable row key within its category. */
  id: z.string(),
  student: personRefSchema.nullable(),
  group: z.object({ id: uuidSchema, name: z.string() }).nullable(),
  teacher: z.object({ id: uuidSchema, name: z.string(), color: z.string().nullable() }).nullable(),
  enrollmentId: uuidSchema.nullable(),
  lesson: z
    .object({
      id: uuidSchema,
      startsAtUtc: isoDateTimeSchema,
      status: lessonStatusSchema,
      cancelledBy: cancelledBySchema.nullable(),
    })
    .nullable(),
  debt: z
    .object({
      amountMinor: z.number().int().nonnegative(),
      currency: currencyCodeSchema,
      lessons: z.number().int().nonnegative(),
    })
    .nullable(),
  package: z
    .object({
      id: uuidSchema,
      name: z.string().nullable(),
      currency: currencyCodeSchema,
      totalMinor: z.number().int().nonnegative(),
      paidMinor: z.number().int(),
      remainingCredits: z.number().int(),
      expiresAt: isoDateTimeSchema.nullable(),
    })
    .nullable(),
  credits: z
    .object({
      left: z.number().int(),
      warning: creditWarningSchema,
    })
    .nullable(),
  pause: z
    .object({
      id: uuidSchema,
      startsAt: isoDateTimeSchema,
      endsAt: isoDateTimeSchema.nullable(),
      reason: z.enum(['RETURNING', 'OPEN_LONG']),
    })
    .nullable(),
});

export type AttentionItem = z.infer<typeof attentionItemSchema>;

export const attentionCategorySchema = z.object({
  kind: attentionKindSchema,
  count: z.number().int().nonnegative(),
  /** The most urgent rows, up to three. */
  items: z.array(attentionItemSchema).max(3),
  /** The collapsed summary: the first two names, each once. */
  names: z.array(z.string()).max(2),
});

export type AttentionCategory = z.infer<typeof attentionCategorySchema>;

/** «Потребує уваги»: every category in its fixed order, empty ones included. */
export const dashboardAttentionResponseSchema = z.object({
  teacherId: uuidSchema.nullable(),
  total: z.number().int().nonnegative(),
  categories: z.array(attentionCategorySchema),
});

export type DashboardAttentionResponse = z.infer<typeof dashboardAttentionResponseSchema>;

/**
 * «Гроші за місяць», always the whole studio, one row per currency and never
 * summed across currencies. The studio's default currency is always listed.
 */
export const dashboardMoneyResponseSchema = z.object({
  /** The studio month the figures cover, as its first day "yyyy-MM-dd". */
  month: z.string(),
  currencies: z.array(
    z.object({
      currency: currencyCodeSchema,
      /** Received this month on the studio's clock, refunds taken off. */
      receivedMonthMinor: z.number().int(),
      receivedTodayMinor: z.number().int(),
      /** Owed now: pay-per-lesson debt and lessons held on debt (L-82, L-90). */
      debtMinor: z.number().int().nonnegative(),
      debtors: z.number().int().nonnegative(),
      /** Expected within 7 days: renewals and the unpaid rest of sold packages; approximate. */
      dueMinor: z.number().int().nonnegative(),
      duePackages: z.number().int().nonnegative(),
    }),
  ),
});

export type DashboardMoneyResponse = z.infer<typeof dashboardMoneyResponseSchema>;

/** The first-run checklist: each step ticks itself from the data. */
export const dashboardSetupResponseSchema = z.object({
  /** Studio mode only; done when a colleague teaches. Null in tutor mode. */
  teacher: z.boolean().nullable(),
  student: z.boolean(),
  schedule: z.boolean(),
  sale: z.boolean(),
});

export type DashboardSetupResponse = z.infer<typeof dashboardSetupResponseSchema>;
