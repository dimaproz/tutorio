import { describe, expect, it } from 'vitest';
import {
  addMoney,
  CurrencyMismatchError,
  formatMoney,
  money,
  subtractMoney,
  sumMoney,
} from './money';

describe('money', () => {
  it('creates money in minor units', () => {
    expect(money(150000, 'UAH')).toEqual({ amountMinor: 150000, currency: 'UAH' });
  });

  it('rejects non-integer amounts', () => {
    expect(() => money(10.5, 'EUR')).toThrow(RangeError);
    expect(() => money(Number.MAX_SAFE_INTEGER + 1, 'EUR')).toThrow(RangeError);
  });

  it('adds and subtracts same-currency money', () => {
    expect(addMoney(money(100, 'EUR'), money(250, 'EUR'))).toEqual(money(350, 'EUR'));
    expect(subtractMoney(money(100, 'EUR'), money(250, 'EUR'))).toEqual(money(-150, 'EUR'));
  });

  it('refuses cross-currency arithmetic', () => {
    expect(() => addMoney(money(100, 'EUR'), money(100, 'UAH'))).toThrow(CurrencyMismatchError);
    expect(() => subtractMoney(money(100, 'PLN'), money(100, 'USD'))).toThrow(
      CurrencyMismatchError,
    );
  });

  it('sums a list with explicit currency (empty list allowed)', () => {
    expect(sumMoney([], 'EUR')).toEqual(money(0, 'EUR'));
    expect(sumMoney([money(100, 'UAH'), money(200, 'UAH')], 'UAH')).toEqual(money(300, 'UAH'));
    expect(() => sumMoney([money(100, 'EUR')], 'UAH')).toThrow(CurrencyMismatchError);
  });

  it('formats money for a locale', () => {
    const formatted = formatMoney(money(150000, 'EUR'), 'en-US');
    expect(formatted).toContain('1,500.00');
  });
});
