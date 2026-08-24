# Audit Aggregate

Last verified: 2026-08-24.

## AuditLog

| Concern       | Contract                                                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose       | Append-only evidence of a workspace business mutation: actor, entity, action, timestamp, and safe diff.                                                        |
| Ownership     | Workspace-scoped; actor may be null for system work.                                                                                                           |
| Create        | Inserted in the same transaction as the business write. Background/system work uses an explicit system actor convention.                                       |
| Read          | Owner-only, filterable, paginated, and safe for support investigation.                                                                                         |
| Update/delete | Never exposed. Retention and privacy policy must preserve required business evidence while excluding secrets and unnecessary personal data.                    |
| Invariants    | No passwords, tokens, raw files, or sensitive request payloads in diffs. Entity/action vocabulary is stable and documented.                                    |
| Current gaps  | `entity` is free text; broad destructive cascades may record only the root action; coverage of background materialization and some side effects is incomplete. |

## Required event quality

An event answers: who did what, to which aggregate, when, why, and what business
effect changed. For finance and lifecycle actions it also carries correlation or
idempotency context so support can connect the audit event to ledger/payment
history.

## Acceptance scenarios

- Every pilot-critical command creates one root audit event transactionally.
- Failed transactions create neither business rows nor success audit events.
- System materialization and compensating operations are distinguishable from
  owner actions.
- Archive/restore, payment, manual adjustment, cancellation, and privacy workflows
  are reconstructable without exposing secrets.
- Non-owners cannot query workspace audit history.
