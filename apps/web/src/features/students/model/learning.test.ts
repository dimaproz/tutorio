import { describe, expect, it } from 'vitest';
import {
  balanceMetric,
  currencyChips,
  directionName,
  moneyMetric,
  passView,
  visibleDirections,
} from './learning';
import { billingDirection, billingPackage, debtDirection, samplePause } from './testing';

describe('passView', () => {
  it('shows a package with its credits, paid in full', () => {
    const view = passView(billingDirection(), [], 2);
    expect(view.state).toBe('package');
    expect(view.credits).toEqual({ left: 6, total: 8, used: 2 });
    // Nothing is owed: the next step is the next package (S07).
    expect(view).toMatchObject({ action: 'sell', actionPrimary: false });
  });

  it('asks for a payment while the package is paid in part', () => {
    const view = passView(
      billingDirection({
        packages: [billingPackage({ paidMinor: 200000, paymentStatus: 'PARTIAL' })],
      }),
      [],
      2,
    );
    expect(view.packageOwedMinor).toBe(200000);
    expect(view.action).toBe('pay');
    expect(view.actionPrimary).toBe(true);
  });

  it('warns when the credits run low (L-82)', () => {
    const view = passView(
      billingDirection({ packages: [billingPackage({ remainingCredits: 2 })], creditsLeft: 2 }),
      [],
      2,
    );
    expect(view.state).toBe('low');
    expect(view).toMatchObject({ action: 'sell', actionPrimary: true });
  });

  it('reads money owed and paid ahead for a pay-per-lesson direction (L-90)', () => {
    expect(passView(debtDirection(), [], 2)).toMatchObject({
      state: 'debt',
      balanceMinor: -100000,
      action: 'pay',
      actionPrimary: true,
    });
    const ahead = passView(
      debtDirection({
        balance: {
          chargedMinor: 0,
          paidMinor: 100000,
          debtMinor: 0,
          advanceMinor: 100000,
          unpaidLessons: 0,
          unpaid: [],
        },
      }),
      [],
      2,
    );
    expect(ahead).toMatchObject({ state: 'advance', advanceLessons: 2, actionPrimary: false });
  });

  it('greys a paused direction but keeps its debt (decision 10)', () => {
    const own = samplePause({ enrollmentId: debtDirection().enrollmentId });
    const view = passView(debtDirection(), [own], 2);
    expect(view).toMatchObject({ state: 'paused', owesWhilePaused: true, action: 'return' });
    // A whole-student pause is ended from the banner, not the card.
    expect(passView(debtDirection(), [samplePause()], 2).action).toBeNull();
    // A scheduled pause does not grey the card yet.
    expect(passView(debtDirection(), [samplePause({ state: 'SCHEDULED' })], 2).state).toBe('debt');
  });
});

describe('the block', () => {
  it('keeps an ended direction only while money is owed on it', () => {
    const ended = billingDirection({ status: 'ARCHIVED' });
    const owing = debtDirection({ status: 'ARCHIVED' });
    expect(visibleDirections([ended, owing])).toEqual([owing]);
  });

  it('never sums currencies', () => {
    expect(
      currencyChips([
        {
          currency: 'PLN',
          debtMinor: 0,
          advanceMinor: 24000,
          unpaidLessons: 0,
          debtLessons: 0,
          creditsLeft: 0,
        },
        {
          currency: 'UAH',
          debtMinor: 105000,
          advanceMinor: 0,
          unpaidLessons: 3,
          debtLessons: 0,
          creditsLeft: 6,
        },
      ]),
    ).toEqual([
      { kind: 'debt', currency: 'UAH', amountMinor: 105000 },
      { kind: 'advance', currency: 'PLN', amountMinor: 24000 },
    ]);
  });

  it('switches the first metric to the balance when everything is paid per lesson', () => {
    expect(balanceMetric([billingDirection()])).toBeNull();
    expect(balanceMetric([debtDirection()])).toEqual({
      balanceMinor: -100000,
      currency: 'UAH',
      unpaidLessons: 2,
      rateMinor: 50000,
    });
    expect(balanceMetric([debtDirection(), debtDirection({ currency: 'PLN' })])).toBeNull();
  });

  it('names a direction by its group, else its subject', () => {
    expect(directionName(billingDirection())).toBe('English');
    expect(directionName(billingDirection({ group: { id: 'g', name: 'B1 English' } }))).toBe(
      'B1 English',
    );
  });
});

describe('moneyMetric', () => {
  /** Noon on 24 September in Kyiv. */
  const NOW = Date.parse('2026-09-24T09:00:00.000Z');
  const TZ = 'Europe/Kyiv';
  const paid = (
    amountMinor: number,
    currency = 'UAH',
    status = 'PAID',
    paidAt = '2026-09-01T10:00:00.000Z',
  ) => ({
    status,
    currency,
    amountMinor,
    paidAt,
  });

  it('sums what was received and what is owed in one currency', () => {
    expect(
      moneyMetric(
        [
          billingDirection({
            packages: [billingPackage({ paidMinor: 200000, paymentStatus: 'PARTIAL' })],
          }),
          debtDirection(),
        ],
        [
          paid(200000),
          paid(300000),
          paid(30000, 'UAH', 'REFUNDED'),
          // Last month's money is not this month's.
          paid(90000, 'UAH', 'PAID', '2026-08-20T10:00:00.000Z'),
        ],
        NOW,
        TZ,
      ),
    ).toEqual({
      kind: 'single',
      currency: 'UAH',
      paidMinor: 470000,
      owedMinor: 300000,
      payments: 2,
      lastPaidAt: '2026-09-01T10:00:00.000Z',
    });
  });

  it('never adds up two currencies', () => {
    expect(moneyMetric([debtDirection()], [paid(24000, 'PLN')], NOW, TZ)).toEqual({
      kind: 'mixed',
    });
    expect(moneyMetric([], [], NOW, TZ)).toBeNull();
  });

  it("counts the studio's month: 00:30 on 1 September in Kyiv is September", () => {
    expect(
      moneyMetric(
        [debtDirection()],
        [paid(10000, 'UAH', 'PAID', '2026-08-31T21:30:00.000Z')],
        NOW,
        TZ,
      ),
    ).toMatchObject({ paidMinor: 10000, payments: 1 });
  });
});
