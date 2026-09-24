/**
 * The package credit ledger (ADR 0007): what a package was granted.
 *
 * Entries are **append-only and expressed in lesson units**, never in money —
 * money lives in `Payment`. A purchase grants the package's credits and a
 * manual adjustment corrects them; a correction is a new entry, never an
 * edit. What a package has paid for is not an entry: it is the lesson
 * charges assigned to it (see `billing.ts`), so a package's remaining credits
 * are its granted credits minus its active charges.
 */

export type LedgerEntryType = 'purchase' | 'manual_adjustment';

export interface LedgerEntryLike {
  delta: number;
  type: LedgerEntryType;
}

/** Credits a package was granted: the sum of its entries. */
export function creditBalance(entries: readonly LedgerEntryLike[]): number {
  return entries.reduce((sum, entry) => sum + entry.delta, 0);
}

/** Credits a package still has after the charges it pays for. */
export function remainingCredits(
  entries: readonly LedgerEntryLike[],
  chargesPaid: number,
): number {
  return creditBalance(entries) - chargesPaid;
}
