import { describe, expect, it } from 'vitest';
import { listTimezones, MAIN_TIMEZONES } from './timezone-combobox';

describe('listTimezones', () => {
  it('offers only the main zones, every one a valid IANA identifier', () => {
    expect(listTimezones()).toEqual([...MAIN_TIMEZONES]);
    expect(new Set(MAIN_TIMEZONES).size).toBe(MAIN_TIMEZONES.length);
    for (const zone of MAIN_TIMEZONES) {
      expect(() => new Intl.DateTimeFormat('en-US', { timeZone: zone })).not.toThrow();
    }
  });

  it('keeps a saved or detected zone outside the main list selectable, once', () => {
    expect(listTimezones('Asia/Singapore', 'Asia/Singapore', 'Europe/Kyiv', '')).toEqual([
      'Asia/Singapore',
      ...MAIN_TIMEZONES,
    ]);
  });
});
