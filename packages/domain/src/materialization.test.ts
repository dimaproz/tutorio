import { describe, expect, it } from 'vitest';
import { planMaterialization } from './materialization';
import type { RecurrenceRule } from './recurrence';

const RULE: RecurrenceRule = {
  weekdays: [1], // Mondays
  localTime: '10:00',
  timezone: 'Europe/Berlin',
  startDate: new Date(0),
};

const WINDOW = {
  from: new Date(Date.UTC(2026, 0, 1)),
  horizonUntil: new Date(Date.UTC(2026, 0, 29)), // Jan 5, 12, 19, 26
};

describe('planMaterialization', () => {
  it('generates the full expansion when nothing exists yet', () => {
    const { toCreate } = planMaterialization({ rule: RULE, ...WINDOW, existingSlots: [] });
    expect(toCreate.map((s) => s.getUTCDate())).toEqual([5, 12, 19, 26]);
  });

  it('is idempotent: re-running with created slots folded in yields nothing', () => {
    const first = planMaterialization({ rule: RULE, ...WINDOW, existingSlots: [] });
    const second = planMaterialization({
      rule: RULE,
      ...WINDOW,
      existingSlots: first.toCreate,
    });
    expect(second.toCreate).toEqual([]);
  });

  it('does not regenerate an existing slot regardless of its status', () => {
    // e.g. Jan 12 was cancelled/detached but its slot still occupies the series.
    const existing = [new Date(Date.UTC(2026, 0, 12, 9, 0))];
    const { toCreate } = planMaterialization({ rule: RULE, ...WINDOW, existingSlots: existing });
    expect(toCreate.map((s) => s.getUTCDate())).toEqual([5, 19, 26]);
  });

  it('honors the horizon upper bound', () => {
    const { toCreate } = planMaterialization({
      rule: RULE,
      from: WINDOW.from,
      horizonUntil: new Date(Date.UTC(2026, 0, 13)), // only Jan 5 & 12
      existingSlots: [],
    });
    expect(toCreate.map((s) => s.getUTCDate())).toEqual([5, 12]);
  });
});
