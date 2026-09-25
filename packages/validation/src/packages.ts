import { z } from 'zod';
import {
  currencyCodeSchema,
  isoDateTimeSchema,
  notesSchema,
  recordStateSchema,
  uuidSchema,
} from './common';
import { priceMinorSchema } from './enrollments';
import { paginatedResponseSchema, paginationQuerySchema } from './pagination';
import { durationMinSchema, localTimeSchema, weekdaySchema } from './scheduling';

// ---------------------------------------------------------------------------
// Shared package primitives
// ---------------------------------------------------------------------------

// By count; by period sized by the direction's schedule; by period sized as
// X lessons a week (L-80).
export const packageSizingModeSchema = z.enum(['FIXED_COUNT', 'BY_PERIOD', 'BY_PERIOD_WEEKLY']);
export type PackageSizingModeDto = z.infer<typeof packageSizingModeSchema>;

export const packagePaymentStatusSchema = z.enum(['PENDING', 'PARTIAL', 'PAID']);
export type PackagePaymentStatusDto = z.infer<typeof packagePaymentStatusSchema>;

// How a package's credits move: granted by the purchase, corrected by hand,
// moved to another direction, refunded, or used by a lesson it pays for (one
// credit per charge, ADR 0007).
export const creditEntryTypeSchema = z.enum([
  'purchase',
  'manual_adjustment',
  'transfer_out',
  'transfer_in',
  'refund',
  'lesson',
]);
export type CreditEntryTypeDto = z.infer<typeof creditEntryTypeSchema>;

// CARD is reserved for online acquiring; the MVP records the first three.
export const paymentMethodSchema = z.enum(['CASH', 'BANK_TRANSFER', 'OTHER', 'CARD']);
export type PaymentMethodDto = z.infer<typeof paymentMethodSchema>;

/**
 * The methods a tutor can pick when recording money by hand. `CARD` is excluded
 * because only a payment provider may set it.
 */
export const PAYMENT_METHODS_MANUAL = [
  'CASH',
  'BANK_TRANSFER',
  'OTHER',
] as const satisfies readonly PaymentMethodDto[];

// A manually recorded payment is PAID immediately; an online one starts
// PENDING until the provider confirms it.
export const paymentStatusSchema = z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']);
export type PaymentStatusDto = z.infer<typeof paymentStatusSchema>;

// A package holds at least one lesson; the ceiling keeps a typo from
// materializing thousands of slots.
export const lessonsTotalSchema = z.number().int().min(1).max(500);

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

// The optional recurring schedule that a package can provision: this is what
// actually creates the LessonSeries (and therefore the lessons) behind it.
export const packageScheduleSchema = z
  .object({
    slots: z
      .array(
        z
          .object({
            weekday: weekdaySchema,
            localTime: localTimeSchema,
          })
          .strict(),
      )
      .min(1)
      .max(7)
      .superRefine((slots, ctx) => {
        const weekdays = new Set<number>();
        slots.forEach((slot, index) => {
          if (weekdays.has(slot.weekday)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Each weekday can only have one package slot',
              path: [index, 'weekday'],
            });
          }
          weekdays.add(slot.weekday);
        });
      }),
    timezone: z.string().min(1),
    durationMin: durationMinSchema,
    startDate: isoDateTimeSchema,
  })
  .strict();

export type PackageScheduleDto = z.infer<typeof packageScheduleSchema>;

export const initialPackagePaymentSchema = z
  .object({
    amountMinor: priceMinorSchema.refine((value) => value > 0, {
      message: 'An initial payment must be greater than zero',
    }),
    paidAt: isoDateTimeSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Date(value.paidAt).getTime() > Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Payment date cannot be in the future',
        path: ['paidAt'],
      });
    }
  });

export type InitialPackagePaymentDto = z.infer<typeof initialPackagePaymentSchema>;

/** Lessons a week in a flexible period package. */
export const lessonsPerWeekSchema = z.number().int().min(1).max(14);

/**
 * What is sold (L-80): the kind, its credits and window, and its price — per
 * lesson or a total. FIXED_COUNT states `lessonsTotal` (optional
 * `expiresAt`); BY_PERIOD states `validFrom`/`endDate` and takes its credits
 * from the direction's schedule unless `lessonsTotal` overrides them;
 * BY_PERIOD_WEEKLY adds `lessonsPerWeek`.
 */
const packageSpecShape = {
  name: z.string().trim().min(1).max(120).nullable().optional(),
  sizingMode: packageSizingModeSchema.default('FIXED_COUNT'),
  lessonsTotal: lessonsTotalSchema.optional(),
  lessonsPerWeek: lessonsPerWeekSchema.optional(),
  /** A period package's first day; defaults to the purchase date. */
  validFrom: isoDateTimeSchema.optional(),
  /** A period package's last instant, inclusive. */
  endDate: isoDateTimeSchema.optional(),
  pricePerLessonMinor: priceMinorSchema.optional(),
  /** Or the price of the whole package. */
  totalPriceMinor: priceMinorSchema.optional(),
  currency: currencyCodeSchema,
  purchasedAt: isoDateTimeSchema.optional(),
  expiresAt: isoDateTimeSchema.nullable().optional(),
  notes: notesSchema.nullable().optional(),
};

type PackageSpec = {
  sizingMode: 'FIXED_COUNT' | 'BY_PERIOD' | 'BY_PERIOD_WEEKLY';
  lessonsTotal?: number;
  lessonsPerWeek?: number;
  validFrom?: string;
  endDate?: string;
  pricePerLessonMinor?: number;
  totalPriceMinor?: number;
  purchasedAt?: string;
  expiresAt?: string | null;
};

function refinePackageSpec(value: PackageSpec, ctx: z.RefinementCtx): void {
  if ((value.pricePerLessonMinor == null) === (value.totalPriceMinor == null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide exactly one of pricePerLessonMinor or totalPriceMinor',
      path: ['pricePerLessonMinor'],
    });
  }
  if (value.sizingMode === 'FIXED_COUNT') {
    if (value.lessonsTotal == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'lessonsTotal is required for a fixed-count package',
        path: ['lessonsTotal'],
      });
    }
  } else {
    if (value.endDate == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endDate is required for a by-period package',
        path: ['endDate'],
      });
    }
    if (
      value.endDate != null &&
      value.validFrom != null &&
      new Date(value.endDate).getTime() < new Date(value.validFrom).getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endDate must not be before validFrom',
        path: ['endDate'],
      });
    }
  }
  if (
    value.sizingMode === 'BY_PERIOD_WEEKLY' &&
    value.lessonsPerWeek == null &&
    value.lessonsTotal == null
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'lessonsPerWeek is required for a weekly package',
      path: ['lessonsPerWeek'],
    });
  }
  if (
    value.expiresAt != null &&
    new Date(value.expiresAt).getTime() <= new Date(value.purchasedAt ?? new Date()).getTime()
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'expiresAt must be after purchasedAt',
      path: ['expiresAt'],
    });
  }
}

/**
 * Buying a package for one direction of a student (L-80): their lessons with
 * one teacher (`teacherId`, needed only when they have several), or their
 * membership of a group (`groupId`). `schedule` and `initialPayment` serve
 * the current package form only; a sale never creates a schedule or records a
 * payment by itself in the new sale flow (L-87).
 */
export const createPackageSchema = z
  .object({
    studentId: uuidSchema,
    groupId: uuidSchema.nullable().optional(),
    teacherId: uuidSchema.nullable().optional(),
    ...packageSpecShape,
    schedule: packageScheduleSchema.nullable().optional(),
    initialPayment: initialPackagePaymentSchema.nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.groupId != null && value.teacherId != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A group package is taught by the group teacher',
        path: ['teacherId'],
      });
    }
    refinePackageSpec(value, ctx);
  });

export type CreatePackageDto = z.infer<typeof createPackageSchema>;

/** Tutor's own correction. Never edits history — appends a signed entry. */
export const adjustBalanceSchema = z
  .object({
    delta: z
      .number()
      .int()
      .min(-500)
      .max(500)
      .refine((value) => value !== 0, {
        message: 'delta must not be zero',
      }),
    note: notesSchema,
  })
  .strict();

export type AdjustBalanceDto = z.infer<typeof adjustBalanceSchema>;

/** What a sale would be, before it is made (L-80 "prefilled, editable"). */
export const packagePreviewResponseSchema = z.object({
  lessonsTotal: z.number().int().positive(),
  pricePerLessonMinor: z.number().int().nonnegative(),
  totalPriceMinor: z.number().int().nonnegative(),
  validFrom: isoDateTimeSchema.nullable(),
  expiresAt: isoDateTimeSchema.nullable(),
  /** Lessons the direction's schedule has in the window; null without one. */
  scheduleLessons: z.number().int().nonnegative().nullable(),
});

export type PackagePreviewResponse = z.infer<typeof packagePreviewResponseSchema>;

/** A later end for a package, so it pays again (L-84). */
export const extendPackageSchema = z.object({ expiresAt: isoDateTimeSchema }).strict();

export type ExtendPackageDto = z.infer<typeof extendPackageSchema>;

/**
 * Moves unused credits to another direction of the same student, recalculated
 * by price and rounded down (L-85). Omitted `credits`: every unused one.
 */
export const transferPackageSchema = z
  .object({
    toEnrollmentId: uuidSchema,
    credits: lessonsTotalSchema.optional(),
    note: notesSchema.nullable().optional(),
  })
  .strict();

export type TransferPackageDto = z.infer<typeof transferPackageSchema>;

/**
 * Takes unused credits back and records the money returned (L-85). Either may
 * be zero, not both.
 */
export const refundPackageSchema = z
  .object({
    credits: z.number().int().min(0).max(500),
    amountMinor: priceMinorSchema,
    method: paymentMethodSchema.default('CASH'),
    paidAt: isoDateTimeSchema.optional(),
    note: notesSchema,
  })
  .strict()
  .refine((value) => value.credits > 0 || value.amountMinor > 0, {
    message: 'A refund returns credits, money or both',
    path: ['credits'],
  });

export type RefundPackageDto = z.infer<typeof refundPackageSchema>;

/** One package spec sold to each selected member of a group (L-86). */
export const sellToMembersSchema = z
  .object({
    groupId: uuidSchema,
    studentIds: z
      .array(uuidSchema)
      .min(1)
      .max(200)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'Each student is sold one package',
      }),
    ...packageSpecShape,
  })
  .strict()
  .superRefine(refinePackageSpec);

export type SellToMembersDto = z.infer<typeof sellToMembersSchema>;

export const recordPaymentSchema = z
  .object({
    enrollmentId: uuidSchema,
    packageId: uuidSchema.nullable().optional(),
    amountMinor: priceMinorSchema.refine((value) => value > 0, {
      message: 'A payment must be greater than zero',
    }),
    currency: currencyCodeSchema,
    method: paymentMethodSchema.default('CASH'),
    paidAt: isoDateTimeSchema.optional(),
    note: notesSchema.nullable().optional(),
    // Replays of the same command return the original payment instead of
    // recording money twice. A changed command under the same key is rejected.
    idempotencyKey: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

export type RecordPaymentDto = z.infer<typeof recordPaymentSchema>;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const listPackagesQuerySchema = paginationQuerySchema
  .extend({
    studentId: uuidSchema.optional(),
    groupId: uuidSchema.optional(),
    paymentStatus: packagePaymentStatusSchema.optional(),
    state: recordStateSchema.default('active'),
  })
  .strict();

export type ListPackagesQueryDto = z.infer<typeof listPackagesQuerySchema>;

export const listPaymentsQuerySchema = paginationQuerySchema
  .extend({
    enrollmentId: uuidSchema.optional(),
    packageId: uuidSchema.optional(),
    studentId: uuidSchema.optional(),
  })
  .strict();

export type ListPaymentsQueryDto = z.infer<typeof listPaymentsQuerySchema>;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

const studentRefSchema = z.object({ id: uuidSchema, fullName: z.string() });
const groupRefSchema = z.object({ id: uuidSchema, name: z.string() });

export const creditEntryResponseSchema = z.object({
  id: uuidSchema,
  packageId: uuidSchema,
  // The lesson a `lesson` entry paid for.
  lessonId: uuidSchema.nullable(),
  delta: z.number().int(),
  type: creditEntryTypeSchema,
  note: z.string().nullable(),
  createdAt: isoDateTimeSchema,
});

export type CreditEntryResponse = z.infer<typeof creditEntryResponseSchema>;

export const packageResponseSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  // The direction the credits pay for, its student and (for a group
  // membership) its group.
  enrollmentId: uuidSchema,
  studentId: uuidSchema,
  groupId: uuidSchema.nullable(),
  name: z.string().nullable(),
  sizingMode: packageSizingModeSchema,
  lessonsTotal: z.number().int(),
  endDate: isoDateTimeSchema.nullable(),
  pricePerLessonMinorSnapshot: z.number().int(),
  totalPriceMinorSnapshot: z.number().int(),
  lessonsPerWeek: z.number().int().nullable(),
  /** A period package's first instant; null for a count package. */
  validFrom: isoDateTimeSchema.nullable(),
  /** The package these credits were transferred from, if any. */
  transferredFromPackageId: uuidSchema.nullable(),
  // Derived at read time: granted credits minus the lessons it pays for.
  remainingCredits: z.number().int(),
  consumedCredits: z.number().int(),
  // Money received net of refunds, and the refunds.
  paidMinor: z.number().int(),
  refundedMinor: z.number().int().nonnegative(),
  currency: currencyCodeSchema,
  paymentStatus: packagePaymentStatusSchema,
  purchasedAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema.nullable(),
  notes: z.string().nullable(),
  student: studentRefSchema,
  group: groupRefSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
});

export type PackageResponse = z.infer<typeof packageResponseSchema>;

export const packageListResponseSchema = paginatedResponseSchema(packageResponseSchema);
export type PackageListResponse = z.infer<typeof packageListResponseSchema>;

export const packageTransferResponseSchema = z.object({
  source: packageResponseSchema,
  target: packageResponseSchema,
  /** The moved credits' value at the source price. */
  valueMinor: z.number().int().nonnegative(),
  /** What rounding down left over (L-85). */
  remainderMinor: z.number().int().nonnegative(),
});

export type PackageTransferResponse = z.infer<typeof packageTransferResponseSchema>;

export const soldPackagesResponseSchema = z.object({ items: z.array(packageResponseSchema) });
export type SoldPackagesResponse = z.infer<typeof soldPackagesResponseSchema>;

export const creditLedgerResponseSchema = z.object({
  items: z.array(creditEntryResponseSchema),
  balance: z.number().int(),
});
export type CreditLedgerResponse = z.infer<typeof creditLedgerResponseSchema>;

export const paymentResponseSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  enrollmentId: uuidSchema,
  packageId: uuidSchema.nullable(),
  amountMinor: z.number().int(),
  currency: currencyCodeSchema,
  method: paymentMethodSchema,
  status: paymentStatusSchema,
  // Which PaymentProvider settled this — "manual" until acquiring ships.
  provider: z.string(),
  externalId: z.string().nullable(),
  paidAt: isoDateTimeSchema,
  note: z.string().nullable(),
  student: studentRefSchema,
  /**
   * In a payment list: how many lessons this pay-per-lesson payment settled
   * in full, oldest first (L-90). Null for a package payment, a refund, or
   * outside a list.
   */
  settledLessons: z.number().int().nonnegative().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type PaymentResponse = z.infer<typeof paymentResponseSchema>;

export const paymentListResponseSchema = paginatedResponseSchema(paymentResponseSchema);
export type PaymentListResponse = z.infer<typeof paymentListResponseSchema>;
