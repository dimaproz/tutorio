import type { PackageResponse, PaymentResponse } from '@tutorio/validation';
import { zonedDate, zonedDayStart } from '@/lib/datetime';

/** Sums per currency: money in several currencies is never added up (decision 3). */
export type CurrencySums = { currency: string; amountMinor: number }[];

function sumByCurrency(rows: readonly { currency: string; amountMinor: number }[]): CurrencySums {
  const sums = new Map<string, number>();
  for (const row of rows) sums.set(row.currency, (sums.get(row.currency) ?? 0) + row.amountMinor);
  return [...sums]
    .map(([currency, amountMinor]) => ({ currency, amountMinor }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

// ---------------------------------------------------------------------------
// «Оплати»: the money ledger
// ---------------------------------------------------------------------------

export type LedgerRow = {
  payment: PaymentResponse;
  kind: 'payment' | 'refund';
  /** The package it paid or refunded, when it belongs to one. */
  pkg: PackageResponse | null;
};

/** A month of the ledger: "yyyy-MM", and its first midnight to name it by. */
export type LedgerMonth = { key: string; month: Date; rows: LedgerRow[] };

/**
 * Every settled payment and refund of the student, newest first, grouped by
 * the studio's month; pending and failed online attempts are not money in
 * hand.
 */
export function ledgerMonths(
  payments: readonly PaymentResponse[],
  packages: readonly PackageResponse[],
  timeZone: string,
): LedgerMonth[] {
  const byId = new Map(packages.map((pkg) => [pkg.id, pkg]));
  const months = new Map<string, LedgerMonth>();
  const rows = payments
    .filter((payment) => payment.status === 'PAID' || payment.status === 'REFUNDED')
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  for (const payment of rows) {
    const key = zonedDate(payment.paidAt, timeZone).slice(0, 7);
    const month = months.get(key) ?? {
      key,
      month: zonedDayStart(`${key}-01`, timeZone),
      rows: [],
    };
    month.rows.push({
      payment,
      kind: payment.status === 'REFUNDED' ? 'refund' : 'payment',
      pkg: payment.packageId ? (byId.get(payment.packageId) ?? null) : null,
    });
    months.set(key, month);
  }
  return [...months.values()];
}

/** The three tiles above the ledger: all paid, refunded, the last payment. */
export function ledgerSummary(payments: readonly PaymentResponse[]): {
  paid: CurrencySums;
  refunded: CurrencySums;
  lastPaidAt: string | null;
} {
  const paid = payments.filter((payment) => payment.status === 'PAID');
  return {
    paid: sumByCurrency(paid),
    refunded: sumByCurrency(payments.filter((payment) => payment.status === 'REFUNDED')),
    lastPaidAt: paid.reduce<string | null>(
      (last, payment) => (last === null || payment.paidAt > last ? payment.paidAt : last),
      null,
    ),
  };
}

// ---------------------------------------------------------------------------
// «Пакети»: the package history
// ---------------------------------------------------------------------------

export type PackageState = 'active' | 'used' | 'expired';

/** Used up, past its end with credits left, or still in play. */
export function packageState(pkg: PackageResponse, now: number): PackageState {
  if (pkg.remainingCredits <= 0) return 'used';
  if (pkg.expiresAt && Date.parse(pkg.expiresAt) <= now) return 'expired';
  return 'active';
}

/** The package history, newest first: the live one leads. */
export function packageHistory(
  packages: readonly PackageResponse[],
  now: number,
): { pkg: PackageResponse; state: PackageState }[] {
  return [...packages]
    .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt))
    .map((pkg) => ({ pkg, state: packageState(pkg, now) }));
}

/** «3 пакети · 11 з 14 занять використано · сплачено 5 900 ₴». */
export function packageSummary(packages: readonly PackageResponse[]): {
  count: number;
  used: number;
  total: number;
  paid: CurrencySums;
} {
  return {
    count: packages.length,
    used: packages.reduce((sum, pkg) => sum + pkg.consumedCredits, 0),
    total: packages.reduce((sum, pkg) => sum + pkg.lessonsTotal, 0),
    paid: sumByCurrency(
      packages.map((pkg) => ({ currency: pkg.currency, amountMinor: pkg.paidMinor })),
    ),
  };
}
