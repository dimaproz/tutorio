import { afterEach, describe, expect, it } from 'vitest';
import { dayEndIso, dayStartIso, zonedIso } from './datetime';

const KYIV = 'Europe/Kyiv';
const original = process.env.TZ;

afterEach(() => {
  process.env.TZ = original;
});

describe.each(['Europe/Kyiv', 'UTC', 'Asia/Tbilisi', 'America/New_York'])(
  'the studio clock in a browser set to %s',
  (browserZone) => {
    it('turns a typed date and time into the same instant', () => {
      process.env.TZ = browserZone;
      expect(zonedIso('2026-10-30', '17:00', KYIV)).toBe('2026-10-30T15:00:00.000Z');
      expect(dayStartIso('2026-10-30', KYIV)).toBe('2026-10-29T22:00:00.000Z');
      expect(dayEndIso('2026-10-30', KYIV)).toBe('2026-10-30T22:00:00.000Z');
      // The autumn switch: the 25th is 25 hours long.
      expect(dayStartIso('2026-10-25', KYIV)).toBe('2026-10-24T21:00:00.000Z');
      expect(dayEndIso('2026-10-25', KYIV)).toBe('2026-10-25T22:00:00.000Z');
    });
  },
);
