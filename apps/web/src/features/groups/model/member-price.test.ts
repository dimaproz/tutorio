import { describe, expect, it } from 'vitest';
import {
  groupPriceImpact,
  hasOwnPrices,
  memberPriceDto,
  memberPriceFormSchema,
  priceDifference,
} from './member-price';

const keyOf = (price: string) => {
  const result = memberPriceFormSchema.safeParse({ price });
  if (result.success) return null;
  return (result.error.issues[0] as { params?: { key?: string } }).params?.key;
};

describe('memberPriceFormSchema', () => {
  it('asks for a price, never a negative or unreadable one', () => {
    expect(keyOf('')).toBe('memberPriceRequired');
    expect(keyOf('  ')).toBe('memberPriceRequired');
    expect(keyOf('-50')).toBe('priceNegative');
    expect(keyOf('abc')).toBe('priceInvalid');
    expect(keyOf('350')).toBeNull();
    expect(keyOf('0')).toBeNull();
  });
});

describe('memberPriceDto', () => {
  it('sends minor units in the group currency', () => {
    expect(memberPriceDto({ price: ' 350 ' }, 'UAH')).toEqual({
      priceMinor: 35000,
      currency: 'UAH',
    });
  });
});

describe('priceDifference', () => {
  it('compares the typed price with the group price', () => {
    expect(priceDifference('350', 40000)).toEqual({ kind: 'less', amountMinor: 5000 });
    expect(priceDifference('450', 40000)).toEqual({ kind: 'more', amountMinor: 5000 });
    expect(priceDifference('400', 40000)).toEqual({ kind: 'same', amountMinor: 0 });
    expect(priceDifference('', 40000)).toBeNull();
    expect(priceDifference('350', null)).toBeNull();
  });
});

describe('groupPriceImpact', () => {
  const members = [
    { id: 'a', ownPrice: false, status: 'ACTIVE' as const },
    { id: 'b', ownPrice: true, status: 'ACTIVE' as const },
    { id: 'c', ownPrice: false, status: 'PAUSED' as const },
    { id: 'd', ownPrice: false, status: 'ARCHIVED' as const },
  ];

  it('moves the followers and keeps the own prices', () => {
    const impact = groupPriceImpact(members, 40000, '450');
    expect(impact?.nextPriceMinor).toBe(45000);
    expect(impact?.following.map((member) => member.id)).toEqual(['a', 'c']);
    expect(impact?.own.map((member) => member.id)).toEqual(['b']);
  });

  it('says nothing while the price is unchanged, empty or unreadable', () => {
    expect(groupPriceImpact(members, 40000, '400')).toBeNull();
    expect(groupPriceImpact(members, 40000, '')).toBeNull();
    expect(groupPriceImpact(members, 40000, 'x')).toBeNull();
  });

  it('tells whether the roster needs its price column', () => {
    expect(hasOwnPrices(members)).toBe(true);
    expect(hasOwnPrices([members[0]!])).toBe(false);
  });
});
