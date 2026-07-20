import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import uk from '../../messages/uk.json';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('message catalogs', () => {
  it('uk and en are structurally identical', () => {
    expect(flattenKeys(uk).sort()).toEqual(flattenKeys(en).sort());
  });

  it('no message is empty', () => {
    const check = (value: unknown, path: string) => {
      if (typeof value === 'string') {
        expect(value.trim(), path).not.toBe('');
        return;
      }
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        check(child, `${path}.${key}`);
      }
    };
    check(uk, 'uk');
    check(en, 'en');
  });
});
