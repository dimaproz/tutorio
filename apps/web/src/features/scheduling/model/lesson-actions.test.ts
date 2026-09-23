import { describe, expect, it } from 'vitest';
import { lessonActions } from './lesson-actions';

const NOW = Date.UTC(2026, 8, 23, 12, 0);
const hoursFromNow = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString();

const lesson = (
  patch: Partial<Parameters<typeof lessonActions>[0]> = {},
): Parameters<typeof lessonActions>[0] => ({
  status: 'SCHEDULED',
  startsAtUtc: hoursFromNow(24),
  durationMin: 60,
  groupId: null,
  ...patch,
});

describe('lessonActions', () => {
  it('holds, moves or cancels an upcoming lesson; no-show waits for the start', () => {
    expect(lessonActions(lesson(), NOW)).toEqual({
      complete: true,
      noShow: false,
      cancel: true,
      reschedule: true,
      reactivate: false,
    });
    expect(lessonActions(lesson({ startsAtUtc: hoursFromNow(-0.5) }), NOW).noShow).toBe(true);
  });

  it('never offers a no-show for a group lesson (L-52)', () => {
    expect(lessonActions(lesson({ startsAtUtc: hoursFromNow(-3), groupId: 'g' }), NOW).noShow).toBe(
      false,
    );
  });

  it('corrects an ended lesson between final statuses, never back to scheduled (L-53)', () => {
    expect(
      lessonActions(lesson({ status: 'COMPLETED', startsAtUtc: hoursFromNow(-3) }), NOW),
    ).toEqual({
      complete: false,
      noShow: true,
      cancel: true,
      reschedule: false,
      reactivate: false,
    });
    expect(
      lessonActions(lesson({ status: 'CANCELLED_UNCHARGED', startsAtUtc: hoursFromNow(-3) }), NOW),
    ).toMatchObject({ complete: true, cancel: false, reactivate: false });
  });

  it('can still undo a final status before the lesson ends', () => {
    expect(lessonActions(lesson({ status: 'CANCELLED_CHARGED' }), NOW)).toMatchObject({
      reactivate: true,
      complete: false,
      cancel: false,
    });
  });
});
