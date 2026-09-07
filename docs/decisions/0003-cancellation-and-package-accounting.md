# ADR 0003: Cancellation and Package Accounting

- Status: Accepted; implemented and verified in Work Packet 3
- Date: 2026-08-24

## Context

The current implementation can grant three benefits for one uncharged
cancellation: retain the lesson credit, reduce the package’s effective monetary
total through a zero-delta credit event, and offer a replacement lesson. Repeated
cancel/restore cycles can also create multiple zero-delta events that distort
group participant shares. This is not explainable or safe to reconcile.

## Decision

For fixed-count lesson packages, entitlement and money are separate ledgers.
Cancellation changes lesson entitlement at most once per state transition and
does not implicitly change the agreed package price.

| Outcome                                 |      Credit delta | Package total | Replacement                         |
| --------------------------------------- | ----------------: | ------------: | ----------------------------------- |
| Completed lesson                        |              `-1` |     unchanged | none                                |
| Student no-show / charged cancellation  |              `-1` |     unchanged | none by default                     |
| Student cancellation within free policy |               `0` |     unchanged | optional explicit scheduling action |
| Teacher cancellation                    |               `0` |     unchanged | optional explicit scheduling action |
| Restore a previously charged occurrence | compensating `+1` |     unchanged | not applicable                      |
| Restore a zero-delta cancellation       |     no ledger row |     unchanged | not applicable                      |

- Zero-delta operational history may be shown from lesson/audit events, but it
  must not be inserted into the credit ledger or counted as a monetary discount.
- A price reduction, refund, or goodwill discount is an explicit money-side
  adjustment with reason, actor, amount, currency, and idempotency key.
- Payment status is derived from settled money versus the agreed total plus
  explicit money adjustments; lesson-credit events do not change it.
- A lesson that consumes a package persists that `packageId`. Compensation uses
  the same package.
- Fixed-count credit semantics apply only to `FIXED_COUNT` packages. A package
  must be active and unexpired at the lesson occurrence for a new debit; an
  archived or expired exact package remains eligible only for its compensation.
- Replacement lessons are real scheduling commands. The UI must not promise an
  automatic replacement unless a new occurrence is actually created and
  conflict-checked.

## Period plans

Period/monthly plans require a separate entitlement and cancellation contract.
They are hidden or marked advanced for the first pilot until their acceptance
matrix is implemented. Fixed-count semantics must not be reused accidentally.

## Consequences

- Existing package-total and participant-share calculations must stop treating
  zero-delta cancellation entries as discounts.
- Repeated cancel/restore commands must be idempotent.
- Tests must reconcile credit balance, agreed total, received amount,
  outstanding amount, participant shares, and human-readable history after every
  transition.

## Implementation note

Work Packet 3 implements the non-zero transition matrix with a persisted lesson
transition version, exact package pinning on first debit, and append-only
compensation. A lesson with non-zero credit history locks its price/currency
snapshot, so compensation never depends on a later PATCH. Legacy zero-delta
entries remain readable but have no financial effect. The packet is not marked
fully implemented until its isolated database E2E and migration-upgrade
verification complete.
