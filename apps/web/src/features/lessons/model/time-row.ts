import type { LessonResponse } from '@tutorio/validation';
import type { LessonTimeRowState } from '@/components/shared/lesson-time-row';
import { awaitsAttendance } from './buckets';
import { lessonMoment } from './panel-actions';

export type TimeRowLesson = Pick<
  LessonResponse,
  | 'id'
  | 'enrollmentId'
  | 'student'
  | 'group'
  | 'groupMembers'
  | 'teacher'
  | 'topic'
  | 'originalStartsAtUtc'
  | 'status'
  | 'startsAtUtc'
  | 'durationMin'
  | 'groupId'
  | 'kind'
  | 'charges'
  | 'attendance'
  | 'cancelledBy'
  | 'rescheduledCount'
  | 'priceMinor'
>;

/** The package a direction pays with now: its credits left and its size. */
export type TimeRowPackage = { left: number; total: number };

/**
 * The one badge on the right of a desktop row (S11 section 3), in the order
 * the design reads them: what happened to the lesson first, then what is
 * running, then how it is paid.
 */
export type TimeRowBadge =
  | { kind: 'cancelled'; by: 'student' | 'teacher' }
  | { kind: 'cancelledCharged' }
  | { kind: 'noShow' }
  | { kind: 'markAttendance' }
  | { kind: 'now'; minutesLeft: number }
  | { kind: 'unpaid' }
  | { kind: 'held' }
  | { kind: 'groupPaid'; paid: number; total: number }
  | { kind: 'package'; left: number; total: number; low: boolean }
  | { kind: 'perLesson' };

/** The one mark on the right of a dense (phone) row. */
export type TimeRowMark =
  'running' | 'noShow' | 'attendance' | 'coin' | 'held' | 'makeup' | 'moved';

const isCancelled = (status: LessonResponse['status']) =>
  status === 'CANCELLED_CHARGED' || status === 'CANCELLED_UNCHARGED';

const unpaid = (lesson: TimeRowLesson) => lesson.charges.some((charge) => !charge.paid);

/** Ahead, now, past or cancelled, by the lesson's time and status. */
export function timeRowState(lesson: TimeRowLesson, now: number): LessonTimeRowState {
  if (isCancelled(lesson.status)) return 'cancelled';
  const moment = lessonMoment(lesson, now);
  if (moment === 'running') return 'now';
  return moment === 'ended' || lesson.status !== 'SCHEDULED' ? 'past' : 'ahead';
}

/** Minutes until a running lesson ends, rounded up. */
export function minutesLeft(
  lesson: Pick<LessonResponse, 'startsAtUtc' | 'durationMin'>,
  now: number,
) {
  const end = Date.parse(lesson.startsAtUtc) + lesson.durationMin * 60_000;
  return Math.max(0, Math.ceil((end - now) / 60_000));
}

export function timeRowBadge(
  lesson: TimeRowLesson,
  now: number,
  pkg: TimeRowPackage | null,
  lowCreditThreshold: number,
): TimeRowBadge | null {
  if (lesson.status === 'CANCELLED_CHARGED') return { kind: 'cancelledCharged' };
  if (lesson.status === 'CANCELLED_UNCHARGED') {
    return { kind: 'cancelled', by: lesson.cancelledBy === 'STUDENT' ? 'student' : 'teacher' };
  }
  if (lesson.status === 'NO_SHOW') return { kind: 'noShow' };
  if (awaitsAttendance(lesson, now)) return { kind: 'markAttendance' };
  if (timeRowState(lesson, now) === 'now') {
    return { kind: 'now', minutesLeft: minutesLeft(lesson, now) };
  }
  if (lesson.groupId !== null) {
    return lesson.charges.length > 0
      ? {
          kind: 'groupPaid',
          paid: lesson.charges.filter((charge) => charge.paid).length,
          total: lesson.charges.length,
        }
      : null;
  }
  if (unpaid(lesson)) return { kind: 'unpaid' };
  if (lesson.status === 'COMPLETED') return { kind: 'held' };
  if (pkg) {
    return {
      kind: 'package',
      left: pkg.left,
      total: pkg.total,
      low: lowCreditThreshold > 0 && pkg.left <= lowCreditThreshold,
    };
  }
  return lesson.priceMinor > 0 ? { kind: 'perLesson' } : null;
}

export function timeRowMark(lesson: TimeRowLesson, now: number): TimeRowMark | null {
  if (lesson.status === 'CANCELLED_CHARGED') return 'coin';
  if (isCancelled(lesson.status)) return null;
  if (timeRowState(lesson, now) === 'now') return 'running';
  if (lesson.status === 'NO_SHOW') return 'noShow';
  if (awaitsAttendance(lesson, now)) return 'attendance';
  if (unpaid(lesson)) return 'coin';
  if (lesson.status === 'COMPLETED') return 'held';
  if (lesson.kind === 'MAKEUP') return 'makeup';
  if (lesson.rescheduledCount > 0) return 'moved';
  return null;
}
