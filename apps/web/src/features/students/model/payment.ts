import type { PaymentMethodDto, RecordPaymentDto } from '@tutorio/validation';
import { z } from 'zod';
import { zonedIso } from '@/lib/datetime';
import { parsePriceInput } from '@/lib/money';
import type { BillingDirection, BillingPackage } from './learning';

/** The methods the dialog offers, transfer first (decision 7). */
export const PAYMENT_METHODS = [
  'BANK_TRANSFER',
  'CASH',
  'OTHER',
] as const satisfies readonly PaymentMethodDto[];

export type PaymentTarget = 'package' | 'lessons';

/** «Записати оплату»: what it pays for, how much, how, when and a note. */
export function paymentFormSchema(packageOwedMinor: number | null) {
  return z
    .object({
      target: z.enum(['package', 'lessons']),
      amount: z.string(),
      method: z.enum(PAYMENT_METHODS),
      paidAt: z.string(),
      note: z.string().max(2000),
    })
    .superRefine((values, ctx) => {
      const amount = parsePriceInput(values.amount);
      if (values.amount.trim() === '' || amount === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['amount'],
          params: { key: 'amountRequired' },
        });
      } else if (amount === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['amount'],
          params: { key: 'priceInvalid' },
        });
      } else if (
        values.target === 'package' &&
        packageOwedMinor !== null &&
        amount > packageOwedMinor
      ) {
        // A package takes no more than it still costs (OVERPAYMENT).
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['amount'],
          params: { key: 'amountOverPackage' },
        });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(values.paidAt)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['paidAt'],
          params: { key: 'dateRequired' },
        });
      }
    });
}

export type PaymentFormValues = z.infer<ReturnType<typeof paymentFormSchema>>;

/** A plain decimal the amount field shows: 100000 → "1000". */
const amountText = (minor: number) =>
  minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);

/**
 * Opens on what is owed: the package's rest when it is paid in part, else the
 * direction's debt. Paid today by transfer.
 */
export function paymentFormDefaults(
  direction: BillingDirection,
  pkg: BillingPackage | null,
  today: string,
): PaymentFormValues {
  const packageOwed = pkg ? Math.max(pkg.totalPriceMinor - pkg.paidMinor, 0) : 0;
  const target: PaymentTarget =
    pkg && packageOwed > 0 && direction.balance.debtMinor === 0 ? 'package' : 'lessons';
  const owed = target === 'package' ? packageOwed : direction.balance.debtMinor;
  return {
    target,
    amount: owed > 0 ? amountText(owed) : '',
    method: 'BANK_TRANSFER',
    paidAt: today,
    note: '',
  };
}

/**
 * The request: the package when it pays for one, the date at the studio's
 * noon unless it is today.
 */
export function paymentDto(
  values: PaymentFormValues,
  direction: BillingDirection,
  pkg: BillingPackage | null,
  now: Date,
  today: string,
  timeZone: string,
): RecordPaymentDto {
  return {
    enrollmentId: direction.enrollmentId,
    ...(values.target === 'package' && pkg ? { packageId: pkg.id } : {}),
    amountMinor: parsePriceInput(values.amount) ?? 0,
    currency: direction.currency,
    method: values.method,
    paidAt:
      values.paidAt === today ? now.toISOString() : zonedIso(values.paidAt, '12:00', timeZone),
    ...(values.note.trim() ? { note: values.note.trim() } : {}),
  };
}

export type BalancePaymentPreview = {
  /** Lessons the payment pays off completely, oldest first (L-90). */
  closes: { lessonId: string; startsAt: string }[];
  /** The lesson it pays in part, if any. */
  partial: { lessonId: string; startsAt: string; leftMinor: number } | null;
  /** What is owed afterwards. */
  debtAfterMinor: number;
  /** What goes into the advance. */
  toAdvanceMinor: number;
};

/**
 * What a payment on the pay-per-lesson balance does: it settles the oldest
 * lessons first and whatever is left runs ahead as an advance (L-90). The
 * server has no preview for it; this is the same allocation.
 */
export function previewBalancePayment(
  direction: BillingDirection,
  amountMinor: number,
): BalancePaymentPreview {
  let available = amountMinor;
  const closes: BalancePaymentPreview['closes'] = [];
  let partial: BalancePaymentPreview['partial'] = null;
  for (const lesson of direction.balance.unpaid) {
    if (available <= 0) break;
    if (available >= lesson.outstandingMinor) {
      available -= lesson.outstandingMinor;
      closes.push({ lessonId: lesson.lessonId, startsAt: lesson.startsAt });
      continue;
    }
    partial = {
      lessonId: lesson.lessonId,
      startsAt: lesson.startsAt,
      leftMinor: lesson.outstandingMinor - available,
    };
    available = 0;
  }
  return {
    closes,
    partial,
    debtAfterMinor: Math.max(direction.balance.debtMinor - amountMinor, 0),
    toAdvanceMinor: Math.max(amountMinor - direction.balance.debtMinor, 0),
  };
}

export type PackagePaymentPreview = {
  paidAfterMinor: number;
  leftMinor: number;
  status: 'PARTIAL' | 'PAID';
};

/** What a payment towards a package leaves: paid so far, the rest and its state. */
export function previewPackagePayment(
  pkg: BillingPackage,
  amountMinor: number,
): PackagePaymentPreview {
  const paidAfterMinor = pkg.paidMinor + amountMinor;
  const leftMinor = Math.max(pkg.totalPriceMinor - paidAfterMinor, 0);
  return { paidAfterMinor, leftMinor, status: leftMinor === 0 ? 'PAID' : 'PARTIAL' };
}
