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

export const packageSizingModeSchema = z.enum(['FIXED_COUNT', 'BY_PERIOD']);
export type PackageSizingModeDto = z.infer<typeof packageSizingModeSchema>;

export const packagePaymentStatusSchema = z.enum(['PENDING', 'PARTIAL', 'PAID']);
export type PackagePaymentStatusDto = z.infer<typeof packagePaymentStatusSchema>;

// Mirrors the domain LedgerEntryType; the ledger is append-only, so these are
// the only ways a balance can ever move.
export const creditEntryTypeSchema = z.enum([
  'purchase',
  'lesson_completed',
  'late_cancellation',
  'teacher_cancellation_refund',
  'manual_adjustment',
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

/**
 * Buying a package. Exactly one target (student or group). FIXED_COUNT states
 * `lessonsTotal`; BY_PERIOD states `endDate` and needs a schedule to know how
 * many lessons fit in the window.
 */
export const createPackageSchema = z
  .object({
    studentId: uuidSchema.nullable().optional(),
    groupId: uuidSchema.nullable().optional(),
    name: z.string().trim().min(1).max(120).nullable().optional(),
    sizingMode: packageSizingModeSchema.default('FIXED_COUNT'),
    lessonsTotal: lessonsTotalSchema.optional(),
    endDate: isoDateTimeSchema.optional(),
    pricePerLessonMinor: priceMinorSchema,
    currency: currencyCodeSchema,
    purchasedAt: isoDateTimeSchema.optional(),
    expiresAt: isoDateTimeSchema.nullable().optional(),
    notes: notesSchema.nullable().optional(),
    // Provisioning the schedule is what turns a package into real lessons.
    schedule: packageScheduleSchema.nullable().optional(),
    initialPayment: initialPackagePaymentSchema.nullable().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasStudent = value.studentId != null;
    const hasGroup = value.groupId != null;
    if (hasStudent === hasGroup) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide exactly one of studentId or groupId',
        path: ['studentId'],
      });
    }
    if (value.sizingMode === 'FIXED_COUNT' && value.lessonsTotal == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'lessonsTotal is required for a fixed-count package',
        path: ['lessonsTotal'],
      });
    }
    if (value.sizingMode === 'BY_PERIOD') {
      if (value.endDate == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'endDate is required for a by-period package',
          path: ['endDate'],
        });
      }
      if (value.schedule == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A by-period package needs a schedule to size itself',
          path: ['schedule'],
        });
      }
    }
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
  enrollmentId: uuidSchema.nullable(),
  lessonId: uuidSchema.nullable(),
  delta: z.number().int(),
  type: creditEntryTypeSchema,
  note: z.string().nullable(),
  createdAt: isoDateTimeSchema,
});

export type CreditEntryResponse = z.infer<typeof creditEntryResponseSchema>;

export const participantShareResponseSchema = z.object({
  id: uuidSchema,
  enrollmentId: uuidSchema,
  student: studentRefSchema,
  oweMinor: z.number().int(),
  paidMinor: z.number().int(),
  paymentStatus: packagePaymentStatusSchema,
});

export type ParticipantShareResponse = z.infer<typeof participantShareResponseSchema>;

export const packageResponseSchema = z.object({
  id: uuidSchema,
  workspaceId: uuidSchema,
  studentId: uuidSchema.nullable(),
  groupId: uuidSchema.nullable(),
  name: z.string().nullable(),
  sizingMode: packageSizingModeSchema,
  lessonsTotal: z.number().int(),
  endDate: isoDateTimeSchema.nullable(),
  pricePerLessonMinorSnapshot: z.number().int(),
  totalPriceMinorSnapshot: z.number().int(),
  // Derived at read time from the ledger — never a stored column.
  effectiveTotalMinor: z.number().int(),
  remainingCredits: z.number().int(),
  consumedCredits: z.number().int(),
  paidMinor: z.number().int(),
  currency: currencyCodeSchema,
  paymentStatus: packagePaymentStatusSchema,
  purchasedAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema.nullable(),
  notes: z.string().nullable(),
  student: studentRefSchema.nullable(),
  group: groupRefSchema.nullable(),
  shares: z.array(participantShareResponseSchema),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
});

export type PackageResponse = z.infer<typeof packageResponseSchema>;

export const packageListResponseSchema = paginatedResponseSchema(packageResponseSchema);
export type PackageListResponse = z.infer<typeof packageListResponseSchema>;

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
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export type PaymentResponse = z.infer<typeof paymentResponseSchema>;

export const paymentListResponseSchema = paginatedResponseSchema(paymentResponseSchema);
export type PaymentListResponse = z.infer<typeof paymentListResponseSchema>;
