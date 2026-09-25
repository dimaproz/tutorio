import type { MemberSalePreviewResponse, SellToMembersDto } from '@tutorio/validation';
import { addDays, addMonth, dayKey } from './dates';
import { needsPackage, type MemberBillingState } from './member-billing';
import { moneyText, saleFormDefaults, saleFormSchema, saleSpec, type SaleFormValues } from './sale';

/** A member the group sale can sell to (S08 board 02). */
export type MemberSaleCandidate = {
  studentId: string;
  fullName: string;
  avatarKey: string | null;
  /** The member's own rate per lesson (L-11); null when they follow the group price. */
  ownRateMinor: number | null;
  state: MemberBillingState;
};

/** One member's line of the preview. */
export type MemberSalePreviewItem = MemberSalePreviewResponse['items'][number];

/** Ticked by default (decision 10): running low, no package, or owing. */
export function defaultSelection(candidates: readonly MemberSaleCandidate[]): string[] {
  return candidates
    .filter((candidate) => needsPackage(candidate.state))
    .map((candidate) => candidate.studentId);
}

/**
 * The first day of the next month and the last day of it (the board's «1–31
 * жовт» on 9 September): a group buys the month ahead.
 */
export function nextMonth(now: Date, timeZone: string): { from: string; to: string } {
  const today = dayKey(now, timeZone);
  const from = addMonth(`${today.slice(0, 8)}01`);
  return { from, to: addDays(addMonth(from), -1) };
}

/**
 * Opens as a period from the group's schedule over the next month (decision
 * 8: one price for everyone, the group's), or — a group without a schedule —
 * as the S07 count package.
 */
export function memberSaleDefaults(
  now: Date,
  timeZone: string,
  { hasSchedule, rateMinor }: { hasSchedule: boolean; rateMinor: number | null },
): SaleFormValues {
  const base = saleFormDefaults(null, now, timeZone);
  const perLesson = rateMinor && rateMinor > 0 ? moneyText(rateMinor) : '';
  if (!hasSchedule) return { ...base, perLesson };
  return { ...base, kind: 'BY_PERIOD', lessons: '', ...nextMonth(now, timeZone), perLesson };
}

/** The own rates the tutor applied (decision 8: only on click), for the members given. */
export function appliedPrices(
  candidates: readonly MemberSaleCandidate[],
  applied: ReadonlySet<string>,
  studentIds: readonly string[],
): NonNullable<SellToMembersDto['prices']> {
  const picked = new Set(studentIds);
  return candidates.flatMap((candidate) =>
    applied.has(candidate.studentId) && picked.has(candidate.studentId) && candidate.ownRateMinor
      ? [{ studentId: candidate.studentId, pricePerLessonMinor: candidate.ownRateMinor }]
      : [],
  );
}

/** The sale request: the group, who is sold to, at whose own rate, and what. */
export function memberSaleDto(
  values: SaleFormValues,
  target: {
    groupId: string;
    studentIds: string[];
    prices: NonNullable<SellToMembersDto['prices']>;
    currency: string;
  },
  timeZone: string,
  name?: string,
) {
  return {
    groupId: target.groupId,
    studentIds: target.studentIds,
    ...(target.prices.length > 0 ? { prices: target.prices } : {}),
    ...(name ? { name } : {}),
    ...saleSpec(values, target.currency, timeZone),
  } satisfies SellToMembersDto;
}

/**
 * The preview request once the form describes a package: every member, so a
 * tick shows its line at once; null while a field is missing or wrong.
 */
export function memberPreviewDto(
  values: SaleFormValues,
  target: {
    groupId: string;
    candidates: readonly MemberSaleCandidate[];
    applied: ReadonlySet<string>;
    currency: string;
  },
  today: string,
  timeZone: string,
) {
  if (target.candidates.length === 0) return null;
  const parsed = saleFormSchema(today).safeParse(values);
  if (!parsed.success) return null;
  const studentIds = target.candidates.map((candidate) => candidate.studentId);
  return memberSaleDto(
    parsed.data,
    {
      groupId: target.groupId,
      studentIds,
      prices: appliedPrices(target.candidates, target.applied, studentIds),
      currency: target.currency,
    },
    timeZone,
  );
}

/**
 * What a ticked member is sold: the package's lessons at their applied own
 * rate or the shared price — worked out at once, as the tutor types —, else
 * (lessons the form cannot count yet) the preview's line.
 */
export function memberLine(
  candidate: MemberSaleCandidate,
  {
    preview,
    lessons,
    sharedPerLessonMinor,
    sharedTotalMinor,
    applied,
  }: {
    preview: MemberSalePreviewItem | undefined;
    lessons: number | null;
    sharedPerLessonMinor: number | null;
    sharedTotalMinor: number | null;
    applied: boolean;
  },
): { lessons: number; totalMinor: number } | null {
  if (lessons) {
    if (applied && candidate.ownRateMinor) {
      return { lessons, totalMinor: candidate.ownRateMinor * lessons };
    }
    if (sharedTotalMinor !== null) return { lessons, totalMinor: sharedTotalMinor };
    if (sharedPerLessonMinor !== null) {
      return { lessons, totalMinor: sharedPerLessonMinor * lessons };
    }
  }
  return preview ? { lessons: preview.lessonsTotal, totalMinor: preview.totalPriceMinor } : null;
}

/**
 * The own-rate hint of a member (decision 8): «9 × 350 = 3 150 ₴» when their
 * rate differs from the shared one and it is not applied yet.
 */
export function ownRateHint(
  candidate: MemberSaleCandidate,
  {
    lessons,
    sharedPerLessonMinor,
    applied,
  }: { lessons: number | null; sharedPerLessonMinor: number | null; applied: boolean },
): { rateMinor: number; lessons: number; totalMinor: number } | null {
  const rate = candidate.ownRateMinor;
  if (applied || !rate || !lessons || rate === sharedPerLessonMinor) return null;
  return { rateMinor: rate, lessons, totalMinor: rate * lessons };
}
