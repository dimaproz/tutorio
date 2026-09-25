import type { GroupEnrollmentSummary, UpdateEnrollmentDto } from '@tutorio/validation';
import { z } from 'zod';
import { formatPriceInput, parsePriceInput } from '@/lib/money';

/**
 * «Ціна для учня»: a member's own price in a group (L-11). The field is
 * required — the way back to the group price is its own button — and a
 * price equal to the group's is saved as the group's, so the member follows
 * the group again (the API clears the override for it).
 */
export const memberPriceFormSchema = z.object({ price: z.string() }).superRefine((data, ctx) => {
  // No explicit message: the localized error map reads `params.key`.
  const issue = (key: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['price'], params: { key } });
  const value = data.price.trim();
  if (value === '') return issue('memberPriceRequired');
  if (value.startsWith('-')) return issue('priceNegative');
  if (parsePriceInput(value) === null) issue('priceInvalid');
});

export type MemberPriceFormValues = z.infer<typeof memberPriceFormSchema>;

/** The dialog opens on what the member pays now: «400», or «400.50». */
export function memberPriceDefaults(member: Pick<GroupEnrollmentSummary, 'priceMinor'>) {
  const minor = member.priceMinor;
  return {
    price: minor % 100 === 0 ? String(minor / 100) : formatPriceInput(minor),
  } satisfies MemberPriceFormValues;
}

/** The PATCH of the member's direction: the price, in the group's currency. */
export function memberPriceDto(
  values: MemberPriceFormValues,
  currency: string,
): UpdateEnrollmentDto {
  return {
    priceMinor: parsePriceInput(values.price.trim()) ?? 0,
    currency: currency as UpdateEnrollmentDto['currency'],
  };
}

/** How a typed price compares with the group's: «На 50 ₴ менше за ціну групи». */
export function priceDifference(
  price: string,
  groupPriceMinor: number | null,
): { kind: 'less' | 'more' | 'same'; amountMinor: number } | null {
  const minor = price.trim() === '' ? null : parsePriceInput(price.trim());
  if (minor === null || groupPriceMinor === null) return null;
  if (minor === groupPriceMinor) return { kind: 'same', amountMinor: 0 };
  return minor < groupPriceMinor
    ? { kind: 'less', amountMinor: groupPriceMinor - minor }
    : { kind: 'more', amountMinor: minor - groupPriceMinor };
}

/** The roster shows its price column only once somebody pays their own. */
export function hasOwnPrices(members: readonly Pick<GroupEnrollmentSummary, 'ownPrice'>[]) {
  return members.some((member) => member.ownPrice);
}

/**
 * What a new group price does (L-11): the members who follow the group move
 * to it, the ones with their own price keep it. Archived memberships do not
 * count. Null while the price is unchanged, empty or unreadable.
 */
export function groupPriceImpact<T extends Pick<GroupEnrollmentSummary, 'ownPrice' | 'status'>>(
  members: readonly T[],
  initialPriceMinor: number | null,
  nextPrice: string,
): { nextPriceMinor: number; following: T[]; own: T[] } | null {
  const trimmed = nextPrice.trim();
  const nextPriceMinor = trimmed === '' ? null : parsePriceInput(trimmed);
  if (nextPriceMinor === null || nextPriceMinor === initialPriceMinor) return null;
  const live = members.filter((member) => member.status !== 'ARCHIVED');
  return {
    nextPriceMinor,
    following: live.filter((member) => !member.ownPrice),
    own: live.filter((member) => member.ownPrice),
  };
}
