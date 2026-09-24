import { isChargedStatus } from '@tutorio/domain';
import type {
  CancelledByDto,
  LessonDetailResponse,
  LessonStatusDto,
  TransitionLessonDto,
} from '@tutorio/validation';
import { lessonMoment } from './panel-actions';

/** The status a correction can move a lesson to. */
export type FixTarget = 'scheduled' | 'held' | 'cancelCharged' | 'cancelFree' | 'noShow';

const TARGET_STATUS: Record<FixTarget, LessonStatusDto> = {
  scheduled: 'SCHEDULED',
  held: 'COMPLETED',
  cancelCharged: 'CANCELLED_CHARGED',
  cancelFree: 'CANCELLED_UNCHARGED',
  noShow: 'NO_SHOW',
};

type FixLesson = Pick<
  LessonDetailResponse,
  'status' | 'groupId' | 'startsAtUtc' | 'durationMin' | 'cancelledBy'
>;

/**
 * The statuses a lesson can be corrected to (L-53): every final status but
 * its own, no-show only for an individual lesson (L-52), and back to
 * "scheduled" only while the lesson has not ended.
 */
export function fixTargets(lesson: FixLesson, now: number): FixTarget[] {
  const ended = lessonMoment(lesson, now) === 'ended';
  return (Object.keys(TARGET_STATUS) as FixTarget[]).filter((target) => {
    if (TARGET_STATUS[target] === lesson.status) return false;
    if (target === 'noShow' && lesson.groupId) return false;
    if (target === 'scheduled' && ended) return false;
    return true;
  });
}

/** The first choice the dialog preselects: a no-show for a held individual lesson, else the first target. */
export function defaultFixTarget(lesson: FixLesson, targets: FixTarget[]): FixTarget | null {
  if (lesson.status === 'COMPLETED' && targets.includes('noShow')) return 'noShow';
  return targets[0] ?? null;
}

/**
 * The transition body. A cancellation keeps who cancelled when the lesson was
 * already cancelled, else it is the student's for a charged one and the
 * teacher's for a free one of a group, the student's otherwise.
 */
export function fixDto(lesson: FixLesson, target: FixTarget): TransitionLessonDto {
  const targetStatus = TARGET_STATUS[target];
  if (target !== 'cancelCharged' && target !== 'cancelFree') return { targetStatus };
  const cancelledBy: CancelledByDto = lesson.cancelledBy ?? (lesson.groupId ? 'GROUP' : 'STUDENT');
  return { targetStatus, cancelledBy };
}

/** What a correction changes, for the dialog's "what will change" list. */
export type FixImpact =
  | 'chargeKept'
  | 'chargeTaken'
  | 'chargeReturned'
  | 'noCharge'
  | 'missAdded'
  | 'missRemoved'
  | 'scheduledUnavailable';

export function fixImpact(lesson: FixLesson, target: FixTarget, now: number): FixImpact[] {
  const from = isChargedStatus(lesson.status);
  const to = isChargedStatus(TARGET_STATUS[target]);
  const impact: FixImpact[] = [
    from && to ? 'chargeKept' : !from && to ? 'chargeTaken' : from ? 'chargeReturned' : 'noCharge',
  ];
  if (target === 'noShow') impact.push('missAdded');
  else if (lesson.status === 'NO_SHOW') impact.push('missRemoved');
  if (lessonMoment(lesson, now) === 'ended') impact.push('scheduledUnavailable');
  return impact;
}
