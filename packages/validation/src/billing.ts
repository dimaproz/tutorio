import { z } from 'zod';
import { currencyCodeSchema, isoDateTimeSchema, uuidSchema } from './common';
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
  student: z.object({ id: uuidSchema, fullName: z.string() }),
});

export type LessonChargeResponse = z.infer<typeof lessonChargeResponseSchema>;

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
      remainingCredits: z.number().int(),
      /** Valid now: not archived and not expired. */
      usable: z.boolean(),
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
  }),
});

export type EnrollmentBillingResponse = z.infer<typeof enrollmentBillingResponseSchema>;
