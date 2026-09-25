import { z } from 'zod';
import { avatarKeySchema, currencyCodeSchema, isoDateTimeSchema, uuidSchema } from './common';
import { billingTypeSchema } from './enrollments';

// ---------------------------------------------------------------------------
// Charges and direction billing (product/scheduling.md L-10, L-70, L-81, L-82,
// L-90; ADR 0007)
// ---------------------------------------------------------------------------

/** What pays for one participant's lesson. */
export const chargeSourceSchema = z.enum(['PACKAGE', 'DEBT', 'BALANCE']);
export type ChargeSourceDto = z.infer<typeof chargeSourceSchema>;

/** One participant's cost for one lesson. */
export const lessonChargeResponseSchema = z.object({
  id: uuidSchema,
  enrollmentId: uuidSchema,
  source: chargeSourceSchema,
  /** The package paying one credit, when the source is PACKAGE. */
  packageId: uuidSchema.nullable(),
  amountMinor: z.number().int().nonnegative(),
  currency: currencyCodeSchema,
  /**
   * Whether it is paid: a package credit is; a lesson on debt is not; a
   * pay-per-lesson charge is once payments reach it, oldest first (L-90).
   */
  paid: z.boolean(),
  student: z.object({ id: uuidSchema, fullName: z.string() }),
});

export type LessonChargeResponse = z.infer<typeof lessonChargeResponseSchema>;

/** Why a direction paid by packages needs attention (L-82). */
export const creditWarningSchema = z.enum(['ON_DEBT', 'NO_CREDITS', 'LOW_CREDITS']);
export type CreditWarningDto = z.infer<typeof creditWarningSchema>;

/** "Nearly used up" means this many credits left or fewer (L-120); 0 turns it off. */
export const lowCreditThresholdSchema = z.number().int().min(0).max(50);

/**
 * How one direction is paid now: its mode and rate, the credits its packages
 * have left, the lessons held on debt, and the pay-per-lesson balance
 * ("Debt: 1 200 ₴ · 3 lessons").
 */
export const enrollmentBillingResponseSchema = z.object({
  enrollmentId: uuidSchema,
  billingType: billingTypeSchema,
  rateMinor: z.number().int().nonnegative(),
  currency: currencyCodeSchema,
  packages: z.array(
    z.object({
      id: uuidSchema,
      name: z.string().nullable(),
      purchasedAt: isoDateTimeSchema,
      expiresAt: isoDateTimeSchema.nullable(),
      /** A period package's first day; null for a count package. */
      validFrom: isoDateTimeSchema.nullable(),
      /** Credits it was sold with. */
      lessonsTotal: z.number().int(),
      remainingCredits: z.number().int(),
      /** Valid now: not archived and not expired. */
      usable: z.boolean(),
      /** What the whole package costs (L-80), and what has been paid for it. */
      totalPriceMinor: z.number().int().nonnegative(),
      paidMinor: z.number().int().nonnegative(),
      // The package payment status (`packagePaymentStatusSchema`); spelled out
      // here because the packages module imports this one.
      paymentStatus: z.enum(['PENDING', 'PARTIAL', 'PAID']),
    }),
  ),
  /** Credits left on the usable packages. */
  creditsLeft: z.number().int(),
  /** Lessons held in package mode with no credit to pay for them (L-82). */
  debtLessons: z.number().int().nonnegative(),
  /** Pay-per-lesson money (L-90); lessons charged while in package mode are not in it. */
  balance: z.object({
    chargedMinor: z.number().int().nonnegative(),
    paidMinor: z.number().int().nonnegative(),
    debtMinor: z.number().int().nonnegative(),
    advanceMinor: z.number().int().nonnegative(),
    unpaidLessons: z.number().int().nonnegative(),
    /**
     * The lessons not (fully) paid yet, oldest first: what a payment settles
     * next (L-90), and what is still owed for each.
     */
    unpaid: z.array(
      z.object({
        lessonId: uuidSchema,
        startsAt: isoDateTimeSchema,
        outstandingMinor: z.number().int().positive(),
      }),
    ),
  }),
  /** The credit warning it shows, if any (L-82). */
  warning: creditWarningSchema.nullable(),
});

export type EnrollmentBillingResponse = z.infer<typeof enrollmentBillingResponseSchema>;

const refSchema = z.object({ id: uuidSchema, name: z.string() });

/**
 * Every direction of one student with how it is paid, for the student
 * profile: its teacher or group, and per currency what is owed and paid
 * ahead ("Debt: 1 200 ₴ · 3 lessons").
 */
export const studentBillingResponseSchema = z.object({
  studentId: uuidSchema,
  lowCreditThreshold: lowCreditThresholdSchema,
  /** The studio's free-cancellation window, for directions that follow it (L-10). */
  cancellationDeadlineHours: z.number().int().nonnegative(),
  directions: z.array(
    enrollmentBillingResponseSchema.extend({
      status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']),
      /** The teacher, with what they teach: an individual direction is named by its subject. */
      teacher: refSchema.extend({
        avatarKey: avatarKeySchema.nullable(),
        subjects: z.array(z.string()),
      }),
      group: refSchema.nullable(),
      /** The direction's own free-cancellation window; null follows the studio. */
      cancellationDeadlineHours: z.number().int().nonnegative().nullable(),
    }),
  ),
  totals: z.array(
    z.object({
      currency: currencyCodeSchema,
      debtMinor: z.number().int().nonnegative(),
      advanceMinor: z.number().int().nonnegative(),
      /** Pay-per-lesson lessons not paid yet. */
      unpaidLessons: z.number().int().nonnegative(),
      /** Package lessons held with no credit (L-82). */
      debtLessons: z.number().int().nonnegative(),
      creditsLeft: z.number().int().nonnegative(),
    }),
  ),
});

export type StudentBillingResponse = z.infer<typeof studentBillingResponseSchema>;

/** A pause now or later: from when, and until when (null: until ended). */
export const memberPauseSchema = z.object({
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema.nullable(),
});

export type MemberPauseResponse = z.infer<typeof memberPauseSchema>;

/**
 * How every live member of a group pays the group (S08 «Склад групи»): the
 * direction's billing as `GET /enrollments/:id/billing` reads it, and the
 * member's pause now or next (L-73) — one read for the whole roster.
 */
export const groupBillingResponseSchema = z.object({
  groupId: uuidSchema,
  lowCreditThreshold: lowCreditThresholdSchema,
  members: z.array(
    enrollmentBillingResponseSchema.extend({
      studentId: uuidSchema,
      /** The member's own or whole-student pause covering now, else the next one. */
      pause: memberPauseSchema.nullable(),
    }),
  ),
});

export type GroupBillingResponse = z.infer<typeof groupBillingResponseSchema>;

/** Every live direction of the studio that shows a credit warning (L-82). */
export const creditWarningListResponseSchema = z.object({
  lowCreditThreshold: lowCreditThresholdSchema,
  items: z.array(
    z.object({
      enrollmentId: uuidSchema,
      warning: creditWarningSchema,
      creditsLeft: z.number().int().nonnegative(),
      debtLessons: z.number().int().nonnegative(),
      student: z.object({ id: uuidSchema, fullName: z.string() }),
      teacher: refSchema,
      group: refSchema.nullable(),
    }),
  ),
});

export type CreditWarningListResponse = z.infer<typeof creditWarningListResponseSchema>;
