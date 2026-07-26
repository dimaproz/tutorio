import { describe, expect, it } from 'vitest';
import { resolveDefaultPrice } from './pricing';

describe('resolveDefaultPrice', () => {
  it('prefers the student rate over group and teacher', () => {
    expect(
      resolveDefaultPrice({
        student: { amountMinor: 45000, currency: 'UAH' },
        group: { amountMinor: 30000, currency: 'EUR' },
        teacher: { amountMinor: 20000, currency: 'EUR' },
      }),
    ).toEqual({ priceMinor: 45000, currency: 'UAH', source: 'student' });
  });

  it('falls back to the group price when the student has no rate', () => {
    expect(
      resolveDefaultPrice({
        student: null,
        group: { amountMinor: 30000, currency: 'EUR' },
        teacher: { amountMinor: 20000, currency: 'EUR' },
      }),
    ).toEqual({ priceMinor: 30000, currency: 'EUR', source: 'group' });
  });

  it("falls back to the teacher's default rate when nothing more specific exists", () => {
    expect(
      resolveDefaultPrice({
        teacher: { amountMinor: 20000, currency: 'EUR' },
      }),
    ).toEqual({ priceMinor: 20000, currency: 'EUR', source: 'teacher' });
  });

  it('returns null when no source is configured', () => {
    expect(resolveDefaultPrice({})).toBeNull();
    expect(
      resolveDefaultPrice({ student: null, group: null, teacher: null }),
    ).toBeNull();
  });

  it('skips a half-filled rate rather than guessing a currency', () => {
    expect(
      resolveDefaultPrice({
        student: { amountMinor: 45000, currency: null },
        group: { amountMinor: 30000, currency: 'EUR' },
      }),
    ).toEqual({ priceMinor: 30000, currency: 'EUR', source: 'group' });

    expect(
      resolveDefaultPrice({
        student: { amountMinor: null, currency: 'UAH' },
        teacher: { amountMinor: 20000, currency: 'EUR' },
      }),
    ).toEqual({ priceMinor: 20000, currency: 'EUR', source: 'teacher' });
  });

  it('accepts a zero rate as a real, configured price', () => {
    expect(
      resolveDefaultPrice({
        student: { amountMinor: 0, currency: 'EUR' },
        teacher: { amountMinor: 20000, currency: 'EUR' },
      }),
    ).toEqual({ priceMinor: 0, currency: 'EUR', source: 'student' });
  });

  it('rejects a negative or non-integer amount and falls through', () => {
    expect(
      resolveDefaultPrice({
        student: { amountMinor: -100, currency: 'EUR' },
        teacher: { amountMinor: 20000, currency: 'EUR' },
      }),
    ).toEqual({ priceMinor: 20000, currency: 'EUR', source: 'teacher' });

    expect(
      resolveDefaultPrice({
        student: { amountMinor: 12.5, currency: 'EUR' },
        teacher: { amountMinor: 20000, currency: 'EUR' },
      }),
    ).toEqual({ priceMinor: 20000, currency: 'EUR', source: 'teacher' });
  });
});
