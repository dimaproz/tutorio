import { describe, expect, it } from 'vitest';
import { buildPageSlots, PAGE_ELLIPSIS } from './pagination';

describe('buildPageSlots', () => {
  it('lists every page while they still fit', () => {
    expect(buildPageSlots(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('keeps three pages at each end near the start', () => {
    expect(buildPageSlots(1, 10)).toEqual([1, 2, 3, PAGE_ELLIPSIS, 8, 9, 10]);
    expect(buildPageSlots(3, 10)).toEqual([1, 2, 3, PAGE_ELLIPSIS, 8, 9, 10]);
  });

  it('keeps the same shape near the end', () => {
    expect(buildPageSlots(10, 10)).toEqual([1, 2, 3, PAGE_ELLIPSIS, 8, 9, 10]);
  });

  it('centres the current page in the middle of a long list', () => {
    expect(buildPageSlots(6, 12)).toEqual([1, PAGE_ELLIPSIS, 5, 6, 7, PAGE_ELLIPSIS, 12]);
  });

  it('never grows past seven slots', () => {
    for (let page = 1; page <= 40; page += 1) {
      expect(buildPageSlots(page, 40)).toHaveLength(7);
    }
  });
});
