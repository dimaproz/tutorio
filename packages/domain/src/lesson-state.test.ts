import { describe, expect, it } from 'vitest';
import {
  canTransition,
  InvalidTransitionError,
  transitionEffect,
  type LessonStatus,
} from './lesson-state';

describe('canTransition', () => {
  it('allows every terminal transition out of SCHEDULED', () => {
    expect(canTransition('SCHEDULED', 'COMPLETED')).toBe(true);
    expect(canTransition('SCHEDULED', 'CANCELLED_CHARGED')).toBe(true);
    expect(canTransition('SCHEDULED', 'CANCELLED_UNCHARGED')).toBe(true);
  });

  it('allows a revert back to SCHEDULED (mistake correction)', () => {
    expect(canTransition('COMPLETED', 'SCHEDULED')).toBe(true);
    expect(canTransition('CANCELLED_CHARGED', 'SCHEDULED')).toBe(true);
    expect(canTransition('CANCELLED_UNCHARGED', 'SCHEDULED')).toBe(true);
  });

  it('forbids jumping directly between terminal statuses', () => {
    expect(canTransition('COMPLETED', 'CANCELLED_CHARGED')).toBe(false);
    expect(canTransition('CANCELLED_CHARGED', 'COMPLETED')).toBe(false);
  });

  it('forbids a no-op transition', () => {
    const statuses: LessonStatus[] = [
      'SCHEDULED',
      'COMPLETED',
      'CANCELLED_CHARGED',
      'CANCELLED_UNCHARGED',
    ];
    for (const s of statuses) {
      expect(canTransition(s, s)).toBe(false);
    }
  });
});

describe('transitionEffect', () => {
  it('consumes a credit on completion', () => {
    expect(transitionEffect('SCHEDULED', 'COMPLETED')).toEqual({
      delta: -1,
      type: 'lesson_completed',
    });
  });

  it('consumes a credit on a charged cancellation', () => {
    expect(transitionEffect('SCHEDULED', 'CANCELLED_CHARGED')).toEqual({
      delta: -1,
      type: 'late_cancellation',
    });
  });

  it('consumes nothing on an uncharged cancellation', () => {
    expect(transitionEffect('SCHEDULED', 'CANCELLED_UNCHARGED')).toEqual({
      delta: 0,
      type: 'teacher_cancellation_refund',
    });
  });

  it('emits the compensating (negated) effect on revert', () => {
    expect(transitionEffect('COMPLETED', 'SCHEDULED')).toEqual({
      delta: 1,
      type: 'lesson_completed',
    });
    expect(transitionEffect('CANCELLED_CHARGED', 'SCHEDULED')).toEqual({
      delta: 1,
      type: 'late_cancellation',
    });
    expect(transitionEffect('CANCELLED_UNCHARGED', 'SCHEDULED')).toEqual({
      delta: 0,
      type: 'teacher_cancellation_refund',
    });
  });

  it('throws on an illegal transition', () => {
    expect(() => transitionEffect('COMPLETED', 'CANCELLED_CHARGED')).toThrow(
      InvalidTransitionError,
    );
  });
});
