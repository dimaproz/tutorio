import type { GroupBillingResponse } from '@tutorio/validation';

/** One member of a group with how they pay it (`GET /groups/:id/billing`). */
export type MemberBilling = GroupBillingResponse['members'][number];

/** The package a member pays the group with now (L-81). */
export type MemberPackage = {
  id: string;
  left: number;
  total: number;
  /** Exclusive end; null for a count package without one. */
  expiresAt: string | null;
  paidMinor: number;
  totalMinor: number;
  paymentStatus: 'PENDING' | 'PARTIAL' | 'PAID';
};

/**
 * Where a member stands (S08 «Склад групи»), in the order the roster shows
 * them: owing, running low, part paid, not paid, no package, fine, paused.
 */
export const MEMBER_KINDS = [
  'debt',
  'low',
  'partial',
  'unpaid',
  'noPackage',
  'paid',
  'paused',
] as const;

export type MemberKind = (typeof MEMBER_KINDS)[number];

export type MemberBillingState = {
  kind: MemberKind;
  currency: string;
  billingType: MemberBilling['billingType'];
  pkg: MemberPackage | null;
  /**
   * What is owed: pay-per-lesson money for unpaid lessons (L-90), or lessons
   * held on debt with no credit (L-82), priced at the member's rate.
   */
  debt: { minor: number; lessons: number; source: 'balance' | 'credits' } | null;
  /** A paused member: when the pause ends (null: until ended). */
  pausedUntil: string | null;
};

/**
 * The package a direction uses now, as the API picks it (L-81): the oldest
 * valid one with credits left, else the newest valid one.
 */
export function currentMemberPackage(member: MemberBilling): MemberPackage | null {
  const usable = member.packages
    .filter((pkg) => pkg.usable)
    .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));
  const pick = usable.find((pkg) => pkg.remainingCredits > 0) ?? usable.at(-1);
  if (!pick) return null;
  return {
    id: pick.id,
    left: Math.max(0, pick.remainingCredits),
    total: pick.lessonsTotal,
    expiresAt: pick.expiresAt,
    paidMinor: pick.paidMinor,
    totalMinor: pick.totalPriceMinor,
    paymentStatus: pick.paymentStatus,
  };
}

/** Whether the member's pause covers `now`. */
function pausedAt(member: MemberBilling, now: number): boolean {
  const pause = member.pause;
  if (!pause || Date.parse(pause.startsAt) > now) return false;
  return pause.endsAt === null || Date.parse(pause.endsAt) > now;
}

/**
 * Where one member stands: paused first (their card is grey whatever they
 * owe), then what they owe, then their package — running low (the studio's
 * threshold, L-82), part paid or not paid —, no package, or all well.
 * `onHold` is the roster's own word: a paused membership or a student on a
 * break.
 */
export function memberBillingState(
  member: MemberBilling,
  { onHold, now }: { onHold: boolean; now: number },
): MemberBillingState {
  const pkg = currentMemberPackage(member);
  const base = {
    currency: member.currency,
    billingType: member.billingType,
    pkg,
    debt: null,
    pausedUntil: null,
  };
  if (onHold || pausedAt(member, now)) {
    return { ...base, kind: 'paused', pausedUntil: member.pause?.endsAt ?? null };
  }
  const debt =
    member.balance.debtMinor > 0
      ? {
          minor: member.balance.debtMinor,
          lessons: member.balance.unpaidLessons,
          source: 'balance' as const,
        }
      : member.debtLessons > 0
        ? {
            minor: member.debtLessons * member.rateMinor,
            lessons: member.debtLessons,
            source: 'credits' as const,
          }
        : null;
  if (debt) return { ...base, kind: 'debt', debt };
  if (pkg && (member.warning === 'LOW_CREDITS' || member.warning === 'NO_CREDITS')) {
    return { ...base, kind: 'low' };
  }
  if (pkg && pkg.totalMinor > 0 && pkg.paymentStatus === 'PARTIAL') {
    return { ...base, kind: 'partial' };
  }
  if (pkg && pkg.totalMinor > 0 && pkg.paymentStatus === 'PENDING') {
    return { ...base, kind: 'unpaid' };
  }
  if (!pkg) return { ...base, kind: 'noPackage' };
  return { ...base, kind: 'paid' };
}

/** Members a group sale ticks by default (decision 10): running low, no package, or owing. */
export function needsPackage(state: Pick<MemberBillingState, 'kind'>): boolean {
  return state.kind === 'debt' || state.kind === 'low' || state.kind === 'noPackage';
}

/** Members the roster counts as «потребують оплати»: everyone who owes or needs a package. */
export function needsPayment(state: Pick<MemberBillingState, 'kind'>): boolean {
  return state.kind !== 'paid' && state.kind !== 'paused';
}

/** The roster's order: by standing, then by name. */
export function compareMembers(
  a: { state: Pick<MemberBillingState, 'kind'>; name: string },
  b: { state: Pick<MemberBillingState, 'kind'>; name: string },
): number {
  return (
    MEMBER_KINDS.indexOf(a.state.kind) - MEMBER_KINDS.indexOf(b.state.kind) ||
    a.name.localeCompare(b.name)
  );
}

/**
 * The roster's summary badges: how many need a payment or a package, how many
 * are paused, and what is owed — per currency, never added across them.
 */
export function rosterSummary(states: readonly MemberBillingState[]) {
  const debts = new Map<string, number>();
  for (const state of states) {
    if (state.kind === 'debt' && state.debt) {
      debts.set(state.currency, (debts.get(state.currency) ?? 0) + state.debt.minor);
    }
  }
  return {
    needPayment: states.filter(needsPayment).length,
    paused: states.filter((state) => state.kind === 'paused').length,
    debts: [...debts]
      .map(([currency, minor]) => ({ currency, minor }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
  };
}
