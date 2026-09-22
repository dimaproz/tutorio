# Student Workflow and Work Packet 6 Screen Brief

Last verified: 2026-09-22 (Studio students handoff) through source and contract inspection plus the full
generation, lint, typecheck, unit, production, Storybook browser/accessibility,
Storybook static-build, and whitespace gate. The complete 166-test Storybook
suite passed twice. Status: Work Packet 6 implementation and blocking-review
remediation are complete; independent re-review remains before Work Packet 6.1.

## Studio students handoff (2026-09-22) — current contract

The students & auth design handoff supersedes the dialog-based create/edit
and the overflow lifecycle menu described further down. Where the sections
below disagree with this one, this one wins.

- **Create and edit are full pages**: `/app/students/new` and
  `/app/students/[studentId]/edit`. Six sections (personal details, contacts,
  learning profile, preferences, price, notes) with a scroll-following
  `SectionNav` (chips on phones), per-section done/error marks, a progress
  meter on create and a sticky `ActionBar`. Only the name and timezone are
  required. Create keeps a local draft in this browser until it is created
  or discarded; leaving a dirty form asks first. Edit shows loading, load
  error (never a create form), unsaved-change counts, request error with
  retry, and a read-only archived state. Success navigates to the profile
  (`?setup=1` after create) with a toast.
- `StudentQuickCreateDialog` remains only for creating a student inline from
  another workflow (the group form). The edit dialog and the separate
  archive dialog are removed.
- **Status lives in one control**, in the profile hero and the edit header:
  a dropdown on desktop, a bottom sheet on phones. Active → on a break opens
  the hold dialog, which can cancel the student's upcoming *individual*
  scheduled lessons as `CANCELLED_UNCHARGED` by the teacher (group lessons
  keep running); on a break → active and archived → active apply at once;
  any → archived confirms first. The row menu no longer changes status.
  The design's optional return date is not offered: the API has no field to
  store it and no reminder to send.
- **Profile order**: status banner (on a break / archived) first, then the
  hero with the next-lesson ticket, four metrics, the set-up checklist for a
  fresh student, the lesson sections and the aside (notes, parents,
  contacts). Hero commands follow the status: active schedules and edits, on
  a break edits, archived restores. Metrics are derived from the student's
  packages and lessons (`model/profile-metrics`); an archived profile shows
  no live metrics.
- **Collection rows carry real rollups** (`model/rollups`): credits of the
  live package, what is owed, the next scheduled lesson and its teacher, all
  from the package and lesson reads the page already makes. A partial
  package read reports nothing rather than a false "paid". The teacher
  filter is removed; the low-credit filter and the card view stay disabled
  until the API can filter by them.

## User job

“Add the learner I am about to teach, then help me do the next useful thing.”

The create action is not complete CRM profile setup. A student becomes useful
when the tutor can schedule a lesson, sell a lesson package, choose an
individual or group learning relationship, or link a guardian.

## Scope and authority

Work Packet 6 owns:

- `/app/students`;
- `/app/students/[studentId]`;
- student quick create and profile editing;
- student archive, restore, hold, and reactivate presentation;
- saved-student entry points into lesson, package, enrollment, and parent jobs;
- reusable Student feature components and their Storybook contracts.

It does not redesign package sale, parent CRUD, enrollment rules, or scheduling
forms. Those existing dialogs may be opened with the student preselected until
their owning packets replace them. No API or domain behavior may be weakened to
fit the screen.

All Student API routes are owner-only in the pilot. The application shell owns
the unauthorized-route response; Student components must not render controls
that imply a staff member can perform these mutations.

## Audited current experience

The collection already provides server-side search, facet filters, sorting,
pagination, desktop rows, mobile cards, and basic loading/error/empty states.
The detail already exposes lessons, contacts, parents, groups, enrollments, and
profile editing. These behaviors are evidence to preserve, not layouts to copy.

### Confirmed problems

1. The create dialog asks for avatar, status, contacts, timezone, two learning
   scales, age, grade, pricing, parents, and notes in one long scroll. Only name
   and timezone are required by the API.
2. Avatar and lifecycle status precede the first useful contact. A new student
   should be active by default, and an avatar is saved-profile enrichment.
3. Parent creation persists a parent before the student exists. Cancelling the
   student afterward can leave an unintended unlinked record.
4. The 634-line legacy form owns queries, mutations, relationship
   reconciliation, formatting, validation, nested entity creation, and
   rendering.
5. Edit-query failure is not rendered explicitly. `StudentFormDialog` passes an
   undefined record to `StudentForm`, which can present create-mode UI after a
   failed edit load.
6. Form actions live inside the scrolling form rather than the dialog's stable
   footer slot. The action is not visible when the long form first opens.
7. Successful creation closes the dialog and leaves the tutor on the list with
   no next action.
8. A zero-result status or group filter is presented as “no students exist” and
   offers another create action. There is no clear-filters action.
9. Desktop collection columns split phone and Telegram into sparse columns,
   making identity and learning context harder to scan than necessary.
10. The detail promotes Edit and a red Delete button above the first operational
    action. The command is actually archive, not routine deletion.
11. The detail has no package summary or preselected package entry point.
12. The mobile detail compresses the full lessons table into a narrow viewport;
    rows remain technically visible but are dense and difficult to scan.
13. “Hourly rate” and “price per lesson” copy conflict. Tutorio bills lessons,
    so the product term is **price per lesson** unless duration-based billing is
    introduced later.
14. “Language level” and “knowledge level” are ambiguous during creation.
    Neither belongs in the quick path; the saved profile may expose both with
    explicit scale labels.

## Approved product decisions

- Use a compact dialog with optional disclosure, not a wizard.
- Make `Add student` the only collection primary action.
- Make `Schedule lesson` the active-profile primary action.
- Use `Archive student` everywhere; never label this reversible command as
  delete.
- Keep permanent deletion out of daily Student UI. It remains an explicit
  owner-only administrative command guarded by business-history checks.
- Navigate to the saved profile after creation and reveal a dismissible setup
  card.
- Move parent creation and linking to the saved profile.
- Use one pilot edit dialog with grouped, collapsible sections and a stable
  footer. Section-level save can be reconsidered after pilot evidence; it is not
  required for this packet.
- Preserve Geist/Geist Mono, semantic theme tokens, Lucide icons, and the
  installed `radix-luma` preset. WP6 adds no visual system or motion library.

## Screen 1 — Student collection

Implementation status: complete and verified on 2026-09-20.

### Information hierarchy

1. Page title and short operational description.
2. Primary `Add student` button.
3. Four collection metrics.
4. URL-backed search, status filter, and group filter.
5. Student results.
6. Pagination.

The search continues to cover full name, email, phone, and Telegram. The
default result set contains active and on-hold students. Archived students are
available through the status filter.

### Statistics

Four `StatBlock` instances appear above the collection, in the Studio shapes:
Active students, Lessons this week, Low on credits, and Awaiting payment.

Only the first has an endpoint. The other three are placeholders that say they
are waiting on reporting data; none of them shows a number the API cannot
support. The facet counts the collection used to spend metric cards on now live
on the status control, where they also drive the filter.

The cards use separate lightweight Student list queries with `pageSize: 1` and
their returned `total`; collection-page rows are never used to derive a metric:

| Metric         | Query state | Status filter |
| -------------- | ----------- | ------------- |
| Total students | active      | none          |
| Active         | active      | `ACTIVE`      |
| On hold        | active      | `ON_HOLD`     |
| Archived       | deleted     | `ARCHIVED`    |

Each metric loads and fails independently. A metric failure must never block or
hide the collection. The grid is four columns on wide desktop, two on tablet,
and one on mobile.

### Desktop composition

Use `CollectionFrame`, `PageHeader`, `CollectionToolbar`, `ListSearchInput`,
`ListSelectFilter`, `DataTable`, `ListPagination`, and
`CollectionEmptyState`.

The table columns are:

| Column      | Content                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------- |
| Student     | Avatar with its lifecycle dot, linked full name, and the best contact on file                      |
| Learning    | Group name, Individual with an active enrollment, or Not configured; teacher below                 |
| Credits     | Segmented credit meter, or "No active package"                                                     |
| Next lesson | Date and time, or the design's empty state                                                         |
| Balance     | Tinted payment badge                                                                               |
| Actions     | Accessible overflow trigger                                                                        |

Status is no longer a column: the avatar dot carries it and the status control
filters by it, and every row is reachable from exactly one facet. Credits, next
lesson, balance and the teacher have no per-student rollup yet, so each renders
its empty state and takes the real value as an optional prop.

Only Student, Status, and Added are server-sortable, and the sort control
offers exactly those. Relational and rolled-up columns are not sortable.
Subject, price, timezone, phone, email, and Telegram are not columns; contact
values remain searchable and available on the profile.

### Mobile composition

Use the owning `StudentCard`; do not horizontally scroll or squeeze the desktop
table. The card contains:

- avatar, linked name, status badge, and overflow action;
- group names, Individual, or Not configured using the exact desktop rule;
- localized added date.

Search is full width. Status and group filters share a two-column row when the
viewport can fit their accessible touch targets and stack below that width.

### Collection states

- **Initial loading:** list skeleton matching table/card density.
- **Background refresh:** preserve results and show the shared refresh indicator.
- **Query error:** keep the toolbar visible, show a retry action, and retain URL
  filters.
- **True empty:** only the default unfiltered query may say there are no
  students; offer `Add student`.
- **Filtered empty:** if search, status, or group is set, say no matches were
  found and offer `Clear filters`; do not offer a second create action.
- **Archived row:** show the archived badge and Restore as its only row command.
- **Pagination:** changing search or facets resets page to one.

## Screen 2 — Student quick create

### Default body

Use `StudentQuickCreateDialog` composed from `EntityFormDialog`, shadcn
`Field`/`Input`/`InputGroup`, `MoneyInput`, and `FormActions`.

| Field            | Behavior                                                    |
| ---------------- | ----------------------------------------------------------- |
| Full name        | Required, autofocus, 1–120 trimmed characters               |
| Phone            | Optional                                                    |
| Telegram         | Optional, normalized without requiring the user to type `@` |
| Price per lesson | Optional; reveal currency only after an amount is entered   |

Phone and Telegram form one contact row on desktop and stack on mobile. This is
clearer and more resilient than a custom combined control. Currency defaults
from the workspace and is omitted from the request when price is empty.

Applied without visible controls:

- status defaults to `ACTIVE` on the server;
- timezone uses the browser IANA timezone with the existing `Europe/Kyiv`
  fallback. A workspace timezone does not exist in the current contract and
  must not be invented by the client;
- no avatar, parent, group, enrollment, package, lesson, or recurrence side
  effect is created.

### Optional disclosure

`Add more details` uses the installed shadcn `Collapsible` and reveals:

- email;
- timezone override;
- age and grade;
- notes.

Language and general knowledge levels move to saved-profile editing, where
their scales can be named explicitly. Avatar and parent relationships also move
to the saved profile.

### Dialog behavior

- A stable footer contains Cancel and Create student at every scroll position.
- Closing with dirty values through Cancel, Escape, overlay, or the close button
  opens one discard-changes confirmation.
- Client and server field issues focus the first invalid control and an error
  summary is announced.
- A request error retains all values and provides a retryable submit action.
- Pending submission disables duplicate submission but not the ability to read
  entered values.
- Mobile has no horizontal scroll or nested overlay. The body alone scrolls;
  header and footer remain visible.

### Success transition

After a successful POST, navigate to
`/app/students/[studentId]?setup=1`. Do not stop at a toast. The profile reads
the query flag, displays the setup card, and removes the flag when dismissed so
normal return visits are quiet.

## Screen 3 — Student detail

### Header and primary action

Use `DetailFrame` and `ProfileHeader`. The identity area contains avatar, full
name, status, created date, and compact age/grade/level tags when present.

For an active or on-hold student:

1. `Schedule lesson` is the primary action and opens the existing lesson dialog
   with `lockedStudentId`.
2. `Edit profile` is secondary.
3. On hold/reactivate and archive live in an overflow menu.

For an archived student, hide edit and operational actions, show a clear
archived explanation, and expose Restore as the only primary command. Historical
lessons, packages, relationships, and contacts remain readable.

### Main column

1. **Setup card**, only after quick create until dismissed.
2. **Lessons**, upcoming first and past second, with `Schedule lesson` in the
   section header.
3. **Lesson packages**, queried by student. Show current balance/status and a
   link to each package; provide `Add package`, opening the existing package
   dialog with `lockedStudentId`. The existing package form is temporary until
   Work Packet 7 and must not be duplicated.
4. **Learning relationships**, showing individual/group enrollments and their
   operational state. `Set up learning` opens the existing enrollment dialog
   with the student locked; solo-workspace teacher selection remains implicit.
5. **Notes**, only when present, with editing available through the profile
   action.

### Aside

1. **Student information:** contacts, price per lesson, timezone, and explicit
   `General level` / `Language level (CEFR)` labels when values exist.
2. **Parents:** linked parent cards plus `Link parent` and `Create parent`
   actions.

The parents section updates the complete parent-ID set through the existing
student PATCH contract. Creating a parent happens only after the student exists.
If parent creation succeeds but linking fails, retain the new parent as a
selectable result and show a retryable link error; never report the combined job
as successful.

### Setup card

`StudentSetupCard` is a feature-owned Card/Item composition titled `Student
created — choose the next step`. It offers independently cancellable actions:

- Schedule first lesson.
- Add lesson package.
- Set up individual or group learning.
- Link or create parent.
- Complete profile.

Each action reuses the owning feature dialog with the saved student preselected.
Dismissal does not mark a business workflow complete and writes no server data.

### Mobile detail

The detail becomes one column in this order: identity/actions, setup, lessons,
packages, learning, student information, parents, notes. Actions wrap without
overlap and destructive commands remain in overflow.

The lessons section must render an owning scheduling-feature mobile list item
below `md`; it must not compress the desktop table. Each item shows date/time,
status, type, price, and an accessible overflow action. This component receives
a Storybook contract so Work Packet 6.4 can reuse it.

## Student profile edit

`StudentEditDialog` is separate from quick create. It fetches the full student
record and has explicit loading, load-error/retry, ready, submitting, and
mutation-error states. A failed fetch must never render create mode.

The pilot editor uses a stable footer and grouped shadcn Accordion sections:

1. Identity: full name and avatar.
2. Contacts: email, phone, and Telegram.
3. Learning profile: age, grade, General level, and Language level (CEFR).
4. Preferences: timezone.
5. Pricing: price per lesson and conditional currency.
6. Notes.

Lifecycle controls and parent relationships are not profile fields. They remain
in their dedicated detail actions. Archived students cannot open this editor.

## Lifecycle and domain contract

- `ACTIVE -> ON_HOLD -> ACTIVE` uses PATCH; archived is never a selectable
  profile status.
- `DELETE /students/:id` means archive. It is reversible and must be represented
  with archive language and iconography.
- Archive suspends future individual series and scheduled lessons, marks live
  group enrollments with restoration metadata, and may reconcile an empty group
  schedule. Historical lessons, packages, payments, shares, credits, and links
  remain.
- Restore uses `POST /restore`, rechecks schedule conflicts, and revives only
  records suspended by that archive.
- Ordinary PATCH on an archived student returns
  `STUDENT_ARCHIVED_REQUIRES_RESTORE`.
- Permanent deletion is owner-only, irreversible, and rejected with
  `STUDENT_HAS_BUSINESS_HISTORY` when any enrollment, lesson, package, payment,
  share, or credit history exists. WP6 does not expose this command.
- All relation IDs remain workspace-scoped and server-validated.
- Money remains integer minor units; the UI never recomputes package balances.

The archive confirmation must summarize operational effects and reversibility,
not claim that all future work remains unchanged.

## Component ownership and shadcn composition

No official shadcn block maps one-to-one to an entity collection/detail pair.
The authenticated shell continues to use the approved `dashboard-01` structure;
WP6 composes installed official primitives inside it.

### Reuse before creation

- shadcn: Button, Card, Dialog/AlertDialog, DropdownMenu, Field, Input,
  InputGroup, Select, Collapsible, Accordion, Item, Badge, Empty, Skeleton,
  Table, Tabs, Alert, Spinner, and Tooltip where help is genuinely required;
- shared Tutorio: CollectionFrame, CollectionToolbar, CollectionEmptyState,
  DataTable, list controls, DetailFrame, PageHeader, QueryErrorAlert,
  EntityFormDialog, FormActions, EntityPicker, MoneyInput, TimezoneCombobox,
  EntityAvatar, ProfileHeader, InfoRow, PersonMiniCard, and status adapters;
- feature: StudentStatusBadge, lesson dialogs/list, PackageFormDialog,
  EnrollmentDialog, ParentFormDialog, and package/parent mini cards.

### Student-owned components

- `StudentCard` — the single mobile/compact collection representation;
- `StudentQuickCreateDialog` — create-only workflow;
- `StudentEditDialog` — edit-only workflow;
- `StudentSetupCard` — post-create next actions;
- `StudentPackagesCard` — student-filtered package summary and entry point;
- `StudentParentsCard` — relationship management on a saved profile;
- `StudentProfileContent` — presentational detail composition if separating
  query state materially improves Storybook coverage.

These remain under `features/students`. Do not promote them to
`components/shared` during WP6. A future packet may extract only a contract
proven by a second domain. Routes import the Student feature barrel only.

The legacy `components/students` modules may be moved or replaced incrementally,
but no visual clone may survive in parallel. The 634-line form must be removed
after its behavior is accounted for, not wrapped and retained indefinitely.

## Storybook and test contract

Stories are required for:

- StudentCard: active, on hold, archived, no contact, long name, multiple groups,
  and narrow mobile;
- Student quick create: default, expanded, validation error, server error,
  pending, dirty-close confirmation, and narrow mobile;
- Student setup card: default, long Ukrainian copy, and dismissed behavior;
- Student packages and parents: loading, empty, populated, error, and archived
  read-only states;
- Student detail composition: ready, loading, query error, archived, just
  created, narrow mobile, light, and dark;
- scheduling mobile lesson item/list if WP6 introduces it.

Interaction tests cover:

- minimum quick-create request and browser-timezone fallback;
- optional price/currency mapping and Telegram normalization;
- validation focus, retained server error, pending guard, and dirty close;
- successful navigation to the setup state with no nested entity side effects;
- filtered empty state and clear-filters behavior;
- active/on-hold/archive/restore command visibility;
- edit-load failure never entering create mode;
- package, lesson, enrollment, and parent actions receiving the saved student;
- parent link/unlink recovery;
- desktop table and mobile list/card behavior.

API E2E already proves student archive/restore, history preservation,
hard-delete conflict, cross-workspace denial, and owner-only authorization. WP6
must not duplicate domain tests in the browser; it must test presentation and
integration of those contracts.

## Accessibility, localization, and visual acceptance

- One `h1` per page and a logical heading order inside sections.
- Table captions, visible form labels, accessible overflow names, status text in
  addition to color, and at least 44px mobile targets.
- Dialog title/description, localized close label, deterministic focus return,
  keyboard-complete disclosure and menus, and announced errors.
- No horizontal scrolling for required mobile fields, student cards, setup
  actions, or lesson summaries.
- Ukrainian and English copy ship together. Long Ukrainian labels must be used
  in narrow Storybook checks.
- Light and dark themes use semantic tokens only. No raw colors, page-owned
  radius/shadow decisions, decorative gradients, or new animation system.
- Screenshot review verifies layout, hierarchy, overflow, spacing, and theme.
  Keyboard and assistive-technology behavior requires interaction/accessibility
  tests and cannot be accepted from screenshots alone.

## Acceptance criteria

- A first-time tutor creates a student in under one minute without explanation.
- Only full name is required when browser timezone detection succeeds.
- Cancelling or discarding creates no student, parent, enrollment, package, or
  lesson.
- Success opens the saved profile and every next action receives that student.
- A filtered zero-result state can be cleared in one action and never claims the
  workspace has no students.
- Active, on-hold, and archived students expose only valid lifecycle commands.
- Edit fetch failure is explicit and retryable; it cannot submit a create POST.
- Desktop and mobile provide equivalent data and commands without a compressed
  desktop table on mobile.
- Changed owned components have current stories and interaction coverage.
- Ukrainian/English, light/dark, keyboard, and responsive checks pass.

## Implementation order and release gates

1. **Collection (implemented):** move to CollectionFrame, redesign row/card
   information density, and fix filtered empty/clear filters. Add stories and
   interactions.
2. **Detail foundation (implemented):** move to DetailFrame, correct action hierarchy and
   archive language, add archived state, and add responsive lesson rendering.
3. **Models and boundaries (implemented):** split create/edit schemas and DTO builders; add
   deterministic tests for defaults, timezone, price, contact normalization,
   and lifecycle action policy.
4. **Quick create (implemented):** implement the compact dialog, dirty-close protection,
   explicit error handling, and success navigation. Delete the create branch of
   the legacy all-in-one form when parity is proven.
5. **Saved-profile next actions (implemented):** add setup, package summary, learning action,
   and parent relationship management with preselected student context.
6. **Edit (implemented):** implement the edit-only accordion dialog, explicit load failure,
   and remove the remaining legacy StudentForm path.
7. **Independent review (pending):** inspect duplication, query invalidation, permission
   visibility, lifecycle copy, keyboard/focus, mobile overflow, theme, and locale
   parity. Synchronize this document and pilot acceptance evidence.
8. **Verification (passed 2026-09-22):** `pnpm generate`, `pnpm lint`, `pnpm
   typecheck`, `pnpm test`, `pnpm build`, two complete 166-test Storybook
   browser/accessibility runs, Storybook static build, and `git diff --check`
   pass. API E2E was not required because the remediation changes no API or
   service contract; the package query only exposes the existing `state`
   parameter.

Do not start Work Packet 6.1 until every WP6 gate is green and the reference
Student feature pattern has passed separate review.
