# Tutorio Current State

Last verified: 2026-09-10 against Work Packet 5 implementation commit
`e362675`, completed Frontend Packet F4, and the `radix-luma` preset migration.

This is the first project document to read before planning or implementing
work. It reports the repository as it exists; [`mvp-plan.md`](./mvp-plan.md)
defines the pilot boundary and [`roadmap.md`](./roadmap.md) defines execution
order.

## Executive status

Tutorio has a broad, credible Students-to-Money core, but it is not pilot-safe
yet. The correct next move is not another design-wide refactor or a new product
module. The next move is a bounded stabilization release that makes four core
workflows correct, understandable, tested, and recoverable.

- Branch: `develop`; Work Packet 5 implementation is committed as `e362675`.
- The former `refactor/students-design` work was merged by PR #18.
- `pnpm generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`
  pass on 2026-09-10. Observed unit totals: domain 92, validation 46, API 158,
  and web 115. Storybook browser tests pass for 98 tests across 20 files,
  including automated accessibility checks, and the static build passes.
- API E2E passes 78 tests in 6 suites against an isolated PostgreSQL 17
  database after all 20 migrations, including legacy-TEACHER denials, group
  compensation cycles, and package archival. The finance migration verifier
  passes against a separate clean PostgreSQL 17 database.
- Unit coverage is uneven: core scheduling and package orchestration still have
  important untested branches. Passing totals are not a pilot-readiness signal.

## Implemented product surface

- Authentication, workspaces, roles, sessions, and Ukrainian/English UI.
- Students, parents, teachers, groups, and enrollments.
- Calendar, individual lessons, recurring lesson series, rescheduling, and
  lesson status transitions.
- Individual and group lesson packages, credit ledger, participant shares,
  payments, and package history.
- A basic Today dashboard, workspace settings, audit events, and shared UI
  primitives. The former `/design` component lab was removed in Frontend Packet
  F0 and is no longer a product route or design authority.

These capabilities are substantial enough for a pilot after stabilization. No
stack rewrite is justified: the pnpm/Turborepo, NestJS, Prisma/PostgreSQL,
Next.js, shared validation, and pure domain package boundaries are sound.

## Active milestone: Pilot Core Stabilization

Stage 4.1 remains active. Work Packet 5 — Pilot Authorization is complete. The
bounded frontend foundation in [`frontend-plan.md`](./frontend-plan.md) now runs
before Work Packet 6 — Student Quick Create. It standardizes the existing UI
stack rather than introducing a broad custom redesign. The required order is:

1. Lock lifecycle and accounting decisions in ADRs and tests.
2. Fix P0 data-integrity defects in group deletion/restoration, payment
   ownership, ledger compensation, and package/lesson deletion.
3. Fix scheduling lifecycle defects: conflict validation, pause behavior,
   effective status, and honest replacement-lesson behavior.
4. Complete Frontend Packet F5: the reusable composition boundary.
5. Replace the all-in-one student and package dialogs with progressive,
   task-based flows documented in `product/`.
6. Run the complete pilot acceptance matrix with realistic seed data and an
   isolated database.

### Frontend Packet F0 evidence

ADR 0005 replaces TailAdmin and the current page layouts as design authorities.
The official shadcn `radix-luma` preset is the pilot baseline; page migrations
require an architect-approved screen brief and an explicitly named shadcn block
where applicable. The isolated `/design` route, demo components, and feature
exports were removed. Active engineering rules now target Storybook as the
development-only component catalog. Frontend Packet F1 is complete after an
independent registry-drift review. The current runtime uses the Stone/Blue/Amber
`radix-luma` baseline from preset `b1Gwk6B7o`, retained Geist typography,
documented primitive exceptions, and automated style-boundary checks. Workspace
colour customization was removed from the UI, API contract, and database.

### Frontend Packet F2 evidence

The backend-independent Storybook catalog is implemented with the official
Next.js/Vite integration, generated docs, deterministic locale and theme
controls, App Router navigation mocks, browser-mode Vitest interactions, and
automated accessibility checks. It covers the approved foundation and Tutorio
form, collection, and entity-picker contracts without an API, session, or
query provider. CI now makes the Storybook browser suite and deterministic
static build separate gates. Independent review corrected portal theme/locale
inheritance, concrete narrow-width stories, and field-hierarchy examples. All
required generation, lint, typecheck, unit test, production build, Storybook
test, static build, and whitespace checks pass.

### Frontend Packet F3 evidence

Authentication now uses the approved muted, centered `login-03`/`signup-03`
composition with localized Tutorio identity, `GraduationCapIcon`, the existing
locale switcher, and one shared feature-owned Card panel. The split illustration
shell and its unused image asset are removed. The runtime mutation/router
containers preserve gateway calls, session updates, redirects, cookies, API
error mapping, browser autocomplete, password visibility, validation, and
duplicate-submit protection; visual forms remain Storybook-independent of the
backend, session, and QueryClient. Registration remains one page and one
submission, with correctly labelled SOLO/SCHOOL radio choices and a conditional
workspace-name field. Auth shell, login, and registration stories cover desktop,
320px, light/dark, Ukrainian/English, request failure, pending, validation,
password visibility, keyboard submission, focus, mode changes, retained input,
links, and automated accessibility. Independent review found and corrected the
missing constrained 320px story coverage. All required generation, lint,
typecheck, unit test, production build, Storybook test, static build, and
whitespace checks pass. F5 has not started.

### Frontend Packet F4 evidence

Authenticated routes now use the official shadcn `dashboard-01` composition:
`SidebarProvider`, inset/icon-collapsible `AppSidebar`, `SidebarInset`, and a
sticky `AppHeader`. A typed navigation model owns route context, icons, groups,
permissions, and active matching; it hides Teachers in SOLO workspaces and
Settings for non-owners. The Sidebar keeps cookie-backed state, Ctrl/Cmd+B,
collapsed tooltips, and Sheet mobile navigation that closes after a destination
is chosen. The consolidated sidebar account menu preserves sign-out mutation,
pending/error toast behavior, redirect, Settings access, and account context.
The header has only localized breadcrumb context, locale switching, and the
existing light/dark toggle; it does not show raw identifiers, duplicate page
headings, search, notifications, or another account control. Route wrappers
now avoid a nested main landmark because SidebarInset owns the page landmark.
Stories and browser interactions cover shell variants and a11y behavior; F5 is
next and has not started. Root lint, typecheck, test, and build, the 98-test
Storybook browser/accessibility suite, Storybook static build, and whitespace
checks pass on 2026-09-10.

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

### Work Packet 5 evidence

The owner-operated boundary is enforced by `@Roles('OWNER')` metadata on all
52 business controller handlers. The five public auth/health endpoints are
unchanged; only `GET /auth/me` and `GET /workspaces/current` remain available
to authenticated legacy `TEACHER` memberships. The metadata manifest in
`apps/api/src/common/roles-metadata.spec.ts` enumerates all 59 routed handlers
and fails for an omitted or unclassified route. `apps/api/test/authorization.e2e-spec.ts`
proves typed `403 FORBIDDEN` responses and no business/audit side effects across
people, scheduling, packages, payments, settings, roster, and audit surfaces;
the full isolated PostgreSQL 17 suite passed 78/78 in 6 suites after all 20
migrations. Existing cross-workspace owner coverage remains in
`apps/api/test/stage2.e2e-spec.ts` and package E2E coverage. OpenAPI and the
generated client expose the typed `403` contract for owner-only handlers.

## Release blockers

### P1 — scheduling correctness and product truthfulness

- Automatic replacement materialization has been removed from cancellation.
- Work Packet 4 closed the recurrence/pause correctness defects, and Work
  Packet 5 now protects scheduling under the owner-only pilot policy.

### P1 — UX and delivery confidence

- Student creation combines identity, avatar, contacts, timezone, learning
  profile, price, parent creation/linking, and notes in one long modal.
- Package creation combines customer assignment, billing model, price, expiry,
  recurrence, timezone, first-lesson calculation, and payment state in one
  modal. A tutor must understand several internal concepts before completing a
  basic sale.
- Large form components exceed the web architecture target and lack workflow-
  level interaction tests. The primitive baseline and Storybook foundation are
  stable, but page composition and form simplification remain F3-F7 work.
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

Frontend Packet F5 — Product Composition Boundary is the next implementation packet.
Work Packet 6 — Student Quick Create begins only after Frontend Packets F3–F5
pass their gates.
