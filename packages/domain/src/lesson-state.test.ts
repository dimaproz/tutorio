import { describe, expect, it } from 'vitest';
import {
  InvalidTransitionError,
  canHaveMakeup,
  canTransition,
  isChargedStatus,
  makeupIsFree,
  transitionEffect,
  type LessonStatus,
} from './lesson-state';

const ALL: LessonStatus[] = [
  'SCHEDULED',
  'COMPLETED',
  'CANCELLED_CHARGED',
  'CANCELLED_UNCHARGED',
  'NO_SHOW',
];

describe('isChargedStatus', () => {
  it('charges a held lesson, a charged cancellation and a no-show (L-50…L-52)', () => {
    expect(ALL.filter(isChargedStatus)).toEqual(['COMPLETED', 'CANCELLED_CHARGED', 'NO_SHOW']);
  });
});

describe('canTransition', () => {
  it('allows every move except staying put', () => {
    for (const from of ALL) {
      for (const to of ALL) {
        expect(canTransition(from, to)).toBe(from !== to);
      }
    }
  });
});

describe('transitionEffect', () => {
  it('debits one credit when a lesson becomes charged, typed by the new status', () => {
    expect(transitionEffect('SCHEDULED', 'COMPLETED')).toEqual({
      delta: -1,
      type: 'lesson_completed',
    });
    expect(transitionEffect('SCHEDULED', 'CANCELLED_CHARGED')).toEqual({
      delta: -1,
      type: 'late_cancellation',
    });
    expect(transitionEffect('SCHEDULED', 'NO_SHOW')).toEqual({ delta: -1, type: 'no_show' });
    expect(transitionEffect('CANCELLED_UNCHARGED', 'NO_SHOW')).toEqual({
      delta: -1,
      type: 'no_show',
    });
  });

  it('refunds one credit when a lesson stops being charged, typed by the status left', () => {
    expect(transitionEffect('COMPLETED', 'SCHEDULED')).toEqual({
      delta: 1,
      type: 'lesson_completed',
    });
    expect(transitionEffect('NO_SHOW', 'CANCELLED_UNCHARGED')).toEqual({
      delta: 1,
      type: 'no_show',
    });
  });

  it('writes nothing when a correction keeps the lesson charged or free (L-53)', () => {
    expect(transitionEffect('COMPLETED', 'NO_SHOW')).toBeNull();
    expect(transitionEffect('CANCELLED_CHARGED', 'COMPLETED')).toBeNull();
    expect(transitionEffect('SCHEDULED', 'CANCELLED_UNCHARGED')).toBeNull();
    expect(transitionEffect('CANCELLED_UNCHARGED', 'SCHEDULED')).toBeNull();
  });

  it('rejects a move to the same status', () => {
    expect(() => transitionEffect('COMPLETED', 'COMPLETED')).toThrow(InvalidTransitionError);
  });
});

describe('makeups (L-60, L-61)', () => {
  it('is offered only for a cancelled or missed lesson', () => {
    expect(ALL.filter(canHaveMakeup)).toEqual([
      'CANCELLED_CHARGED',
      'CANCELLED_UNCHARGED',
      'NO_SHOW',
    ]);
  });

  it('charges exactly one of the pair', () => {
    expect(makeupIsFree('CANCELLED_CHARGED')).toBe(true);
    expect(makeupIsFree('NO_SHOW')).toBe(true);
    expect(makeupIsFree('CANCELLED_UNCHARGED')).toBe(false);
  });
});
