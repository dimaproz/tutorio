import { describe, expect, it } from 'vitest';
import { GatewayError } from '@/lib/auth/client';
import { cancelAdvice, cancelDto, cancelFormDefaults } from './cancel';
import { editFormDefaults, editPlan, rescheduleDto } from './edit';
import { makeupDto, makeupFormDefaults, makeupWillBeFree } from './makeup';
import { localSlotOf, moveChange, scheduleConflicts } from './move';
import { defaultFixTarget, fixDto, fixImpact, fixTargets } from './status-fix';
import { lessonFixture } from './testing';

/** 17:00 on Friday 11 September in Kyiv (UTC+3). */
const START = Date.parse('2026-09-11T14:00:00.000Z');
/** The studio's zone; the process runs in another one (vitest config). */
const TZ = 'Europe/Kyiv';
const HOUR = 3_600_000;

describe('cancel form', () => {
  const lesson = lessonFixture();

  it('suggests charging a student who cancels after the deadline (L-51)', () => {
    expect(cancelAdvice(lesson, 'STUDENT', START - 3 * HOUR)).toEqual({
      advice: { kind: 'late', hoursLeft: 3, deadlineHours: 24 },
      charge: 'charge',
    });
    expect(cancelAdvice(lesson, 'STUDENT', START - 48 * HOUR)).toMatchObject({
      advice: { kind: 'onTime', hoursLeft: 48 },
      charge: 'free',
    });
  });

  it('suggests a free cancellation by the teacher or the group', () => {
    expect(cancelAdvice(lesson, 'TEACHER', START - HOUR).charge).toBe('free');
    expect(cancelFormDefaults(lessonFixture({ groupId: 'g1' }), START - HOUR)).toEqual({
      cancelledBy: 'GROUP',
      charge: 'free',
      reason: '',
    });
  });

  it('sends the chosen status, author and a trimmed reason', () => {
    expect(cancelDto({ cancelledBy: 'STUDENT', charge: 'charge', reason: '  Захворіла ' })).toEqual(
      {
        targetStatus: 'CANCELLED_CHARGED',
        cancelledBy: 'STUDENT',
        cancelledReason: 'Захворіла',
      },
    );
    expect(cancelDto({ cancelledBy: 'TEACHER', charge: 'free', reason: '' }).cancelledReason).toBe(
      null,
    );
  });
});

describe('edit form', () => {
  const lesson = lessonFixture({ topic: 'Past Perfect', notes: null });

  it('sends nothing when nothing changed', () => {
    expect(
      editPlan(editFormDefaults(lesson, TZ), lesson, { priceLocked: false, timeZone: TZ }),
    ).toEqual({
      move: null,
      update: null,
    });
  });

  it("reads the lesson's date and time on the studio's clock", () => {
    expect(editFormDefaults(lesson, TZ)).toMatchObject({ date: '2026-09-11', time: '17:00' });
  });

  it('moves the lesson with its new length and updates the rest', () => {
    const defaults = editFormDefaults(lesson, TZ);
    const [hours, minutes] = defaults.time.split(':').map(Number);
    const later = hours! * 60 + minutes! + 90;
    const time = `${String(Math.floor(later / 60)).padStart(2, '0')}:${String(later % 60).padStart(2, '0')}`;
    const values = {
      ...defaults,
      time,
      durationMin: '90',
      topic: ' ',
      notes: 'Bring audio',
      price: '550',
    };
    const plan = editPlan(values, lesson, { priceLocked: false, timeZone: TZ });
    expect(plan.move?.durationMin).toBe(90);
    expect(Date.parse(plan.move!.startsAtUtc) - START).toBe(1.5 * HOUR);
    expect(plan.update).toEqual({
      topic: null,
      notes: 'Bring audio',
      priceMinor: 55000,
      currency: 'UAH',
    });
    expect(rescheduleDto(plan.move!, 'this_and_following').scope).toBe('this_and_following');
  });

  it('keeps a length change in the update when the lesson stays, and drops a locked price', () => {
    const values = { ...editFormDefaults(lesson, TZ), durationMin: '45', price: '999' };
    expect(editPlan(values, lesson, { priceLocked: true, timeZone: TZ })).toEqual({
      move: null,
      update: { durationMin: 45 },
    });
  });
});

describe('makeup form', () => {
  const original = lessonFixture({ status: 'CANCELLED_CHARGED', topic: 'Past Perfect' });

  it('starts from the original the next day and sends only what differs', () => {
    const values = makeupFormDefaults(original, START, TZ);
    expect(values).toMatchObject({ date: '2026-09-12', time: '17:00' });
    expect(values.durationMin).toBe('60');
    expect(values.topic).toBe('Past Perfect');
    const dto = makeupDto({ ...values, durationMin: '90' }, original, TZ);
    expect(dto).toMatchObject({ durationMin: 90, topic: 'Past Perfect' });
    expect(dto).not.toHaveProperty('teacherId');
    expect(Date.parse(dto.startsAtUtc) - START).toBe(24 * HOUR);
  });

  it('is free for a charged original only (L-61)', () => {
    expect(makeupWillBeFree(original)).toBe(true);
    expect(makeupWillBeFree(lessonFixture({ status: 'CANCELLED_UNCHARGED' }))).toBe(false);
  });
});

describe('status fix', () => {
  const held = lessonFixture({ status: 'COMPLETED' });
  const after = START + 3 * HOUR;

  it('offers every other final status, no-show for individuals, scheduled before the end (L-53)', () => {
    expect(fixTargets(held, after)).toEqual(['cancelCharged', 'cancelFree', 'noShow']);
    expect(
      fixTargets(lessonFixture({ status: 'CANCELLED_UNCHARGED', groupId: 'g1' }), START - HOUR),
    ).toEqual(['scheduled', 'held', 'cancelCharged']);
    expect(defaultFixTarget(held, fixTargets(held, after))).toBe('noShow');
  });

  it('names who cancelled when a correction cancels', () => {
    expect(fixDto(held, 'cancelFree')).toEqual({
      targetStatus: 'CANCELLED_UNCHARGED',
      cancelledBy: 'STUDENT',
    });
    expect(fixDto(held, 'noShow')).toEqual({ targetStatus: 'NO_SHOW' });
  });

  it('says what the correction changes', () => {
    expect(fixImpact(held, 'noShow', after)).toEqual([
      'chargeKept',
      'missAdded',
      'scheduledUnavailable',
    ]);
    expect(fixImpact(lessonFixture({ status: 'NO_SHOW' }), 'cancelFree', after)).toEqual([
      'chargeReturned',
      'missRemoved',
      'scheduledUnavailable',
    ]);
  });
});

describe('move', () => {
  const schedule = {
    timezone: 'Europe/Kyiv',
    durationMin: 60,
    slots: [
      { weekday: 1, localTime: '17:00', seriesId: 'a' },
      { weekday: 5, localTime: '17:00', seriesId: 'b' },
    ],
  };

  it('reads the weekday and time in the schedule timezone', () => {
    expect(localSlotOf('2026-09-11T14:00:00.000Z', 'Europe/Kyiv')).toEqual({
      weekday: 5,
      localTime: '17:00',
    });
  });

  it('moves only the lesson weekday from this lesson on (L-41)', () => {
    expect(moveChange(schedule, '2026-09-11T14:00:00.000Z', '2026-09-11T15:30:00.000Z')).toEqual({
      effectiveFrom: '2026-09-11T14:00:00.000Z',
      slots: [
        { weekday: 1, localTime: '17:00' },
        { weekday: 5, localTime: '18:30' },
      ],
      durationMin: 60,
    });
  });

  it('reads the overlaps of a schedule conflict and ignores other errors', () => {
    const conflict = {
      candidateStartsAtUtc: '2026-09-11T15:30:00.000Z',
      lessonId: '88888888-8888-4888-8888-000000000009',
      startsAtUtc: '2026-09-11T15:00:00.000Z',
      durationMin: 90,
      reason: 'TEACHER',
      kind: 'REGULAR',
      teacher: { id: '55555555-5555-4555-8555-555555555555', name: 'Dmytro Tutor' },
      student: null,
      group: { id: '99999999-9999-4999-8999-000000000001', name: 'B2 prep' },
      students: [],
    };
    expect(
      scheduleConflicts(new GatewayError(409, 'SCHEDULE_CONFLICT', { conflicts: [conflict] })),
    ).toEqual([conflict]);
    expect(scheduleConflicts(new GatewayError(404, 'LESSON_NOT_FOUND'))).toBeNull();
  });
});
