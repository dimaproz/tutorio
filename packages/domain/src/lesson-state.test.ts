import { describe, expect, it } from 'vitest';
import {
  canHaveMakeup,
  canTransition,
  isDueForCompletion,
  lessonEndsAt,
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

describe('auto-completion (L-50)', () => {
  const start = new Date('2026-10-01T10:00:00.000Z');
  const lesson = (status: LessonStatus) => ({ status, startsAtUtc: start, durationMin: 60 });

  it('ends a lesson at its start plus its duration', () => {
    expect(lessonEndsAt(lesson('SCHEDULED'))).toEqual(new Date('2026-10-01T11:00:00.000Z'));
  });

  it('completes a scheduled lesson once its end has passed, and nothing else', () => {
    const atEnd = new Date('2026-10-01T11:00:00.000Z');
    const during = new Date('2026-10-01T10:30:00.000Z');
    expect(isDueForCompletion(lesson('SCHEDULED'), atEnd)).toBe(true);
    expect(isDueForCompletion(lesson('SCHEDULED'), during)).toBe(false);
    expect(isDueForCompletion(lesson('CANCELLED_UNCHARGED'), atEnd)).toBe(false);
    expect(isDueForCompletion(lesson('NO_SHOW'), atEnd)).toBe(false);
  });
});
