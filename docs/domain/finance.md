# Finance Aggregate

Last verified: 2026-08-27 (root static/unit/build checks, isolated PostgreSQL 17 E2E, and finance migration-upgrade verification).

The finance aggregate uses two separate histories:

- lesson entitlement: `LessonCreditEntry` in lesson units;
- money received: `Payment` in integer minor units and one currency.

Cancellation semantics are defined by
[ADR 0003](../decisions/0003-cancellation-and-package-accounting.md).

## LessonPackage

| Concern       | Contract                                                                                                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose       | Immutable purchase snapshot for exactly one student or group.                                                                                                               |
| Ownership     | Workspace-scoped; target XOR is enforced by validation and database constraints.                                                                                            |
| Relationships | Target, optional enrollment context, credit entries, payments, participant shares, package-owned series and lessons.                                                        |
| Create        | Grant opening entitlement atomically. Scheduling and payment are separate user jobs in the target UX, even if orchestration remains transactional internally.               |
| Edit/version  | No arbitrary mutation of agreed commercial history. A material plan change creates an explicit adjustment or replacement plan.                                              |
| Archive       | Prevents new debits, archives owned series and future scheduled package lessons, and preserves credits, payments, shares, and historical lessons. Restore is not supported. |
| Current gaps  | Period-plan entitlement and cancellation semantics remain out of scope for the first pilot; period packages cannot fund fixed-count lesson credits.                         |

Acceptance scenarios: individual/group XOR, entitlement grant, target ownership,
currency consistency, archive with series, expired/depleted states, idempotency.

## LessonCreditEntry

| Concern      | Contract                                                                                                                                                                                                                                                                                      |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose      | Append-only explanation of lesson entitlement changes.                                                                                                                                                                                                                                        |
| Ownership    | Workspace and package-scoped; optional lesson, enrollment, and actor references.                                                                                                                                                                                                              |
| Lifecycle    | Insert only. Corrections are compensating rows with unique idempotency keys; never update/delete.                                                                                                                                                                                             |
| Invariants   | Units are integers; one semantic transition produces at most one non-zero delta; a compensation references the same persisted package and lesson context. Current consumption is the net of lesson debits and compensations; purchases/manual adjustments do not represent completed lessons. |
| Current gaps | Legacy lessons with conflicting package history require manual repair; automatic package inference is deliberately forbidden for compensation.                                                                                                                                                |

Acceptance: reconcile balance from history after every transition and prove
repeat commands do not change balance or create meaningless ledger rows.

## Eligibility and legacy repair

Only active `FIXED_COUNT` packages may fund a new lesson debit. Explicit and
automatic selection validates the package target, currency, archive state, and
`expiresAt` against the occurrence's `startsAtUtc`, not request time. An archived
package is allowed only for an exact compensation of its own recorded debit.
Once a lesson has a non-zero credit entry, its price/currency snapshot is
immutable; notes and the established per-lesson `paidAt` field remain editable.

The finance migration backfills a NULL `Lesson.packageId` only when one distinct
ledger package exists. Multiple ledger packages, an existing mismatch, or a
terminal charged lesson without exactly one ledger package require reviewed
manual repair; the mandatory deploy query is in `deploy.md`.

## PackageParticipantShare

| Concern       | Contract                                                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Purpose       | Creation-time debt allocation for each participant in a group package.                                                             |
| Ownership     | Workspace/package-scoped through the package; unique `(packageId, enrollmentId)`.                                                  |
| Create/update | Created from an explicit preview and allocation rule. Settled payments increment the matching share. No independent CRUD.          |
| Lifecycle     | Historical snapshot; roster changes do not silently rewrite past debt. Corrections require an explicit reallocation/refund design. |
| Current gaps  | No refund/correction path. Zero-delta credit entries are ignored because shares are immutable purchase-time snapshots.             |

Acceptance scenarios: deterministic rounding, membership snapshot, partial/full
payment, overpayment rejection, cancellation, and preserved history on archive.

## Payment

| Concern      | Contract                                                                                                                                                                                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose      | Append-only record of money received or reversed, separate from lesson credits.                                                                                                                                                                                      |
| Ownership    | Workspace and enrollment-scoped; package optional only for a documented non-package payment use case.                                                                                                                                                                |
| Create       | Validate amount, currency, date, idempotency, and that enrollment participates in the package target/share. Derive package payment status; do not ask users to set it.                                                                                               |
| Lifecycle    | Insert-only event with explicit reversal/refund status or compensating event. Routine edit/delete is not allowed.                                                                                                                                                    |
| Current gaps | Future `paidAt` is accepted, and there is no refund/correction API. Package payments now validate the student target or immutable group share, enforce package currency, cap the outstanding amount, and replay a matching idempotency key without a second payment. |

Acceptance scenarios: related/unrelated enrollment, currency mismatch, duplicate
idempotency, partial/full/overpayment, group allocation, reversal, future date,
and audit evidence.
