# Active Work Queue

Last verified: 2026-09-18.

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
  Packet 2. The full isolated PostgreSQL E2E command now passes 61/61 after
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
  cross-workspace/non-owner denial, conflict rollback, and audit rows (61/61).

## Work Packet 2.1 — Lifecycle Closure and Migration Safety (implemented)

### Actual result — 2026-08-25

- Archived students accept only the dedicated restore operation: normal PATCH
  returns `STUDENT_ARCHIVED_REQUIRES_RESTORE`, and the row menu exposes Restore
  without edit, status, or archive actions.
- Student archive uses its archive timestamp to suspend linked group
  enrollments, retain `groupId`, and restore only the marked enrollment to its
  exact preceding `ACTIVE` or `PAUSED` state. Archived students are excluded
  from operational group rosters and package/payment/scheduling targets while
  historical group records remain intact.
- Forward migration `20260825120000_lifecycle_closure_and_legacy_repair`
  normalizes legacy archived/deleted students and their future individual work.
  `verify:migration-upgrade` applies pre-migration schema/data, then the new
  migration, and verifies a real restore on a dedicated PostgreSQL database.
- Groups deleted by the previous destructive implementation return
  `GROUP_LEGACY_REPAIR_REQUIRED`; the deploy runbook supplies the audit query
  and prohibits inferred relationship reconstruction.

## Work Packet 3 — Exact Credit Compensation (implemented)

- Persist the package charged by every package-funded lesson.
- Implement ADR 0003 cancellation/restore deltas and idempotency.
- Remove zero-delta entries from money/share calculations.
- Make charged lesson/package archive block or compensate safely.
- Replace misleading auto-rebook with an explicit scheduling command or remove it.

### Actual result — 2026-09-07

- Implemented the ADR 0003 non-zero transition matrix, versioned transition
  identity, exact first-debit package pinning, compensation to archived original
  packages, archive safety, legacy backfill migration, contract generation, and
  localized user messages.
- The corrective closure adds financial-snapshot immutability, fixed-count-only
  occurrence-time package eligibility, net current consumption, and a mandatory
  legacy-conflict preflight.
- Application-level migration verification proves fixed-count and legacy
  `BY_PERIOD` exact compensation, rejects missing, mismatched, wrong-type, and
  already-balanced sources without partial mutation, and verifies audit and
  replay behavior.
- Isolated PostgreSQL 17 evidence passes: 70/70 API E2E across 5 suites after
  all 19 migrations, plus the finance upgrade verifier on a separate database.
  Group cancel/restore/cancel and package archive scenarios preserve immutable
  shares, money, ledger, and historical lessons. Implementation: `61fbfbd`.

## Work Packet 4 — Recurrence and Pause Correctness (implemented)

- Stop materialization for paused/archived/deleted enrollment targets.
- Handle group series with no active participants.
- Apply conflict checks on series create/update.
- Correct one/this-and-following/whole-series weekday and DST behavior.
- Align stored/effective status filters and labels.

### Actual result — 2026-09-08

- Added dedicated suspension tokens for precise pause/archive/delete and
  roster-empty restoration, without reusing `deletedAt`.
- Enforced active-target eligibility, advisory-lock serialization, conflict
  validation, canonical post-lock reads, idempotent materialization,
  future-rule boundaries, DST-safe local scheduling, and stored-status
  filtering. Reversible suspension and permanent archive precedence are covered.
- Added isolated PostgreSQL 17 E2E and migration-upgrade evidence.
  Implementation: `76463d9`.

## Work Packet 5 — Pilot Authorization (implemented)

- Enforce owner-only business mutations for the pilot.
- Deny or disable unsupported teacher-member access.
- Add endpoint permission matrix and negative E2E tests.

### Actual result — 2026-09-08

- Applied `@Roles('OWNER')` to all 52 business API handlers. The five public
  authentication/health routes are unchanged; `GET /auth/me` and
  `GET /workspaces/current` are the only authenticated legacy-TEACHER routes.
- Added `docs/api-permission-matrix.md` and an executable controller metadata
  manifest that classifies all 59 routes and fails when a new handler is not
  assigned public, self/session, or owner-only access.
- Added isolated PostgreSQL 17 E2E coverage proving legacy `TEACHER` receives
  typed `403 FORBIDDEN` responses without business or audit mutation across
  people, scheduling, packages, payments, settings, roster, and audit; owner
  setup and reads remain functional. Full API E2E: 78/78 in 6 suites.
- Regenerated OpenAPI/client artifacts with typed owner-only `403` responses.
  Implementation: `e362675`.

## Frontend Foundation Track — implemented

ADR 0005 introduced a bounded presentation-layer reset before workflow
simplification. Full scope and gates live in
[`frontend-plan.md`](./frontend-plan.md). The completed order is:

1. **F0 — Direction Reset (implemented):** remove `/design`, retire TailAdmin as
   design authority, and establish shadcn blocks plus architect-owned screen
   briefs.
2. **F1 — Shadcn Baseline (implemented and reviewed):** normalized all installed
   official `radix-luma` primitives, Stone/Blue/Amber tokens, retained Geist typography,
   dependencies, and automated style-boundary checks without changing
   workflows. Workspace colour customization was removed from the product.
3. **F2 — Storybook Foundation (implemented and reviewed):** added the
   backend-independent Next.js/Vite catalog, deterministic locale/theme
   providers, interaction and accessibility coverage, and CI static-build gate.
4. **F3 — Authentication Shell (implemented and reviewed):** adapted official
   shadcn `login-03` and `signup-03` to the existing login/register flows;
   registration remains one page and one submission, and all auth behavior is
   preserved.
5. **F4 — Authenticated Application Shell (implemented and reviewed):** adapted
   the `dashboard-01` structure without importing demo features; preserved
   routing, permissions, session logout, workspace identity, locale, theme,
   cookie-backed collapse, and mobile Sheet behavior. The typed navigation model
   and Storybook shell contract are the reusable F4 boundary.
6. **F5 — Product Composition Boundary (implemented):** shared/app ownership,
   documented/tested collection/detail/form references, and dependency direction
   enforcement are complete at `4900755`.

The foundation is closed. Its primitives, shared compositions, Storybook
contracts, and architecture checks govern the feature migrations below.

## Existing Surface Migration Track — active before Work Packet 7

Migrate one domain at a time. The current page is behavior evidence, not a
visual template. Each packet starts with an architect-approved screen brief,
builds owned components and states in Storybook, integrates existing behavior,
passes its verification gate, and remains independently deployable. Do not
start the next packet while the current one is under review.

### Work Packet 6 — Student Experience and Quick Create (active)

Implement [`product/students.md`](./product/students.md) as the reference feature
migration:

- redesign the Students collection and detail surfaces on `CollectionFrame` and
  `DetailFrame`;
- establish the owning Student row/card representations with explicit density
  variants instead of page-local copies;
- replace mandatory full-profile creation with compact quick create and
  progressive optional details;
- navigate to the saved profile and expose independently cancellable next
  actions for lesson, package, study, parent, and profile completion;
- move parent linking/creation after student persistence;
- cover loading, query error, filtered empty, archived, destructive, dirty,
  permission, mobile, theme, locale, interaction, and accessibility states.

The architect-approved Students screen brief is recorded in
[`product/students.md`](./product/students.md). The collection slice is
implemented and verified: four independent metrics, URL-backed search/status/
group controls, filtered-empty recovery, the compact desktop table and mobile
card, localized `createdAt`, Storybook coverage, and the generated API contract
are complete. The Student detail foundation is the next active slice. Compact
create and edit replacement follow the approved list/detail compositions.

### Work Packet 6.1 — Parents

Migrate parent collection, detail, create/edit, relationship, archive, and
restore surfaces. Validate person identity, contact, relationship, and action
patterns against Students before promoting any shared abstraction.

### Work Packet 6.2 — Teachers

Migrate teacher collection, detail, form, status, assignment, and workspace-mode
states. Reuse proven person components where their contracts match; keep
teacher scheduling and availability behavior feature-owned.

### Work Packet 6.3 — Groups and Enrollments

Migrate group collection/detail, roster, enrollment, lesson summary, and
archive/restore flows. Preserve lifecycle and suspension semantics while making
participant and scheduling consequences explicit.

### Work Packet 6.4 — Scheduling

Migrate Calendar, lesson actions, lesson creation/editing, and Recurring
Patterns. Preserve time-zone, conflict, recurrence-scope, cancellation, credit,
and pause semantics. Prefer shadcn overlays, fields, tabs, tables, toggles, and
feedback components; scheduling-specific visualization remains feature-owned.

### Work Packet 6.5 — Package Read Surfaces

Migrate package collection, detail, entitlement, participant-share, ledger,
payment-history, archive, and adjustment surfaces. Do not redesign package
creation in this packet: the new sale flow remains Work Packet 7, avoiding a
temporary form that would immediately be replaced.

### Work Packet 6.6 — Dashboard and Settings

Migrate the Today dashboard and workspace/audit settings after upstream feature
patterns are stable. Dashboard content remains limited to today and actionable
exceptions; Settings reuses approved fields, sections, tables, and feedback
patterns without introducing theme customization.

## Work Packet 7 — Lesson Pack Sale

Implement [`product/packages.md`](./product/packages.md) after finance behavior is
stable: fixed-pack primary path, no default schedule/payment, explicit next
actions, lifecycle/detail states, and interaction tests.

## Work Packet 8 — Pilot Operations

- Finance-rich seed, minimal CSV student import, database readiness, monitoring,
  backup restore, export/privacy runbooks, and one-week staging rehearsal.

## Work-in-progress rules

- Keep one active work packet at a time.
- Keep each PR deployable and green; do not merge intentionally failing tests.
- Every PR links the ADR/domain rule it implements and updates acceptance evidence.
- A feature component moves to `components/shared` only after at least two
  domains prove the same stable contract.
- No deferred module, second visual system, decorative-only redesign, or work
  outside the ordered migration track may enter the active queue without an
  explicit roadmap decision.
