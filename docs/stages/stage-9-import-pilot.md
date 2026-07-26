# Stage 9 — CSV Import, SpeakWise Pilot, GDPR minimum

> **Outcome:** real data migrates in, a real month runs through the system
> without manual DB fixes, and the GDPR minimum is met. This is the graduation
> stage — the product proves it can run a live school.
>
> **Pillar:** Ops · **Status:** Planned · **Depends on:** the operational
> stages it migrates data into (Students/Groups, Scheduling, Packages/Payments).

## 1. Goal & non-goals

**Goals**
- **CSV import** of students, schedule, and balances — critical for migrating
  SpeakWise and for onboarding any tutor (they all come from Google Sheets).
- **SpeakWise pilot:** migrate real data, run a full payment month, record every
  manual fix as a bug report, fix bugs.
- **GDPR minimum:** privacy policy, workspace data export (JSON), full workspace
  deletion on request, parent-contact field for minors.
- *(Optional, last)* the `/features` ("Можливості") in-app catalogue — pure
  static content linking to real routes; cheapest to build once everything
  exists.

**Non-goals**
- No DPA / access-log (deferred until paying EU customers).

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
TailAdmin reference: **multi-step wizard** for import (upload → map columns →
preview/validate → commit), **file dropzone**, **validation result table**.
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
- **Irreversible workspace delete** — hard delete is intentional and owner-gated
  with explicit confirmation; export offered first.
