import { isChargedStatus, makeupIsFree } from '@tutorio/domain';
import type {
  EnrollmentBillingResponse,
  LessonDetailResponse,
  PackageResponse,
} from '@tutorio/validation';

export type PaymentSegment = 'used' | 'current' | 'charged' | 'available';

/** The package a lesson draws on, as the payment card describes it. */
export type PaymentPackage = {
  name: string | null;
  lessonsTotal: number;
  totalPriceMinor: number;
  currency: string;
  expiresAt: string | null;
};

/** Why a package credit went on this lesson. */
export type ChargeReason = 'held' | 'noShow' | 'lateCancel';

export type PaymentView =
  | { kind: 'pending' }
  | {
      kind: 'package';
      /** upcoming: will draw a credit; charged: drew one; free: cancelled without. */
      state: 'upcoming' | 'charged' | 'free';
      reason: ChargeReason | null;
      package: PaymentPackage;
      /** The big number: credits left after this lesson (upcoming) or now. */
      left: number;
      segments: PaymentSegment[];
      /** Upcoming and the package's last credit: the next lesson is not covered. */
      last: boolean;
      /** When `last`, the next lesson of the direction, if one is booked. */
      nextLessonAt: string | null;
    }
  /** Package mode and nothing left to pay for it: on debt (L-82). */
  | { kind: 'packageEmpty'; state: 'upcoming' | 'charged' }
  | {
      kind: 'oneOff';
      state: 'upcoming' | 'paid' | 'unpaid' | 'free';
      amountMinor: number;
      currency: string;
      /** When it was charged (held, cancelled, missed). */
      chargedAt: string | null;
      paidAt: string | null;
    }
  | { kind: 'freeMakeup'; originalStartsAt: string | null };

export type PaymentInput = {
  lesson: Pick<
    LessonDetailResponse,
    | 'status'
    | 'kind'
    | 'charges'
    | 'priceMinor'
    | 'currency'
    | 'paidAt'
    | 'startsAtUtc'
    | 'completedAt'
    | 'cancelledAt'
    | 'original'
  >;
  /** The direction's billing; undefined while it loads. */
  billing: EnrollmentBillingResponse | undefined;
  /** The package paying (or about to pay) for the lesson; undefined while it loads. */
  pkg: PackageResponse | null | undefined;
  /** Scheduled lessons of the direction between now and this one. */
  lessonsBefore: number;
  /** The direction's next scheduled lesson after this one. */
  nextLessonAt: string | null;
};

/**
 * The package a lesson will draw its credit from: the charge's own package
 * once charged, else the oldest usable package with a credit left (L-81).
 * Null when there is none.
 */
export function payingPackageId(
  lesson: Pick<LessonDetailResponse, 'charges'>,
  billing: EnrollmentBillingResponse | undefined,
): string | null {
  const charged = lesson.charges.find((charge) => charge.packageId)?.packageId;
  if (charged) return charged;
  const usable = [...(billing?.packages ?? [])]
    .filter((pkg) => pkg.usable && pkg.remainingCredits > 0)
    .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt) || a.id.localeCompare(b.id));
  return usable[0]?.id ?? null;
}

function meter(total: number, used: number, mark: PaymentSegment | null): PaymentSegment[] {
  return Array.from({ length: total }, (_, index) => {
    if (index < used) return 'used';
    if (mark && index === used) return mark;
    return 'available';
  });
}

const REASON: Partial<Record<LessonDetailResponse['status'], ChargeReason>> = {
  COMPLETED: 'held',
  NO_SHOW: 'noShow',
  CANCELLED_CHARGED: 'lateCancel',
};

/**
 * How an individual lesson is paid (S01 decision 1: a package lesson shows
 * one credit and the package balance, never a money price).
 *
 * - A makeup whose original was charged is free (L-61).
 * - Package mode: an upcoming lesson draws the credit left after the lessons
 *   booked before it; a charged one shows what is left now; a free
 *   cancellation shows the credit back in the package. With no credit it is
 *   on debt.
 * - Pay per lesson: the price, then whether its charge is paid.
 */
export function paymentView({
  lesson,
  billing,
  pkg,
  lessonsBefore,
  nextLessonAt,
}: PaymentInput): PaymentView {
  if (lesson.kind === 'MAKEUP' && lesson.original && makeupIsFree(lesson.original.status)) {
    return { kind: 'freeMakeup', originalStartsAt: lesson.original.startsAtUtc };
  }
  const charge = lesson.charges[0] ?? null;
  const charged = isChargedStatus(lesson.status) && charge !== null;
  const packageMode =
    charge?.source === 'PACKAGE' ||
    charge?.source === 'DEBT' ||
    (!charge && billing?.billingType === 'PACKAGE');

  if (packageMode) {
    if (charge?.source === 'DEBT') return { kind: 'packageEmpty', state: 'charged' };
    if (pkg === undefined) return { kind: 'pending' };
    if (pkg === null) {
      return lesson.status === 'CANCELLED_UNCHARGED'
        ? { kind: 'packageEmpty', state: 'charged' }
        : { kind: 'packageEmpty', state: 'upcoming' };
    }
    const total = Math.max(pkg.lessonsTotal, 0);
    const described: PaymentPackage = {
      name: pkg.name,
      lessonsTotal: total,
      totalPriceMinor: pkg.totalPriceMinorSnapshot,
      currency: pkg.currency,
      expiresAt: pkg.expiresAt,
    };
    const remaining = Math.max(pkg.remainingCredits, 0);

    if (charged) {
      const reason = REASON[lesson.status] ?? 'held';
      return {
        kind: 'package',
        state: 'charged',
        reason,
        package: described,
        left: remaining,
        segments: meter(
          total,
          Math.max(total - remaining - 1, 0),
          reason === 'held' ? 'used' : 'charged',
        ),
        last: false,
        nextLessonAt: null,
      };
    }
    if (lesson.status !== 'SCHEDULED') {
      return {
        kind: 'package',
        state: 'free',
        reason: null,
        package: described,
        left: remaining,
        segments: meter(total, total - remaining, null),
        last: false,
        nextLessonAt: null,
      };
    }
    const available = remaining - lessonsBefore;
    if (available < 1) return { kind: 'packageEmpty', state: 'upcoming' };
    const left = available - 1;
    return {
      kind: 'package',
      state: 'upcoming',
      reason: null,
      package: described,
      left,
      segments: meter(total, Math.max(total - left - 1, 0), 'current'),
      last: left === 0,
      nextLessonAt: left === 0 ? nextLessonAt : null,
    };
  }

  if (!charge && billing === undefined && lesson.status === 'SCHEDULED') {
    return { kind: 'pending' };
  }
  const chargedAt =
    lesson.status === 'COMPLETED'
      ? (lesson.completedAt ?? lesson.startsAtUtc)
      : lesson.status === 'SCHEDULED'
        ? null
        : (lesson.cancelledAt ?? lesson.startsAtUtc);
  return {
    kind: 'oneOff',
    state:
      lesson.status === 'SCHEDULED'
        ? 'upcoming'
        : !charged
          ? 'free'
          : charge.paid
            ? 'paid'
            : 'unpaid',
    amountMinor: charge?.amountMinor ?? lesson.priceMinor,
    currency: charge?.currency ?? lesson.currency,
    chargedAt: charged ? chargedAt : null,
    paidAt: charged && charge.paid ? lesson.paidAt : null,
  };
}

/**
 * Whether the lesson's price can still change (L-12): not for a package
 * lesson (always one credit) and not once its charge is paid.
 */
export function priceEditability(
  lesson: Pick<LessonDetailResponse, 'charges' | 'groupId'>,
  billing: EnrollmentBillingResponse | undefined,
): 'editable' | 'paid' | 'package' | 'group' {
  if (lesson.groupId) return 'group';
  const charge = lesson.charges[0];
  if (charge?.source === 'PACKAGE' || charge?.source === 'DEBT') return 'package';
  if (!charge && billing?.billingType === 'PACKAGE') return 'package';
  if (charge?.paid) return 'paid';
  return 'editable';
}
