import { describe, expect, it } from 'vitest';
import {
  extendsPackage,
  isPausedAt,
  pauseLengthSeconds,
  pauseStateAt,
  pausesOverlap,
} from './pause';

const day = (n: number) => new Date(Date.UTC(2026, 9, n, 0));

describe('pause windows (L-100)', () => {
  const bounded = { startsAt: day(10), endsAt: day(20) };
  const open = { startsAt: day(25), endsAt: null };

  it('covers its start and stops at its end', () => {
    expect(isPausedAt([bounded], day(10))).toBe(true);
    expect(isPausedAt([bounded], day(19))).toBe(true);
    expect(isPausedAt([bounded], day(20))).toBe(false);
    expect(isPausedAt([open], day(28))).toBe(true);
  });

  it('stops where it actually ended', () => {
    expect(isPausedAt([{ ...open, endedAt: day(27) }], day(28))).toBe(false);
  });

  it('tells overlapping pauses apart from back-to-back ones', () => {
    expect(pausesOverlap(bounded, { startsAt: day(19), endsAt: day(22) })).toBe(true);
    expect(pausesOverlap(bounded, { startsAt: day(20), endsAt: day(22) })).toBe(false);
    expect(pausesOverlap(bounded, open)).toBe(false);
    expect(pausesOverlap(open, { startsAt: day(30), endsAt: null })).toBe(true);
  });

  it('reports its state; one ended before it began was cancelled', () => {
    expect(pauseStateAt(bounded, day(5))).toBe('SCHEDULED');
    expect(pauseStateAt(bounded, day(15))).toBe('ACTIVE');
    expect(pauseStateAt(bounded, day(20))).toBe('ENDED');
    expect(pauseStateAt({ ...bounded, endedAt: day(10) }, day(5))).toBe('CANCELLED');
  });
});

describe('package extension (L-102)', () => {
  it('extends by the covered length, and an open pause only once it ends', () => {
    expect(pauseLengthSeconds({ startsAt: day(10), endsAt: day(20) })).toBe(10 * 86_400);
    expect(pauseLengthSeconds({ startsAt: day(10), endsAt: null })).toBeNull();
    expect(pauseLengthSeconds({ startsAt: day(10), endsAt: null, endedAt: day(12) })).toBe(
      2 * 86_400,
    );
  });

  it('extends only packages valid at the pause start', () => {
    expect(extendsPackage({ validFrom: null, expiresAt: day(30) }, day(10))).toBe(true);
    expect(extendsPackage({ validFrom: null, expiresAt: null }, day(10))).toBe(false);
    expect(extendsPackage({ validFrom: null, expiresAt: day(5) }, day(10))).toBe(false);
    expect(extendsPackage({ validFrom: day(15), expiresAt: day(30) }, day(10))).toBe(false);
  });
});
