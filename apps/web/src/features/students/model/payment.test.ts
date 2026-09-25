import { describe, expect, it } from 'vitest';
import {
  paymentDto,
  paymentFormDefaults,
  paymentFormSchema,
  previewBalancePayment,
  previewPackagePayment,
} from './payment';
import { billingDirection, billingPackage, debtDirection } from './testing';

/** The studio's zone; the process runs in another one (vitest config). */
const TZ = 'Europe/Kyiv';
const TODAY = '2026-09-24';
const NOW = new Date('2026-09-24T09:00:00.000Z');

describe('payment preview', () => {
  it('closes the oldest lessons first (L-90)', () => {
    expect(previewBalancePayment(debtDirection(), 50000)).toMatchObject({
      closes: [{ startsAt: '2026-09-21T14:00:00.000Z' }],
      partial: null,
      debtAfterMinor: 50000,
      toAdvanceMinor: 0,
    });
    expect(previewBalancePayment(debtDirection(), 70000)).toMatchObject({
      closes: [{ startsAt: '2026-09-21T14:00:00.000Z' }],
      partial: { leftMinor: 30000 },
    });
  });

  it('puts what is over the debt into the advance', () => {
    const preview = previewBalancePayment(debtDirection(), 200000);
    expect(preview.closes).toHaveLength(2);
    expect(preview).toMatchObject({ debtAfterMinor: 0, toAdvanceMinor: 100000 });
  });

  it('pays a package in part (decision 5)', () => {
    const pkg = billingPackage({ paidMinor: 200000, paymentStatus: 'PARTIAL' });
    expect(previewPackagePayment(pkg, 100000)).toEqual({
      paidAfterMinor: 300000,
      leftMinor: 100000,
      status: 'PARTIAL',
    });
    expect(previewPackagePayment(pkg, 200000).status).toBe('PAID');
  });
});

describe('payment form', () => {
  it('opens on the debt, by transfer, today', () => {
    expect(paymentFormDefaults(debtDirection(), null, TODAY)).toEqual({
      target: 'lessons',
      amount: '1000',
      method: 'BANK_TRANSFER',
      paidAt: TODAY,
      note: '',
    });
  });

  it('opens on the package rest when a package is paid in part', () => {
    const pkg = billingPackage({ paidMinor: 200000, paymentStatus: 'PARTIAL' });
    expect(paymentFormDefaults(billingDirection({ packages: [pkg] }), pkg, TODAY)).toMatchObject({
      target: 'package',
      amount: '2000',
    });
  });

  it('asks for an amount and keeps a package payment within what is left', () => {
    const schema = paymentFormSchema(200000);
    const values = { target: 'package', method: 'CASH', paidAt: TODAY, note: '' } as const;
    const keys = (amount: string) => {
      const result = schema.safeParse({ ...values, amount });
      return result.success
        ? []
        : result.error.issues.map((issue) => (issue as { params?: { key: string } }).params?.key);
    };
    expect(keys('')).toEqual(['amountRequired']);
    expect(keys('0')).toEqual(['amountRequired']);
    expect(keys('abc')).toEqual(['priceInvalid']);
    expect(keys('2500')).toEqual(['amountOverPackage']);
    expect(keys('2000')).toEqual([]);
  });

  it('sends the package, the direction currency and the date', () => {
    const pkg = billingPackage({ paidMinor: 200000 });
    const direction = billingDirection({ packages: [pkg] });
    expect(
      paymentDto(
        { target: 'package', amount: '1000', method: 'CASH', paidAt: TODAY, note: ' cash ' },
        direction,
        pkg,
        NOW,
        TODAY,
        TZ,
      ),
    ).toEqual({
      enrollmentId: direction.enrollmentId,
      packageId: pkg.id,
      amountMinor: 100000,
      currency: 'UAH',
      method: 'CASH',
      paidAt: NOW.toISOString(),
      note: 'cash',
    });
    const earlier = paymentDto(
      { target: 'lessons', amount: '500', method: 'OTHER', paidAt: '2026-09-20', note: '' },
      direction,
      pkg,
      NOW,
      TODAY,
      TZ,
    );
    expect(earlier.packageId).toBeUndefined();
    // An earlier day is recorded at the studio's noon.
    expect(earlier.paidAt).toBe('2026-09-20T09:00:00.000Z');
  });
});
