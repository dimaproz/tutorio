import { resolveDefaultPrice } from '@tutorio/domain';
import type { PauseResponse, StudentBillingResponse } from '@tutorio/validation';
import type { LessonTarget, PriceMode } from './create';

export type Direction = StudentBillingResponse['directions'][number];

/**
 * A student's direction the form books into when no teacher says otherwise:
 * the first individual one that is not archived (the API's own pick for a
 * bare student is the oldest).
 */
export function primaryDirection(billing: StudentBillingResponse | undefined): Direction | null {
  return (
    billing?.directions.find(
      (direction) => direction.group === null && direction.status !== 'ARCHIVED',
    ) ?? null
  );
}

/** What a student booking resolves to for the picked teacher. */
export type StudentBooking = {
  /** The direction the lessons go to, if any. */
  direction: Direction | null;
  /** The direction's teacher is not the picked one: a substitute for these lessons. */
  substitute: boolean;
  target: LessonTarget;
  priceMode: Exclude<PriceMode, 'group' | 'none'>;
  /** The price the field starts from: the rate of the pair (L-11). */
  rateMinor: number;
  currency: string;
};

/**
 * Where a one-off booking for a student goes (L-2, L-10, L-11):
 *
 * - the student's direction with the picked teacher, when there is one;
 * - otherwise, when the student has a direction, that direction with the
 *   picked teacher as a substitute for these lessons only (the mockup's
 *   «Заміна … лише для цих занять»);
 * - otherwise a new direction for the pair, paid per lesson (L-10).
 *
 * A package direction costs a credit; any other books an amount — the pair's
 * rate, a substitute's own rate, or the default rate of a new pair.
 */
export function resolveStudentBooking({
  studentId,
  teacherId,
  billing,
  teacherRate,
  studentRate,
  defaultCurrency,
}: {
  studentId: string;
  teacherId: string;
  billing: StudentBillingResponse | undefined;
  teacherRate: { amountMinor: number | null; currency: string | null } | null;
  studentRate: { amountMinor: number | null; currency: string | null } | null;
  defaultCurrency: string;
}): StudentBooking {
  const own =
    billing?.directions.find(
      (direction) =>
        direction.group === null &&
        direction.status !== 'ARCHIVED' &&
        direction.teacher.id === teacherId,
    ) ?? null;
  const direction = own ?? primaryDirection(billing);

  if (!direction) {
    const price = resolveDefaultPrice({
      student: studentRate ?? undefined,
      teacher: teacherRate ?? undefined,
    } as Parameters<typeof resolveDefaultPrice>[0]);
    return {
      direction: null,
      substitute: false,
      target: { kind: 'newDirection', studentId },
      priceMode: 'amount',
      rateMinor: price?.priceMinor ?? 0,
      currency: price?.currency ?? defaultCurrency,
    };
  }

  const substitute = own === null;
  const rateMinor =
    substitute && teacherRate?.amountMinor != null ? teacherRate.amountMinor : direction.rateMinor;
  return {
    direction,
    substitute,
    target: { kind: 'direction', enrollmentId: direction.enrollmentId },
    priceMode: direction.billingType === 'PACKAGE' ? 'package' : 'amount',
    rateMinor,
    currency: direction.currency,
  };
}

/** The package that pays next: the oldest usable one with credits (L-81). */
export function payingPackage(direction: Direction | null) {
  return (
    direction?.packages
      .filter((pkg) => pkg.usable && pkg.remainingCredits > 0)
      .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt))[0] ?? null
  );
}

/**
 * The pause of a student at an instant (L-100): one for the whole student or
 * for the direction that covers it, in force then.
 */
export function pauseAt(
  pauses: readonly PauseResponse[],
  studentId: string,
  at: number,
  enrollmentId?: string | null,
): PauseResponse | null {
  return (
    pauses.find(
      (pause) =>
        pause.studentId === studentId &&
        (pause.enrollmentId === null || pause.enrollmentId === enrollmentId) &&
        Date.parse(pause.startsAt) <= at &&
        (pause.endsAt === null || Date.parse(pause.endsAt) > at),
    ) ?? null
  );
}
