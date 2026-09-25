import { canHaveMakeup } from '@tutorio/domain';
import type { LessonResponse } from '@tutorio/validation';

type PaymentLesson = Pick<
  LessonResponse,
  'status' | 'priceMinor' | 'groupId' | 'charges' | 'kind' | 'makeupLessonId'
>;

/**
 * What the payment cell says (S04 decision 6), from the lesson's charges:
 * held and paid, not paid or on debt, a group's paid share, a package
 * credit; before it is held «Оплата після»; free or cancelled free.
 */
export type PaymentView =
  | { kind: 'paid' }
  | { kind: 'unpaid' }
  | { kind: 'debt' }
  | { kind: 'package' }
  | { kind: 'group'; paid: number; total: number }
  | { kind: 'later' }
  | { kind: 'free' }
  | { kind: 'noCharge' };

export function paymentView(lesson: PaymentLesson): PaymentView {
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
  if (!charge) return lesson.priceMinor === 0 ? { kind: 'free' } : { kind: 'later' };
  if (charge.source === 'PACKAGE') return { kind: 'package' };
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
