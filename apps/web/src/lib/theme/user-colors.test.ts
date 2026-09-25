import { describe, expect, it } from 'vitest';
import { inkOn } from './user-colors';

describe('inkOn', () => {
  it('picks the ink with the higher contrast on a user colour', () => {
    expect(inkOn('#4B4FE0')).toBe('#FFFFFF');
    expect(inkOn('#12A150')).toBe('#1B1F3B');
    expect(inkOn('#FFE066')).toBe('#1B1F3B');
    expect(inkOn('not a colour')).toBe('#FFFFFF');
  });
});
