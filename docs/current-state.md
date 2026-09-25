# Tutorio Current State

Last verified: 2026-09-25 after screen steps S04 and S05 (see "Lessons and
Schedules").

This is the first project document to read before planning or implementing
work. It reports the repository as it exists; [`mvp-plan.md`](./mvp-plan.md)
defines the pilot boundary and [`roadmap.md`](./roadmap.md) defines execution
order.

## Frontend reset (2026-09-24)

At the owner's request the web app keeps only the rebuilt screens: sign-in and
registration, the application shell (navigation since: see the steps below),
and the Students, Parents and Groups screens. The dashboard, calendar, lesson
patterns, packages and payments, teachers and settings pages, the old lesson,
schedule, package, payment and enrollment dialogs, and the shared helpers only
they used were deleted; `/app` opens the students. The rebuilt screens show
lessons, packages and directions read-only — scheduling, lesson actions, sales
and direction edits come back with the new screens (Work Packet 6.4 screens,
6.2, 6.5, 6.6 and 7). Every backend route stays available.

## Lessons and Schedules — screen steps S04 and S05 (2026-09-25)

Navigation: Календар · Заняття · Розклади · Учні · Групи · Батьки; the phone
tab bar is Календар · Заняття · Учні · Групи · Ще.

«Заняття» (`/app/lessons`, S04) lists every lesson of the studio, paged,
with the quick filters and their counts (all, unpaid, cancelled, no-shows, no
makeup), the period, teacher, student or group and status filters, a search
and the order — all in the URL. Rows show the date and time, who with the
kind, the teacher (hidden in solo mode), the status with the makeup chip, the
payment from the charges and the price; they open the S01 panel, and the row
menu opens its move, makeup and cancel dialogs. Phones get cards and a filter
sheet. «Скасування занять» (here and in the calendar header) cancels a period
for the studio or one teacher in two steps, free and by the teacher (L-54).

«Розклади» (`/app/schedules`, S05) lists the schedules by state (active, with
a planned change, ended, all) with counts, teacher, student or group and type
filters, a search and the order: slot chips, the state with its caption, the
next lesson and how far ahead it is booked. The shared dialogs — «Новий
розклад» (the lesson form's band and weekly block, a length and a horizon,
then the check with the dates and the overlapping lessons, forced after
conflicts; an existing schedule as a callout), «Змінити розклад» (form, then
consequences), stop and weeks ahead — are exported from `@/features/lessons`
for the student profile (S06) and the group page (S08).

API reads added for the screens: the lesson page takes several statuses, a
name search and counts every lesson; the schedule list takes a changing
state, a kind, a search and a sort by the next lesson, counts each state and
returns the start, the last booked lesson, the student's avatar and the
group's size; the create, change and stop previews name their lessons and why
each is kept; `POST /schedules/:id/horizon/preview` says what a horizon adds.
Briefs, decisions and open questions:
[`screens/s04-lessons-list.md`](./screens/s04-lessons-list.md),
[`screens/s05-schedules.md`](./screens/s05-schedules.md).

Gate on 2026-09-25: root lint, typecheck and tests (API 242 unit tests, web
308 unit tests), the API E2E suite on an isolated database (120 tests), the
web build, the Storybook browser tests (330 in 89 files) and the Storybook
build.

## Calendar — screen step S03 (2026-09-25)

«Календар» (`/app/calendar`) is the first navigation item. The week (default
on desktop), day (default on phones) and month views show the studio's
lessons, coloured by type (individual, group, makeup) and filled by time
(upcoming, past, running, cancelled), with held, no-show, makeup and unpaid
marks; several teachers add their initials and a legend. Teacher and status
filters count the period's lessons; the phone has a filter sheet. A click or
drag on empty time opens the lesson form with that date, time and length; a
lesson opens the S01 panel; dragging a scheduled lesson moves it (15-minute
snap, the overlap named while dragging) through the S01 scope and conflict
dialogs, with an undo toast for a plain move. Empty, loading and error states
sit over the grid. The API's lesson list now carries the student's avatar.
Brief, decisions and open questions:
[`screens/s03-calendar.md`](./screens/s03-calendar.md).

Gate on 2026-09-25: root lint, typecheck and tests (API 241 unit tests, web
unit tests), the API E2E suite on an isolated database (119 tests), the web
build and the Storybook browser tests (288 in 87 files).

## Group member prices (2026-09-25)

A group member can pay their own price (L-11): «Змінити ціну» in the group
roster opens «Ціна для учня»; the roster shows a price column once somebody
has one; the group form shows who a new group price moves and who keeps their
own; the lesson form's group card counts the members with their own price.
The API gained `Enrollment.ownPrice` (a group price change reprices only the
others, and a charge keeps its amount, L-12). `Notice` now defaults to the
Info and TriangleAlert glyphs. Details:
[`screens/s08-group-page-operations.md`](./screens/s08-group-page-operations.md).

## Lesson create form — screen step S02 (2026-09-24)

«Додати заняття» on the student profile and the group page opens the lesson
form: a 640px window (a full-screen sheet on phones) with who the lesson is
for in the indigo band — «Учень / Група» tiles, a search in place, the picked
student with their package, schedule or pause, or the group with its size,
paused members and price —, then the teacher (hidden in solo mode; another
teacher is a substitute for these lessons), «Коли» as date rows with their own
times or «Щотижня» (weekday pills, a time per day, from and until), length
and price, a past date's outcome, the group's participants or what the
schedule becomes, topic and notes, and the result in the footer. One-off
dates book with `POST /lessons`; «Щотижня» creates a schedule or adds the days
to the direction's schedule after its preview; every save goes through the S01
conflict dialog. The time lists mark the slots other lessons take. The lesson
panel moved to the same family (layout A) and its edit form and makeup dialog
use the new fields. Brief, decisions for the owner and open questions:
[`screens/s02-lesson-create.md`](./screens/s02-lesson-create.md).

Gate on 2026-09-24: web lint, typecheck, 267 unit tests in 44 files, build,
the Storybook browser tests (238 tests in 85 files, with accessibility checks)
and the Storybook static build. The API, domain and validation packages are
unchanged by this step.

Follow-up on 2026-09-25: a new schedule is previewed too.
`POST /schedules/preview` answers what `POST /schedules` would create and
overlap without writing anything (a student with no direction with the
teacher is checked as that student), and «Щотижня» shows «Конфліктів немає»
or the overlaps before saving; the save still checks again. Gate: root lint,
typecheck and tests (API 241 unit tests), the API E2E suite on an isolated
database (118 tests in 13 files; the pauses suite's schedule moved to 06:00
so it no longer overlaps its own 10:00 bookings on Fridays), the web build
and the Storybook browser tests (238 in 85 files).

## Lesson panel — screen step S01 (2026-09-24)

The first screen step from the owner's mockups is done: a lesson row on the
student profile or the group page opens the lesson panel (`?lesson=<id>`), a
920×720 window on desktop and a full-screen sheet on phones. It shows the
lesson, its payment (package credits or the single-lesson price) or a group's
attendance and members' charges, and its history, and runs every action on the
lesson: edit in place, move (with "this / this and following" and the
schedule preview's numbers), cancel, status fix, makeup, attendance, delete,
and the conflict dialog with "save anyway". The attendance sheet now flags a
paused member (API). Brief, decisions and open questions:
[`screens/s01-lesson-panel.md`](./screens/s01-lesson-panel.md). Since S02 the
panel is one 640px column under the indigo band (layout A) instead of the
920×720 two-column window.

Gate on 2026-09-24: web lint, typecheck, 222 unit tests, build, the Storybook
browser tests (209 tests in 77 files, with accessibility checks) and the
Storybook static build; domain 126 and validation 60 unit tests; API lint,
240 unit tests, and the pauses, groups and billing E2E suites (27 tests) on an
isolated PostgreSQL 17. Four older stories asserted a dialog visible during
its fade-in and failed now and then; they now wait for it.

## Executive status

Tutorio has a broad, credible Students-to-Money core, but it is not pilot-safe
yet. The next move is the approved route-by-route migration of existing pilot
workflows onto the completed shadcn foundation. This is a bounded stabilization
track, not a big-bang redesign or a new product module: every migrated route
must become clearer, tested, responsive, accessible, and independently
deployable while preserving proven behavior.

- Branch: `develop`; Work Packet 5 implementation is committed as `e362675`,
  Frontend Packet F5 as `4900755`, and Work Packet 6 is closed on 2026-09-23.
  Work Packet 6.1 — Parents is closed on 2026-09-23 after a four-slice
  independent review and its remediation. Work Packet 6.3 — Groups is
  implemented, reviewed in two slices and remediated on 2026-09-23, ahead of
  Work Packet 6.2 at the product owner's request.
- The former `refactor/students-design` work was merged by PR #18.
- `pnpm generate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`
  pass on 2026-09-23 after the WP6.3 remediation. Observed unit totals: domain
  107, validation 53, API 215, and web 234. Storybook browser tests pass for
  249 tests across 79 files, including automated accessibility checks.
- API E2E passes 94 tests in 7 suites against an isolated PostgreSQL 17
  database after all 23 migrations (WP6.3 adds the group teacher, seats and
  per-student attendance). The WP6.1 run passed 80 tests in 6 suites after
  22 migrations. Earlier runs passed 78 tests in 6 suites
  against an isolated PostgreSQL 17
  database after the then-current migration set, including legacy-TEACHER
  denials, group compensation cycles, and package archival. The finance
  migration verifier passes against a separate clean PostgreSQL 17 database.
  The WP6 Student contract slice additionally passes its 29-test Stage 2 suite
  against a fresh PostgreSQL 17 database after all 21 current migrations.
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

Stage 4.1 remains active. Work Packet 5 — Pilot Authorization and Frontend
Packets F0–F5 are complete. The bounded feature-migration track in
[`frontend-plan.md`](./frontend-plan.md) now runs before Work Packet 7 — Lesson
Pack Sale. It standardizes each existing pilot surface without introducing a
second visual system or speculative product scope. The required order is:

1. Lock lifecycle and accounting decisions in ADRs and tests.
2. Fix P0 data-integrity defects in group deletion/restoration, payment
   ownership, ledger compensation, and package/lesson deletion.
3. Fix scheduling lifecycle defects: conflict validation, pause behavior,
   effective status, and honest replacement-lesson behavior.
4. Use Work Packet 6 — Student Experience and Quick Create as the reference
   feature migration (closed 2026-09-23).
5. Migrate Parents, Teachers, Groups and Enrollments, Scheduling, package read
   surfaces, Dashboard, and Settings in Work Packets 6.1–6.6.
6. Replace package creation with the progressive sale flow in Work Packet 7.
7. Run the complete pilot acceptance matrix with realistic seed data and an
   isolated database.

### Studio students & auth handoff

The students and authentication screens follow the Studio handoff: the
shared base, form and status kits (`TextField`, `ChoiceCard`, `Notice`,
`Segmented`, `IconButton`, `SectionNav`, `ActionBar`, `StatusTrigger` with
its menu and sheet, `AdaptiveDialog`, and more), full-page student create and
edit routes, the status control with the hold and archive flows, collection
rows and profile metrics derived from package and lesson data, the phone
app bar and tab bar, and the two-column sign-in and registration screens.
Storybook was reorganised to one entry per component with controls; screen
stories render the real features against an in-memory story backend, which
validates list pagination the way the API does.

Authentication is a 40 / 60 desktop split: the form card beside a decorative
promo panel (hidden from assistive technology and pinned to the light palette),
with a compact promo band above the form on phones. The approved Studio dark
palette is shipped as token pairs in `globals.css`; see the theme contract in
[`design-system.md`](./design-system.md). The timezone picker offers 25 main
zones and keeps a saved or browser zone outside them selectable.

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
whitespace checks pass.

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
Stories and browser interactions cover shell variants and a11y behavior. Root
lint, typecheck, test, and build, the 98-test Storybook browser/accessibility
suite, Storybook static build, and whitespace checks pass on 2026-09-10.

### Frontend Packet F5 evidence

The product composition boundary is implemented. `components/app` now owns only
the authenticated shell; reusable product compositions live in
`components/shared`, while the dashboard and its dashboard-only `StatTile` live
in `features/dashboard`. Generic status
presentation is shared, with lifecycle DTO and localization adapters retained
by each domain. `CollectionFrame`, `DetailFrame`, and `EntityFormDialog` were first
documented as Storybook reference compositions; since 2026-09-24 the frames
are shown by the screen stories and the dialog shell by its own entry. The architecture check now
enforces the documented layer direction, including static and literal dynamic
import paths plus the reviewed session-context/root-layout exceptions. Root
lint, typecheck, test, build, Storybook browser tests (112 across 22 files),
Storybook static build, and `git diff --check` pass. Work Packet 6 is the next
planned work.

### Work Packet 6.3 evidence

Groups follow the Studio handoff; see [`product/groups.md`](./product/groups.md)
and [ADR 0006](./decisions/0006-group-teacher-capacity-and-attendance.md). The
collection (cards and rows, four metrics, status tabs, teacher, weekday and
unpaid filters, sort — all answered by the API), the group page led by the
schedule, and full-page create and edit with a neutral archive are built on
two new shared components, `LessonList` and `AttendanceList`; the student
profile's lessons now scroll inside `LessonList`. The schema gained a group
teacher, seats and per-student attendance (migration
`20260924120000_group_teacher_capacity_attendance`).

Backend audit (students, teachers, parents, groups), fixed in the same pass:
roster reconciliation no longer revives or duplicates student-archived
enrollments and writes in batches; the solo single-teacher rule holds on every
activation path; enrollment changes are guarded against archived students;
archived students are listable; `PATCH /parents/:id` answers with the detail;
list page and count reads run concurrently; restore conflict checks and
advisory locks are batched; a schedule set on an empty group is clash-checked
at once and materialized when the first student joins; the rate limiter keys
on the session and on a gateway-forwarded client address trusted only with
`GATEWAY_SHARED_SECRET`; a rotated refresh token's successor is shared during
a short grace window, and the web gateway single-flights refreshes, so
parallel requests after expiry no longer log the user out.

Performance ("every action loads many routes"): the causes were per-row
`Link` prefetching of dynamic routes, mutations invalidating whole query
families, search and filters pushed through the router on every keystroke,
whole-form `watch()` re-rendering forms per keystroke, client-side session
bootstrapping on hard reloads, lesson windows keyed to the millisecond,
serial reads, and retries of 4xx answers. Now: row links do not prefetch;
each mutation invalidates only what it outdates and cancelled reads abort;
search is debounced and filters are written with native history; forms watch
only the fields a section needs; the session is read on the server; lesson
windows round to whole days; package pages, profile reads and group page
reads start in parallel; student counts and profile enrollments come in one
request; 4xx answers are not retried; the calendar loads on demand and unused
barrel exports drop from bundles.

Review, 2026-09-23: two independent reviewers (backend; web) found five
backend and ten web defects, none a data-loss blocker; the most serious were a
reschedule that failed on marked lessons and an edit save that could reassign
a legacy group's lessons. All are fixed with tests or stories; details are in
the brief's review section.

### Work Packet 6.1 evidence

Parents follow the Studio handoff on the pattern Students set: a collection
with search, a student filter, a "no students" filter and a name sort, all
answered by the API; a profile with the hero, linked students, contact details
and notes; full-page create and edit with section navigation, progress and the
sticky save bar, no local draft, and the owner-only danger zone. Linking is
symmetric: both profiles use one `LinkedCard` with one `LinkPickerDialog`, save
the whole set through `useLinkedSet`, and confirm an unlink with the neutral
dialog. Parent email is stored end to end. Delete is hidden for non-owners in
the row menu, the profile menu and the edit form. See
[`product/parents.md`](./product/parents.md).

Closure, 2026-09-23: four independent reviews (frontend correctness, API and
contract, design-system compliance, accessibility and responsive layout) found
no blocker. The remediation fixed the confirmed findings: input filters that
never reached the submitted value (the student form shared the defect), a
search field that kept cleared text, stale-set edge cases in `useLinkedSet`,
the duplicated linking cards (now one `useRelationshipLinks`), cloned form
layouts and notes cards (now the shared `FormPageLayout` and `NotesCard`),
focus return from dialogs, picker scrolling and announcements, phone touch
targets, and thin E2E assertions. The declined items and their reasons are in
the brief's review section.

### Work Packet 6 evidence

The Student reference migration is implemented through the feature boundary.
The detail uses `DetailFrame` and `ProfileHeader`, lifecycle commands come from
one tested presentation policy, archived profiles are read-only, and Scheduling
owns separate mobile lesson items below `md`. Create and edit now have separate
schemas, DTO builders, and dialogs; quick create navigates to the saved profile
setup state while the Group caller retains controlled selection without forced
navigation. Parent relationship management runs only after persistence and
supports link, unlink, and retry after a successful parent create. The legacy
combined Student form and delete-labelled dialog are removed.

The review-remediation pass prevents enrollment edit from falling through to
create mode, uses the workspace currency for previously unpriced students,
shows package payment state and archived history, exposes both parent paths,
and makes mobile menu cleanup deterministic. Root generation, lint, typecheck,
unit tests, production build, two complete 166-test Storybook
browser/accessibility runs, Storybook static build, and whitespace checks pass
on 2026-09-22. No API or service contract changed, so the existing isolated
lifecycle E2E evidence remains applicable.

The 2026-09-23 closure gate reviewed everything since `4900755` — the Student
migration, the Studio redesign, the auth screens and the dark theme — in four
independent passes: Students correctness, authentication, design-system
compliance, and accessibility/responsive behavior. They found one blocker (the
collection requested 200 packages per page against the API's cap of 100, so
every row reported "No active package") and a set of major defects: invented
profile zeros on failed reads, a parent link/unlink race, unsaved edits lost on
in-app navigation, a low-credit count that followed used-up packages, the phone
save button hidden under the tab bar, no phone pagination, tablet overflow and
clipping, invisible focus, and names that did not match visible labels. All
were fixed with regression tests or stories where behavior exists; the story
backend now rejects out-of-range pagination. A second independent pass verified
every fix and found five minor follow-ons, also fixed. Root generation, lint,
typecheck, unit tests, production build, repeated 183-test Storybook
browser/accessibility runs, the Storybook static build, and whitespace checks
pass. No API contract changed; the one API commit adjusts a test-only spec.
Remaining minor items are listed in [`next-work.md`](./next-work.md).

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
`apps/api/scripts/verify-finance-migration-upgrade.ts` (retired in Work
Packet 6.4 phase 3) against a separate PostgreSQL 17 database. The verifier covers migrated fixed and `BY_PERIOD`
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

- Package creation combines customer assignment, billing model, price, expiry,
  recurrence, timezone, first-lesson calculation, and payment state in one
  modal. A tutor must understand several internal concepts before completing a
  basic sale.
- Legacy form components outside Students mix several roles and lack
  workflow-level interaction tests; they are migrated domain by domain in Work
  Packets 6.1–7.
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

Work Packet 6 — Student Experience and Quick Create is closed: it passed an
independent four-dimension review, its remediation, a verifying re-review, and
the complete local gate on 2026-09-23. The Student feature is the reference
collection/detail/form migration. Work Packet 6.1 — Parents is closed on the
same pattern, with its brief in [`product/parents.md`](./product/parents.md).
Work Packet 6.3 — Groups is implemented and reviewed, with its brief in
[`product/groups.md`](./product/groups.md). The next checkpoint is Work
Packet 6.2 — Teachers, which starts with its architect-approved screen brief
in `docs/product/`.
