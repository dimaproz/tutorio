# Active Work Queue

Last verified: 2026-09-25 (S02 follow-up).

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

Migrate one domain at a time. Since the frontend reset of 2026-09-24 the
pages still to migrate no longer exist in the web app: Teachers (6.2), the
lesson screens (6.4), packages (6.5), dashboard and settings (6.6) and the
package sale (7) are built new from the owner's mockups and the backend
contracts; git history holds the old pages as behaviour evidence. Each packet starts with an architect-approved screen brief,
builds owned components and states in Storybook, integrates existing behavior,
passes its verification gate, and remains independently deployable. Do not
start the next packet while the current one is under review.

### Work Packet 6 — Student Experience and Quick Create (closed 2026-09-23)

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
[`product/students.md`](./product/students.md). Collection and detail now use the
approved shared compositions; quick create, edit, setup actions, parent
relationships, archive/read-only behavior, and Scheduling-owned mobile lesson
items are implemented. The full local verification gate passes on 2026-09-20.
The 2026-09-22 remediation closes the blocking Student review findings and
passes the complete 166-test Storybook browser/accessibility suite twice.

Closure, 2026-09-23: four independent reviews (Students correctness,
authentication, design-system compliance, accessibility/responsive) covered
everything since `4900755`, including the Studio redesign, the 40 / 60 auth
screens and the dark theme. The blocker (package reads over the API's page cap)
and every major finding were fixed with tests or stories, a verifying re-review
passed, and the full gate is green with 183 Storybook tests. Details are in
[`current-state.md`](./current-state.md#work-packet-6-evidence).

### Work Packet 6.1 — Parents (closed 2026-09-23)

Implements the Studio parents handoff; the brief is
[`product/parents.md`](./product/parents.md). Collection, profile, full-page
create and edit, and linking from both sides are on the shared `LinkPicker`,
`LinkPickerDialog`, `LinkedCard` and `DangerZone`; `components/parents` is
removed and Students import `ParentQuickCreateDialog` from the Parents barrel.
The API gained parent `email` (migration `20260923120000_parent_email`), the
`linked=none` filter and a server-side sort. Parents have no lifecycle, so the
archive/restore surfaces the plan once named do not exist; delete stays
owner-only and permanent.

Closure, 2026-09-23: a four-slice independent review found no blocker; the
confirmed findings are fixed and the full gate is green (223 Storybook tests,
80 API E2E on an isolated PostgreSQL 17). The shared `FormPageLayout`,
`NotesCard`, `useRelationshipLinks` and `useReturnFocus` came out of the review
and are ready for Teachers. Details are in the brief's review section.

Open product decisions: a stored relation (mother, guardian) and a payer flag;
a student schedule view for the parent-side row menu.

### Work Packet 6.3 — Groups (closed 2026-09-23, ahead of 6.2)

Implements the Studio groups handoff; the brief is
[`product/groups.md`](./product/groups.md) and the schema decisions are
[ADR 0006](./decisions/0006-group-teacher-capacity-and-attendance.md). The
collection (cards and rows, four metrics, status tabs with the owner-only
archive, teacher/weekday/unpaid filters and the sort, all answered by the
API), the group page (hero, schedule card, metrics, lessons, attendance,
roster, package and notes), and full-page create and edit with the neutral
archive are on the new shared `LessonList` and `AttendanceList`; the student
profile's lessons moved onto `LessonList`. `components/groups` and
`StudentQuickCreateDialog` are removed.

The API gained `Group.teacherId` and `capacity`, per-student
`LessonAttendance` with `GET`/`PUT /lessons/:id/attendance`,
`GET /groups/summary`, `/groups/options` and `/groups/:id/attendance`, the
first-schedule path in the group form, and teacher reassignment (migration
`20260924120000_group_teacher_capacity_attendance`). The same pass audited the
students, teachers, parents and groups services and cut the web's request
volume; see [`current-state.md`](./current-state.md#work-packet-63-evidence).

Closure, 2026-09-23: a two-slice independent review (backend; web) found no
blocker; its fifteen confirmed findings are fixed and the full gate is green
(249 Storybook tests, 94 API E2E on an isolated PostgreSQL 17).

Follow-ups, in the order they unblock the pilot:

1. The schedule-change confirmation — specified in
   [`product/scheduling.md`](./product/scheduling.md) `L-25`; the owner is
   designing it. Until then the form shows an existing schedule read-only.
2. Attendance marking in the lesson side panel (Work Packet 6.4); remove the
   group page's interim dialog once it lands.
3. A teacher filter on the students list and the per-student attendance
   series on the student profile, both now possible on the new data.
4. ~~Persist the collection view choice.~~ Decided 2026-09-23: remembered
   per browser in `localStorage` through `useStoredChoice`; groups use it,
   and the students card view adopts it when it is built.
5. Enrollment surfaces outside a group (individual enrollments) still live on
   the student profile; there is no standalone enrollment screen.

### Work Packet 6.2 — Teachers (next)

Migrate teacher collection, detail, form, status, assignment, and workspace-mode
states. Reuse proven person components where their contracts match; keep
teacher scheduling and availability behavior feature-owned. A teacher's groups
can now be read from `Group.teacherId` (`GET /groups?teacherId=`), and
`LessonList` is ready for the teacher's lessons.

### Work Packet 6.4 — Lessons, Schedules and Charging (contract accepted 2026-09-23)

The owner re-decided the whole lesson model; the contract is
[`product/scheduling.md`](./product/scheduling.md) (rules `L-1`…`L-121`) and
the model change is [ADR 0007](./decisions/0007-schedules-per-student-charging-package-credits.md).
The backend is built in phases while the owner designs the screens; each
phase ships one migration (test data only: the dev database is reseeded),
pure domain rules with unit tests, API E2E on the isolated PostgreSQL, and a
green gate.

1. **Lesson core and conflicts** — done 2026-09-23: topic, makeup kind and
   link (`POST /lessons/:id/makeup`), no-show, corrections between final
   statuses (no return to "scheduled" after the end), per-lesson duration,
   teacher and price edits, and one teacher-and-student conflict check with
   "save anyway" on lesson create, move, edit and makeup. Schedules adopt
   the student check in phase 2; the price override moves to phase 3.
2. **Schedule model** — done 2026-09-24: `Schedule` (one active per
   student–teacher enrollment and per group) over versioned `LessonSeries`
   rows, per-weekday times and one duration, a per-schedule horizon (studio
   default 4 weeks) topped up nightly, optional end date, stop, and change
   preview/apply that moves lessons 1:1 (topic and notes survive) instead of
   deleting them; `/schedules` routes; "this and following" and the pattern
   screen change the schedule instead of creating rows; packages create a
   schedule for their direction. Existing rows keep the former 12-week
   horizon; the legacy `/lesson-series` create does too.
3. **Billing core** — done 2026-09-24: direction billing mode (a new
   direction pays per lesson, the first sale switches it to packages) and
   rate; one `LessonCharge` per lesson and participant, re-evaluated from the
   lesson's status, makeup pairing and attendance; oldest valid package
   first, debt covered by the next credits, pay-per-lesson balance settled
   oldest lesson first; a package belongs to one direction; group lessons
   charged per member (excused free, no mark = present); group packages,
   participant shares and lesson credit debits removed;
   `GET /enrollments/:id/billing`. The group page shows members' own
   packages and the package form sells to a student until the phase 5 flows
   and the owner's mockups replace them.
4. **Automation** — done 2026-09-24: a job every 10 minutes holds each
   scheduled lesson whose end has passed (completed at its end, charged, a
   group's unmarked active members marked present); `POST
/lessons/bulk-cancel/preview` and `POST /lessons/bulk-cancel` cancel one
   teacher's or the whole studio's scheduled lessons in a period, free, by the
   teacher, with a reason; the cancellation suggestion treats a teacher or
   group cancellation as free. The bulk cancel dialog comes with the screens.
5. **Package kinds and operations** — done 2026-09-24: by count, by period
   from the direction's schedule (editable count), by period X lessons a week;
   per-lesson or total price; a period package pays only inside its window;
   `POST /packages/preview`, `/packages/members` (sell to members),
   `/packages/:id/extend`, `/packages/:id/transfer` (recalculated by price,
   rounded down, remainder reported) and `/packages/:id/refund` (credits and a
   `REFUNDED` payment). The current package form still sends a schedule and a
   first payment until the new sale form (L-87) replaces it.
6. **Pause** — done 2026-09-24: `Pause` for the whole student or one
   direction, from now or a later date, with an optional end. It takes the
   individual lessons in its window off the calendar (and the schedule skips
   them), keeps the student out of group lessons and their charges, and
   extends every package valid at its start by its length (an open pause on
   return). `POST /pauses/:id/end` ends it now or cancels one that has not
   begun: lessons from then on come back (teacher conflicts unless `force`)
   and the extension keeps only what was used. "On a break" is a
   whole-student pause: `PATCH /students/:id` with `ON_HOLD` opens one and
   `ACTIVE` ends it; a job every 10 minutes syncs the status at pause
   boundaries. The hold dialog now says how many lessons come off instead of
   cancelling them. Enrollment `PAUSED` stays as the legacy direction status
   until the direction screens replace it.
7. **Read APIs** — done 2026-09-24: `GET /lessons/list` (paged, newest
   first; period, teacher, student — their own lessons and their groups' —,
   group and status; quick filters unpaid, cancelled, no-show and needs a
   makeup, each with its count), `GET /lessons/:id` for the side panel (the
   lesson, its original or makeup, its schedule and its history), every
   lesson charge says whether it is `paid`, `GET /students/:id/billing`
   (every direction with its warning, totals per currency) and
   `GET /billing/warnings` by the studio's `lowCreditThreshold` (default 2,
   editable in the workspace settings). Deleting a makeup now unlinks it, so
   its original can get a new one. `GET /schedules` already served the
   Schedules tab.

Then the screens from the owner's mockups, one step at a time: the steps,
their briefs and their status are in [`screens/`](./screens/README.md) (S01
lesson panel … S11 dashboard), which also carries Work Packets 6.2 (S09), 6.5
and 7 (S07) and 6.6 (S10, S11).

- **S01 — lesson panel: done 2026-09-24** (`effab27`…`1d5c771`). The panel
  opens over the student profile and the group page as `?lesson=<id>` and runs
  every action on one lesson: edit in place, move with "this / this and
  following" and the preview's numbers, cancel with the deadline suggestion,
  status fix, makeup, group attendance with paused members, delete, and the
  conflict dialog with "save anyway". The attendance sheet now flags paused
  members (API). Eight new shared patterns with stories; the group page's
  interim attendance dialog is gone. Decisions and open questions (payment
  method, recording a payment and offering a package from the panel, the
  group makeup on board 02) are in the [brief](./screens/s01-lesson-panel.md).
- **Group member prices: done 2026-09-25** (S08's member rate dialog, ahead
  of the step): `Enrollment.ownPrice`, the roster's price column, «Ціна для
  учня», the group form's price impact and the S02 group pill.
- **S02 — lesson create form: done 2026-09-24** (`6b9d8cd`…`6c237a3`;
  2026-09-25: `POST /schedules/preview` shows a new schedule's lessons and
  «Конфліктів немає» or its overlaps before saving).
  «Додати заняття» on the student profile and the group page opens the form
  (layout B): who in the indigo band with search, the teacher with the
  substitute strip, one or several dates each with its own time, «Щотижня»
  (a new schedule, or days added to the direction's schedule with what it
  becomes), past dates with their outcome (L-31), the price from the pair's
  rate, the package credit or the group price, and the result in the footer;
  saves through the conflict dialog. The S01 panel moved to the same family
  (layout A: one column under the indigo band, edit as the form in edit
  mode, the makeup dialog on the new fields). New shared fields: time,
  length, date rows, price, the band picker, field notes, the band; the
  credit meter is recoloured everywhere. Contract decisions for the owner
  (package debt instead of one-off, the locked group price, substitutes on
  create) and the data left out are in the
  [brief](./screens/s02-lesson-create.md).

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

Implement the package sale from [`product/scheduling.md`](./product/scheduling.md)
(`L-80`…`L-87`) and the flow in [`product/packages.md`](./product/packages.md):
the three package kinds, no schedule or payment created by the sale, explicit
next actions, lifecycle/detail states, and interaction tests.

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

## WP6 review follow-ups (open, minor)

Found by the closure review and deliberately left out of the remediation:

- Product decisions resolved 2026-09-23: non-owner memberships get no business
  UI at all, mirroring the owner-only API; a failed lesson count in the hold
  dialog offers a retry or an explicit pause that keeps every booked lesson.
- Focus return after dismissing the setup checklist, unlinking a parent, or a
  status change; the browser Back button is not covered by the leave guard.
- Completing or cancelling a lesson does not refresh package credits until the
  next refetch.
- Accessibility polish: the mobile navigation sheet's English-only title and
  hidden close button, the "More" tab without `aria-expanded`, the phone status
  sheet radio group without a name or arrow keys, sort direction and result
  counts not announced, the timezone field not marked required, targets below
  the contract's 44px phone minimum.
- Design-system hygiene: arbitrary type sizes and radii in feature code, raw
  `white` utilities in `stat-block`/`button`/`sonner`, `-space-x` for the
  empty-state avatars, a duplicated status-dot map, translated strings reshaped
  in components, registry entries missing for `PageHeader` and the newer
  `DataTable` props, locale-specific stories, and shared components with a
  single caller that should be reviewed against the two-caller rule.
- The header search, phone search and notifications bell are not wired yet.

## Studio redesign follow-ups (open)

The "Studio - Indigo & Sky" redesign of the application shell, the student
collection and the student profile is implemented. These are the parts it could
not finish, each with the slot already in place.

### Backend data the design shows and the API does not provide

Listed in `apps/web/src/features/students/model/pending-data.ts`. Every one of
them renders a documented empty state today and takes the real value as an
optional prop, so wiring one up is a single argument.

1. Per-student rollups for the collection row: package credits left/total, the
   next lesson, the balance status, and the teacher on the list item.
2. Collection aggregates: the weekly lesson trend series, the running-low
   count, and the outstanding total.
3. Profile metrics: credits left, paid this term, and an attendance series.
   Attendance is now stored per lesson (`LessonAttendance`, ADR 0006); the
   student-side series still needs a read endpoint.
4. Notes authorship: who last edited a student's notes and when.
5. Navigation counters and the workspace teacher count.

### Product surfaces the design shows that are not built

The teacher filter and the low-credit filter (no query support), the card view
(no grid view), and the profile's Payments and History sections. Each renders
disabled or as a named empty state rather than pretending.

### Visual follow-ups

1. ~~A dark palette.~~ Shipped on 2026-09-23; the token families are described
   in [`design-system.md`](./design-system.md#theme-contract). Open design
   questions: the white 6px avatar ring on the dark profile hero, and the
   canvas discrepancies listed in the dark-theme PR.
2. ~~Migrate the remaining `MetricCard` callers in groups to `StatBlock`.~~
   Done in Work Packet 6.3; only the dashboard's `StatTile` still uses
   `MetricCard`.
3. Input and Select are still 36px while buttons are 44px. The handoff does not
   cover forms, so they were left alone; they need one reviewed pass.
4. The mobile layout for both screens is a proposal, not an approved design.
