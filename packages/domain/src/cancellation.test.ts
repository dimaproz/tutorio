import { describe, expect, it } from 'vitest';
import {
  cancellationTiming,
  effectiveDeadlineHours,
  hoursUntil,
  suggestedCancellationStatus,
} from './cancellation';

const NOW = new Date('2026-08-01T10:00:00.000Z');
const inHours = (hours: number) =>
  new Date(NOW.getTime() + hours * 3_600_000);

describe('effectiveDeadlineHours', () => {
  it("uses the enrollment's own deadline when set", () => {
    expect(effectiveDeadlineHours(48, 24)).toBe(48);
  });

  it('falls back to the workspace default', () => {
    expect(effectiveDeadlineHours(null, 24)).toBe(24);
    expect(effectiveDeadlineHours(undefined, 24)).toBe(24);
  });

  it('honours an explicit zero rather than treating it as unset', () => {
    expect(effectiveDeadlineHours(0, 24)).toBe(0);
  });
});

describe('hoursUntil', () => {
  it('counts whole hours left', () => {
    expect(hoursUntil(inHours(3), NOW)).toBe(3);
    // Partial hours round down: 2h59m left is "2 hours".
    expect(hoursUntil(new Date(NOW.getTime() + 179 * 60_000), NOW)).toBe(2);
  });

  it('goes negative once the lesson has started', () => {
    expect(hoursUntil(inHours(-1), NOW)).toBe(-1);
  });
});

describe('cancellationTiming', () => {
  it('is on time well before the deadline', () => {
    expect(cancellationTiming(inHours(48), NOW, 24)).toBe('on_time');
  });

  it('is late inside the deadline', () => {
    expect(cancellationTiming(inHours(3), NOW, 24)).toBe('late');
  });

  it('treats the exact deadline as on time', () => {
    expect(cancellationTiming(inHours(24), NOW, 24)).toBe('on_time');
  });

  it('is late for a lesson that already started', () => {
    expect(cancellationTiming(inHours(-2), NOW, 24)).toBe('late');
  });

  it('makes every cancellation on time when the deadline is zero', () => {
    expect(cancellationTiming(inHours(1), NOW, 0)).toBe('on_time');
    // Once it has begun, even a zero deadline is missed.
    expect(cancellationTiming(inHours(-1), NOW, 0)).toBe('late');
  });
});

describe('suggestedCancellationStatus', () => {
  it('charges a late cancellation and spares an on-time one', () => {
    expect(suggestedCancellationStatus('late')).toBe('CANCELLED_CHARGED');
    expect(suggestedCancellationStatus('on_time')).toBe('CANCELLED_UNCHARGED');
  });
});
