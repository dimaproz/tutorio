import { describe, expect, it } from 'vitest';
import {
  listQuery,
  narrowed,
  periodParams,
  periodRange,
  readListState,
  resetParams,
  sheetFilterCount,
} from './filters';
import { lessonKind, needsMakeup, paymentView } from './payment';

/** The studio's zone; the process runs in another one (vitest config). */
const TZ = 'Europe/Kyiv';
/** Thursday 24 September 2026, 18:40 in Kyiv (UTC+3). */
const NOW = Date.parse('2026-09-24T15:40:00.000Z');
const state = (query = '') => readListState(new URLSearchParams(query));

describe('lessons list state (S04)', () => {
  it('opens on this month, newest first, with every filter off', () => {
    expect(state()).toEqual({
      page: 1,
      quick: 'all',
      period: 'month',
      from: null,
      to: null,
      teacherId: null,
      studentId: null,
      groupId: null,
      statuses: [],
      search: null,
      order: 'desc',
    });
    expect(listQuery(state(), NOW, TZ)).toEqual({
      page: 1,
      pageSize: 20,
      from: '2026-08-31T21:00:00.000Z',
      to: '2026-09-30T21:00:00.000Z',
      teacherId: undefined,
      studentId: undefined,
      groupId: undefined,
      status: undefined,
      filter: undefined,
      search: undefined,
      order: undefined,
    });
  });

  it('reads the filters back from the URL and ignores what it does not know', () => {
    const read = state(
      'quick=unpaid&teacher=t1&student=s1&group=g1&status=CANCELLED,NO_SHOW,HELD&q=%20anna%20&order=asc&page=3',
    );
    expect(read).toMatchObject({
      quick: 'unpaid',
      teacherId: 't1',
      studentId: 's1',
      // A student already takes their groups' lessons, so the group gives way.
      groupId: null,
      statuses: ['CANCELLED', 'NO_SHOW'],
      search: 'anna',
      order: 'asc',
      page: 3,
    });
    expect(listQuery(read, NOW, TZ)).toMatchObject({
      filter: 'unpaid',
      status: 'CANCELLED_CHARGED,CANCELLED_UNCHARGED,NO_SHOW',
      order: 'asc',
      search: 'anna',
    });
    expect(state('quick=paid&page=-2')).toMatchObject({ quick: 'all', page: 1 });
    expect(narrowed(read)).toBe(true);
    expect(narrowed(state())).toBe(false);
    expect(sheetFilterCount(read)).toBe(3);
  });

  it("turns every period into [from, to) between the studio's midnights", () => {
    expect(periodRange({ period: 'week', from: null, to: null }, NOW, TZ)).toEqual({
      from: new Date('2026-09-20T21:00:00.000Z'),
      to: new Date('2026-09-27T21:00:00.000Z'),
    });
    expect(periodRange({ period: 'lastMonth', from: null, to: null }, NOW, TZ)).toEqual({
      from: new Date('2026-07-31T21:00:00.000Z'),
      to: new Date('2026-08-31T21:00:00.000Z'),
    });
    expect(periodRange({ period: 'last3Months', from: null, to: null }, NOW, TZ)).toEqual({
      from: new Date('2026-06-30T21:00:00.000Z'),
      to: new Date('2026-09-30T21:00:00.000Z'),
    });
    expect(periodRange({ period: 'all', from: null, to: null }, NOW, TZ)).toBeNull();
    // A custom period includes its last day, whichever way round it was picked.
    expect(state('from=2026-10-14')).toMatchObject({
      period: 'custom',
      from: '2026-10-14',
      to: '2026-10-14',
    });
    expect(
      periodRange({ period: 'custom', from: '2026-10-18', to: '2026-10-14' }, NOW, TZ),
    ).toEqual({
      from: new Date('2026-10-13T21:00:00.000Z'),
      to: new Date('2026-10-18T21:00:00.000Z'),
    });
    // «Цей місяць» on the studio's 1 October starts there even while UTC is still in September.
    expect(
      periodRange({ period: 'month', from: null, to: null }, Date.parse('2026-09-30T21:30:00Z'), TZ)
        ?.from,
    ).toEqual(new Date('2026-09-30T21:00:00.000Z'));
    // A custom period across the autumn switch ends at the winter midnight.
    expect(
      periodRange({ period: 'custom', from: '2026-10-25', to: '2026-10-25' }, NOW, TZ),
    ).toEqual({
      from: new Date('2026-10-24T21:00:00.000Z'),
      to: new Date('2026-10-25T22:00:00.000Z'),
    });
  });

  it('writes no defaults to the URL', () => {
    expect(periodParams('month')).toEqual({ period: undefined, from: undefined, to: undefined });
    expect(periodParams({ from: '2026-10-14', to: '2026-10-14' })).toEqual({
      period: undefined,
      from: '2026-10-14',
      to: undefined,
    });
    expect(Object.keys(resetParams())).toEqual(['teacher', 'student', 'group', 'status']);
    expect(Object.keys(resetParams(true))).toContain('quick');
  });
});

const lesson = (fields: Partial<Parameters<typeof paymentView>[0]> = {}) => ({
  status: 'COMPLETED' as const,
  priceMinor: 40000,
  groupId: null,
  charges: [],
  kind: 'REGULAR' as const,
  makeupLessonId: null,
  ...fields,
});
const charge = (source: 'PACKAGE' | 'DEBT' | 'BALANCE', paid: boolean) => ({
  id: 'c',
  enrollmentId: 'e',
  source,
  packageId: null,
  amountMinor: 40000,
  currency: 'UAH' as const,
  paid,
  student: { id: 's', fullName: 'Anna' },
});

describe('payment cell (S04 decision 6)', () => {
  it('reads what the charges say', () => {
    expect(paymentView(lesson({ charges: [charge('BALANCE', true)] }))).toEqual({ kind: 'paid' });
    expect(paymentView(lesson({ charges: [charge('BALANCE', false)] }))).toEqual({
      kind: 'unpaid',
    });
    expect(paymentView(lesson({ charges: [charge('DEBT', false)] }))).toEqual({ kind: 'debt' });
    expect(paymentView(lesson({ charges: [charge('PACKAGE', true)] }))).toEqual({
      kind: 'package',
      state: null,
    });
    // With the direction's package now: «Пакет · 3 з 8».
    expect(
      paymentView(lesson({ charges: [charge('PACKAGE', true)] }), { left: 3, total: 8 }),
    ).toEqual({ kind: 'package', state: { left: 3, total: 8 } });
    expect(
      paymentView(
        lesson({
          groupId: 'g',
          charges: [charge('BALANCE', true), charge('BALANCE', false), charge('PACKAGE', true)],
        }),
      ),
    ).toEqual({ kind: 'group', paid: 2, total: 3 });
  });

  it('says what happens before a lesson is charged', () => {
    expect(paymentView(lesson({ status: 'SCHEDULED' }))).toEqual({ kind: 'later' });
    // A lesson ahead in a package-paid direction shows the package that will pay.
    expect(paymentView(lesson({ status: 'SCHEDULED' }), { left: 3, total: 8 })).toEqual({
      kind: 'package',
      state: { left: 3, total: 8 },
    });
    expect(
      paymentView(lesson({ status: 'SCHEDULED', priceMinor: 0 }), { left: 3, total: 8 }),
    ).toEqual({ kind: 'free' });
    expect(paymentView(lesson({ status: 'SCHEDULED', priceMinor: 0 }))).toEqual({ kind: 'free' });
    expect(paymentView(lesson({ status: 'CANCELLED_UNCHARGED' }))).toEqual({ kind: 'noCharge' });
  });

  it('marks a cancelled or missed individual lesson that has no makeup (L-60, L-62)', () => {
    expect(needsMakeup(lesson({ status: 'NO_SHOW' }))).toBe(true);
    expect(needsMakeup(lesson({ status: 'NO_SHOW', makeupLessonId: 'm' }))).toBe(false);
    expect(needsMakeup(lesson({ status: 'CANCELLED_UNCHARGED', groupId: 'g' }))).toBe(false);
    expect(needsMakeup(lesson())).toBe(false);
    expect(lessonKind(lesson({ kind: 'MAKEUP' }))).toBe('makeup');
    expect(lessonKind(lesson({ groupId: 'g' }))).toBe('group');
  });
});
