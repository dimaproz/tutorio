import { describe, expect, it } from 'vitest';
import type { PackageResponse, PaymentResponse } from '@tutorio/validation';
import {
  ledgerMonths,
  ledgerSummary,
  packageHistory,
  packageState,
  packageSummary,
} from './money-history';
import {
  directionSettingsDefaults,
  directionSettingsDto,
  modeSwitchImpact,
} from './direction-settings';
import { billingDirection } from './testing';

/** The studio's zone; the process runs in another one (vitest config). */
const TZ = 'Europe/Kyiv';
const NOW = Date.parse('2026-09-24T12:00:00.000Z');

const payment = (overrides: Partial<PaymentResponse>) =>
  ({
    id: overrides.paidAt ?? 'p',
    enrollmentId: 'e',
    packageId: null,
    amountMinor: 100000,
    currency: 'UAH',
    method: 'CASH',
    status: 'PAID',
    paidAt: '2026-09-25T10:00:00.000Z',
    ...overrides,
  }) as PaymentResponse;

const pkg = (overrides: Partial<PackageResponse>) =>
  ({
    id: 'k',
    name: 'B2 preparation',
    lessonsTotal: 8,
    remainingCredits: 6,
    consumedCredits: 2,
    paidMinor: 400000,
    currency: 'UAH',
    purchasedAt: '2026-09-01T10:00:00.000Z',
    expiresAt: '2026-10-30T21:00:00.000Z',
    ...overrides,
  }) as PackageResponse;

describe('the payments ledger', () => {
  it('groups settled money by month, newest first, and names the package', () => {
    const months = ledgerMonths(
      [
        payment({ paidAt: '2026-08-19T10:00:00.000Z', status: 'REFUNDED', amountMinor: 30000 }),
        payment({ paidAt: '2026-09-01T10:00:00.000Z', packageId: 'k' }),
        payment({ paidAt: '2026-09-25T10:00:00.000Z' }),
        payment({ paidAt: '2026-09-26T10:00:00.000Z', status: 'PENDING' }),
      ],
      [pkg({})],
      TZ,
    );
    expect(months.map((month) => month.rows.length)).toEqual([2, 1]);
    expect(months.map((month) => month.key)).toEqual(['2026-09', '2026-08']);
    expect(months[0]!.month.toISOString()).toBe('2026-08-31T21:00:00.000Z');
    expect(months[0]!.rows[1]!.pkg?.name).toBe('B2 preparation');
    expect(months[1]!.rows[0]!.kind).toBe('refund');
  });

  it('sums paid and refunded per currency', () => {
    expect(
      ledgerSummary([
        payment({ amountMinor: 100000 }),
        payment({ amountMinor: 24000, currency: 'PLN', paidAt: '2026-09-02T10:00:00.000Z' }),
        payment({ amountMinor: 30000, status: 'REFUNDED', paidAt: '2026-09-30T10:00:00.000Z' }),
      ]),
    ).toEqual({
      paid: [
        { currency: 'PLN', amountMinor: 24000 },
        { currency: 'UAH', amountMinor: 100000 },
      ],
      refunded: [{ currency: 'UAH', amountMinor: 30000 }],
      lastPaidAt: '2026-09-25T10:00:00.000Z',
    });
  });
});

describe('the package history', () => {
  it('tells active, used and expired apart', () => {
    expect(packageState(pkg({}), NOW)).toBe('active');
    expect(packageState(pkg({ remainingCredits: 0 }), NOW)).toBe('used');
    expect(packageState(pkg({ expiresAt: '2026-08-19T21:00:00.000Z' }), NOW)).toBe('expired');
  });

  it('lists the newest first and sums what was used and paid', () => {
    const rows = [
      pkg({
        id: 'old',
        purchasedAt: '2026-08-12T10:00:00.000Z',
        lessonsTotal: 2,
        consumedCredits: 1,
        paidMinor: 30000,
      }),
      pkg({}),
    ];
    expect(packageHistory(rows, NOW).map((row) => row.pkg.id)).toEqual(['k', 'old']);
    expect(packageSummary(rows)).toEqual({
      count: 2,
      used: 3,
      total: 10,
      paid: [{ currency: 'UAH', amountMinor: 430000 }],
    });
  });
});

describe('direction settings', () => {
  it('sends only what changed', () => {
    const direction = billingDirection();
    const defaults = directionSettingsDefaults(direction);
    expect(defaults).toEqual({ billingType: 'PACKAGE', rate: '500', deadline: 'studio' });
    expect(directionSettingsDto(defaults, direction)).toEqual({});
    expect(
      directionSettingsDto({ billingType: 'PER_LESSON', rate: '550', deadline: '24' }, direction),
    ).toEqual({ billingType: 'PER_LESSON', priceMinor: 55000, cancellationDeadlineHours: 24 });
  });

  it('explains a mode switch with the credits the package still has', () => {
    expect(modeSwitchImpact(billingDirection(), 'PACKAGE')).toBeNull();
    expect(modeSwitchImpact(billingDirection(), 'PER_LESSON')).toEqual({
      to: 'PER_LESSON',
      creditsLeft: 6,
      debtMinor: 0,
    });
  });
});
