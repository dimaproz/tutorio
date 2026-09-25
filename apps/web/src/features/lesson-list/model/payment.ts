import { canHaveMakeup } from '@tutorio/domain';
import type { LessonResponse } from '@tutorio/validation';

type PaymentLesson = Pick<
  LessonResponse,
  'status' | 'priceMinor' | 'groupId' | 'charges' | 'kind' | 'makeupLessonId'
>;

/** The package a direction pays with now: its credits left and its size. */
export type PackageState = { left: number; total: number };

/**
 * What the payment cell says (S04 decision 6), from the lesson's charges:
 * held and paid, not paid or on debt, a group's paid share, a package
 * credit — with what is left of the direction's package now, «Пакет · 3 з
 * 8»; before it is held «Оплата після», or the package that will pay for it;
 * free or cancelled free.
 */
export type PaymentView =
  | { kind: 'paid' }
  | { kind: 'unpaid' }
  | { kind: 'debt' }
  | { kind: 'package'; state: PackageState | null }
  | { kind: 'group'; paid: number; total: number }
  | { kind: 'later' }
  | { kind: 'free' }
  | { kind: 'noCharge' };

export function paymentView(
  lesson: PaymentLesson,
  /** The package the lesson's direction pays with now, when it is paid by packages. */
  pkg: PackageState | null = null,
): PaymentView {
  if (lesson.status === 'CANCELLED_UNCHARGED') return { kind: 'noCharge' };
  const charges = lesson.charges;
  if (lesson.groupId !== null && charges.length > 0) {
    return {
      kind: 'group',
      paid: charges.filter((charge) => charge.paid).length,
      total: charges.length,
    };
  }
  const charge = charges[0];
  if (!charge) {
    if (lesson.priceMinor === 0) return { kind: 'free' };
    return lesson.status === 'SCHEDULED' && pkg
      ? { kind: 'package', state: pkg }
      : { kind: 'later' };
  }
  if (charge.source === 'PACKAGE') return { kind: 'package', state: pkg };
  if (charge.source === 'DEBT') return { kind: 'debt' };
  return charge.paid ? { kind: 'paid' } : { kind: 'unpaid' };
}

/** A cancelled or missed individual lesson with no makeup yet (L-60, L-62). */
export function needsMakeup(
  lesson: Pick<PaymentLesson, 'status' | 'groupId' | 'makeupLessonId'>,
): boolean {
  return lesson.groupId === null && canHaveMakeup(lesson.status) && lesson.makeupLessonId === null;
}

/** The line under the name: a group lesson, a makeup, or an individual one. */
export function lessonKind(lesson: Pick<PaymentLesson, 'groupId' | 'kind'>) {
  if (lesson.groupId !== null) return 'group' as const;
  return lesson.kind === 'MAKEUP' ? ('makeup' as const) : ('individual' as const);
}
