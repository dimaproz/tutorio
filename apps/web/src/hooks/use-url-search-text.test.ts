import { describe, expect, it } from 'vitest';
import { searchTextFollowsUrl } from './use-url-search-text';

describe('searchTextFollowsUrl', () => {
  it('takes a search changed elsewhere, such as a cleared filter', () => {
    expect(searchTextFollowsUrl('', 'anna', 'anna')).toBe(true);
    expect(searchTextFollowsUrl('maks', 'anna', 'anna')).toBe(true);
  });

  it('keeps the keys typed while the last commit reached the URL', () => {
    // The URL caught up with the committed "anna" while the user typed on.
    expect(searchTextFollowsUrl('anna', 'anna k', 'anna')).toBe(false);
  });

  it('ignores a URL that already matches the field', () => {
    expect(searchTextFollowsUrl('anna', ' anna ', 'an')).toBe(false);
  });
});
