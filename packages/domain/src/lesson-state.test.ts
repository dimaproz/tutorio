import { describe, expect, it } from 'vitest';
import {
  canHaveMakeup,
  canTransition,
  isChargedStatus,
  makeupIsFree,
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
