import { describe, expect, it } from 'vitest';
import { buildQueryString, parsePageParam, parseStateParam } from './filters';
import { queryKeys } from './keys';

describe('query key factories', () => {
  it('nests list and detail keys under the feature root so invalidation cascades', () => {
    const listKey = queryKeys.students.lists({ page: 2, search: 'alice' });
    const detailKey = queryKeys.students.detail('student-1');

    expect(listKey.slice(0, queryKeys.students.all.length)).toEqual([
      ...queryKeys.students.all,
    ]);
    expect(detailKey.slice(0, queryKeys.students.all.length)).toEqual([
      ...queryKeys.students.all,
    ]);
  });

  it('distinguishes different filter sets and matches identical ones', () => {
    expect(queryKeys.students.lists({ page: 1 })).toEqual(queryKeys.students.lists({ page: 1 }));
    expect(queryKeys.students.lists({ page: 1 })).not.toEqual(
      queryKeys.students.lists({ page: 2 }),
    );
    expect(queryKeys.groups.lists({ page: 1, state: 'deleted' })).not.toEqual(
      queryKeys.groups.lists({ page: 1, state: 'active' }),
    );
  });

  it('keeps feature roots separate', () => {
    expect(queryKeys.students.all).not.toEqual(queryKeys.groups.all);
    expect(queryKeys.enrollments.all).not.toEqual(queryKeys.audit.all);
  });
});

describe('filter serialization', () => {
  it('omits empty values so URLs stay clean', () => {
    expect(buildQueryString({ page: 1, search: undefined, state: undefined })).toBe('?page=1');
    expect(buildQueryString({ page: 2, search: 'alice', state: 'deleted' })).toBe(
      '?page=2&search=alice&state=deleted',
    );
    expect(buildQueryString({})).toBe('');
  });

  it('encodes values that would otherwise break the query string', () => {
    expect(buildQueryString({ search: 'a&b=c' })).toBe('?search=a%26b%3Dc');
  });
});

describe('URL parameter parsing', () => {
  it('falls back to page 1 for anything unusable', () => {
    expect(parsePageParam('3')).toBe(3);
    expect(parsePageParam(null)).toBe(1);
    expect(parsePageParam('0')).toBe(1);
    expect(parsePageParam('-2')).toBe(1);
    expect(parsePageParam('abc')).toBe(1);
  });

  it('never lets a teacher reach deleted records through the URL', () => {
    expect(parseStateParam('deleted', true)).toBe('deleted');
    expect(parseStateParam('all', true)).toBe('all');
    // Teachers are forced back to `active` even if they hand-edit the URL;
    // the API enforces the same rule.
    expect(parseStateParam('deleted', false)).toBe('active');
    expect(parseStateParam('all', false)).toBe('active');
    expect(parseStateParam('nonsense', true)).toBe('active');
    expect(parseStateParam(null, true)).toBe('active');
  });
});
