# Group Workflow and Work Packet 6.3 Screen Brief

Last verified: 2026-09-23 through source inspection, the full lint,
typecheck, unit, production build and Storybook browser/accessibility gate,
and API E2E on an isolated PostgreSQL 17. Status: Work Packet 6.3 is
implemented, independently reviewed in two slices, and remediated.

Groups follow Students and Parents: the Studio "Indigo & Sky" look, full pages
instead of dialogs, both themes and phone layouts. The handoff screens are the
design authority; where this brief and a screen disagree, the screen wins.
The group page deliberately does **not** copy the person layout: a group is a
schedule with people attached, so the page leads with the schedule and the
next lesson.

Schema decisions (group teacher, seats, attendance, first-schedule-only form)
are recorded in [ADR 0006](../decisions/0006-group-teacher-capacity-and-attendance.md).

## User job

"See at a glance which groups run this week, who is in them, who keeps
missing, and who has not paid — and change the roster without a detour."

## Scope and authority

Work Packet 6.3 owns:

- `/app/groups` — the collection;
- `/app/groups/new` — create;
- `/app/groups/[groupId]` — the group page;
- `/app/groups/[groupId]/edit` — edit, with the archive danger zone;
- the roster flow on the group page;
- the two new shared components, `LessonList` and `AttendanceList`, and the
  student profile's move onto `LessonList`.

Out of scope and still open: the schedule-change confirmation (§ Screen 3),
calendar work, group packages beyond showing the active one and its shares,
bulk actions, and the lesson-screen attendance write path.

Every group route is owner-only in the pilot (ADR 0004). Archive and restore
entry points are hidden for anyone else, not disabled on click.

## Data contract

- `Group` gains `teacherId` (nullable FK) and `capacity` (1–500). Both are
  optional on create and edit; a school needs a teacher before it can add
  students or a schedule (`GROUP_TEACHER_REQUIRED`), a solo tutor never picks
  one.
- **The list query** answers search (group name or teacher name), `status`
  (`ACTIVE` / `EMPTY`), `state=deleted` for the archive, `teacherId`,
  `weekday` (0–6 of the live schedule), `payment=unpaid` and
  `sort=name|pricePerLesson|createdAt|activeStudentCount|schedule`. Nothing
  is filtered or sorted on the client. Each item carries the teacher, the
  capacity, the next lesson and whether a share is unpaid.
- `GET /groups/summary` returns the four metrics (active groups with the empty
  count, students in groups with free seats, lessons this week in the
  workspace timezone with today's count, unpaid shares); `GET /groups/options`
  is the picker list.
- `GET /groups/:id` includes archived groups, the lifecycle, the teacher and a
  `teacherMismatch` flag, schedules with their series ids, the next lesson,
  lesson counts and the student status and level on each enrollment.
- `GET /groups/:id/attendance?window=8` and `PUT /lessons/:id/attendance` are
  described in ADR 0006; the lesson response carries `attendance:
{ present, marked }` for the row summary.
- Package shares come from `PackageParticipantShare`; the share student now
  carries `avatarKey`.

## Screen 1 — Collection

`CollectionFrame`, `PageHeader`, four `StatBlock`s, status tabs
(All · Active · Empty · Archive, the archive owner-only), `SearchField`, a
teacher `EntityPicker`, a weekday picker, the sort, and a `Segmented` view
switch: cards (`GroupCard`, three per row on desktop, two on a tablet) or rows
(`DataTable`). Both views show the name, teacher, weekday + time pills, an
`AvatarGroup` with "6 of 8 seats" (just the count without a capacity), the
next lesson and the price.

The metrics are active groups (with an "N empty" badge), students in groups
(with free seats), lessons this week (with today's count) and "Without
payment", the only one with an action: "View" sets `payment=unpaid`.

Every filter lives in the URL; search is debounced and written with native
history, so typing does not re-render the route. The view choice is not
persisted, matching the students grid. Phones always get cards.

States: loading skeleton; query error with retry; true empty (`GroupsEmpty`,
no toolbar, one "Create group"); search with no hits (toolbar and metrics
stay, "Clear search" as a secondary button with an ✕); filters with no hits
("Reset filters"); an empty archive.

Row and card menus: open, edit, schedule a lesson, and under a divider
"Archive" (neutral, owner-only); an archived row offers "Restore".

## Screen 2 — Group page

Row 1: `GroupHero` (status chip, price chip, name, teacher with a
"mixed roster" note when legacy enrollments disagree, avatar stack, primary
"Schedule a lesson", "Edit", `…` menu with archive) beside
`GroupScheduleCard` — `Card tone="feature"`, the one saturated card on the
page: weekday rows, the next lesson and "Open lesson". Without a schedule it
becomes the call to add one.

Row 2: `GroupPageMetrics`, four `StatBlock`s: students (with free seats),
lessons held (ring), attendance (segments), paid shares.

Then two columns: `GroupLessonsCard` (`LessonList`, fixed height with an inner
scroll, "Showing N of M", "Show more" into the same container, the next lesson
highlighted) and `GroupAttendanceCard` (`AttendanceList`) on the left;
`GroupRosterCard`, `GroupPackageCard` and `GroupNotesCard` on the right.

- **Roster.** `LinkedCard` with `LinkPickerDialog` from "+"; the row menu
  opens the profile or removes the student after a **neutral** confirmation.
  Saving sends the whole roster (replace semantics) through
  `useRelationshipLinks`, so the last sent set stays authoritative until a
  newer record arrives. "Create a student" goes to the student create page.
- **Attendance.** The last eight held lessons per student, worst first; a
  cancelled lesson is a grey cell for everyone, a student on hold is a warning
  row with "—", and two or more misses in a row take the danger tint. The card
  is hidden for an empty group with no lessons.
- **Marking.** A held lesson's row menu opens `AttendanceDialog` (present,
  absent, excused per participant). This is the interim write path until the
  lesson screen owns it.
- **Just created.** `?created=1` shows the page right after create: no
  schedule, zero metrics with explanatory captions, an empty lessons card,
  and a roster card offering "Add existing" / "Create a student".
- **Archived.** The page stays readable, dimmed, with "Restore" as the primary
  command for the owner; nothing else can be changed.

Phones stack everything; lesson rows are compact (no overflow menu, shorter
meta) and each row is one button — a held lesson opens attendance marking, any
other opens the lesson; attendance rows use short names, and the picker is a
bottom sheet.

## Screen 3 — Create and edit

Five sections with the scroll-following `SectionNav`, per-section done and
error marks, a `ProgressMeter` and the sticky `ActionBar`: **Basics** (name*,
teacher, seats) · **Schedule** (weekday pills; start and length appear with
the first day) · **Price** (price, currency) · **Students** (`LinkPicker`) ·
**Notes**. Only the name is required.

- The schedule section only creates a group's **first** schedule, generated
  12 weeks ahead in the workspace timezone (the form names the zone). A group
  that already has one shows it read-only with "Open recurring lessons"; the
  confirmation that says how many booked lessons a change rebuilds is not
  designed yet.
- Edit sends the roster only when the form changed it and the teacher only
  when it changed; a new teacher moves the upcoming lessons, the live roster
  and the series, after a clash check.
- No local draft; leaving a dirty create form asks once and discards it.
- Create success opens the new group with `?created=1` and a toast; edit
  success returns to the page. A request error keeps every value and offers
  retry; controls are disabled while saving.
- Edit ends with the `DangerZone` (owner only): "Archive group" opens a
  **neutral** `ConfirmDialog` that says how many upcoming lessons are
  cancelled and that the roster and money stay.

Every form rule reports a translation key through `params.key` and never a
fixed `message`, which would bypass the localized error map
(`lib/forms/error-map.test.ts` guards it).

## Component ownership

- Shared (Layer 2): `LessonList` and `AttendanceList`. Extended: `StatBlock`
  (`size="sm"`), `LessonItem` (`compact`), `TextField` (`type="time"`,
  `suffix`), `WeekdayPicker` (`appearance="pills"`), `EntityPicker`
  (`appearance="field"`, `icon`), `DataTable` (`rowHeight="auto"`),
  `DetailFrame` (`ratio="balanced"`), plus the `scrollbar-thin` and
  `no-scrollbar` utilities.
- Groups feature (`features/groups`): model (form schema, section status, DTO
  builders, presentation helpers), the collection, cards and rows, the page and
  its cards, the attendance dialog, the form pages and the archive hook.
  `components/groups` and `StudentQuickCreateDialog` are removed; nothing
  needed the inline create any more.
- Students feature: the student link search (`useStudentLinkRow`,
  `useStudentLinkResults`, `useStudentFormPicker`) moved here from Parents and
  is shared by the parent and group forms.

## Storybook and test contract

- Shared: `Shared/Lists/LessonList` and `Shared/Lists/AttendanceList`, plus
  the updated `StatBlock`, `TextField`, value-control and `EntityPicker`
  stories.
- Screens: `Groups/Screens/Collection` (cards, rows, the unpaid filter, empty
  search, archive and archiving from a row, empty workspace),
  `Groups/Screens/Page` (roster removal and adding, load more, marking
  attendance, just created, archived) and `Groups/Screens/Form` (validation,
  a schedule needing a teacher, the locked schedule, archiving and the
  non-owner) run the real feature against the story backend.
- Model tests cover the form schema, section status, DTO builders and the
  presentation helpers; domain tests cover `summarizeAttendance` and the zoned
  ranges; API unit tests cover the group service and API E2E the list filters,
  summary, teacher reassignment, first schedule, archive/restore and the
  attendance routes.

## Independent review — 2026-09-23

Two reviewers, each given only the diff and the contracts, covered the
backend (groups, attendance, the audit fixes, the migration) and the web
(the groups feature, the shared lists, query invalidation, design system,
accessibility). All confirmed findings were fixed with a test or a story:

- **Backend.** A "this and following" reschedule of a started lesson with
  marks failed on the attendance foreign key; regeneration now keeps that
  lesson. A schedule an empty roster suspended vanished from the page and the
  list while still blocking a new one; it is now shown everywhere and a
  schedule set by PATCH on an empty group stays live, as on create. A teacher
  change left archived memberships with the old teacher and a returning
  student came back to them; every membership moves now and a reactivated one
  joins the group's teacher. A student restore could take teacher locks out
  of order across groups; it now pre-locks them in one sorted call. A group
  whose roster emptied while archived could be refused restore over lessons
  the restore suspends at once; the check now runs only with active members.
- **Web.** Any edit save of a group without its own teacher reassigned every
  upcoming lesson (the form compared against the record, not its own
  defaults). Lesson and package actions left the group page, metrics and
  attendance stale. Phones had no way to mark attendance; rows are now tap
  targets. The picker could show "no results" while unlinked students
  remained. Also fixed: a cancelled-then-repeated detail read after each link
  save, full group rows read just to name them in filters, attendance
  re-read on every rename, an archive confirmation that briefly said no
  lessons stop, unnamed weekday pickers, locale-fixed quotes, a share line
  that always warned, and hand-drawn loading cards and divider.

Declined: wrapping the rows view in `Card` — the `DataTable` rows wrapper is
the same one Students and Parents use; changing it belongs to a shared pass.

## Open product decisions

- The schedule-change confirmation dialog (how many lessons are rebuilt).
- Marking attendance on the lesson screen (Work Packet 6.4); the group page
  dialog is the interim path.
- Persisting the cards/rows choice — not persisted, like the students grid.
- Whether a full group should refuse a student; today capacity is
  informational.
