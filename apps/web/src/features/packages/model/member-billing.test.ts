import { describe, expect, it } from 'vitest';
import {
  compareMembers,
  currentMemberPackage,
  memberBillingState,
  needsPackage,
  rosterSummary,
  type MemberBilling,
} from './member-billing';

const NOW = Date.parse('2026-09-09T09:00:00.000Z');
const ID = '11111111-1111-4111-8111-111111111111';

function pkg(patch: Partial<MemberBilling['packages'][number]> = {}) {
  return {
    id: ID,
    name: null,
    purchasedAt: '2026-09-01T10:00:00.000Z',
    expiresAt: '2026-10-20T21:00:00.000Z',
    validFrom: null,
    lessonsTotal: 8,
    remainingCredits: 6,
    usable: true,
    totalPriceMinor: 320000,
    paidMinor: 320000,
    paymentStatus: 'PAID' as const,
    ...patch,
  };
}

function member(patch: Partial<MemberBilling> = {}): MemberBilling {
  return {
    enrollmentId: ID,
    studentId: ID,
    billingType: 'PACKAGE',
    rateMinor: 40000,
    currency: 'UAH',
    packages: [pkg()],
    creditsLeft: 6,
    debtLessons: 0,
    balance: {
      chargedMinor: 0,
      paidMinor: 0,
      debtMinor: 0,
      advanceMinor: 0,
      unpaidLessons: 0,
      unpaid: [],
    },
    warning: null,
    pause: null,
    ...patch,
  };
}

const state = (patch: Partial<MemberBilling> = {}, onHold = false) =>
  memberBillingState(member(patch), { onHold, now: NOW });

describe('memberBillingState (S08 roster)', () => {
  it('reads each standing of the board', () => {
    expect(
      state({
        billingType: 'PER_LESSON',
        packages: [],
        balance: { ...member().balance, debtMinor: 80000, unpaidLessons: 2 },
      }),
    ).toMatchObject({ kind: 'debt', debt: { minor: 80000, lessons: 2, source: 'balance' } });
    expect(state({ packages: [pkg({ remainingCredits: 2 })], warning: 'LOW_CREDITS' }).kind).toBe(
      'low',
    );
    expect(state({ packages: [pkg({ paidMinor: 160000, paymentStatus: 'PARTIAL' })] }).kind).toBe(
      'partial',
    );
    expect(state({ packages: [pkg({ paidMinor: 0, paymentStatus: 'PENDING' })] }).kind).toBe(
      'unpaid',
    );
    expect(state({ billingType: 'PER_LESSON', packages: [] }).kind).toBe('noPackage');
    expect(state().kind).toBe('paid');
  });

  it('prices lessons held on debt at the rate (L-82)', () => {
    expect(state({ debtLessons: 3, packages: [pkg({ remainingCredits: 0 })] })).toMatchObject({
      kind: 'debt',
      debt: { minor: 120000, lessons: 3, source: 'credits' },
    });
  });

  it('greys a paused member whatever they owe, with the pause end (L-73)', () => {
    const paused = state({
      pause: { startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-10-04T21:00:00.000Z' },
      balance: { ...member().balance, debtMinor: 40000, unpaidLessons: 1 },
    });
    expect(paused).toMatchObject({ kind: 'paused', pausedUntil: '2026-10-04T21:00:00.000Z' });
    // A pause that has not begun is not a pause yet.
    expect(state({ pause: { startsAt: '2026-09-20T00:00:00.000Z', endsAt: null } }).kind).toBe(
      'paid',
    );
    // The roster's own hold (a student on a break) counts too.
    expect(state({}, true).kind).toBe('paused');
  });

  it('uses the oldest valid package with credits, else the newest valid one (L-81)', () => {
    const older = pkg({
      id: 'older',
      purchasedAt: '2026-08-01T10:00:00.000Z',
      remainingCredits: 0,
    });
    const newer = pkg({ id: 'newer', remainingCredits: 4 });
    const expired = pkg({ id: 'expired', usable: false, remainingCredits: 5 });
    expect(currentMemberPackage(member({ packages: [newer, older, expired] }))?.id).toBe('newer');
    expect(
      currentMemberPackage(member({ packages: [older, pkg({ id: 'b', remainingCredits: 0 })] }))
        ?.id,
    ).toBe('b');
    expect(currentMemberPackage(member({ packages: [expired] }))).toBeNull();
  });
});

describe('the roster and the sale', () => {
  it('ticks the members who need a package (decision 10)', () => {
    expect(needsPackage({ kind: 'debt' })).toBe(true);
    expect(needsPackage({ kind: 'low' })).toBe(true);
    expect(needsPackage({ kind: 'noPackage' })).toBe(true);
    expect(needsPackage({ kind: 'partial' })).toBe(false);
    expect(needsPackage({ kind: 'paid' })).toBe(false);
    expect(needsPackage({ kind: 'paused' })).toBe(false);
  });

  it('orders by standing, then by name', () => {
    const rows = [
      { name: 'Kateryna', state: { kind: 'paused' as const } },
      { name: 'Mark', state: { kind: 'paid' as const } },
      { name: 'Anna', state: { kind: 'low' as const } },
      { name: 'Artem', state: { kind: 'debt' as const } },
      { name: 'Sofiia', state: { kind: 'noPackage' as const } },
      { name: 'Denys', state: { kind: 'partial' as const } },
    ];
    expect([...rows].sort(compareMembers).map((row) => row.name)).toEqual([
      'Artem',
      'Anna',
      'Denys',
      'Sofiia',
      'Mark',
      'Kateryna',
    ]);
  });

  it('counts the badges, owing per currency (never across them)', () => {
    const summary = rosterSummary([
      state({
        billingType: 'PER_LESSON',
        packages: [],
        balance: { ...member().balance, debtMinor: 80000, unpaidLessons: 2 },
      }),
      state({
        currency: 'EUR',
        billingType: 'PER_LESSON',
        packages: [],
        balance: { ...member().balance, debtMinor: 5000, unpaidLessons: 1 },
      }),
      state({ packages: [pkg({ remainingCredits: 2 })], warning: 'LOW_CREDITS' }),
      state(),
      state({}, true),
    ]);
    expect(summary).toEqual({
      needPayment: 3,
      paused: 1,
      debts: [
        { currency: 'EUR', minor: 5000 },
        { currency: 'UAH', minor: 80000 },
      ],
    });
  });
});
