import { describe, expect, it } from 'vitest';
import { buildUpdatedSearchParams } from './list-controls';

describe('buildUpdatedSearchParams', () => {
  it('resets pagination when search, filters, or sorting change', () => {
    const current = new URLSearchParams('page=3&status=ACTIVE');

    expect(buildUpdatedSearchParams(current, { search: 'anna' }, true).toString()).toBe(
      'status=ACTIVE&search=anna',
    );
    expect(buildUpdatedSearchParams(current, { status: 'ON_HOLD' }, true).toString()).toBe(
      'status=ON_HOLD',
    );
    expect(
      buildUpdatedSearchParams(current, { sort: 'createdAt', order: 'desc' }, true).toString(),
    ).toBe('status=ACTIVE&sort=createdAt&order=desc');
  });

  it('clears all active Student collection controls and returns to page one', () => {
    const current = new URLSearchParams('page=2&search=anna&status=ACTIVE&groupId=group-1');

    expect(
      buildUpdatedSearchParams(
        current,
        { search: undefined, status: undefined, groupId: undefined },
        true,
      ).toString(),
    ).toBe('');
  });

  it('keeps pagination when the pager is the only control changing it', () => {
    const current = new URLSearchParams('search=anna');

    expect(buildUpdatedSearchParams(current, { page: '2' }).toString()).toBe('search=anna&page=2');
  });
});
