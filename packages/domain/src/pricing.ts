/**
 * Default lesson price resolution. When a lesson is booked for a student the
 * tutor should not have to retype the price: it is derived from the most
 * specific rate that exists, and stays editable in the form.
 *
 * Precedence (frozen in Stage 3.7): the student's own hourly rate wins, then
 * the group's per-lesson price, then the teacher's default rate. A rate only
 * counts when both its amount and its currency are present — a half-filled
 * profile falls through to the next source instead of producing a price in the
 * wrong currency.
 */

import type { CurrencyCode } from './money';

/** One candidate rate. Either field missing means "not configured". */
export interface RateSource {
  amountMinor?: number | null;
  currency?: CurrencyCode | null;
}

export interface DefaultPriceInputs {
  student?: RateSource | null;
  group?: RateSource | null;
  teacher?: RateSource | null;
}

export interface ResolvedPrice {
  priceMinor: number;
  currency: CurrencyCode;
  /** Which source supplied the price — surfaced in the UI as a hint. */
  source: 'student' | 'group' | 'teacher';
}

function usable(rate: RateSource | null | undefined): boolean {
  return (
    rate != null &&
    typeof rate.amountMinor === 'number' &&
    Number.isSafeInteger(rate.amountMinor) &&
    rate.amountMinor >= 0 &&
    rate.currency != null
  );
}

/**
 * The price to prefill for a new lesson, or `null` when nothing is configured
 * (the tutor then types it). Never guesses a currency.
 */
export function resolveDefaultPrice(inputs: DefaultPriceInputs): ResolvedPrice | null {
  const ordered: readonly [ResolvedPrice['source'], RateSource | null | undefined][] = [
    ['student', inputs.student],
    ['group', inputs.group],
    ['teacher', inputs.teacher],
  ];

  for (const [source, rate] of ordered) {
    if (usable(rate)) {
      return {
        priceMinor: rate!.amountMinor as number,
        currency: rate!.currency as CurrencyCode,
        source,
      };
    }
  }
  return null;
}
