# Tutorio Pilot MVP Product and Architecture Contract

Last verified: 2026-08-24.

## Product thesis

Tutorio is an operations cockpit for a private tutor or a small teaching team.
Its core promise is one reliable chain:

`student -> enrollment -> schedule -> lesson outcome -> credit/money history`

The pilot succeeds when a tutor can run this chain for real students without a
spreadsheet, duplicate bookkeeping, or a developer correcting data manually.
It does not need to look finished everywhere. It must be trustworthy, learnable,
and recoverable.

## Pilot customer and operating model

- Primary customer: an owner-tutor managing individual and small-group lessons.
- Secondary validation customer: a small school operated from one owner account.
- Pilot access is owner-operated. `Teacher` records represent assignees and
  profiles; staff login is not a supported pilot promise until authorization is
  redesigned and tested.
- Supported locales: Ukrainian and English.
- Supported money model: integer minor units with an explicit ISO currency; no
  cross-currency totals.

## Jobs the pilot must complete

1. Add a student quickly and enrich the profile later.
2. Link a parent when needed and place the student in individual or group study.
3. Create a one-off or recurring schedule without time-zone or conflict errors.
4. Sell a lesson package, understand what it includes, and record payment.
5. Complete, reschedule, or cancel a lesson and explain the resulting credit
   effect from an immutable history.
6. See today’s work and the records that require attention.
7. Archive records safely and export enough data to leave the pilot without
   lock-in.

## In-scope pilot capabilities

### Identity and people

- Owner authentication and workspace settings.
- Students, parents, parent links, teacher profiles, groups, and enrollments.
- Archive/restore as the normal removal workflow.

### Scheduling

- One-off lessons and recurring series.
- Time-zone-safe materialization and visible conflict handling.
- Reschedule and status transitions with explicit scope for recurring edits.
- Pause/resume behavior that cannot silently continue generating unwanted work.

### Packages and payments

- Fixed-count packages for individual students and groups.
- Period packages only if their cancellation semantics pass the acceptance
  matrix; otherwise hide the mode during the first pilot.
- Append-only credit history, group participant shares, and recorded payments.
- An explainable package detail view: entitlement, usage, payment, and history.

### Operations and safety

- Today dashboard with lessons and actionable exceptions.
- Minimal CSV student import for pilot onboarding.
- Audit events for business writes, isolated end-to-end verification, database
  readiness, backup/restore proof, and basic workspace export/deletion handling.

## Explicitly out of scope

- Full analytics and profitability reporting.
- Progress journal, tests, attachments, and curriculum management.
- Student/parent authentication, public pages, and mobile apps.
- Automated Telegram communication and branded receipts.
- Leads pipeline, marketing CRM, subscriptions, and multi-tenant SaaS billing.
- An unbounded custom visual redesign. The bounded official shadcn foundation
  in ADR 0005 is allowed because it enables pilot-critical workflow clarity,
  accessibility, responsive correctness, and inexpensive future theming.

## Product decisions

Durable decisions live in [`decisions/`](./decisions/README.md). The pilot is
governed by these rules:

- Pilot-first delivery and design freeze: ADR 0001.
- Archive-first lifecycle and finance preservation: ADR 0002.
- Cancellation and package accounting semantics: ADR 0003.
- Owner-operated access model: ADR 0004.
- Official shadcn frontend foundation and screen-brief workflow: ADR 0005.

## Domain invariants

- Every business record is workspace-scoped. Cross-workspace IDs are rejected,
  not merely filtered after loading.
- Business writes and their `AuditLog` entry share one database transaction.
- Money is stored only in integer minor units. Currency equality is validated
  wherever records are related or aggregated.
- Credit history and payments are append-only business records. Corrections use
  compensating entries or an explicit reversal status; historical rows are not
  edited away.
- A lesson persists the package it charged. Later compensation uses that exact
  package, never “the newest eligible package.”
- Related IDs are validated as a relationship, not as independent existence
  checks. In particular, a payment enrollment must participate in its package.
- Archive is reversible and must not destroy or disconnect historical financial
  or lesson facts. Hard deletion is reserved for unused drafts or a controlled
  privacy workflow.
- Effective lesson status has one documented source of truth for commands,
  filters, and UI labels.
- Recurrence changes state their scope: one occurrence, this and following, or
  the whole series. Conflict detection applies before persistence.
- Idempotency protects every operation that can double-charge, double-credit, or
  duplicate generated lessons.

## Architecture boundaries

```text
apps/web -> packages/validation -> HTTP API
apps/api -> packages/validation + packages/domain -> Prisma/PostgreSQL
packages/api-client <- generated OpenAPI contract
```

- `packages/domain` contains pure business rules and unit tests; it has no I/O.
- `packages/validation` owns shared Zod request/response contracts.
- `apps/api` owns authorization, orchestration, transactions, persistence, and
  audit logging. Controllers stay thin.
- `apps/web` owns presentation and task flows. Routes compose feature entry
  points; feature models map form state to API contracts.
- `packages/api-client` is the target web/API boundary. Adoption must be made
  real or the requirement removed; generated-but-unused code is not a boundary.

## UX principles for the pilot

- Ask only for data required to complete the current job. Optional enrichment
  belongs on the detail page or behind “Add more details.”
- Use the tutor’s vocabulary: student, group, schedule, package, lessons left,
  paid, and balance. Internal entities such as enrollment and series stay out of
  primary UI copy.
- Separate independent jobs. Creating a package does not also require creating a
  schedule or recording a payment; offer those as clear next steps.
- Show consequences before confirmation: affected lessons, credits, money,
  participants, and whether an action can be undone.
- One obvious primary action per surface. Destructive actions are secondary,
  explicit, and recoverable when possible.
- Use the official shadcn `radix-nova` baseline and approved Tutorio
  compositions. Current page layouts are not visual authority. Design work
  serves task clarity and follows an architect-approved screen brief; it does
  not create parallel primitives or page-specific styling.

## Pilot exit criteria

The MVP is ready for a real customer only when all mandatory rows in
[`quality/pilot-acceptance.md`](./quality/pilot-acceptance.md) pass and the
repository checkpoint contains evidence for:

- Four end-to-end core journeys with expected ledger and audit outcomes.
- No open P0 data-integrity or authorization defects.
- Successful backup restore and workspace export on representative data.
- Desktop and mobile usability in both locales for pilot-critical routes.
- A runbook that a developer can execute without tribal knowledge.

## Delivery plan

Execution order, stop/go gates, and deferred stages are maintained in
[`roadmap.md`](./roadmap.md). Stage briefs in [`stages/`](./stages/README.md)
must remain subordinate to this contract.
