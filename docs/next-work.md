# Active Work Queue

Last verified: 2026-08-25.

This is the short-lived execution queue for Stage 4.1. It answers “what should I
work on next?” without requiring a developer to re-derive priorities from the
full roadmap. Update it when a work packet merges; do not use it for long-term
ideas.

## Work Packet 1 — Package Integrity Boundary (implemented)

Why first: it is a bounded vertical slice with direct financial risk, clear
accepted semantics, and enough existing tests to extend. It creates the testing
pattern used by the larger lifecycle fixes.

### Scope

1. Parse `force` with a runtime DTO so `force=false` never bypasses schedule
   conflict checks.
2. Require a payment enrollment to belong to the package’s student/group share.
3. Enforce package/payment currency equality and define package-less payment
   currency against the enrollment agreement.
4. Reject accidental overpayment; leave refunds/corrections for an explicit
   follow-up command.
5. Add domain/service/E2E regression tests with cross-workspace, unrelated
   enrollment, false coercion, mismatch, duplicate idempotency, and partial/full
   payment cases.

### Expected files

- `packages/validation/src/scheduling.ts` and package/payment contracts.
- `apps/api/src/packages/packages.controller.ts`.
- `apps/api/src/packages/packages.service.ts`.
- `apps/api/src/packages/payments.service.ts`.
- Package/payment service and E2E test files.
- Generated OpenAPI/client artifacts if the public contract changes.
- `docs/domain/finance.md`, the acceptance matrix, and this queue.

### Definition of done

- `force=false` blocks a real conflicting schedule; `force=true` is explicit.
- An unrelated enrollment cannot affect a package or participant share.
- Displayed plan received/outstanding reconciles to accepted payment events.
- The new tests fail on the pre-fix behavior and pass after the implementation.
- Root static/unit pipeline and isolated API E2E are green.

Suggested PR intent: `fix(api): enforce package payment integrity`.

### Actual result — 2026-08-24

- Implemented runtime parsing for `force`, package payment relationship and
  currency validation, overpayment rejection, and payment-command idempotency.
- Added validation, domain, service, package E2E, and scheduling E2E regressions;
  refreshed `packages/api-client/openapi.json` and generated schema.
- Root static/unit checks passed for Work Packet 1 and were repeated for Work
  Packet 2. The full isolated PostgreSQL E2E command now passes 60/60 after
  the lifecycle assertions replaced the unsafe deletion expectation.

## Work Packet 2 — History-Preserving Lifecycle (implemented)

### Actual result — 2026-08-25

- Group archive is owner-only, keeps every historical relationship, and
  suspends only group series and future scheduled lessons. Restore rechecks
  conflicts before restoring only the work suspended by that archive.
- Student archive/restore is owner-only; archive hides the student by business
  status, stops future individual work, and preserves history. Explicit hard
  delete is owner-only and rejects any enrollment, lesson, package, payment,
  share, or credit history with `STUDENT_HAS_BUSINESS_HISTORY` details.
- Contracts, Swagger/generated client, and localized lifecycle copy were
  refreshed. Service and isolated PostgreSQL E2E coverage prove financial
  preservation, active/paused roster retention, repeated commands,
  cross-workspace/non-owner denial, conflict rollback, and audit rows (60/60).

## Start here: Work Packet 3 — Exact Credit Compensation

## Work Packet 3 — Exact Credit Compensation

- Persist the package charged by every package-funded lesson.
- Implement ADR 0003 cancellation/restore deltas and idempotency.
- Remove zero-delta entries from money/share calculations.
- Make charged lesson/package archive block or compensate safely.
- Replace misleading auto-rebook with an explicit scheduling command or remove it.

## Work Packet 4 — Recurrence and Pause Correctness

- Stop materialization for paused/archived/deleted enrollment targets.
- Handle group series with no active participants.
- Apply conflict checks on series create/update.
- Correct one/this-and-following/whole-series weekday and DST behavior.
- Align stored/effective status filters and labels.

## Work Packet 5 — Pilot Authorization

- Enforce owner-only business mutations for the pilot.
- Deny or disable unsupported teacher-member access.
- Add endpoint permission matrix and negative E2E tests.

## Work Packet 6 — Student Quick Create

Implement [`product/students.md`](./product/students.md) after lifecycle behavior
is stable: compact create, saved-profile next actions, parent linking after save,
explicit errors, and interaction tests.

## Work Packet 7 — Lesson Pack Sale

Implement [`product/packages.md`](./product/packages.md) after finance behavior is
stable: fixed-pack primary path, no default schedule/payment, explicit next
actions, lifecycle/detail states, and interaction tests.

## Work Packet 8 — Pilot Operations

- Finance-rich seed, minimal CSV student import, database readiness, monitoring,
  backup restore, export/privacy runbooks, and one-week staging rehearsal.

## Work-in-progress rules

- One integrity packet at a time until Work Packet 5 is complete.
- Keep each PR deployable and green; do not merge intentionally failing tests.
- Every PR links the ADR/domain rule it implements and updates acceptance evidence.
- No deferred module or broad visual refactor may enter the active queue without
  an explicit roadmap decision.
