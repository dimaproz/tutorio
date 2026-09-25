import { transferCredits } from '@tutorio/domain';
import type {
  AdjustBalanceDto,
  ExtendPackageDto,
  PackageResponse,
  PaymentMethodDto,
  RecordPaymentDto,
  RefundPackageDto,
  TransferPackageDto,
} from '@tutorio/validation';
import { z } from 'zod';
import { zonedIso } from '@/lib/datetime';
import { parsePriceInput } from '@/lib/money';
import { endOfDayExclusive, isDayKey } from './dates';
import { moneyText } from './sale';
import { owedMinor } from './ticket';

/** The methods the dialogs offer, transfer first (decision 7). */
export const METHODS = [
  'BANK_TRANSFER',
  'CASH',
  'OTHER',
] as const satisfies readonly PaymentMethodDto[];

type Issue = (path: string, key: string) => void;

const issuer =
  (ctx: z.RefinementCtx): Issue =>
  (path, key) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], params: { key } });

/** A paid date: the moment now when it is today, else that day at the studio's noon. */
function paidAtOf(day: string, today: string, now: Date, timeZone: string): string {
  return day === today ? now.toISOString() : zonedIso(day, '12:00', timeZone);
}

// ---------------------------------------------------------------------------
// «Оплата за пакет» (board 03, states 01–02)
// ---------------------------------------------------------------------------

/** Amount (capped at what the package still costs, OVERPAYMENT), date, method, note. */
export function packagePaymentSchema(leftMinor: number) {
  return z
    .object({
      amount: z.string(),
      paidAt: z.string(),
      method: z.enum(METHODS),
      note: z.string().max(2000),
    })
    .superRefine((values, ctx) => {
      const issue = issuer(ctx);
      const amount = parsePriceInput(values.amount);
      if (values.amount.trim() === '' || amount === 0) issue('amount', 'amountRequired');
      else if (amount === null) issue('amount', 'priceInvalid');
      else if (amount > leftMinor) issue('amount', 'amountOverLeft');
      if (!isDayKey(values.paidAt)) issue('paidAt', 'dateRequired');
    });
}

export type PackagePaymentValues = z.infer<ReturnType<typeof packagePaymentSchema>>;

export function packagePaymentDefaults(pkg: PackageResponse, today: string): PackagePaymentValues {
  const left = owedMinor(pkg);
  return {
    amount: left > 0 ? moneyText(left) : '',
    paidAt: today,
    method: 'BANK_TRANSFER',
    note: '',
  };
}

export function packagePaymentDto(
  values: PackagePaymentValues,
  pkg: PackageResponse,
  today: string,
  now: Date,
  timeZone: string,
): RecordPaymentDto {
  return {
    enrollmentId: pkg.enrollmentId,
    packageId: pkg.id,
    amountMinor: parsePriceInput(values.amount) ?? 0,
    currency: pkg.currency,
    method: values.method,
    paidAt: paidAtOf(values.paidAt, today, now, timeZone),
    ...(values.note.trim() ? { note: values.note.trim() } : {}),
  };
}

// ---------------------------------------------------------------------------
// «Продовжити термін» (board 03, state 03)
// ---------------------------------------------------------------------------

/** A new last day: after today and after the current one (L-84). */
export function extendSchema(today: string, currentLastDay: string) {
  return z.object({ until: z.string() }).superRefine((values, ctx) => {
    const issue = issuer(ctx);
    if (!isDayKey(values.until)) issue('until', 'dateRequired');
    else if (values.until <= today) issue('until', 'dateAfterToday');
    else if (values.until <= currentLastDay) issue('until', 'dateAfterCurrentEnd');
  });
}

export type ExtendValues = z.infer<ReturnType<typeof extendSchema>>;

export function extendDto(values: ExtendValues, timeZone: string): ExtendPackageDto {
  return { expiresAt: endOfDayExclusive(values.until, timeZone).toISOString() };
}

// ---------------------------------------------------------------------------
// «Перенести заняття» (board 03, state 04)
// ---------------------------------------------------------------------------

/** How many credits (1…left) and where to (the same student's direction in the same currency). */
export function transferSchema(left: number) {
  return z
    .object({ credits: z.string(), toEnrollmentId: z.string() })
    .superRefine((values, ctx) => {
      const issue = issuer(ctx);
      const credits = Number(values.credits);
      if (!/^\d+$/.test(values.credits.trim()) || credits < 1 || credits > left) {
        issue('credits', 'creditsRange');
      }
      if (!values.toEnrollmentId) issue('toEnrollmentId', 'directionRequired');
    });
}

export type TransferValues = z.infer<ReturnType<typeof transferSchema>>;

export function transferDto(values: TransferValues): TransferPackageDto {
  return { toEnrollmentId: values.toEnrollmentId, credits: Number(values.credits) };
}

/**
 * «Перерахунок за ціною» (L-85): the moved credits' value at this package's
 * price, the lessons it buys at the target's rate rounded down, and what is
 * left over — the API's own arithmetic. Null when it buys nothing.
 */
export function transferPreview(credits: number, fromPriceMinor: number, toPriceMinor: number) {
  if (!Number.isInteger(credits) || credits < 1) return null;
  const moved = transferCredits(credits, fromPriceMinor, toPriceMinor);
  return {
    ...moved,
    targetValueMinor: moved.valueMinor - moved.remainderMinor,
  };
}

// ---------------------------------------------------------------------------
// «Повернення» (board 03, state 05)
// ---------------------------------------------------------------------------

/**
 * Take the unused credits back and/or return money (at least one), the
 * amount no more than was paid for what is unused, the date, the method and
 * a reason (L-85).
 */
export function refundSchema(pkg: PackageResponse) {
  return z
    .object({
      takeCredits: z.boolean(),
      returnMoney: z.boolean(),
      amount: z.string(),
      paidAt: z.string(),
      method: z.enum(METHODS),
      note: z.string().max(2000),
    })
    .superRefine((values, ctx) => {
      const issue = issuer(ctx);
      if (!values.takeCredits && !values.returnMoney) issue('takeCredits', 'refundNothing');
      if (values.returnMoney) {
        const amount = parsePriceInput(values.amount);
        if (values.amount.trim() === '' || amount === 0) issue('amount', 'amountRequired');
        else if (amount === null) issue('amount', 'priceInvalid');
        else if (amount > refundCap(pkg, values.takeCredits)) issue('amount', 'refundOverPaid');
        if (!isDayKey(values.paidAt)) issue('paidAt', 'dateRequired');
      }
      if (values.note.trim() === '') issue('note', 'noteRequired');
    });
}

export type RefundValues = z.infer<ReturnType<typeof refundSchema>>;

/**
 * The most a refund returns: what was paid, and with the credits taken back
 * no more than those credits cost («не більше сплаченого за невикористане»).
 */
export function refundCap(pkg: PackageResponse, takeCredits: boolean): number {
  const paid = Math.max(pkg.paidMinor, 0);
  if (!takeCredits) return paid;
  return Math.min(paid, Math.max(pkg.remainingCredits, 0) * pkg.pricePerLessonMinorSnapshot);
}

export function refundDefaults(pkg: PackageResponse, today: string): RefundValues {
  const takeCredits = pkg.remainingCredits > 0;
  const cap = refundCap(pkg, takeCredits);
  return {
    takeCredits,
    returnMoney: cap > 0,
    amount: cap > 0 ? moneyText(cap) : '',
    paidAt: today,
    method: 'BANK_TRANSFER',
    note: '',
  };
}

/** The request, with «Переказ» sent explicitly (the schema's default is cash, decision 7). */
export function refundDto(
  values: RefundValues,
  pkg: PackageResponse,
  today: string,
  now: Date,
  timeZone: string,
): RefundPackageDto {
  return {
    credits: values.takeCredits ? Math.max(pkg.remainingCredits, 0) : 0,
    amountMinor: values.returnMoney ? (parsePriceInput(values.amount) ?? 0) : 0,
    method: values.method,
    paidAt: paidAtOf(values.paidAt, today, now, timeZone),
    note: values.note.trim(),
  };
}

// ---------------------------------------------------------------------------
// «Коригування занять» (board 03, state 06)
// ---------------------------------------------------------------------------

/** A signed change that leaves no fewer than zero credits, and why. */
export function adjustSchema(left: number) {
  return z
    .object({ delta: z.number().int(), note: z.string().max(2000) })
    .superRefine((values, ctx) => {
      const issue = issuer(ctx);
      if (values.delta === 0) issue('delta', 'deltaNotZero');
      else if (left + values.delta < 0) issue('delta', 'deltaBelowZero');
      if (values.note.trim() === '') issue('note', 'noteRequired');
    });
}

export type AdjustValues = z.infer<ReturnType<typeof adjustSchema>>;

export function adjustDto(values: AdjustValues): AdjustBalanceDto {
  return { delta: values.delta, note: values.note.trim() };
}

/** The stepper's reach: down to no credits left, up to 50 at a time. */
export function adjustBounds(left: number) {
  return { min: -Math.max(left, 0), max: 50 };
}

/** The dots after a correction: left, added (green) and used (dashed); a minus draws no removed dot. */
export function adjustDots(
  pkg: Pick<PackageResponse, 'remainingCredits' | 'lessonsTotal'>,
  delta: number,
) {
  const left = Math.max(pkg.remainingCredits, 0);
  const used = Math.max(pkg.lessonsTotal - left, 0);
  return {
    left: delta >= 0 ? left : left + delta,
    added: Math.max(delta, 0),
    used,
  };
}
