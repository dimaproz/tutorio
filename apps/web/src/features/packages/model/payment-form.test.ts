import { describe, expect, it } from 'vitest';
import {
  adjustFormSchema,
  buildAdjustBalanceDto,
  buildRecordPaymentDto,
  emptyPaymentForm,
  paymentFormSchema,
  type PaymentFormValues,
} from './payment-form';

const ENROLLMENT_ID = '44444444-4444-4444-8444-444444444444';
const PACKAGE_ID = '55555555-5555-4555-8555-555555555555';

const base: PaymentFormValues = {
  enrollmentId: ENROLLMENT_ID,
  amount: '1000',
  method: 'CASH',
  note: '',
};

describe('emptyPaymentForm', () => {
  it('prefills the amount with what is still owed', () => {
    expect(emptyPaymentForm({ enrollmentId: ENROLLMENT_ID, oweMinor: 47500 }).amount).toBe(
      '475.00',
    );
  });

  it('leaves the amount blank when nothing is owed', () => {
    expect(emptyPaymentForm({ enrollmentId: ENROLLMENT_ID }).amount).toBe('');
  });
});

describe('paymentFormSchema', () => {
  it('accepts a positive amount', () => {
    expect(paymentFormSchema.safeParse(base).success).toBe(true);
  });

  it('requires an amount', () => {
    expect(paymentFormSchema.safeParse({ ...base, amount: '' }).success).toBe(false);
  });

  it('rejects zero and unparseable amounts', () => {
    expect(paymentFormSchema.safeParse({ ...base, amount: '0' }).success).toBe(false);
    expect(paymentFormSchema.safeParse({ ...base, amount: 'abc' }).success).toBe(false);
  });
});

describe('buildRecordPaymentDto', () => {
  it('records money against an enrollment and a package', () => {
    expect(
      buildRecordPaymentDto(
        { ...base, note: '  paid in cash  ' },
        { packageId: PACKAGE_ID, currency: 'UAH' },
      ),
    ).toEqual({
      enrollmentId: ENROLLMENT_ID,
      packageId: PACKAGE_ID,
      amountMinor: 100000,
      currency: 'UAH',
      method: 'CASH',
      note: 'paid in cash',
    });
  });

  it('omits an absent package and a blank note', () => {
    const dto = buildRecordPaymentDto(base, { packageId: null, currency: 'EUR' });
    expect(dto).not.toHaveProperty('packageId');
    expect(dto).not.toHaveProperty('note');
  });
});

describe('adjustFormSchema', () => {
  it('accepts a signed whole number with a reason', () => {
    expect(adjustFormSchema.safeParse({ delta: '2', note: 'Goodwill' }).success).toBe(
      true,
    );
    expect(adjustFormSchema.safeParse({ delta: '-1', note: 'Fix' }).success).toBe(true);
  });

  it('rejects zero, fractions and out-of-range values', () => {
    expect(adjustFormSchema.safeParse({ delta: '0', note: 'x' }).success).toBe(false);
    expect(adjustFormSchema.safeParse({ delta: '1.5', note: 'x' }).success).toBe(false);
    expect(adjustFormSchema.safeParse({ delta: '900', note: 'x' }).success).toBe(false);
  });

  it('requires a reason — the ledger must explain itself', () => {
    expect(adjustFormSchema.safeParse({ delta: '2', note: '' }).success).toBe(false);
    expect(adjustFormSchema.safeParse({ delta: '2', note: '   ' }).success).toBe(false);
  });
});

describe('buildAdjustBalanceDto', () => {
  it('sends a numeric delta and a trimmed note', () => {
    expect(buildAdjustBalanceDto({ delta: '3', note: '  Goodwill  ' })).toEqual({
      delta: 3,
      note: 'Goodwill',
    });
  });
});
