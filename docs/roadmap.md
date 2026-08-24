# Tutorio Pilot-First Roadmap

Last verified: 2026-08-24.

This roadmap replaces feature-by-feature expansion as the active delivery
strategy. Complete phases in order. A later phase may be designed, but it must
not be implemented while an earlier release gate is red.

## Now — Phase 0: Decisions become executable rules

Outcome: the team can change code without guessing what “correct” means.

- Accept ADRs 0001–0004 as the target product contract.
- Convert the cancellation/billing matrix, deletion policy, package ownership,
  and owner-only permissions into domain and API tests.
- Build representative seed scenarios: individual fixed package, group package
  with shares, partial payment, charged cancellation, uncharged cancellation,
  paused enrollment, and archived group.
- Establish an isolated local/CI end-to-end command and document that root unit
  tests do not include it.

**Gate:** tests fail for each confirmed implementation defect and pass for
already-correct invariants. No unresolved product semantics remain in P0 flows.

## Next — Phase 1: Correctness stabilization

Outcome: existing data cannot be silently mischarged, orphaned, or destroyed.

- Make group archive/restore reversible and history-preserving.
- Enforce payment-to-package participant ownership and currency consistency.
- Persist the charged package on lessons and compensate only that package.
- Make charged lesson/package deletion safe through blocking or explicit
  compensating operations.
- Correct cancel/restore repetition, share calculations, enrollment pause, series
  materialization, recurrence conflict checks, and effective status filtering.
- Remove or correctly implement the misleading automatic-replacement action.
- Fix boolean query parsing at the runtime API boundary.

**Gate:** all P0/P1 core integrity scenarios pass at domain, service, and
end-to-end levels; migrations are reversible or have an approved rollback plan.

## Then — Phase 2: Pilot-critical workflow simplification

Outcome: a tutor can complete core tasks without understanding the data model.

- Replace student creation with a quick-create flow: name first, contact and
  timezone only when needed, optional details later.
- Split parent linking/creation from the mandatory student submission path.
- Replace package creation with a short sale flow and post-create next steps.
- Move recurrence into a dedicated scheduling step and payment into a dedicated
  record-payment action.
- Make package terminology, entitlement, usage, payment, and cancellation
  consequences self-explanatory.
- Add form interaction tests, loading/error/empty/success states, mobile checks,
  and locale parity.
- Split oversized feature components to the documented web boundaries while
  changing each flow; do not perform another repo-wide UI refactor.

**Gate:** a first-time tutor completes student setup and package sale in an
observed usability session without developer explanation or data correction.

## Then — Phase 3: Pilot operations

Outcome: representative customer data can enter, run, and leave safely.

- Minimal student CSV import with preview, validation, and row-level errors.
- Package/payment import only for the actual pilot dataset after mappings are
  confirmed; imported balances enter through explicit adjustment history.
- Database readiness check, error monitoring, backup schedule, restore drill,
  workspace export, and controlled deletion/anonymization runbook.
- Pilot dashboard limited to today’s lessons and actionable exceptions.

**Gate:** dry-run migration plus one full operational week in staging completes
without direct database fixes.

## Then — Phase 4: Controlled pilot

Outcome: one owner-tutor or small school completes a real billing cycle.

- Migrate representative data and train the owner on the four core journeys.
- Capture every support intervention as a defect or documentation gap.
- Review adoption, task completion, financial reconciliation, and recovery
  incidents weekly.
- Graduate only after one full payment cycle reconciles without manual database
  changes.

## After evidence, not before

Prioritize the next module from pilot evidence:

1. Telegram reminders if missed communication is the top repeated pain.
2. Progress tracking if tutors consistently need a learning record.
3. Analytics if operational data is trusted and decisions require aggregation.
4. Public/portal access if students or parents repeatedly request self-service.
5. Leads CRM only after the operational core is retained by pilot users.

## Design investment rule

Use an 80/20 allocation until pilot graduation:

- 80% correctness, tests, migration, observability, and workflow completion.
- 20% design work limited to pilot-critical comprehension, accessibility, and
  responsive quality.

The current visual direction is sufficient. Broad redesign, custom component
expansion, and visual polish of deferred modules are explicitly paused.
