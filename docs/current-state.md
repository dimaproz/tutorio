# Tutorio Current State

Last verified: 2026-09-08 against Work Packet 4 implementation commit
`76463d9`.

This is the first project document to read before planning or implementing
work. It reports the repository as it exists; [`mvp-plan.md`](./mvp-plan.md)
defines the pilot boundary and [`roadmap.md`](./roadmap.md) defines execution
order.

## Executive status

Tutorio has a broad, credible Students-to-Money core, but it is not pilot-safe
yet. The correct next move is not another design-wide refactor or a new product
module. The next move is a bounded stabilization release that makes four core
workflows correct, understandable, tested, and recoverable.

- Branch: `develop`; Work Packet 3 implementation is committed as `61fbfbd`.
- The former `refactor/students-design` work was merged by PR #18.
- `pnpm generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`
  pass on 2026-09-07. Observed unit totals: domain 92, validation 46, API 109, and
  web 109.
- API E2E passes 70 tests in 5 suites against an isolated PostgreSQL 17
  database after all 19 migrations, including group compensation cycles and
  package archival. The finance migration verifier passes against a separate
  clean PostgreSQL 17 database.
- Unit coverage is uneven: core scheduling and package orchestration still have
  important untested branches. Passing totals are not a pilot-readiness signal.

## Implemented product surface

- Authentication, workspaces, roles, sessions, and Ukrainian/English UI.
- Students, parents, teachers, groups, and enrollments.
- Calendar, individual lessons, recurring lesson series, rescheduling, and
  lesson status transitions.
- Individual and group lesson packages, credit ledger, participant shares,
  payments, and package history.
- A basic Today dashboard, workspace settings, audit events, shared UI
  primitives, and the `/design` component lab.

These capabilities are substantial enough for a pilot after stabilization. No
stack rewrite is justified: the pnpm/Turborepo, NestJS, Prisma/PostgreSQL,
Next.js, shared validation, and pure domain package boundaries are sound.

## Active milestone: Pilot Core Stabilization

Stage 4.1 is active, with Work Packet 5 — Pilot Authorization as the current
implementation packet. Work Packet 4 — Recurrence and Pause Correctness is
complete. Its goal was to make existing workflows safe and obvious, not to add
surface area. The required order is:

1. Lock lifecycle and accounting decisions in ADRs and tests.
2. Fix P0 data-integrity defects in group deletion/restoration, payment
   ownership, ledger compensation, and package/lesson deletion.
3. Fix scheduling lifecycle defects: conflict validation, pause behavior,
   effective status, and honest replacement-lesson behavior.
4. Replace the all-in-one student and package dialogs with progressive,
   task-based flows documented in `product/`.
5. Run the complete pilot acceptance matrix with realistic seed data and an
   isolated database.

### Work Packet 1 evidence

The package/payment integrity boundary is implemented at `ec5e650`: an explicit
runtime DTO parses `force`, payments validate the package participant
relationship and required currency, package payments reject overpayment, and
idempotency keys replay the original payment without adding a second event. The
OpenAPI schema and generated client were refreshed. Evidence:
`packages/validation/src/packages.test.ts`,
`packages/domain/src/package.test.ts`,
`apps/api/src/packages/payments.service.spec.ts`, and
`apps/api/test/{packages,scheduling}.e2e-spec.ts`.

### Work Packets 2 and 2.1 evidence

Group and student lifecycle is now history-preserving. Group archive keeps
roster, completed lessons, packages, payments, shares, credits, and audit rows;
it suspends group series and only future `SCHEDULED` lessons. Restore revives
only rows marked by that archive and refuses calendar conflicts before writing.
Student archive uses `Student.status = ARCHIVED`, suspends only future
individual series/lessons, and keeps all relationships. It also removes the
student from operational group rosters while preserving `groupId` and restoring
the exact prior `ACTIVE`/`PAUSED` enrollment state. Archived students cannot
use ordinary PATCH; `STUDENT_ARCHIVED_REQUIRES_RESTORE` requires the dedicated
restore command. The explicit hard-delete endpoint rejects history with
`STUDENT_HAS_BUSINESS_HISTORY` and dependency counts. Legacy deleted/archived
student records are normalized by a forward migration; legacy destructive
group deletes return a typed manual-repair refusal. Evidence:
`apps/api/src/{groups,students}/*.service.spec.ts`,
`apps/api/test/stage2.e2e-spec.ts` (isolated PostgreSQL: 61/61 tests), and
`apps/api/scripts/verify-lifecycle-migration-upgrade.ts` (pre-migration legacy
data → migration → restore verification).

### Work Packet 3 evidence

Exact credit compensation is implemented at `61fbfbd`. Every non-zero lesson
effect has a versioned transition identity and is pinned to its exact package;
restoration requires an unmatched debit with the same lesson, package, and
entry type. First-debit eligibility is limited to active fixed-count packages
covering the lesson occurrence, while exact legacy `BY_PERIOD` compensation is
allowed without enabling new period-package debits. Charged lesson snapshots
are immutable, package archive stops owned series and future scheduled work,
and financial/share history remains append-only and queryable.

Evidence: `packages/domain/src/{lesson-state,ledger,package}.test.ts`,
`apps/api/test/packages.e2e-spec.ts` (70/70 full API E2E), and
`apps/api/scripts/verify-finance-migration-upgrade.ts` against a separate
PostgreSQL 17 database. The verifier covers migrated fixed and `BY_PERIOD`
history, conflicts, missing/mismatched/already-balanced sources, idempotency,
audit metadata, and transaction rollback.

### Work Packet 4 evidence

Recurrence suspension has dedicated opaque tokens rather than overloaded
timestamps. Individual enrollment pause/archive/delete suspends only future
`SCHEDULED` work and restores only matching rows after a conflict check. Group
series require an active, non-archived participant; last-active roster changes
suspend shared work and first-active transitions restore only roster-empty work.
Materialization, archive, and restore decisions use ordered PostgreSQL
transaction advisory locks and canonical post-lock reads. Reversible lifecycle
operations preserve their suspension token, while explicit series/package
archive cannot later be resurrected by a resume command.

Series creation/update validates every generated candidate unless the explicit
`force=true` contract is used. `this_and_following` ends the old rule and creates
a new future rule boundary, preserving the earlier local-time/weekday history.
Stored lesson status remains the command and API-filter authority; past/upcoming
is a separate UI bucket. Evidence: `apps/api/test/scheduling.e2e-spec.ts` (13
scheduling tests), full isolated PostgreSQL 17 API E2E (75 tests / 5 suites),
and `apps/api/scripts/verify-recurrence-migration-upgrade.ts` after all 20
migrations.

## Release blockers

### P1 — scheduling correctness and product truthfulness

- Automatic replacement materialization has been removed from cancellation.
- Work Packet 4 closed the recurrence/pause correctness defects; scheduling
  remains subject to the authorization hardening in Work Packet 5.

### P1 — authorization and API contract

- Lifecycle commands for groups and students are owner-only. Broader business
  mutation authorization remains a Work Packet 5 pilot blocker.

### P1 — UX and delivery confidence

- Student creation combines identity, avatar, contacts, timezone, learning
  profile, price, parent creation/linking, and notes in one long modal.
- Package creation combines customer assignment, billing model, price, expiry,
  recurrence, timezone, first-lesson calculation, and payment state in one
  modal. A tutor must understand several internal concepts before completing a
  basic sale.
- Large form components exceed the web architecture target and lack interaction
  tests. The visual layer is ahead of workflow confidence.
- The package list fetches a fixed first page without a complete pagination
  experience. Some non-auth session errors can leave the UI in a permanent
  loading state.
- The generated API client is documented as mandatory but is not yet the actual
  web integration boundary.

## Operational gaps

- Seed data is rich for people and scheduling but too thin for payments, package
  history, participant shares, and ledger edge cases.
- Root `pnpm test` does not include API end-to-end tests, although prior docs
  described the root pipeline as identical to CI.
- Health checking is liveness-only; database readiness, backup restore evidence,
  error monitoring, and production deployment remain unverified.
- API and web package READMEs still contain starter-level guidance rather than
  service-specific runbooks.

## Deliberately deferred until the pilot proves demand

- Analytics beyond the Today action surface.
- Progress tracking, tests, journal, and attachments.
- Student/parent portal and public student page.
- Telegram automation, branded receipts, leads CRM, and SaaS billing.
- Broad visual redesign or a second component system.

## Next checkpoint

Work Packet 5 — Pilot Authorization is the next implementation packet.
