/**
 * Деньги хранятся в minor units (копейки/центы/гроши) — целые числа.
 * Никаких float-операций с деньгами.
 */

export const SUPPORTED_CURRENCIES = ['EUR', 'UAH', 'PLN', 'USD', 'GBP'] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export interface Money {
  /** Сумма в minor units (целое число, может быть отрицательной). */
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

/** Сумма списка Money одной валюты. Пустой список требует явной валюты. */
export function sumMoney(items: readonly Money[], currency: CurrencyCode): Money {
  return items.reduce((acc, item) => addMoney(acc, item), money(0, currency));
}

/** Форматирование для UI: money(150000, 'UAH') → "1 500,00 ₴" (зависит от локали). */
export function formatMoney(value: Money, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: value.currency,
  }).format(value.amountMinor / 100);
}
