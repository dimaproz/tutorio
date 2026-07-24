import { describe, expect, it } from 'vitest';
import {
  findConflicts,
  intervalsOverlap,
  toInterval,
  type BusyInterval,
} from './conflict';

const at = (h: number, m = 0) => new Date(Date.UTC(2026, 0, 5, h, m));

describe('intervalsOverlap', () => {
  it('detects a genuine overlap', () => {
    expect(
      intervalsOverlap({ start: at(10), end: at(11) }, { start: at(10, 30), end: at(11, 30) }),
    ).toBe(true);
  });

  it('treats touching endpoints as non-overlapping (back-to-back lessons)', () => {
    expect(
      intervalsOverlap({ start: at(10), end: at(11) }, { start: at(11), end: at(12) }),
    ).toBe(false);
  });

  it('detects containment', () => {
    expect(
      intervalsOverlap({ start: at(10), end: at(12) }, { start: at(10, 30), end: at(11) }),
    ).toBe(true);
  });

  it('returns false for disjoint intervals', () => {
    expect(
      intervalsOverlap({ start: at(10), end: at(11) }, { start: at(12), end: at(13) }),
    ).toBe(false);
  });
});

describe('toInterval', () => {
  it('builds an end from a duration in minutes', () => {
    expect(toInterval(at(10), 90)).toEqual({ start: at(10), end: at(11, 30) });
  });
});

describe('findConflicts', () => {
  const existing: BusyInterval[] = [
    { id: 'a', start: at(9), end: at(10) },
    { id: 'b', start: at(10, 30), end: at(11, 30) },
    { id: 'c', start: at(13), end: at(14) },
  ];

  it('returns only the overlapping busy intervals', () => {
    const conflicts = findConflicts(toInterval(at(11), 60), existing);
    expect(conflicts.map((c) => c.id)).toEqual(['b']);
  });

  it('returns empty for a free slot', () => {
    expect(findConflicts(toInterval(at(12), 30), existing)).toEqual([]);
  });
});
