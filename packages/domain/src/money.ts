/**
 * Money is stored in minor units (cents/kopecks/groszy) as integers.
 * No floating-point arithmetic on money.
 */

export const SUPPORTED_CURRENCIES = ['EUR', 'UAH', 'PLN', 'USD', 'GBP'] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export interface Money {
  /** Amount in minor units (integer, may be negative). */
  amountMinor: number;
  currency: CurrencyCode;
}

export class CurrencyMismatchError extends Error {
  constructor(a: CurrencyCode, b: CurrencyCode) {
    super(`Currency mismatch: ${a} vs ${b}`);
    this.name = 'CurrencyMismatchError';
  }
}

export function money(amountMinor: number, currency: CurrencyCode): Money {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError(`Money amount must be a safe integer, got ${amountMinor}`);
  }
  return { amountMinor, currency };
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new CurrencyMismatchError(a.currency, b.currency);
  }
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new CurrencyMismatchError(a.currency, b.currency);
  }
  return money(a.amountMinor - b.amountMinor, a.currency);
}

/** Sum of a list of Money in a single currency. An empty list requires an explicit currency. */
export function sumMoney(items: readonly Money[], currency: CurrencyCode): Money {
  return items.reduce((acc, item) => addMoney(acc, item), money(0, currency));
}

/** Formatting for UI: money(150000, 'UAH') → "1 500,00 ₴" (locale-dependent). */
export function formatMoney(value: Money, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: value.currency,
  }).format(value.amountMinor / 100);
}
