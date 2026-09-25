import { describe, expect, it } from 'vitest';
import type { PackageResponse } from '@tutorio/validation';
import {
  adjustDots,
  adjustSchema,
  extendDto,
  extendSchema,
  packagePaymentDefaults,
  packagePaymentDto,
  packagePaymentSchema,
  refundCap,
  refundDefaults,
  refundDto,
  refundSchema,
  transferPreview,
  transferSchema,
} from './operations';

const ID = '11111111-1111-4111-8111-111111111111';
/** 10:00 on 25 September in Kyiv (UTC+3). */
const NOW = new Date('2026-09-25T07:00:00.000Z');
const TODAY = '2026-09-25';
/** The studio's zone; the process runs in another one (vitest config). */
const TZ = 'Europe/Kyiv';

const pkg = {
  id: ID,
  enrollmentId: ID,
  currency: 'UAH',
  lessonsTotal: 8,
  remainingCredits: 2,
  pricePerLessonMinorSnapshot: 50000,
  totalPriceMinorSnapshot: 400000,
  paidMinor: 200000,
  refundedMinor: 0,
} as PackageResponse;

const keyOf = (result: { success: boolean; error?: { issues: unknown[] } }) =>
  (result.error?.issues ?? []).map(
    (issue) =>
      `${(issue as { path: string[] }).path[0]}:${(issue as { params?: { key: string } }).params?.key}`,
  );

describe('package payment (board 03, states 01–02)', () => {
  it('opens on what is left, by transfer, and caps the amount there (OVERPAYMENT)', () => {
    const defaults = packagePaymentDefaults(pkg, TODAY);
    expect(defaults).toMatchObject({ amount: '2000', method: 'BANK_TRANSFER', paidAt: TODAY });
    expect(packagePaymentSchema(200000).safeParse(defaults).success).toBe(true);
    expect(keyOf(packagePaymentSchema(200000).safeParse({ ...defaults, amount: '2500' }))).toEqual([
      'amount:amountOverLeft',
    ]);
    expect(packagePaymentDto({ ...defaults, amount: '1000' }, pkg, TODAY, NOW, TZ)).toEqual({
      enrollmentId: ID,
      packageId: ID,
      amountMinor: 100000,
      currency: 'UAH',
      method: 'BANK_TRANSFER',
      paidAt: NOW.toISOString(),
    });
    // An earlier day is recorded at the studio's noon.
    expect(
      packagePaymentDto({ ...defaults, paidAt: '2026-09-20' }, pkg, TODAY, NOW, TZ).paidAt,
    ).toBe('2026-09-20T09:00:00.000Z');
  });
});

describe('extend (board 03, state 03)', () => {
  it('takes a day after today and after the current end, and ends after it', () => {
    const schema = extendSchema(TODAY, '2026-09-20');
    expect(keyOf(schema.safeParse({ until: '2026-09-25' }))).toEqual(['until:dateAfterToday']);
    expect(schema.safeParse({ until: '2026-10-31' }).success).toBe(true);
    expect(keyOf(extendSchema(TODAY, '2026-10-30').safeParse({ until: '2026-10-20' }))).toEqual([
      'until:dateAfterCurrentEnd',
    ]);
    // After the autumn switch Kyiv is UTC+2: the end is the studio's midnight.
    expect(extendDto({ until: '2026-10-31' }, TZ)).toEqual({
      expiresAt: '2026-10-31T22:00:00.000Z',
    });
  });
});

describe('transfer (board 03, state 04, L-85)', () => {
  it('recalculates by price, rounded down, with the remainder', () => {
    expect(transferPreview(2, 50000, 35000)).toEqual({
      valueMinor: 100000,
      lessons: 2,
      remainderMinor: 30000,
      targetValueMinor: 70000,
    });
    expect(transferPreview(0, 50000, 35000)).toBeNull();
  });

  it('moves 1 to the credits left, to a direction', () => {
    expect(keyOf(transferSchema(2).safeParse({ credits: '3', toEnrollmentId: '' }))).toEqual([
      'credits:creditsRange',
      'toEnrollmentId:directionRequired',
    ]);
  });
});

describe('refund (board 03, state 05)', () => {
  it('returns no more than was paid for the unused credits, by transfer, with a reason', () => {
    expect(refundCap(pkg, true)).toBe(100000);
    expect(refundCap(pkg, false)).toBe(200000);
    const defaults = refundDefaults(pkg, TODAY);
    expect(defaults).toMatchObject({ takeCredits: true, returnMoney: true, amount: '1000' });
    expect(keyOf(refundSchema(pkg).safeParse({ ...defaults, amount: '1500' }))).toEqual([
      'amount:refundOverPaid',
      'note:noteRequired',
    ]);
    expect(
      keyOf(refundSchema(pkg).safeParse({ ...defaults, takeCredits: false, returnMoney: false })),
    ).toEqual(['takeCredits:refundNothing', 'note:noteRequired']);
    expect(refundDto({ ...defaults, note: ' Moved ' }, pkg, TODAY, NOW, TZ)).toEqual({
      credits: 2,
      amountMinor: 100000,
      method: 'BANK_TRANSFER',
      paidAt: NOW.toISOString(),
      note: 'Moved',
    });
  });
});

describe('correction (board 03, state 06)', () => {
  it('needs a change that leaves credits and a reason; draws the added one in green', () => {
    expect(keyOf(adjustSchema(2).safeParse({ delta: -3, note: 'x' }))).toEqual([
      'delta:deltaBelowZero',
    ]);
    expect(keyOf(adjustSchema(2).safeParse({ delta: 0, note: '' }))).toEqual([
      'delta:deltaNotZero',
      'note:noteRequired',
    ]);
    expect(adjustDots({ remainingCredits: 4, lessonsTotal: 8 }, 1)).toEqual({
      left: 4,
      added: 1,
      used: 4,
    });
    expect(adjustDots({ remainingCredits: 4, lessonsTotal: 8 }, -1)).toEqual({
      left: 3,
      added: 0,
      used: 4,
    });
  });
});
