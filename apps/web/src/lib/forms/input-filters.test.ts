import { describe, expect, it } from 'vitest';
import { keepPhoneCharacters, keepTelegramCharacters } from './input-filters';

describe('input filters', () => {
  it('keeps only phone characters', () => {
    expect(keepPhoneCharacters('+380 (50) 111-22-33 ext.')).toBe('+380 (50) 111-22-33 ');
  });

  it('drops the leading @ and anything that is not a word character', () => {
    expect(keepTelegramCharacters('@@iryna.s-1')).toBe('irynas1');
  });
});
