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

export class InvalidDecimalStringError extends Error {
  constructor(value: string) {
    super(`Invalid decimal money string: "${value}"`);
    this.name = 'InvalidDecimalStringError';
  }
}

// All supported currencies use 2 decimal places (minor unit exponent 2).
const MINOR_UNIT_DIGITS = 2;

// Optional sign, integer part, optional fraction of 1..2 digits.
// Thousands separators and comma decimals are a UI concern, not accepted here.
const DECIMAL_STRING_RE = /^-?\d+(\.\d{1,2})?$/;

/**
 * Converts a decimal string ("12.30", "0.5", "-7") to minor units (1230, 50,
 * -700) using only string/integer operations — no floating-point arithmetic.
 * A single decimal comma ("1500,50") is accepted as a localized equivalent of
 * the decimal dot; thousands separators are rejected.
 */
export function decimalStringToMinorUnits(value: string): number {
  const trimmed = value.trim().replace(',', '.');
  if (trimmed.includes(',') || !DECIMAL_STRING_RE.test(trimmed)) {
    throw new InvalidDecimalStringError(value);
  }
  const negative = trimmed.startsWith('-');
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [integerPart, fractionPart = ''] = unsigned.split('.');
  const paddedFraction = fractionPart.padEnd(MINOR_UNIT_DIGITS, '0');
  const minor = Number(integerPart + paddedFraction);
  if (!Number.isSafeInteger(minor)) {
    throw new RangeError(`Money amount out of safe integer range: "${value}"`);
  }
  return negative ? -minor : minor;
}

/** Inverse of decimalStringToMinorUnits: 1230 → "12.30", -50 → "-0.50". */
export function minorUnitsToDecimalString(amountMinor: number): string {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError(`Money amount must be a safe integer, got ${amountMinor}`);
  }
  const negative = amountMinor < 0;
  const digits = Math.abs(amountMinor).toString().padStart(MINOR_UNIT_DIGITS + 1, '0');
  const integerPart = digits.slice(0, -MINOR_UNIT_DIGITS);
  const fractionPart = digits.slice(-MINOR_UNIT_DIGITS);
  return `${negative ? '-' : ''}${integerPart}.${fractionPart}`;
}

/** Formatting for UI: money(150000, 'UAH') → "1 500,00 ₴" (locale-dependent). */
export function formatMoney(value: Money, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: value.currency,
  }).format(value.amountMinor / 100);
}
