import { describe, expect, it } from 'vitest';
import { lessonMoment, panelActions } from './panel-actions';
import { lessonFixture } from './testing';

const START = Date.parse('2026-09-11T14:00:00.000Z');
const BEFORE = START - 3 * 3_600_000;
const DURING = START + 30 * 60_000;
const AFTER = START + 2 * 3_600_000;
const GROUP = { groupId: 'g1', enrollmentId: null, student: null, group: { id: 'g1', name: 'B2' } };

const menu = (actions: ReturnType<typeof panelActions>) =>
  actions.menu.map((item) => (item.disabled ? `${item.action}(disabled)` : item.action));

describe('lesson moment', () => {
  it('is upcoming before the start, running until the end, ended after', () => {
    const lesson = lessonFixture();
    expect(lessonMoment(lesson, BEFORE)).toBe('upcoming');
    expect(lessonMoment(lesson, DURING)).toBe('running');
    expect(lessonMoment(lesson, START + 60 * 60_000)).toBe('ended');
  });
});

describe('panel actions', () => {
  it('offers move and cancel on a scheduled lesson, no-show only after the start', () => {
    const before = panelActions(lessonFixture(), BEFORE);
    expect([before.secondary, before.primary]).toEqual(['move', 'cancel']);
    expect(menu(before)).toEqual(['edit', 'move', 'noShow(disabled)', 'copyLink', 'delete']);
    expect(before.menu.find((item) => item.action === 'noShow')?.hint).toBe('afterStart');

    expect(menu(panelActions(lessonFixture(), DURING))).toContain('noShow');
  });

  it('never offers a no-show on a group lesson (L-52)', () => {
    const actions = panelActions(lessonFixture(GROUP), BEFORE);
    expect(menu(actions)).toEqual(['edit', 'move', 'copyLink', 'delete']);
  });

  it('marks attendance on a running group lesson and moves cancelling to the menu', () => {
    const actions = panelActions(lessonFixture(GROUP), DURING);
    expect(actions.primary).toBe('markAttendance');
    expect(actions.secondary).toBeNull();
    expect(menu(actions)).toEqual(['edit', 'move', 'cancel', 'copyLink', 'delete']);
  });

  it('corrects the status of an ended lesson the automation has not held yet', () => {
    const actions = panelActions(lessonFixture(), AFTER);
    expect([actions.secondary, actions.primary]).toEqual(['fixStatus', null]);
  });

  it('only fixes the status of a held lesson, individual or group', () => {
    for (const lesson of [
      lessonFixture({ status: 'COMPLETED' }),
      lessonFixture({
        ...GROUP,
        status: 'COMPLETED',
        attendance: { present: 3, marked: 5, confirmed: true },
      }),
    ]) {
      const actions = panelActions(lesson, AFTER);
      expect([actions.secondary, actions.primary]).toEqual(['fixStatus', null]);
      expect(menu(actions)).toEqual(['edit', 'copyLink', 'delete']);
    }
  });

  it('assigns a makeup for a missed or cancelled individual lesson without one (L-60)', () => {
    for (const status of ['NO_SHOW', 'CANCELLED_UNCHARGED', 'CANCELLED_CHARGED'] as const) {
      const actions = panelActions(lessonFixture({ status }), AFTER);
      expect(actions.primary).toBe('makeup');
      expect(menu(actions)).toEqual(['edit', 'fixStatus', 'copyLink', 'delete']);
    }
  });

  it('fixes the status once the makeup exists, and never offers one to a group (L-62)', () => {
    const withMakeup = panelActions(
      lessonFixture({ status: 'CANCELLED_CHARGED', makeupLessonId: 'm1' }),
      AFTER,
    );
    expect([withMakeup.secondary, withMakeup.primary]).toEqual(['fixStatus', null]);
    const group = panelActions(lessonFixture({ ...GROUP, status: 'CANCELLED_UNCHARGED' }), AFTER);
    expect(group.primary).toBeNull();
    expect(group.secondary).toBe('fixStatus');
  });
});
