import { describe, expect, it } from 'vitest';
import {
  addMoney,
  CurrencyMismatchError,
  decimalStringToMinorUnits,
  formatMoney,
  InvalidDecimalStringError,
  minorUnitsToDecimalString,
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

  it('converts decimal strings to minor units without floats', () => {
    expect(decimalStringToMinorUnits('12.30')).toBe(1230);
    expect(decimalStringToMinorUnits('12.3')).toBe(1230);
    expect(decimalStringToMinorUnits('0.5')).toBe(50);
    expect(decimalStringToMinorUnits('0')).toBe(0);
    expect(decimalStringToMinorUnits('1500')).toBe(150000);
    expect(decimalStringToMinorUnits('-7')).toBe(-700);
    expect(decimalStringToMinorUnits(' 25.99 ')).toBe(2599);
    // Classic float trap: 0.1 + 0.2 !== 0.3; string conversion must be exact.
    expect(decimalStringToMinorUnits('0.29')).toBe(29);
    expect(decimalStringToMinorUnits('1.13')).toBe(113);
  });

  it('accepts a decimal comma as a localized separator', () => {
    expect(decimalStringToMinorUnits('1500,50')).toBe(150050);
    expect(decimalStringToMinorUnits('1500,5')).toBe(150050);
    expect(decimalStringToMinorUnits('0,29')).toBe(29);
  });

  it('rejects malformed decimal strings', () => {
    for (const bad of ['', ' ', '.', '.5', '1.', '1.234', '1,234', '1,2,3', '1.5,0', '1 500', '12e2', 'NaN', '+5']) {
      expect(() => decimalStringToMinorUnits(bad)).toThrow(InvalidDecimalStringError);
    }
  });

  it('rejects decimal strings outside the safe integer range', () => {
    expect(() => decimalStringToMinorUnits('92233720368547758.08')).toThrow(RangeError);
  });

  it('converts minor units back to decimal strings', () => {
    expect(minorUnitsToDecimalString(1230)).toBe('12.30');
    expect(minorUnitsToDecimalString(50)).toBe('0.50');
    expect(minorUnitsToDecimalString(0)).toBe('0.00');
    expect(minorUnitsToDecimalString(5)).toBe('0.05');
    expect(minorUnitsToDecimalString(-50)).toBe('-0.50');
    expect(minorUnitsToDecimalString(150000)).toBe('1500.00');
    expect(() => minorUnitsToDecimalString(10.5)).toThrow(RangeError);
  });

  it('round-trips decimal strings through minor units', () => {
    for (const value of ['0.00', '0.05', '12.30', '1500.00', '-7.00']) {
      expect(minorUnitsToDecimalString(decimalStringToMinorUnits(value))).toBe(value);
    }
  });

  it('formats money for a locale', () => {
    const formatted = formatMoney(money(150000, 'EUR'), 'en-US');
    expect(formatted).toContain('1,500.00');
  });
});
