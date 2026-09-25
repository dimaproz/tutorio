import { describe, expect, it } from 'vitest';
import { inkOn, readableFill } from './user-colors';

describe('inkOn', () => {
  it('picks the ink with the higher contrast on a user colour', () => {
    expect(inkOn('#4B4FE0')).toBe('#FFFFFF');
    expect(inkOn('#12A150')).toBe('#1B1F3B');
    expect(inkOn('#FFE066')).toBe('#1B1F3B');
    expect(inkOn('not a colour')).toBe('#FFFFFF');
  });
});

describe('readableFill', () => {
  it('keeps a colour text already reads on, else darkens it until white does', () => {
    expect(readableFill('#4B4FE0')).toEqual({ fill: '#4B4FE0', ink: '#FFFFFF' });
    expect(readableFill('#FFE066')).toEqual({ fill: '#FFE066', ink: '#1B1F3B' });
    // A mid blue reads with neither ink: it gets darker, with white text.
    const blue = readableFill('#1C7ED6');
    expect(blue.ink).toBe('#FFFFFF');
    expect(blue.fill).not.toBe('#1C7ED6');
    expect(readableFill('#F08C00')).toEqual({ fill: '#F08C00', ink: '#1B1F3B' });
  });
});
