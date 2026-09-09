# Stage 9 — Pilot Graduation and Import Expansion

> **Outcome:** real data migrates in, a real month runs through the system
> without manual DB fixes, and the GDPR minimum is met. This is the graduation
> stage — the product proves it can run a live school.
>
> **Pillar:** Ops · **Status:** Planned after core pilot · **Depends on:** the
> operational stages it migrates data into (Students/Groups, Scheduling,
> Packages/Payments).

## 1. Goal & non-goals

**Goals**
- Expand the minimal student import delivered in Stage 4.1 into schedule,
  package, payment, and balance migration for the confirmed pilot dataset.
- **SpeakWise pilot:** migrate real data, run a full payment month, record every
  manual fix as a bug report, fix bugs.
- **GDPR minimum:** privacy policy, workspace data export (JSON), full workspace
  deletion on request, parent-contact field for minors.
- *(Optional, last)* the `/features` in-app capabilities catalogue — pure
  static content linking to real routes; cheapest to build once everything
  exists.

**Non-goals**
- No DPA / access-log (deferred until paying EU customers).

The controlled pilot, backup/restore proof, basic export, and privacy runbook are
now pulled forward into Stage 4.1 because they are release gates rather than
late feature work. This stage graduates those capabilities for repeated
onboarding after the core pilot succeeds.

## 2. Domain / model
- No new core entities. Import is an ETL surface; GDPR export/delete operate over
  existing workspace-scoped tables.
- Money import respects the two-ledger rule: imported balances become
  `manual_adjustment` credit entries + optional historical `Payment`s, never a
  mutable balance field.

## 3. API — `import` + workspace GDPR
- `POST /import/preview` — parse + validate a CSV, return a dry-run diff and row
  errors (no writes).
- `POST /import/commit` — transactional apply; every created row audited; partial
  failure rolls back.
- `GET /workspaces/:id/export` — full JSON export (owner-gated).
- `DELETE /workspaces/:id` — full workspace deletion on request (owner-gated,
  hard, confirmed).

## 4. Web
UI reference: an architect-approved import brief using official shadcn Stepper
or Tabs, Field, Item, Alert, and Table compositions for upload, mapping,
preview/validation, and commit.
Settings: privacy policy link, export button, delete-workspace flow with a
strong confirmation.

## 5. Sequencing
Import parser + preview (dry-run) → column mapping UI → transactional commit +
audit → GDPR export/delete → run the SpeakWise migration → bugfix loop →
optional `/features` catalogue.

## 6. Testing
- Domain/unit: CSV parsing, column mapping, balance→ledger conversion.
- API: preview never writes; commit is atomic (partial failure rolls back);
  export completeness; delete cascades within the workspace only.
- **Acceptance:** a full month of real SpeakWise operation with zero manual DB
  fixes (the mvp-plan final check).

## 7. Definition of Done
Global DoD + : SpeakWise runs a live payment month in the system unaided; a
workspace can export and delete its data.

## 8. Risks & decisions
- **Bad imports corrupting money** — dry-run preview + transactional commit +
  ledger-based balances make every import reversible/auditable.
- **Controlled workspace privacy workflow** — export first, then delete or
  anonymize according to [ADR 0002](../decisions/0002-record-lifecycle-and-deletion.md).
  The operation is owner-gated, resumable, and preserves required finance/audit
  evidence.
