import { describe, expect, it } from 'vitest';
import { effectiveLinks, withLinks, withoutLink } from './use-linked-set';

describe('linked-set edits', () => {
  it('adds without duplicates and keeps the existing order first', () => {
    expect(withLinks(['a', 'b'], ['c', 'a', 'd'])).toEqual(['a', 'b', 'c', 'd']);
    expect(withLinks([], [])).toEqual([]);
  });

  it('removes only the named record', () => {
    expect(withoutLink(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
    expect(withoutLink(['a'], 'z')).toEqual(['a']);
  });
});

describe('the set the next edit builds on', () => {
  const before = ['a'];

  it('is the record when nothing was sent', () => {
    expect(effectiveLinks(before, null)).toEqual(['a']);
  });

  it('is the sent set while the record still predates the send', () => {
    expect(effectiveLinks(before, { ids: ['a', 'b'], against: before })).toEqual(['a', 'b']);
  });

  it('is the record again as soon as a newer copy arrives', () => {
    const refreshed = ['a', 'b'];
    expect(effectiveLinks(refreshed, { ids: ['a', 'b'], against: before })).toEqual(refreshed);
    // Another tab's later edit wins over our older send.
    expect(effectiveLinks(['c'], { ids: ['a', 'b'], against: before })).toEqual(['c']);
  });
});
