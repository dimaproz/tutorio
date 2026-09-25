import { describe, expect, it } from 'vitest';
import type {
  CreditEntryResponse,
  PackageDetailResponse,
  PaymentResponse,
} from '@tutorio/validation';
import {
  creditDots,
  deletable,
  owedMinor,
  paidPercent,
  ticketActions,
  ticketHistory,
  ticketLessons,
  ticketNotice,
  ticketState,
} from './ticket';

const NOW = new Date('2026-09-25T10:00:00.000Z');
const ID = '11111111-1111-4111-8111-111111111111';

function pkg(patch: Partial<PackageDetailResponse> = {}): PackageDetailResponse {
  return {
    id: ID,
    workspaceId: ID,
    enrollmentId: ID,
    studentId: ID,
    groupId: null,
    name: 'B2 preparation',
    sizingMode: 'FIXED_COUNT',
    lessonsTotal: 8,
    endDate: null,
    pricePerLessonMinorSnapshot: 50000,
    totalPriceMinorSnapshot: 400000,
    lessonsPerWeek: null,
    validFrom: null,
    transferredFromPackageId: null,
    remainingCredits: 4,
    consumedCredits: 4,
    paidMinor: 200000,
    refundedMinor: 0,
    currency: 'UAH',
    paymentStatus: 'PARTIAL',
    purchasedAt: '2026-09-01T10:00:00.000Z',
    expiresAt: '2026-10-31T00:00:00.000Z',
    notes: null,
    student: { id: ID, fullName: 'Anna Shevchenko', avatarKey: null },
    group: null,
    teacher: { id: ID, name: 'Dmytro Tutor', avatarKey: null, subjects: ['English'] },
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    deletedAt: null,
    ahead: null,
    pauseExtensions: [],
    manualExtensions: [],
    ...patch,
  };
}

describe('the ticket (S07 board 02)', () => {
  it('reads its state: new, active, used up, expired', () => {
    expect(ticketState(pkg({ consumedCredits: 0, remainingCredits: 8 }), NOW)).toBe('new');
    expect(ticketState(pkg(), NOW)).toBe('active');
    expect(ticketState(pkg({ remainingCredits: 0, consumedCredits: 8 }), NOW)).toBe('used');
    expect(ticketState(pkg({ expiresAt: '2026-09-21T00:00:00.000Z' }), NOW)).toBe('expired');
  });

  it('draws one dot per credit, never fewer than are left', () => {
    expect(creditDots(pkg())).toEqual({ left: 4, total: 8 });
    expect(creditDots(pkg({ remainingCredits: 9 }))).toEqual({ left: 9, total: 9 });
    expect(creditDots(pkg({ remainingCredits: -1 }))).toEqual({ left: 0, total: 8 });
  });

  it('knows what is owed and how much is paid', () => {
    expect(owedMinor(pkg())).toBe(200000);
    expect(paidPercent(pkg())).toBe(50);
    expect(paidPercent(pkg({ totalPriceMinorSnapshot: 0, paidMinor: 0 }))).toBe(100);
  });

  it('puts paying first while money is owed, extending once expired, selling once used', () => {
    expect(ticketActions(pkg(), 'active')).toEqual([
      { action: 'pay', primary: true },
      { action: 'extend', primary: false },
      { action: 'transfer', primary: false },
      { action: 'refund', primary: false },
    ]);
    const paid = pkg({ paidMinor: 400000, paymentStatus: 'PAID' });
    expect(ticketActions({ ...paid, expiresAt: '2026-09-21T00:00:00.000Z' }, 'expired')).toEqual([
      { action: 'extend', primary: true },
      { action: 'transfer', primary: false },
      { action: 'refund', primary: false },
    ]);
    expect(ticketActions({ ...paid, remainingCredits: 0 }, 'used')[0]).toEqual({
      action: 'sell',
      primary: true,
    });
    expect(ticketActions(pkg({ deletedAt: NOW.toISOString() }), 'active')).toEqual([]);
  });

  it('explains the state: expired, used up, a pause, the package ahead', () => {
    expect(ticketNotice(pkg({ expiresAt: '2026-09-21T00:00:00.000Z' }), 'expired')).toMatchObject({
      kind: 'expired',
      unused: 4,
    });
    expect(ticketNotice(pkg({ remainingCredits: 0 }), 'used')).toEqual({ kind: 'used', total: 8 });
    const paused = ticketNotice(
      pkg({
        expiresAt: '2026-11-14T00:00:00.000Z',
        pauseExtensions: [
          {
            pauseId: ID,
            startsAt: '2026-10-01T00:00:00.000Z',
            endsAt: '2026-10-15T00:00:00.000Z',
            extendedBySeconds: 14 * 86400,
          },
        ],
      }),
      'active',
    );
    expect(paused).toMatchObject({ kind: 'paused', days: 14 });
    expect(paused?.kind === 'paused' ? paused.endBefore?.toISOString() : null).toBe(
      '2026-10-30T23:59:59.999Z',
    );
    expect(
      ticketNotice(
        pkg({ ahead: { id: ID, name: 'Starter', remainingCredits: 1, lastLessonAt: null } }),
        'new',
      ),
    ).toEqual({ kind: 'ahead', name: 'Starter', credits: 1, lastLessonAt: null });
    expect(ticketNotice(pkg(), 'active')).toBeNull();
  });

  it('lists the lessons it paid for, newest first, and the rest as history', () => {
    const entry = (patch: Partial<CreditEntryResponse>): CreditEntryResponse => ({
      id: ID,
      packageId: ID,
      lessonId: null,
      lesson: null,
      delta: 0,
      type: 'purchase',
      note: null,
      createdAt: '2026-09-01T10:00:00.000Z',
      ...patch,
    });
    const lesson = (id: string, startsAt: string) =>
      entry({
        id,
        type: 'lesson',
        delta: -1,
        lessonId: id,
        lesson: { id, startsAt, durationMin: 60, status: 'COMPLETED' },
      });
    const ledger = [
      entry({ id: 'purchase', delta: 8 }),
      lesson('a', '2026-09-14T14:00:00.000Z'),
      lesson('b', '2026-09-24T14:00:00.000Z'),
      entry({
        id: 'fix',
        type: 'manual_adjustment',
        delta: 1,
        note: 'teacher',
        createdAt: '2026-09-20T10:00:00.000Z',
      }),
    ];
    expect(ticketLessons(ledger).map((row) => row.id)).toEqual(['b', 'a']);
    const payment = {
      id: 'pay',
      status: 'PAID',
      paidAt: '2026-09-10T10:00:00.000Z',
      amountMinor: 200000,
      method: 'BANK_TRANSFER',
    } as PaymentResponse;
    const extended = pkg({
      manualExtensions: [
        {
          at: '2026-09-22T10:00:00.000Z',
          from: '2026-09-21T00:00:00.000Z',
          to: '2026-10-31T00:00:00.000Z',
        },
      ],
    });
    expect(ticketHistory(ledger, [payment], extended).map((event) => event.kind)).toEqual([
      'extend',
      'adjustment',
      'payment',
      'purchase',
    ]);
  });

  it('can be deleted only with nothing charged and no money (decision 9)', () => {
    expect(deletable(pkg({ consumedCredits: 0 }), [])).toBe(true);
    expect(deletable(pkg({ consumedCredits: 0 }), [{} as PaymentResponse])).toBe(false);
    expect(deletable(pkg(), [])).toBe(false);
  });
});
