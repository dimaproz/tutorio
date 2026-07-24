/**
 * Idempotent planning of which lessons a recurring series still needs to
 * materialize. Pure: it computes the missing UTC slots; persistence and the
 * cron cadence live in the API layer.
 */

import { expandSeries, type RecurrenceRule } from './recurrence';

export interface MaterializationParams {
  rule: RecurrenceRule;
  /** Lower bound to start generating from (UTC), e.g. "now" or the series start. */
  from: Date;
  /** Materialize up to (but not including) this instant (UTC). */
  horizonUntil: Date;
  /**
   * UTC start instants already present for this series, regardless of status —
   * completed, cancelled, and detached slots are all included so a slot is never
   * regenerated. Compared by exact millisecond.
   */
  existingSlots: readonly Date[];
}

export interface MaterializationPlan {
  /** New UTC start instants to create, ascending. */
  toCreate: Date[];
}

/**
 * Expands the series over `[from, horizonUntil)` and subtracts slots that
 * already exist. Running it twice with the freshly-created slots folded into
 * `existingSlots` yields an empty plan — the operation is idempotent.
 */
export function planMaterialization(params: MaterializationParams): MaterializationPlan {
  const existing = new Set(params.existingSlots.map((slot) => slot.getTime()));
  const candidates = expandSeries(params.rule, {
    from: params.from,
    until: params.horizonUntil,
  });
  const toCreate = candidates.filter((slot) => !existing.has(slot.getTime()));
  return { toCreate };
}
