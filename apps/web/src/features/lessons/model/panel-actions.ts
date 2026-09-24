import { canHaveMakeup, lessonEndsAt } from '@tutorio/domain';
import type { LessonResponse } from '@tutorio/validation';

type ActionLesson = Pick<
  LessonResponse,
  'status' | 'groupId' | 'makeupLessonId' | 'startsAtUtc' | 'durationMin' | 'attendance'
>;

/** Where a lesson stands against the clock. */
export type LessonMoment = 'upcoming' | 'running' | 'ended';

export function lessonMoment(
  lesson: Pick<LessonResponse, 'startsAtUtc' | 'durationMin'>,
  now: number,
): LessonMoment {
  const start = Date.parse(lesson.startsAtUtc);
  if (now < start) return 'upcoming';
  const end = lessonEndsAt({ startsAtUtc: new Date(start), durationMin: lesson.durationMin });
  return now < end.getTime() ? 'running' : 'ended';
}

/** A group lesson that started and is not over: attendance can be marked now (L-74). */
export function isRunningGroupLesson(lesson: ActionLesson, now: number): boolean {
  return (
    lesson.groupId !== null &&
    lesson.status === 'SCHEDULED' &&
    lessonMoment(lesson, now) === 'running'
  );
}

/** Commands the panel's footer can carry. */
export type FooterAction = 'move' | 'cancel' | 'fixStatus' | 'makeup' | 'markAttendance';

/** Commands of the «⋯» menu. */
export type MenuAction =
  'edit' | 'move' | 'noShow' | 'cancel' | 'fixStatus' | 'makeup' | 'copyLink' | 'delete';

export type MenuItem = {
  action: MenuAction;
  /** Disabled items stay visible with the reason under them. */
  disabled?: boolean;
  hint?: 'afterStart';
};

export type PanelActions = {
  /** The one filled action pinned at the bottom (desktop) or in the phone footer. */
  primary: FooterAction | null;
  /** The outline action beside it, when there is one. */
  secondary: FooterAction | null;
  menu: MenuItem[];
};

/**
 * What the lesson panel offers for one lesson (S01 decision 4): one primary
 * action in the footer, at most one outline action beside it, and the rest in
 * the «⋯» menu, which always ends with "copy link" and "delete".
 *
 * - Scheduled: "move" and "cancel"; a running group lesson "mark attendance"
 *   instead, with cancelling in the menu. "No-show" is individual only and
 *   waits for the start (L-52).
 * - Ended but not held yet (the automation marks it held within minutes):
 *   "fix status" moves it to any final status (L-53).
 * - Held: "fix status" only; a group changes its marks on the attendance card.
 * - No-show or cancelled, individual, with no makeup yet: "assign a makeup"
 *   (L-60), "fix status" moves to the menu. Group lessons have no makeups
 *   (L-62).
 */
export function panelActions(lesson: ActionLesson, now: number): PanelActions {
  const group = lesson.groupId !== null;
  const moment = lessonMoment(lesson, now);
  const tail: MenuItem[] = [{ action: 'copyLink' }, { action: 'delete' }];

  if (lesson.status === 'SCHEDULED') {
    if (moment === 'ended') {
      return {
        primary: null,
        secondary: 'fixStatus',
        menu: [{ action: 'edit' }, ...tail],
      };
    }
    if (group && moment === 'running') {
      return {
        primary: 'markAttendance',
        secondary: null,
        menu: [{ action: 'edit' }, { action: 'move' }, { action: 'cancel' }, ...tail],
      };
    }
    const noShow: MenuItem[] = group
      ? []
      : [
          moment === 'upcoming'
            ? { action: 'noShow', disabled: true, hint: 'afterStart' }
            : { action: 'noShow' },
        ];
    return {
      primary: 'cancel',
      secondary: 'move',
      menu: [{ action: 'edit' }, { action: 'move' }, ...noShow, ...tail],
    };
  }

  const makeupDue = !group && canHaveMakeup(lesson.status) && lesson.makeupLessonId === null;
  if (makeupDue) {
    return {
      primary: 'makeup',
      secondary: null,
      menu: [{ action: 'edit' }, { action: 'fixStatus' }, ...tail],
    };
  }
  return {
    primary: null,
    secondary: 'fixStatus',
    menu: [{ action: 'edit' }, ...tail],
  };
}
