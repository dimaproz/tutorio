import { packageLifecycle } from '@tutorio/domain';
import type {
  CreditEntryResponse,
  PackageDetailResponse,
  PackageResponse,
  PaymentResponse,
} from '@tutorio/validation';

/**
 * The ticket's state (S07 board 02): nothing used yet, in use, used up, or
 * its window closed with credits left. It picks the stub's tint and label
 * (decision 11: indigo new and active, grey used up, warning expired).
 */
export type TicketState = 'new' | 'active' | 'used' | 'expired';

type Credits = Pick<
  PackageResponse,
  'remainingCredits' | 'consumedCredits' | 'lessonsTotal' | 'expiresAt'
>;

export function ticketState(pkg: Credits, now: Date): TicketState {
  const lifecycle = packageLifecycle(
    {
      remainingCredits: pkg.remainingCredits,
      expiresAt: pkg.expiresAt ? new Date(pkg.expiresAt) : null,
    },
    now,
  );
  if (lifecycle !== 'active') return lifecycle;
  return pkg.consumedCredits === 0 ? 'new' : 'active';
}

/**
 * The dots of a package: one per credit it holds — filled while unused,
 * dashed once used. Corrections and transfers can leave more credits than
 * were sold, so the row is never shorter than what is left.
 */
export function creditDots(pkg: Credits): { left: number; total: number } {
  const left = Math.max(pkg.remainingCredits, 0);
  return { left, total: Math.max(pkg.lessonsTotal, left) };
}

/** What the package still costs: its price less refunds and what came in. */
export function owedMinor(
  pkg: Pick<PackageResponse, 'totalPriceMinorSnapshot' | 'refundedMinor' | 'paidMinor'>,
): number {
  return Math.max(pkg.totalPriceMinorSnapshot - pkg.refundedMinor - pkg.paidMinor, 0);
}

/** How much of the price is paid, 0–100 (a package with nothing to pay is paid). */
export function paidPercent(
  pkg: Pick<PackageResponse, 'totalPriceMinorSnapshot' | 'refundedMinor' | 'paidMinor'>,
): number {
  const due = pkg.totalPriceMinorSnapshot - pkg.refundedMinor;
  if (due <= 0) return 100;
  return Math.min(Math.round((pkg.paidMinor / due) * 100), 100);
}

export type TicketAction = 'pay' | 'sell' | 'extend' | 'transfer' | 'refund';

/**
 * The ticket's buttons, in board order, and the one that is primary: paying
 * while money is owed, extending once expired, selling a new package once
 * used up. Extending needs an end; moving needs credits left; a refund needs
 * credits or money to give back.
 */
export function ticketActions(
  pkg: Pick<
    PackageResponse,
    | 'remainingCredits'
    | 'expiresAt'
    | 'paidMinor'
    | 'totalPriceMinorSnapshot'
    | 'refundedMinor'
    | 'deletedAt'
  >,
  state: TicketState,
): { action: TicketAction; primary: boolean }[] {
  if (pkg.deletedAt) return [];
  const owes = owedMinor(pkg) > 0;
  const actions: { action: TicketAction; primary: boolean }[] = [];
  if (state === 'used') actions.push({ action: 'sell', primary: true });
  if (owes) actions.push({ action: 'pay', primary: state === 'new' || state === 'active' });
  if (pkg.expiresAt) actions.push({ action: 'extend', primary: state === 'expired' });
  if (pkg.remainingCredits > 0) actions.push({ action: 'transfer', primary: false });
  if (pkg.remainingCredits > 0 || pkg.paidMinor > 0) {
    actions.push({ action: 'refund', primary: false });
  }
  return actions;
}

/**
 * The callout under the metrics, first that applies: the window closed with
 * credits left; everything used; the end moved by a pause; waiting behind an
 * older package (L-81).
 */
export type TicketNotice =
  | { kind: 'expired'; lastDay: Date; unused: number }
  | { kind: 'used'; total: number }
  | {
      kind: 'paused';
      days: number;
      pauseFrom: string;
      pauseTo: string | null;
      endBefore: Date | null;
      endAfter: Date | null;
    }
  | { kind: 'ahead'; name: string | null; credits: number; lastLessonAt: string | null }
  | null;

const DAY_SECONDS = 24 * 60 * 60;

export function ticketNotice(pkg: PackageDetailResponse, state: TicketState): TicketNotice {
  if (state === 'expired' && pkg.expiresAt) {
    return {
      kind: 'expired',
      lastDay: new Date(Date.parse(pkg.expiresAt) - 1),
      unused: Math.max(pkg.remainingCredits, 0),
    };
  }
  if (state === 'used') return { kind: 'used', total: pkg.lessonsTotal };
  const extension = pkg.pauseExtensions.at(-1);
  if (extension && pkg.expiresAt) {
    const seconds = pkg.pauseExtensions.reduce((sum, row) => sum + row.extendedBySeconds, 0);
    const end = Date.parse(pkg.expiresAt);
    return {
      kind: 'paused',
      days: Math.round(seconds / DAY_SECONDS),
      pauseFrom: extension.startsAt,
      pauseTo: extension.endsAt,
      endBefore: new Date(end - seconds * 1000 - 1),
      endAfter: new Date(end - 1),
    };
  }
  if (pkg.ahead) {
    return {
      kind: 'ahead',
      name: pkg.ahead.name,
      credits: pkg.ahead.remainingCredits,
      lastLessonAt: pkg.ahead.lastLessonAt,
    };
  }
  return null;
}

/** Days the pauses added to the end (L-102). */
export function pauseDays(pkg: Pick<PackageDetailResponse, 'pauseExtensions'>): number {
  return Math.round(
    pkg.pauseExtensions.reduce((sum, row) => sum + row.extendedBySeconds, 0) / DAY_SECONDS,
  );
}

/** The lessons a package paid for, newest first (the «Заняття» tab). */
export function ticketLessons(items: readonly CreditEntryResponse[]) {
  return items
    .filter(
      (
        item,
      ): item is CreditEntryResponse & { lesson: NonNullable<CreditEntryResponse['lesson']> } =>
        item.type === 'lesson' && item.lesson !== null,
    )
    .map((item) => item.lesson)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
}

export type HistoryEvent =
  | { id: string; at: string; kind: 'purchase'; credits: number }
  | { id: string; at: string; kind: 'adjustment'; credits: number; note: string | null }
  | { id: string; at: string; kind: 'transferOut' | 'transferIn'; credits: number }
  | { id: string; at: string; kind: 'refundCredits'; credits: number; note: string | null }
  | {
      id: string;
      at: string;
      kind: 'payment' | 'refund';
      amountMinor: number;
      method: PaymentResponse['method'];
    }
  | { id: string; at: string; kind: 'pause'; days: number; from: string; to: string | null }
  | { id: string; at: string; kind: 'extend'; from: string | null; to: string };

/**
 * «Історія»: what happened to the package apart from its lessons — the sale,
 * corrections, transfers and refunds of credits, the money in and back, the
 * extensions by hand and the pauses that moved its end — newest first.
 */
export function ticketHistory(
  ledger: readonly CreditEntryResponse[],
  payments: readonly PaymentResponse[],
  pkg: Pick<PackageDetailResponse, 'pauseExtensions' | 'manualExtensions'>,
): HistoryEvent[] {
  const events: HistoryEvent[] = [];
  for (const item of ledger) {
    const base = { id: item.id, at: item.createdAt };
    if (item.type === 'purchase') events.push({ ...base, kind: 'purchase', credits: item.delta });
    if (item.type === 'manual_adjustment') {
      events.push({ ...base, kind: 'adjustment', credits: item.delta, note: item.note });
    }
    if (item.type === 'transfer_out' || item.type === 'transfer_in') {
      events.push({
        ...base,
        kind: item.type === 'transfer_out' ? 'transferOut' : 'transferIn',
        credits: Math.abs(item.delta),
      });
    }
    if (item.type === 'refund') {
      events.push({ ...base, kind: 'refundCredits', credits: -item.delta, note: item.note });
    }
  }
  for (const payment of payments) {
    if (payment.status !== 'PAID' && payment.status !== 'REFUNDED') continue;
    events.push({
      id: payment.id,
      at: payment.paidAt,
      kind: payment.status === 'PAID' ? 'payment' : 'refund',
      amountMinor: payment.amountMinor,
      method: payment.method,
    });
  }
  for (const extension of pkg.pauseExtensions) {
    events.push({
      id: extension.pauseId,
      at: extension.endsAt ?? extension.startsAt,
      kind: 'pause',
      days: Math.round(extension.extendedBySeconds / DAY_SECONDS),
      from: extension.startsAt,
      to: extension.endsAt,
    });
  }
  pkg.manualExtensions.forEach((extension, index) => {
    events.push({
      id: `extend-${index}`,
      at: extension.at,
      kind: 'extend',
      from: extension.from,
      to: extension.to,
    });
  });
  return events.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}

/** How many payments came in (the «Сплачено» footer: «1 оплата»). */
export function paymentsIn(payments: readonly PaymentResponse[]): number {
  return payments.filter((payment) => payment.status === 'PAID').length;
}

/**
 * Whether a package can be deleted (decision 9): nothing charged and no
 * money in or back — otherwise it is refunded instead.
 */
export function deletable(
  pkg: Pick<PackageResponse, 'consumedCredits'>,
  payments: readonly PaymentResponse[],
): boolean {
  return pkg.consumedCredits === 0 && payments.length === 0;
}
