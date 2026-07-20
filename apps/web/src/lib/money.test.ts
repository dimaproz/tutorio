import { describe, expect, it } from 'vitest';
import { formatPriceInput, parsePriceInput, PRICE_MINOR_MAX } from './money';

describe('parsePriceInput', () => {
  it('accepts the formats a form actually receives', () => {
    expect(parsePriceInput('1500')).toBe(150000);
    expect(parsePriceInput('1500.5')).toBe(150050);
    expect(parsePriceInput('1500.50')).toBe(150050);
    // Localized decimal comma (uk keyboards).
    expect(parsePriceInput('1500,50')).toBe(150050);
    expect(parsePriceInput('0')).toBe(0);
    expect(parsePriceInput(' 25.99 ')).toBe(2599);
  });

  it('rejects input the API would refuse', () => {
    expect(parsePriceInput('')).toBeNull();
    expect(parsePriceInput('abc')).toBeNull();
    expect(parsePriceInput('1.234')).toBeNull();
    expect(parsePriceInput('1 500')).toBeNull();
    expect(parsePriceInput('-5')).toBeNull();
  });

  it('rejects amounts beyond the PostgreSQL Int column', () => {
    expect(parsePriceInput(formatPriceInput(PRICE_MINOR_MAX))).toBe(PRICE_MINOR_MAX);
    expect(parsePriceInput('21474836.48')).toBeNull();
  });
});

describe('formatPriceInput', () => {
  it('round-trips an existing enrollment price back into the form', () => {
    expect(formatPriceInput(150050)).toBe('1500.50');
    expect(formatPriceInput(0)).toBe('0.00');
    expect(formatPriceInput(5)).toBe('0.05');
    expect(parsePriceInput(formatPriceInput(2599))).toBe(2599);
  });
});
