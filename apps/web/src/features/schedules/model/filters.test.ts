import { describe, expect, it } from 'vitest';
import {
  lastDayOf,
  listQuery,
  pillsActive,
  plannedChanges,
  readListState,
  resetParams,
  scheduleStatus,
} from './filters';

const state = (query = '') => readListState(new URLSearchParams(query));

describe('schedules list state (S05)', () => {
  it('opens on the active schedules by their next lesson', () => {
    expect(state()).toEqual({
      page: 1,
      tab: 'ACTIVE',
      teacherId: null,
      studentId: null,
      groupId: null,
      kind: null,
      search: null,
      sort: 'next',
    });
    expect(listQuery(state())).toEqual({
      page: 1,
      pageSize: 20,
      state: undefined,
      teacherId: undefined,
      studentId: undefined,
      groupId: undefined,
      kind: undefined,
      search: undefined,
      sort: 'next',
    });
  });

  it('reads the tab, filters, search and order back from the URL', () => {
    const read = state(
      'state=CHANGING&teacher=t1&group=g1&kind=group&q=%20b2%20&sort=created&page=2',
    );
    expect(read).toMatchObject({
      tab: 'CHANGING',
      teacherId: 't1',
      groupId: 'g1',
      kind: 'group',
      search: 'b2',
      sort: 'created',
      page: 2,
    });
    expect(listQuery(read)).toMatchObject({ state: 'CHANGING', kind: 'group', search: 'b2' });
    expect(pillsActive(read)).toBe(true);
    expect(state('state=PAUSED&kind=trial')).toMatchObject({ tab: 'ACTIVE', kind: null });
    expect(Object.keys(resetParams(true))).toEqual([
      'teacher',
      'student',
      'group',
      'kind',
      'q',
      'state',
    ]);
  });
});

describe('schedule status', () => {
  const slots = [
    { weekday: 2, localTime: '17:00', seriesId: 'a' },
    { weekday: 5, localTime: '18:30', seriesId: 'b' },
  ];

  it('reads ended, a planned change, an end date or plain active', () => {
    expect(scheduleStatus({ state: 'ENDED', nextChange: null, endsAt: null })).toEqual({
      kind: 'ended',
    });
    expect(
      scheduleStatus({
        state: 'ACTIVE',
        nextChange: { effectiveFrom: '2026-10-01T00:00:00.000Z', slots: [] },
        endsAt: null,
      }),
    ).toEqual({ kind: 'changing', from: '2026-10-01T00:00:00.000Z' });
    expect(
      scheduleStatus({ state: 'ACTIVE', nextChange: null, endsAt: '2026-11-01T00:00:00.000Z' }),
    ).toEqual({ kind: 'until', lastDay: '2026-10-31T23:59:59.999Z' });
    expect(lastDayOf('2026-11-01T00:00:00.000Z')).toBe('2026-10-31T23:59:59.999Z');
  });

  it('names the weekdays a planned change touches', () => {
    expect(
      plannedChanges({
        slots,
        nextChange: {
          effectiveFrom: '2026-10-01T00:00:00.000Z',
          slots: [
            { weekday: 2, localTime: '18:00' },
            { weekday: 5, localTime: '18:30' },
            { weekday: 3, localTime: '16:00' },
          ],
        },
      }),
    ).toEqual([
      { weekday: 2, before: '17:00', after: '18:00' },
      { weekday: 3, before: null, after: '16:00' },
    ]);
  });
});
