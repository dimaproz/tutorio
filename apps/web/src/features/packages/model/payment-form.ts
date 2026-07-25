import {
  notesSchema,
  paymentMethodSchema,
  uuidSchema,
  type AdjustBalanceDto,
  type RecordPaymentDto,
} from '@tutorio/validation';
import { z } from 'zod';
import { optionalText, priceString } from '@/lib/forms/helpers';
import { formatPriceInput, parsePriceInput } from '@/lib/money';

// ---------------------------------------------------------------------------
// Recording a payment
// ---------------------------------------------------------------------------

export const paymentFormSchema = z
  .object({
    enrollmentId: uuidSchema,
    amount: priceString({ required: true }),
    method: paymentMethodSchema,
    note: optionalText(notesSchema),
  })
  .superRefine((values, ctx) => {
    const amountMinor = parsePriceInput(values.amount);
    // A zero payment records nothing; the API rejects it too.
    if (amountMinor !== null && amountMinor <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amount'],
        params: { key: 'amountPositive' },
        message: 'Amount must be greater than zero',
      });
    }
  });

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;

export function emptyPaymentForm(input: {
  enrollmentId: string;
  /** Prefilled with what is still owed, when known. */
  oweMinor?: number;
}): PaymentFormValues {
  return {
    enrollmentId: input.enrollmentId,
    amount: input.oweMinor ? formatPriceInput(input.oweMinor) : '',
    method: 'CASH',
    note: '',
  };
}

export function buildRecordPaymentDto(
  values: PaymentFormValues,
  context: { packageId?: string | null; currency: string },
): RecordPaymentDto {
  return {
    enrollmentId: values.enrollmentId,
    ...(context.packageId ? { packageId: context.packageId } : {}),
    amountMinor: parsePriceInput(values.amount) ?? 0,
    currency: context.currency as RecordPaymentDto['currency'],
    method: values.method,
    ...(values.note.trim() ? { note: values.note.trim() } : {}),
  };
}

// ---------------------------------------------------------------------------
// Manual balance adjustment
// ---------------------------------------------------------------------------

/**
 * The note is mandatory: an append-only ledger is only useful if every entry
 * says why it exists.
 */
export const adjustFormSchema = z.object({
  delta: z.string().superRefine((value, ctx) => {
    const parsed = Number(value);
    if (value.trim() === '' || !Number.isInteger(parsed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        params: { key: 'deltaInvalid' },
        message: 'Enter a whole number of lessons',
      });
      return;
    }
    if (parsed === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        params: { key: 'deltaNotZero' },
        message: 'Delta must not be zero',
      });
    }
    if (Math.abs(parsed) > 500) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        params: { key: 'deltaRange' },
        message: 'Delta out of range',
      });
    }
  }),
  note: notesSchema.refine((value) => value.trim().length > 0, {
    params: { key: 'noteRequired' },
  }),
});

export type AdjustFormValues = z.infer<typeof adjustFormSchema>;

export const EMPTY_ADJUST_FORM: AdjustFormValues = { delta: '', note: '' };

export function buildAdjustBalanceDto(
  values: AdjustFormValues,
): AdjustBalanceDto {
  return { delta: Number(values.delta), note: values.note.trim() };
}
