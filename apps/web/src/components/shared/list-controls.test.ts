import { describe, expect, it } from 'vitest';
import { buildUpdatedSearchParams, planSearchParamsWrite } from './list-controls';

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

describe('planSearchParamsWrite', () => {
  const rendered = new URLSearchParams('search=ann');

  it('writes through native history from the live URL while the page is on screen', () => {
    // The render still saw `search=ann`; the URL already holds a later commit.
    expect(
      planSearchParamsWrite({
        pathname: '/app/students',
        rendered,
        location: { pathname: '/app/students', search: '?search=anna&page=2' },
        updates: { status: 'ACTIVE' },
        resetPage: true,
      }),
    ).toEqual({ href: '/app/students?search=anna&status=ACTIVE', native: true });
  });

  it('drops the query string entirely when every control is cleared', () => {
    expect(
      planSearchParamsWrite({
        pathname: '/app/parents',
        rendered,
        location: { pathname: '/app/parents', search: '?search=anna' },
        updates: { search: undefined },
      }),
    ).toEqual({ href: '/app/parents', native: true });
  });

  it('leaves the write to the router when the URL belongs to another page', () => {
    expect(
      planSearchParamsWrite({
        pathname: '/app/students',
        rendered,
        location: { pathname: '/iframe.html', search: '?id=story' },
        updates: { page: '2' },
      }),
    ).toEqual({ href: '/app/students?search=ann&page=2', native: false });
    expect(
      planSearchParamsWrite({ pathname: '/app/students', rendered, updates: { page: '2' } }),
    ).toEqual({ href: '/app/students?search=ann&page=2', native: false });
  });
});
