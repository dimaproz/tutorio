import { describe, expect, it } from 'vitest';
import {
  consumedCredits,
  creditBalance,
  lessonEntryKey,
  planTransition,
  type LedgerEntryLike,
} from './ledger';
import { InvalidTransitionError } from './lesson-state';

const LESSON = 'lesson-1';

describe('planTransition', () => {
  it('implements the ADR 0003 fixed-package transition matrix', () => {
    expect(planTransition('SCHEDULED', 'COMPLETED', LESSON, 1).entry).toMatchObject({
      delta: -1,
      type: 'lesson_completed',
    });
    expect(planTransition('SCHEDULED', 'CANCELLED_CHARGED', LESSON, 1).entry).toMatchObject({
      delta: -1,
      type: 'late_cancellation',
    });
    expect(planTransition('SCHEDULED', 'CANCELLED_UNCHARGED', LESSON, 1).entry).toBeNull();
    expect(planTransition('COMPLETED', 'SCHEDULED', LESSON, 2).entry).toMatchObject({
      delta: 1,
      type: 'lesson_completed',
    });
    expect(planTransition('CANCELLED_CHARGED', 'SCHEDULED', LESSON, 2).entry).toMatchObject({
      delta: 1,
      type: 'late_cancellation',
    });
    expect(planTransition('CANCELLED_UNCHARGED', 'SCHEDULED', LESSON, 2).entry).toBeNull();
  });

  it('creates distinct effects for a cancel, restore, cancel cycle', () => {
    const entries = [
      planTransition('SCHEDULED', 'CANCELLED_CHARGED', LESSON, 1).entry!,
      planTransition('CANCELLED_CHARGED', 'SCHEDULED', LESSON, 2).entry!,
      planTransition('SCHEDULED', 'CANCELLED_CHARGED', LESSON, 3).entry!,
    ];
    expect(entries.map((entry) => entry.delta)).toEqual([-1, 1, -1]);
    expect(new Set(entries.map((entry) => entry.idempotencyKey)).size).toBe(3);
  });
  it('consumes one credit when a lesson is completed', () => {
    const plan = planTransition('SCHEDULED', 'COMPLETED', LESSON);
    expect(plan.entry).toEqual({
      delta: -1,
      type: 'lesson_completed',
      idempotencyKey: 'lesson:lesson-1:transition:1',
      lessonId: LESSON,
    });
  });

  it('still consumes the credit on a charged (late) cancellation', () => {
    const plan = planTransition('SCHEDULED', 'CANCELLED_CHARGED', LESSON);
    expect(plan.entry?.delta).toBe(-1);
    expect(plan.entry?.type).toBe('late_cancellation');
  });

  it('does not create a credit effect for an uncharged cancellation', () => {
    const plan = planTransition('SCHEDULED', 'CANCELLED_UNCHARGED', LESSON);
    expect(plan.entry).toBeNull();
  });

  it('writes a compensating entry when a completion is reverted', () => {
    const plan = planTransition('COMPLETED', 'SCHEDULED', LESSON);
    // The original -1 is undone by a +1; the first entry is never deleted.
    expect(plan.entry?.delta).toBe(1);
    expect(plan.entry?.type).toBe('lesson_completed');
  });

  it('rejects an illegal transition', () => {
    expect(() => planTransition('COMPLETED', 'CANCELLED_CHARGED', LESSON)).toThrow(
      InvalidTransitionError,
    );
  });

  it('reuses the same idempotency key for a repeated transition', () => {
    const a = planTransition('SCHEDULED', 'COMPLETED', LESSON, 1);
    const b = planTransition('SCHEDULED', 'COMPLETED', LESSON, 1);
    // A double click cannot charge twice — the unique key collides on insert.
    expect(a.entry?.idempotencyKey).toBe(b.entry?.idempotencyKey);
  });

  it('separates a re-entry after a revert from the original entry', () => {
    const first = planTransition('SCHEDULED', 'COMPLETED', LESSON, 1);
    const again = planTransition('SCHEDULED', 'COMPLETED', LESSON, 3);
    expect(first.entry?.idempotencyKey).not.toBe(again.entry?.idempotencyKey);
  });
});

describe('lessonEntryKey', () => {
  it('is stable and namespaced per lesson and type', () => {
    expect(lessonEntryKey('l1', 1)).toBe('lesson:l1:transition:1');
    expect(lessonEntryKey('l1', 3)).toBe('lesson:l1:transition:3');
  });
});

describe('creditBalance', () => {
  it('is the sum of every entry, never a stored counter', () => {
    const entries = [
      { delta: 8, type: 'purchase' as const },
      { delta: -1, type: 'lesson_completed' as const },
      { delta: -1, type: 'late_cancellation' as const },
      { delta: 0, type: 'teacher_cancellation_refund' as const },
    ];
    expect(creditBalance(entries)).toBe(6);
    expect(consumedCredits(entries)).toBe(2);
  });

  it('reports net current usage rather than gross debit history', () => {
    expect(consumedCredits([{ delta: -1, type: 'lesson_completed' }])).toBe(1);
    expect(
      consumedCredits([
        { delta: -1, type: 'lesson_completed' },
        { delta: 1, type: 'lesson_completed' },
      ]),
    ).toBe(0);
    expect(
      consumedCredits([
        { delta: -1, type: 'late_cancellation' },
        { delta: 1, type: 'late_cancellation' },
        { delta: -1, type: 'lesson_completed' },
        { delta: 0, type: 'teacher_cancellation_refund' },
        { delta: 8, type: 'purchase' },
        { delta: -2, type: 'manual_adjustment' },
      ]),
    ).toBe(1);
  });

  it('treats an empty ledger as a zero balance', () => {
    expect(creditBalance([])).toBe(0);
  });
});

// The scenarios the product positioning promises to handle correctly.
describe('canonical scenarios', () => {
  it('8 lessons bought for a 9-week month leaves the balance short, not negative by accident', () => {
    // Annotated: inference from the first element would pin the array to
    // `purchase` and reject every lesson entry pushed below.
    const entries: LedgerEntryLike[] = [{ delta: 8, type: 'purchase' }];
    for (let i = 0; i < 8; i++) {
      entries.push({ delta: -1, type: 'lesson_completed' });
    }
    expect(creditBalance(entries)).toBe(0);
    // The ninth lesson is scheduled but unpaid — it drives the balance negative,
    // which is exactly the debt signal the dashboard surfaces.
    entries.push({ delta: -1, type: 'lesson_completed' });
    expect(creditBalance(entries)).toBe(-1);
  });

  it('a teacher cancellation costs the student nothing without a replacement side effect', () => {
    const plan = planTransition('SCHEDULED', 'CANCELLED_UNCHARGED', 'l9');
    expect(plan.entry).toBeNull();
  });
});
