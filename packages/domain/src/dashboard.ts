/**
 * The owner's Today dashboard (S11): the studio's day and month on its own
 * clock, the exceptions to act on, and where the money stands
 * (product/scheduling.md L-50, L-60, L-72, L-74, L-82, L-84, L-87, L-90,
 * L-91, L-100, L-103, L-120).
 *
 * Money is always per currency — nothing here converts or adds currencies.
 */

import { packageLifecycle } from './package';
import { pauseEnd, pauseStateAt, type PauseWindow } from './pause';
import { isCancelledStatus, lessonEndsAt, type LessonStatus } from './lesson-state';
import {
  addCalendarMonths,
  calendarMonthStart,
  zonedDate,
  zonedDayEnd,
  zonedDayStart,
} from './wall-clock';

const DAY_MS = 24 * 60 * 60 * 1000;

/** «Потребує уваги»: the categories in their fixed order, lessons first. */
export const ATTENTION_KINDS = [
  'attendance',
  'makeups',
  'debtors',
  'unpaidPackages',
  'endingPackages',
  'expiringPackages',
  'pauses',
] as const;
export type AttentionKind = (typeof ATTENTION_KINDS)[number];

/** How many rows an open category lists before «Усі N →». */
export const ATTENTION_PREVIEW = 3;
/** A package window closing within this many days with credits left. */
export const EXPIRY_WARNING_DAYS = 3;
/** A pause ending within this many days. */
export const PAUSE_RETURN_DAYS = 3;
/** An open-ended pause running longer than this many days. */
export const OPEN_PAUSE_DAYS = 30;
/** How far «До оплати» looks ahead. */
export const DUE_FORECAST_DAYS = 7;

export interface StudioPeriods {
  /** The studio's calendar date, "yyyy-MM-dd". */
  today: string;
  dayStart: Date;
  dayEnd: Date;
  monthStart: Date;
  monthEnd: Date;
}

/** Today and this month on the studio's clock. */
export function studioPeriods(now: Date, timeZone: string): StudioPeriods {
  const today = zonedDate(now, timeZone);
  const month = calendarMonthStart(today);
  return {
    today,
    dayStart: zonedDayStart(today, timeZone),
    dayEnd: zonedDayEnd(today, timeZone),
    monthStart: zonedDayStart(month, timeZone),
    monthEnd: zonedDayStart(addCalendarMonths(month, 1), timeZone),
  };
}

export interface AttendanceCandidate {
  isGroup: boolean;
  status: LessonStatus;
  startsAtUtc: Date;
  durationMin: number;
  /** A person marked or confirmed the attendance (not the automation, L-72). */
  confirmed: boolean;
}

/**
 * A group lesson that is over, not cancelled, whose attendance nobody
 * confirmed: everyone counts as present until the tutor marks the
 * exceptions (L-72, L-74).
 */
export function needsAttendance(lesson: AttendanceCandidate, now: Date): boolean {
  return (
    lesson.isGroup &&
    !lesson.confirmed &&
    !isCancelledStatus(lesson.status) &&
    lessonEndsAt(lesson).getTime() <= now.getTime()
  );
}

/**
 * A live package whose window closes within {@link EXPIRY_WARNING_DAYS} while
 * credits are left: they would expire unused (L-84).
 */
export function expiresUnused(
  pkg: { remainingCredits: number; expiresAt: Date | null },
  now: Date,
): boolean {
  if (pkg.expiresAt === null || packageLifecycle(pkg, now) !== 'active') return false;
  return pkg.expiresAt.getTime() - now.getTime() <= EXPIRY_WARNING_DAYS * DAY_MS;
}

/** Why a pause needs a look: the student returns soon, or has been away with no date for long. */
export type PauseAttention = 'RETURNING' | 'OPEN_LONG';

/**
 * A running pause ending within {@link PAUSE_RETURN_DAYS} (L-103), or an
 * open-ended one running longer than {@link OPEN_PAUSE_DAYS}.
 */
export function pauseAttention(pause: PauseWindow, now: Date): PauseAttention | null {
  if (pauseStateAt(pause, now) !== 'ACTIVE') return null;
  const end = pauseEnd(pause);
  if (end === null) {
    return now.getTime() - pause.startsAt.getTime() > OPEN_PAUSE_DAYS * DAY_MS ? 'OPEN_LONG' : null;
  }
  return end.getTime() - now.getTime() <= PAUSE_RETURN_DAYS * DAY_MS ? 'RETURNING' : null;
}

/**
 * Whether a direction's current package will likely be bought again within
 * {@link DUE_FORECAST_DAYS}: its window closes in that time, or the lessons
 * booked in that time use up its credits.
 */
export function expectsRenewal(
  pkg: { creditsLeft: number; expiresAt: Date | null; upcomingLessons: number },
  now: Date,
): boolean {
  if (pkg.upcomingLessons <= 0) return false;
  if (pkg.expiresAt !== null && pkg.expiresAt.getTime() - now.getTime() <= DUE_FORECAST_DAYS * DAY_MS) {
    return true;
  }
  return pkg.creditsLeft <= pkg.upcomingLessons;
}

export interface DueSource {
  currency: string;
  /** The current package's price when a renewal is expected, else null. */
  renewalMinor: number | null;
  /** What a sold package still owes. */
  owedMinor: number;
}

export interface CurrencyDue {
  currency: string;
  amountMinor: number;
  packages: number;
}

/**
 * «До оплати за 7 днів ≈»: the expected renewals plus the unpaid rest of the
 * packages already sold, per currency; a package counts once.
 */
export function dueForecast(sources: readonly DueSource[]): CurrencyDue[] {
  const byCurrency = new Map<string, CurrencyDue>();
  for (const source of sources) {
    const amount = (source.renewalMinor ?? 0) + Math.max(0, source.owedMinor);
    if (amount <= 0) continue;
    const due = byCurrency.get(source.currency) ?? { currency: source.currency, amountMinor: 0, packages: 0 };
    due.amountMinor += amount;
    due.packages += 1;
    byCurrency.set(source.currency, due);
  }
  return byCurrency.size === 0 ? [] : sortedByCurrency([...byCurrency.values()]);
}

export interface ReceivedPayment {
  amountMinor: number;
  currency: string;
  status: 'PAID' | 'REFUNDED';
  paidAt: Date;
}

export interface CurrencyReceived {
  currency: string;
  monthMinor: number;
  todayMinor: number;
}

/**
 * «Отримано у вересні»: the money recorded this studio month, refunds taken
 * off, with what came in today; per currency.
 */
export function receivedTotals(
  payments: readonly ReceivedPayment[],
  periods: Pick<StudioPeriods, 'dayStart' | 'dayEnd' | 'monthStart' | 'monthEnd'>,
): CurrencyReceived[] {
  const within = (at: Date, from: Date, until: Date) =>
    at.getTime() >= from.getTime() && at.getTime() < until.getTime();
  const byCurrency = new Map<string, CurrencyReceived>();
  for (const payment of payments) {
    if (!within(payment.paidAt, periods.monthStart, periods.monthEnd)) continue;
    const sign = payment.status === 'REFUNDED' ? -1 : 1;
    const total = byCurrency.get(payment.currency) ?? { currency: payment.currency, monthMinor: 0, todayMinor: 0 };
    total.monthMinor += sign * payment.amountMinor;
    if (within(payment.paidAt, periods.dayStart, periods.dayEnd)) {
      total.todayMinor += sign * payment.amountMinor;
    }
    byCurrency.set(payment.currency, total);
  }
  return sortedByCurrency([...byCurrency.values()]);
}

export interface DebtEntry {
  studentId: string;
  currency: string;
  amountMinor: number;
  /** Lessons not paid for. */
  lessons: number;
  /** The oldest unpaid lesson. */
  oldestAt: Date;
}

export interface DebtSummary {
  /** One row per student and currency, the largest debt first. */
  rows: DebtEntry[];
  /** «18 400 ₴ · у 5 учнів» per currency. */
  totals: { currency: string; amountMinor: number; students: number }[];
}

/**
 * Debtors (L-82, L-90): pay-per-lesson debt and lessons held on debt in
 * package mode, summed per student and currency.
 */
export function debtorsOf(entries: readonly DebtEntry[]): DebtSummary {
  const rows = new Map<string, DebtEntry>();
  for (const entry of entries) {
    if (entry.amountMinor <= 0 && entry.lessons <= 0) continue;
    const key = `${entry.studentId}:${entry.currency}`;
    const row = rows.get(key);
    rows.set(
      key,
      row
        ? {
            ...row,
            amountMinor: row.amountMinor + entry.amountMinor,
            lessons: row.lessons + entry.lessons,
            oldestAt: row.oldestAt.getTime() <= entry.oldestAt.getTime() ? row.oldestAt : entry.oldestAt,
          }
        : { ...entry },
    );
  }
  const ordered = [...rows.values()].sort(
    (a, b) =>
      b.amountMinor - a.amountMinor ||
      b.lessons - a.lessons ||
      a.oldestAt.getTime() - b.oldestAt.getTime() ||
      a.studentId.localeCompare(b.studentId),
  );
  const totals = new Map<string, { currency: string; amountMinor: number; students: number }>();
  for (const row of ordered) {
    const total = totals.get(row.currency) ?? { currency: row.currency, amountMinor: 0, students: 0 };
    total.amountMinor += row.amountMinor;
    total.students += 1;
    totals.set(row.currency, total);
  }
  return { rows: ordered, totals: sortedByCurrency([...totals.values()]) };
}

/** A collapsed category's summary: the first `count` names, each once. */
export function summaryNames(names: readonly string[], count = 2): string[] {
  return [...new Set(names)].slice(0, count);
}

function sortedByCurrency<T extends { currency: string }>(rows: T[]): T[] {
  return rows.sort((a, b) => a.currency.localeCompare(b.currency));
}
