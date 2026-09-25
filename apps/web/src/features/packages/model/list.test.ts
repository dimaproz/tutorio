import { describe, expect, it } from 'vitest';
import { listQuery, pillsActive, readListState, rowCredits } from './list';

const NOW = new Date('2026-09-25T10:00:00.000Z');

describe('the «Пакети» page state (S07 board 04)', () => {
  it('reads the tab, filters, search and order from the URL, ending first by default', () => {
    const state = readListState(
      new URLSearchParams('tab=UNPAID&teacher=t1&student=s1&group=g1&kind=BY_PERIOD&q=anna&page=2'),
    );
    expect(state).toEqual({
      page: 2,
      tab: 'UNPAID',
      teacherId: 't1',
      studentId: 's1',
      groupId: null,
      kind: 'BY_PERIOD',
      search: 'anna',
      sort: 'ending',
    });
    expect(readListState(new URLSearchParams('tab=LOW&kind=X&sort=newest'))).toMatchObject({
      tab: 'ACTIVE',
      kind: null,
      sort: 'newest',
    });
    expect(pillsActive(state)).toBe(true);
  });

  it('asks the API for the tab and nothing for «Усі»', () => {
    expect(listQuery(readListState(new URLSearchParams('tab=all')))).toMatchObject({
      status: undefined,
      sort: 'ending',
      pageSize: 20,
    });
    expect(listQuery(readListState(new URLSearchParams()))).toMatchObject({ status: 'ACTIVE' });
  });

  it('colours running-out credits and a closing window, bars for a small package', () => {
    const row = (remainingCredits: number, lessonsTotal: number, expiresAt: string | null) =>
      rowCredits({ remainingCredits, lessonsTotal, expiresAt }, NOW, 2);
    expect(row(6, 8, null)).toMatchObject({ tone: 'brand', bars: false, windowClosing: false });
    expect(row(1, 8, null)).toMatchObject({ tone: 'warning' });
    expect(row(2, 4, null)).toMatchObject({ tone: 'warning', bars: true });
    expect(row(0, 8, null)).toMatchObject({ tone: 'danger', lifecycle: 'used' });
    expect(row(6, 8, '2026-09-30T00:00:00.000Z')).toMatchObject({ windowClosing: true });
  });
});
