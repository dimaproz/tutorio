import { describe, expect, it } from 'vitest';
import { creditBalance, remainingCredits } from './ledger';

describe('creditBalance', () => {
  it('sums the purchase and every manual correction', () => {
    expect(
      creditBalance([
        { delta: 8, type: 'purchase' },
        { delta: 2, type: 'manual_adjustment' },
        { delta: -1, type: 'manual_adjustment' },
      ]),
    ).toBe(9);
  });
});

describe('remainingCredits', () => {
  it('takes the charges a package pays for off its granted credits', () => {
    expect(remainingCredits([{ delta: 10, type: 'purchase' }], 3)).toBe(7);
  });
});
