import { describe, expect, it } from 'vitest';
import { withLinks, withoutLink } from './use-linked-set';

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
