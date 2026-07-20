import { describe, expect, it } from 'vitest';
import { resolveLocale } from './locale';

describe('resolveLocale', () => {
  it('prefers a valid NEXT_LOCALE cookie', () => {
    expect(resolveLocale('en', 'uk-UA,uk;q=0.9')).toBe('en');
    expect(resolveLocale('uk', 'en-US,en;q=0.9')).toBe('uk');
  });

  it('ignores invalid cookie values', () => {
    expect(resolveLocale('de', 'en-US,en;q=0.9')).toBe('en');
    expect(resolveLocale('', 'en-US')).toBe('en');
  });

  it('falls back to the first supported browser language', () => {
    expect(resolveLocale(undefined, 'en-US,en;q=0.9,uk;q=0.8')).toBe('en');
    expect(resolveLocale(undefined, 'uk-UA,uk;q=0.9,en;q=0.8')).toBe('uk');
    expect(resolveLocale(undefined, 'de-DE,de;q=0.9,en;q=0.8')).toBe('en');
  });

  it('defaults to Ukrainian when nothing matches', () => {
    expect(resolveLocale(undefined, undefined)).toBe('uk');
    expect(resolveLocale(undefined, null)).toBe('uk');
    expect(resolveLocale(undefined, 'de-DE,fr;q=0.9')).toBe('uk');
    expect(resolveLocale('fr', 'pl-PL')).toBe('uk');
  });
});
