import type { LessonResponse } from '@tutorio/validation';

export type LessonActionSet = {
  complete: boolean;
  noShow: boolean;
  cancel: boolean;
  reschedule: boolean;
  /** Back to "scheduled": only before the lesson has ended. */
  reactivate: boolean;
};

/**
 * What a tutor can do with a lesson now (product/scheduling.md L-50…L-53). An
 * upcoming lesson is held, moved or cancelled; a no-show is offered once an
 * individual lesson has started. An ended lesson is corrected between final
 * statuses and never goes back to "scheduled"; before it ends a final status
 * can still be undone.
 */
export function lessonActions(
  lesson: Pick<LessonResponse, 'status' | 'startsAtUtc' | 'durationMin' | 'groupId'>,
  now: number,
): LessonActionSet {
  const start = new Date(lesson.startsAtUtc).getTime();
  const ended = start + lesson.durationMin * 60_000 <= now;
  const started = start <= now;
  const individual = lesson.groupId === null;
  const cancelled =
    lesson.status === 'CANCELLED_CHARGED' || lesson.status === 'CANCELLED_UNCHARGED';

  if (lesson.status === 'SCHEDULED') {
    return {
      complete: true,
      noShow: individual && started,
      cancel: true,
      reschedule: true,
      reactivate: false,
    };
  }
  if (!ended) {
    return { complete: false, noShow: false, cancel: false, reschedule: false, reactivate: true };
  }
  return {
    complete: lesson.status !== 'COMPLETED',
    noShow: individual && lesson.status !== 'NO_SHOW',
    cancel: !cancelled,
    reschedule: false,
    reactivate: false,
  };
}
