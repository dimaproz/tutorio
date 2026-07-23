import {
  decimalStringToMinorUnits,
  minorUnitsToDecimalString,
  type CurrencyCode,
} from '@tutorio/domain';

// Forms show major units ("1500,50"); the API only accepts integer minor units.
// Conversion happens on strings — never parseFloat or float multiplication.

export const PRICE_MINOR_MAX = 2_147_483_647;

/** Returns null when the input is not a usable money amount. */
export function parsePriceInput(value: string): number | null {
  try {
    const minor = decimalStringToMinorUnits(value);
    if (minor < 0 || minor > PRICE_MINOR_MAX) {
      return null;
    }
    return minor;
  } catch {
    return null;
  }
}

/** Fills the form field from an existing enrollment: 150050 → "1500.50". */
export function formatPriceInput(amountMinor: number): string {
  return minorUnitsToDecimalString(amountMinor);
}

/**
 * Amount only, no currency symbol — locale-aware thousands/decimals:
 * 150050 → "1,500.50" (en) / "1 500,50" (uk). Pair with the currency code
 * shown separately so every currency reads the same way (e.g. in a table).
 */
export function formatAmountDisplay(amountMinor: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

/** Display formatting via Intl, locale-aware: 150050 EUR → "€1,500.50". */
export function formatMoneyDisplay(
  amountMinor: number,
  currency: CurrencyCode | string,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amountMinor / 100);
}
