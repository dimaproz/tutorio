import { describe, expect, it } from 'vitest';
import type {
  EnrollmentBillingResponse,
  LessonChargeResponse,
  PackageResponse,
} from '@tutorio/validation';
import { payingPackageId, paymentView, priceEditability } from './payment';
import { lessonFixture } from './testing';

const PKG = { id: '77777777-7777-4777-8777-000000000001' };

function billing(fields: Partial<EnrollmentBillingResponse> = {}): EnrollmentBillingResponse {
  return {
    enrollmentId: '66666666-6666-4666-8666-000000000001',
    billingType: 'PACKAGE',
    rateMinor: 50000,
    currency: 'UAH',
    packages: [
      {
        id: PKG.id,
        name: 'B2 preparation',
        purchasedAt: '2026-09-01T10:00:00.000Z',
        expiresAt: '2026-11-30T00:00:00.000Z',
        remainingCredits: 6,
        usable: true,
      },
    ],
    creditsLeft: 6,
    debtLessons: 0,
    balance: { chargedMinor: 0, paidMinor: 0, debtMinor: 0, advanceMinor: 0, unpaidLessons: 0 },
    warning: null,
    ...fields,
  };
}

function pkg(remainingCredits: number): PackageResponse {
  return {
    id: PKG.id,
    name: 'B2 preparation',
    lessonsTotal: 8,
    remainingCredits,
    totalPriceMinorSnapshot: 400000,
    currency: 'UAH',
    expiresAt: '2026-11-30T00:00:00.000Z',
  } as PackageResponse;
}

function charge(fields: Partial<LessonChargeResponse>): LessonChargeResponse {
  return {
    id: 'c1',
    enrollmentId: '66666666-6666-4666-8666-000000000001',
    source: 'PACKAGE',
    packageId: PKG.id,
    amountMinor: 50000,
    currency: 'UAH',
    paid: true,
    student: { id: 's1', fullName: 'Anna Shevchenko' },
    ...fields,
  };
}

describe('paying package', () => {
  it('uses the charge package, else the oldest usable package with credits', () => {
    expect(payingPackageId(lessonFixture({ charges: [charge({})] }), undefined)).toBe(PKG.id);
    const older = {
      ...billing().packages[0]!,
      id: '77777777-7777-4777-8777-000000000000',
      purchasedAt: '2026-08-01T10:00:00.000Z',
    };
    const empty = {
      ...older,
      id: 'e',
      remainingCredits: 0,
      purchasedAt: '2026-07-01T10:00:00.000Z',
    };
    expect(
      payingPackageId(
        lessonFixture(),
        billing({ packages: [billing().packages[0]!, older, empty] }),
      ),
    ).toBe(older.id);
    expect(payingPackageId(lessonFixture(), billing({ packages: [] }))).toBeNull();
  });
});

describe('payment view', () => {
  const base = { billing: billing(), lessonsBefore: 0, nextLessonAt: null };

  it('draws the credit left after the lessons booked before this one', () => {
    const view = paymentView({ ...base, lesson: lessonFixture(), pkg: pkg(6) });
    expect(view).toMatchObject({ kind: 'package', state: 'upcoming', left: 5, last: false });
    if (view.kind !== 'package') throw new Error('package expected');
    expect(view.segments).toEqual([
      'used',
      'used',
      'current',
      'available',
      'available',
      'available',
      'available',
      'available',
    ]);

    const later = paymentView({ ...base, lesson: lessonFixture(), pkg: pkg(6), lessonsBefore: 5 });
    expect(later).toMatchObject({ left: 0, last: true });
    expect(
      paymentView({ ...base, lesson: lessonFixture(), pkg: pkg(6), lessonsBefore: 6 }),
    ).toEqual({
      kind: 'packageEmpty',
      state: 'upcoming',
    });
  });

  it('shows what is left and why a charged package lesson took a credit', () => {
    const view = paymentView({
      ...base,
      lesson: lessonFixture({ status: 'NO_SHOW', charges: [charge({})] }),
      pkg: pkg(5),
    });
    expect(view).toMatchObject({ kind: 'package', state: 'charged', reason: 'noShow', left: 5 });
    if (view.kind !== 'package') throw new Error('package expected');
    expect(view.segments.indexOf('charged')).toBe(2);
  });

  it('returns the credit of a free cancellation to the package', () => {
    const view = paymentView({
      ...base,
      lesson: lessonFixture({ status: 'CANCELLED_UNCHARGED' }),
      pkg: pkg(6),
    });
    expect(view).toMatchObject({ kind: 'package', state: 'free', left: 6 });
  });

  it('puts a package lesson with no credit on debt (L-82)', () => {
    expect(
      paymentView({
        ...base,
        lesson: lessonFixture({
          status: 'COMPLETED',
          charges: [charge({ source: 'DEBT', packageId: null, paid: false })],
        }),
        pkg: null,
      }),
    ).toEqual({ kind: 'packageEmpty', state: 'charged' });
  });

  it('waits for the package before drawing the card', () => {
    expect(paymentView({ ...base, lesson: lessonFixture(), pkg: undefined })).toEqual({
      kind: 'pending',
    });
  });

  it('shows the price and the paid state of a pay-per-lesson lesson', () => {
    const perLesson = billing({ billingType: 'PER_LESSON', packages: [] });
    expect(
      paymentView({ ...base, billing: perLesson, lesson: lessonFixture(), pkg: null }),
    ).toMatchObject({ kind: 'oneOff', state: 'upcoming', amountMinor: 50000 });
    const held = lessonFixture({
      status: 'COMPLETED',
      completedAt: '2026-09-04T15:00:00.000Z',
      charges: [charge({ source: 'BALANCE', packageId: null, paid: false })],
    });
    expect(paymentView({ ...base, billing: perLesson, lesson: held, pkg: null })).toMatchObject({
      kind: 'oneOff',
      state: 'unpaid',
      chargedAt: '2026-09-04T15:00:00.000Z',
    });
    const paid = { ...held, charges: [charge({ source: 'BALANCE', packageId: null, paid: true })] };
    expect(paymentView({ ...base, billing: perLesson, lesson: paid, pkg: null })).toMatchObject({
      state: 'paid',
    });
  });

  it('frees the makeup of a charged original (L-61)', () => {
    const makeup = lessonFixture({
      kind: 'MAKEUP',
      original: { id: 'o1', startsAtUtc: '2026-09-11T14:00:00.000Z', status: 'CANCELLED_CHARGED' },
    });
    expect(paymentView({ ...base, lesson: makeup, pkg: pkg(5) })).toEqual({
      kind: 'freeMakeup',
      originalStartsAt: '2026-09-11T14:00:00.000Z',
    });
  });
});

describe('price editability', () => {
  it('locks the price of a package lesson and of a paid lesson (L-12)', () => {
    expect(priceEditability(lessonFixture(), billing())).toBe('package');
    expect(priceEditability(lessonFixture(), billing({ billingType: 'PER_LESSON' }))).toBe(
      'editable',
    );
    expect(
      priceEditability(
        lessonFixture({ charges: [charge({ source: 'BALANCE', packageId: null, paid: true })] }),
        undefined,
      ),
    ).toBe('paid');
    expect(priceEditability(lessonFixture({ groupId: 'g1' }), undefined)).toBe('group');
  });
});
