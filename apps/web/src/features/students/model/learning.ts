import type { PauseResponse, ScheduleResponse, StudentBillingResponse } from '@tutorio/validation';
import { zonedDate } from '@/lib/datetime';

export type BillingDirection = StudentBillingResponse['directions'][number];
export type BillingPackage = BillingDirection['packages'][number];

/**
 * What the stub of a direction's pass says, and in which tint (S06 decision
 * 2): a package (indigo), a package running low (warning), money or lessons
 * owed (danger), money paid ahead (success), nothing owed (success, zero), a
 * package direction with no package, or a pause (grey).
 */
export type PassState = 'package' | 'low' | 'debt' | 'advance' | 'clear' | 'empty' | 'paused';

export type PassView = {
  direction: BillingDirection;
  state: PassState;
  kind: 'individual' | 'group';
  /** The package the direction uses now (L-81); null when it has none. */
  current: BillingPackage | null;
  /** Credits of the current package. */
  credits: { left: number; total: number; used: number } | null;
  /** Pay-per-lesson money: owed (negative) or ahead (positive). */
  balanceMinor: number;
  /** Package lessons held with no credit (L-82). */
  debtLessons: number;
  /** Lessons the advance pays for at the direction's rate. */
  advanceLessons: number;
  /** The pause the direction is on now, if any. */
  pause: PauseResponse | null;
  /** Money is still owed while paused: the stub keeps it red (decision 10). */
  owesWhilePaused: boolean;
  /** The package still has money to take (L-80, decision 5). */
  packageOwedMinor: number;
  /** The main button on the card, before the ⋯ menu. */
  action: 'pay' | 'return' | 'sell' | null;
  /** Whether that button is the ink one. */
  actionPrimary: boolean;
};

/** A pause covers a direction when it is its own, or the whole student's. */
export function pauseOf(
  pauses: readonly PauseResponse[],
  enrollmentId: string,
  state: PauseResponse['state'],
): PauseResponse | null {
  return (
    pauses.find(
      (pause) =>
        pause.state === state &&
        (pause.enrollmentId === null || pause.enrollmentId === enrollmentId),
    ) ?? null
  );
}

/**
 * The package a direction uses now, as the API picks it (L-81): the oldest
 * valid one with a credit left, else the newest valid one.
 */
export function currentPackage(direction: BillingDirection): BillingPackage | null {
  const usable = direction.packages.filter((pkg) => pkg.usable);
  return usable.find((pkg) => pkg.remainingCredits > 0) ?? usable.at(-1) ?? null;
}

/** Everything a direction's pass shows, from the billing read and the current pauses. */
export function passView(
  direction: BillingDirection,
  pauses: readonly PauseResponse[],
  lowCreditThreshold: number,
): PassView {
  const pause = pauseOf(pauses, direction.enrollmentId, 'ACTIVE');
  const current = currentPackage(direction);
  const credits = current
    ? {
        left: Math.max(current.remainingCredits, 0),
        total: current.lessonsTotal,
        used: Math.max(current.lessonsTotal - Math.max(current.remainingCredits, 0), 0),
      }
    : null;
  const { debtMinor, advanceMinor } = direction.balance;
  const balanceMinor = advanceMinor - debtMinor;
  const packageMode = direction.billingType === 'PACKAGE';
  const packageOwedMinor = current ? Math.max(current.totalPriceMinor - current.paidMinor, 0) : 0;

  const state: PassState = pause
    ? 'paused'
    : packageMode
      ? current
        ? lowCreditThreshold > 0 && direction.creditsLeft <= lowCreditThreshold
          ? 'low'
          : 'package'
        : direction.debtLessons > 0
          ? 'debt'
          : 'empty'
      : debtMinor > 0
        ? 'debt'
        : advanceMinor > 0
          ? 'advance'
          : 'clear';

  const owesMoney = debtMinor > 0 || packageOwedMinor > 0;
  // Paying is the next step when money is owed; a paused direction offers
  // its return instead (a whole-student pause returns from the banner); a
  // package direction with nothing owed sells its next package (S07).
  const action: PassView['action'] =
    pause && pause.enrollmentId !== null
      ? 'return'
      : pause
        ? null
        : !packageMode || owesMoney
          ? 'pay'
          : 'sell';

  return {
    direction,
    state,
    kind: direction.group ? 'group' : 'individual',
    current,
    credits,
    balanceMinor,
    debtLessons: direction.debtLessons,
    advanceLessons: direction.rateMinor > 0 ? Math.floor(advanceMinor / direction.rateMinor) : 0,
    pause,
    owesWhilePaused: Boolean(pause) && debtMinor > 0,
    packageOwedMinor,
    action,
    // Selling is the next step once the credits run low or out.
    actionPrimary: action === 'pay' ? owesMoney : action === 'sell' ? state !== 'package' : false,
  };
}

/**
 * The directions the block shows: the live ones, and an ended one only while
 * money is still owed or paid ahead on it (the money does not disappear).
 */
export function visibleDirections(directions: readonly BillingDirection[]): BillingDirection[] {
  return directions.filter(
    (direction) =>
      direction.status !== 'ARCHIVED' ||
      direction.balance.debtMinor > 0 ||
      direction.balance.advanceMinor > 0,
  );
}

/**
 * The currency chips next to the block title (decision 3, board 07): what is
 * owed and what is paid ahead, per currency, never summed across currencies.
 */
export function currencyChips(
  totals: StudentBillingResponse['totals'],
): { kind: 'debt' | 'advance'; currency: string; amountMinor: number }[] {
  return [
    ...totals
      .filter((total) => total.debtMinor > 0)
      .map((total) => ({
        kind: 'debt' as const,
        currency: total.currency,
        amountMinor: total.debtMinor,
      })),
    ...totals
      .filter((total) => total.advanceMinor > 0)
      .map((total) => ({
        kind: 'advance' as const,
        currency: total.currency,
        amountMinor: total.advanceMinor,
      })),
  ];
}

/**
 * The first metric follows the billing mode (decision 6): «Залишок занять»
 * while the directions are paid by packages, «Баланс» when every live one is
 * paid per lesson, in one currency. Null when there is nothing to say.
 */
export function balanceMetric(
  directions: readonly BillingDirection[],
): { balanceMinor: number; currency: string; unpaidLessons: number; rateMinor: number } | null {
  const live = directions.filter((direction) => direction.status !== 'ARCHIVED');
  if (live.length === 0 || live.some((direction) => direction.billingType === 'PACKAGE')) {
    return null;
  }
  const currencies = new Set(live.map((direction) => direction.currency));
  if (currencies.size !== 1) return null;
  return {
    balanceMinor: live.reduce(
      (sum, direction) => sum + direction.balance.advanceMinor - direction.balance.debtMinor,
      0,
    ),
    currency: live[0]!.currency,
    unpaidLessons: live.reduce((sum, direction) => sum + direction.balance.unpaidLessons, 0),
    rateMinor: live[0]!.rateMinor,
  };
}

/** The schedule a direction runs on: its own, or its group's. */
export function scheduleOf(
  schedules: readonly ScheduleResponse[],
  direction: BillingDirection,
): ScheduleResponse | null {
  return (
    schedules.find((schedule) =>
      direction.group
        ? schedule.groupId === direction.group.id
        : schedule.enrollmentId === direction.enrollmentId,
    ) ?? null
  );
}

/** The free-cancellation window a direction follows: its own, or the studio's. */
export function cancellationHours(
  direction: BillingDirection,
  studioHours: number,
): { hours: number; own: boolean } {
  return direction.cancellationDeadlineHours === null
    ? { hours: studioHours, own: false }
    : { hours: direction.cancellationDeadlineHours, own: true };
}

/** What a direction is called: its group, else what its teacher teaches, else the teacher. */
export function directionName(direction: BillingDirection): string {
  return direction.group?.name ?? direction.teacher.subjects[0] ?? direction.teacher.name;
}

export type MoneyMetric =
  | {
      kind: 'single';
      currency: string;
      /** Money received, refunds taken off. */
      paidMinor: number;
      /** Owed now: pay-per-lesson debt and what the current packages still cost. */
      owedMinor: number;
      payments: number;
      lastPaidAt: string | null;
    }
  | { kind: 'mixed' }
  | null;

/**
 * «Оплачено цього місяця» (decision 6; the owner chose the calendar month):
 * the money received this month from the student's ledger, refunds taken
 * off, and what is owed now, in one currency. Several currencies never add
 * up: the metric then reads «—» with «Кілька валют». Null when there is
 * nothing yet.
 */
export function moneyMetric(
  directions: readonly BillingDirection[],
  payments: readonly { status: string; currency: string; amountMinor: number; paidAt: string }[],
  now: number,
  timeZone: string,
): MoneyMetric {
  const month = zonedDate(now, timeZone).slice(0, 7);
  const thisMonth = (iso: string) => zonedDate(iso, timeZone).slice(0, 7) === month;
  const settled = payments.filter(
    (payment) =>
      (payment.status === 'PAID' || payment.status === 'REFUNDED') && thisMonth(payment.paidAt),
  );
  const live = directions.filter((direction) => direction.status !== 'ARCHIVED');
  const currencies = new Set([
    ...live.map((direction) => direction.currency),
    ...settled.map((payment) => payment.currency),
  ]);
  if (currencies.size > 1) return { kind: 'mixed' };
  const [currency] = [...currencies];
  if (!currency) return null;
  const received = settled.filter((payment) => payment.status === 'PAID');
  return {
    kind: 'single',
    currency,
    paidMinor: settled.reduce(
      (sum, payment) =>
        sum + (payment.status === 'PAID' ? payment.amountMinor : -payment.amountMinor),
      0,
    ),
    owedMinor: live.reduce((sum, direction) => {
      const pkg = currentPackage(direction);
      const packageOwed = pkg ? Math.max(pkg.totalPriceMinor - pkg.paidMinor, 0) : 0;
      return sum + direction.balance.debtMinor + packageOwed;
    }, 0),
    payments: received.length,
    lastPaidAt: received.reduce<string | null>(
      (last, payment) => (last === null || payment.paidAt > last ? payment.paidAt : last),
      null,
    ),
  };
}

export type BalanceMetric = NonNullable<ReturnType<typeof balanceMetric>>;
