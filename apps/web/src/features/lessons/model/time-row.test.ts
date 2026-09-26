import { describe, expect, it } from 'vitest';
import { lessonFixture } from './testing';
import { minutesLeft, timeRowBadge, timeRowMark, timeRowState } from './time-row';

// 11 Sep 2026: the fixture's lesson runs 17:00–18:00 Kyiv (14:00–15:00 UTC).
const before = Date.parse('2026-09-11T13:00:00.000Z');
const during = Date.parse('2026-09-11T14:35:00.000Z');
const after = Date.parse('2026-09-11T16:00:00.000Z');

const charge = (source: 'PACKAGE' | 'DEBT' | 'BALANCE', paid: boolean) => ({
  id: crypto.randomUUID(),
  enrollmentId: '66666666-6666-4666-8666-000000000001',
  source,
  packageId: null,
  amountMinor: 50000,
  currency: 'UAH' as const,
  paid,
  student: { id: 'd6bf671d-7a0f-4cf3-8a67-000000000001', fullName: 'Anna Shevchenko' },
});

describe('the timed row of a lesson', () => {
  it('reads its time: ahead, now, past, cancelled', () => {
    expect(timeRowState(lessonFixture(), before)).toBe('ahead');
    expect(timeRowState(lessonFixture(), during)).toBe('now');
    expect(timeRowState(lessonFixture({ status: 'COMPLETED' }), after)).toBe('past');
    expect(timeRowState(lessonFixture({ status: 'CANCELLED_UNCHARGED' }), during)).toBe(
      'cancelled',
    );
    expect(minutesLeft(lessonFixture(), during)).toBe(25);
  });

  it('shows what happened before how it is paid', () => {
    const held = lessonFixture({ status: 'COMPLETED', charges: [charge('BALANCE', true)] });
    expect(timeRowBadge(held, after, null, 2)).toEqual({ kind: 'held' });
    expect(timeRowBadge({ ...held, charges: [charge('BALANCE', false)] }, after, null, 2)).toEqual({
      kind: 'unpaid',
    });
    expect(timeRowBadge(lessonFixture({ status: 'NO_SHOW' }), after, null, 2)).toEqual({
      kind: 'noShow',
    });
    expect(
      timeRowBadge(
        lessonFixture({ status: 'CANCELLED_UNCHARGED', cancelledBy: 'STUDENT' }),
        after,
        null,
        2,
      ),
    ).toEqual({ kind: 'cancelled', by: 'student' });
    expect(timeRowBadge(lessonFixture({ status: 'CANCELLED_CHARGED' }), after, null, 2)).toEqual({
      kind: 'cancelledCharged',
    });
    expect(timeRowBadge(lessonFixture(), during, null, 2)).toEqual({
      kind: 'now',
      minutesLeft: 25,
    });
  });

  it('names the package ahead, warning at the studio threshold', () => {
    expect(timeRowBadge(lessonFixture(), before, { left: 6, total: 8 }, 2)).toEqual({
      kind: 'package',
      left: 6,
      total: 8,
      low: false,
    });
    expect(timeRowBadge(lessonFixture(), before, { left: 1, total: 8 }, 2)).toMatchObject({
      low: true,
    });
    expect(timeRowBadge(lessonFixture(), before, null, 2)).toEqual({ kind: 'perLesson' });
    expect(timeRowBadge(lessonFixture({ priceMinor: 0 }), before, null, 2)).toBeNull();
  });

  it('asks to mark a finished group lesson nobody confirmed', () => {
    const group = lessonFixture({
      groupId: '99999999-9999-4999-8999-000000000001',
      status: 'COMPLETED',
      attendance: { present: 4, marked: 4, confirmed: false },
      charges: [charge('BALANCE', true), charge('BALANCE', false)],
    });
    expect(timeRowBadge(group, after, null, 2)).toEqual({ kind: 'markAttendance' });
    expect(timeRowMark(group, after)).toBe('attendance');
    const confirmed = { ...group, attendance: { present: 4, marked: 4, confirmed: true } };
    expect(timeRowBadge(confirmed, after, null, 2)).toEqual({
      kind: 'groupPaid',
      paid: 1,
      total: 2,
    });
  });

  it('keeps one mark for a dense row', () => {
    expect(timeRowMark(lessonFixture(), during)).toBe('running');
    expect(timeRowMark(lessonFixture({ status: 'NO_SHOW' }), after)).toBe('noShow');
    expect(timeRowMark(lessonFixture({ status: 'CANCELLED_CHARGED' }), after)).toBe('coin');
    expect(timeRowMark(lessonFixture({ status: 'CANCELLED_UNCHARGED' }), after)).toBeNull();
    expect(timeRowMark(lessonFixture({ kind: 'MAKEUP' }), before)).toBe('makeup');
    expect(timeRowMark(lessonFixture({ rescheduledCount: 1 }), before)).toBe('moved');
    expect(
      timeRowMark(lessonFixture({ status: 'COMPLETED', charges: [charge('DEBT', false)] }), after),
    ).toBe('coin');
    expect(timeRowMark(lessonFixture({ status: 'COMPLETED' }), after)).toBe('held');
  });
});
