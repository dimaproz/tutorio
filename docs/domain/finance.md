# Finance Aggregate

Last verified: 2026-08-24.

The finance aggregate uses two separate histories:

- lesson entitlement: `LessonCreditEntry` in lesson units;
- money received: `Payment` in integer minor units and one currency.

Cancellation semantics are defined by
[ADR 0003](../decisions/0003-cancellation-and-package-accounting.md).

## LessonPackage

| Concern       | Contract                                                                                                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose       | Immutable purchase snapshot for exactly one student or group.                                                                                                                                       |
| Ownership     | Workspace-scoped; target XOR is enforced by validation and database constraints.                                                                                                                    |
| Relationships | Target, optional enrollment context, credit entries, payments, participant shares, package-owned series and lessons.                                                                                |
| Create        | Grant opening entitlement atomically. Scheduling and payment are separate user jobs in the target UX, even if orchestration remains transactional internally.                                       |
| Edit/version  | No arbitrary mutation of agreed commercial history. A material plan change creates an explicit adjustment or replacement plan.                                                                      |
| Archive       | Prevent new charges and stop/resolve package-owned recurrence while preserving history. Restore is not currently supported.                                                                         |
| Current gaps  | Delete only sets `deletedAt` and leaves series/future lessons; individual target selection can silently choose one of multiple enrollments; group teacher/currency assumptions are under-validated. |

Acceptance scenarios: individual/group XOR, entitlement grant, target ownership,
currency consistency, archive with series, expired/depleted states, idempotency.

## LessonCreditEntry

| Concern      | Contract                                                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose      | Append-only explanation of lesson entitlement changes.                                                                                                                        |
| Ownership    | Workspace and package-scoped; optional lesson, enrollment, and actor references.                                                                                              |
| Lifecycle    | Insert only. Corrections are compensating rows with unique idempotency keys; never update/delete.                                                                             |
| Invariants   | Units are integers; one semantic transition produces at most one effective delta; a compensation references the same package and lesson context.                              |
| Current gaps | Package can be resolved as the newest eligible package on each transition; repeated zero-delta cancellations create multiple entries and distort monetary/share calculations. |

Acceptance: reconcile balance from history after every transition and prove
repeat commands do not change balance or create meaningless ledger rows.

## PackageParticipantShare

| Concern       | Contract                                                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Purpose       | Creation-time debt allocation for each participant in a group package.                                                             |
| Ownership     | Workspace/package-scoped through the package; unique `(packageId, enrollmentId)`.                                                  |
| Create/update | Created from an explicit preview and allocation rule. Settled payments increment the matching share. No independent CRUD.          |
| Lifecycle     | Historical snapshot; roster changes do not silently rewrite past debt. Corrections require an explicit reallocation/refund design. |
| Current gaps  | No refund/correction path, and zero-delta cancellation events can reduce shares repeatedly.                                        |

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
