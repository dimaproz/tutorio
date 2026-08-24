# Tutorio Current State

Last verified: 2026-08-24 in the uncommitted Work Packet 1 tree based on
`3d985d5` on `develop`.

This is the first project document to read before planning or implementing
work. It reports the repository as it exists; [`mvp-plan.md`](./mvp-plan.md)
defines the pilot boundary and [`roadmap.md`](./roadmap.md) defines execution
order.

## Executive status

Tutorio has a broad, credible Students-to-Money core, but it is not pilot-safe
yet. The correct next move is not another design-wide refactor or a new product
module. The next move is a bounded stabilization release that makes four core
workflows correct, understandable, tested, and recoverable.

- Branch: `develop`; Work Packet 1 changes are intentionally uncommitted.
- The former `refactor/students-design` work was merged by PR #18.
- Root `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass in the
  Work Packet 1 tree.
- Observed unit totals: domain 89, validation 45, API 101, web 106.
- API E2E was run against an isolated PostgreSQL 17 container after applying all
  migrations. Package and scheduling suites pass (18 tests); the full suite is
  55/57 because two existing Stage 2 group-deletion assertions fail.
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

Stage 4.1 is active. Its goal is to make existing workflows safe and obvious,
not to add surface area. The required order is:

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

The package/payment integrity boundary is implemented and verified in the
uncommitted tree: an explicit runtime DTO parses `force`, payments validate the
package participant relationship and required currency, package payments reject
overpayment, and idempotency keys replay the original payment without adding a
second event. The OpenAPI schema and generated client were refreshed. Evidence:
`packages/validation/src/packages.test.ts`,
`packages/domain/src/package.test.ts`,
`apps/api/src/packages/payments.service.spec.ts`, and
`apps/api/test/{packages,scheduling}.e2e-spec.ts`.

## Release blockers

### P0 — data integrity and financial correctness

- Group soft deletion tombstones and disconnects related lessons, series,
  packages, payments, and enrollments, while restore restores only the group.
  The behavior is effectively destructive and contradicts API/test expectations.
- A lesson without a persisted `packageId` can resolve a different package on a
  later status transition, so a compensating credit may affect the wrong package.
- Deleting a charged lesson or a package can leave scheduling and financial
  history inconsistent. Package deletion does not reliably stop owned series.
- Student hard deletion can fail on financial foreign keys or leave related
  history in a state that contradicts the UI promise.

### P1 — scheduling correctness and product truthfulness

- Cancel-unpaid, restore, and repeat can create multiple zero-delta credit
  events; group share calculations can count them as repeated discounts.
- The current “automatic replacement” action usually re-runs materialization
  without creating a real replacement lesson.
- Pausing or archiving an enrollment does not consistently remove or suspend
  future generated lessons; group series may continue when all participants are
  paused.
- Series create/update paths do not consistently apply conflict detection, and
  “this and following” edits have weekday edge cases.
- Stored lesson status and effective time-derived status can drift, affecting
  filtering and user expectations.

### P1 — authorization and API contract

- Teacher accounts are workspace-wide in practice. Mutations are not consistently
  owner-gated and there is no complete “own teacher only” authorization model.
  The pilot therefore uses the owner-operated access decision in ADR 0004.

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

The next checkpoint is reached when Phase 0 and Phase 1 in
[`roadmap.md`](./roadmap.md) are complete: the domain decisions are executable
tests, P0 defects are fixed, and the four critical workflows pass in an isolated
environment. Only then should the team implement the simplified student and
package UX.
