# S09 — Teachers

- Status: In progress (mockups in, 2026-09-25)
- Work packet: 6.2
- Depends on: nothing (reuses the Students, Parents and Groups patterns)

## User job

Keep the studio's teachers: add one, see their week, workload, groups,
schedules and students, set their subjects, default rate and calendar colour,
archive and restore them — handing their future lessons to someone else — and
let the owner, who teaches too, stop teaching without leaving the studio.

## Routes

`/app/teachers`, `/app/teachers/[teacherId]`, `/app/teachers/new`,
`/app/teachers/[teacherId]/edit`. The navigation item «Викладачі»
(`GraduationCapIcon`) sits after «Батьки», owner only, studio mode only; the
page itself still answers in solo mode (the solo state below).

## Screens and dialogs

1. **Collection**: the table and the cards (toggle as on Students), status
   tabs with counts, subject filter, search, sort; the owner first with «Ви»
   and the crown; the «Власниця не викладає» row; the only-owner card; the
   solo notice; the solo refusal dialog.
2. **Profile**: the tinted header with the background circles, four metrics,
   «Тиждень», the tabbed card «Групи» / «Розклади», «Учні», the owner's
   «Викладання» card, notes; the archived state with «Відновити».
3. **Form** (full page, as students and parents): avatar and name, contacts,
   «Викладання» (the owner's «Я викладаю», subjects, rate and currency,
   colour with the calendar preview), bio and notes.
4. **Archive** and **turn teaching off**, with their consequences and the
   transfer picker; **restore**.
5. **Solo mode**: the owner is the only teacher; switching to solo is refused
   while a second active teacher exists (`SOLO_MODE_SINGLE_TEACHER`).

## Rules

[`product/scheduling.md`](../product/scheduling.md) L-40 (substitution) and
L-110 / L-111 (teacher conflicts, «save anyway»); ADR 0004 (owner-operated
pilot).

## Reuse

`PageHeader`, `Segmented`, `FilterPill`, `SearchField`, `DataTable`,
`EmptyState`, `StatBlock`, `GroupCard`, `NotesCard`, `Notice`,
`AdaptiveDialog`, `ImpactList`, `EntityPicker`, `FormPageLayout`,
`SectionNav`, `SectionChips`, `ProgressMeter`, `AvatarPicker`, `TextField`,
`EntityAvatar`, `IconButton`.

## Mockups

The owner's handoff `tutorio-s09-teachers`: board 01 «TeachersList» (7
desktop states, 3 tablet, 3 phone), board 02 «TeacherProfile» (6 states on
each width), board 03 «TeacherForm» (4 desktop, 4 phone), at 1440, 834 and
390, light and dark, with the canvas source. The fixture is Kyiv English
Studio on Wednesday 9 September 2026; the owner Olena Kovalenko teaches too.
The repository does not keep mockups.

## Decisions (the owner's, from the handoff)

1. **The owner is a teacher too.** Registration creates her teaching profile
   (`isMe`). She is listed first with «Ви» and a gold crown over her avatar.
   «Я викладаю» on her profile and form turns teaching off; she then leaves
   the teacher picker, and the list shows the «Я теж викладаю» row.
2. **Colour is identity.** The teacher's calendar colour tints the card band,
   the profile header, the avatar ring and the week blocks. The background
   circles are the shared motif.
3. **The profile is about the week and the workload**, not billing: no
   package information anywhere on the teacher pages.
4. **Groups and schedules share one tabbed card**, groups first.
5. **Lists are loaded, not linked away**: students and schedules open fully
   on the profile with a scroll region and «Показати ще».
6. **Archive and «turn teaching off» ask where the future lessons go**: the
   other teachers or «Не передавати». History never changes.
7. **Solo mode** shows one teacher and an info notice. The switch to solo is
   refused with a plain explanation, without naming the teachers.
8. **The table/cards toggle** works like the Students page.

The brief's open question — does a teacher have a login in the pilot? — is
answered: **no, a teacher is a profile only** (ADR 0004); the owner's own
profile is the one teacher bound to a login (`isMe`).

## Data (answers to the handoff's section 4)

1. **Subjects**: `subjects` (up to 20 free-text names of up to 60
   characters, deduplicated without case) is in the teacher response, create
   and update; an update without `subjects` keeps them (it used to erase
   them). The popover's studio subjects and who teaches each are derived from
   the teachers list — no new read. The list search matches subjects too, and
   `subject=` filters by one.
2. **List counts**: each list item carries `studentCount` (distinct students
   with a live direction or group membership taught by the teacher),
   `groupCount` (live groups led) and `week` — this studio week's lessons that
   are not cancelled, in total and per day, Monday first. The response carries
   the tab `counts` and `me`, the caller's own profile whatever the filters.
   `sort=workload|name|created`; the caller's own profile always comes first.
3. **Profile metrics**: new `GET /teachers/:id/summary` — hours of lessons
   that are not cancelled per studio week for the last six weeks («13 год», «у
   середньому 11 год»), students in total, individually and in groups, groups
   led, and this studio month's held lessons, no-shows («1 пропуск») and
   lessons the students cancelled («ще 2 скасували учні»). The week block reads
   the calendar range `GET /lessons?teacherId=&from=&to=`.
4. **Students of a teacher**: new `GET /teachers/:id/students` (paginated,
   by name): the student with the language level, the subject, whether they
   study with the teacher individually and the teacher's groups they attend.
   A dedicated read rather than a `teacherId` filter on `GET /students`: the
   level and «індивідуально / група Kids A2» are relative to the teacher.
5. **Archive transfer**: new `POST /teachers/:id/archive/preview
{ transferTo? }` (the consequences: active schedules, future lessons with
   the last date, students and groups; with `transferTo` the new teacher's
   overlaps) and `POST /teachers/:id/archive { transferTo? }` (`?force` after
   conflicts). A transfer hands over, after a clash check against the new
   teacher's calendar (L-110; students do not change, so only teacher
   overlaps count), the future scheduled lessons, the active schedules (the
   rule in force and a planned one) and the groups the teacher leads (with
   their members). Without a transfer the schedules keep generating lessons
   for the archived teacher, as the dialog warns. Archive sets
   `status = ARCHIVED` and the new `archivedAt`; the profile stays readable;
   `POST /teachers/:id/restore` makes an archived profile active again (solo
   check) as well as undeleting a soft-deleted one.
6. **Turning teaching off** is the same archive command on the caller's own
   profile (`isMe`), with the same transfer. The caller's own profile is never
   listed among the archived teachers nor counted there — it comes back as
   `me`, and the list shows the «Я теж викладаю» row, which restores it.
7. **Navigation**: «Викладачі» after «Батьки», owner only, studio mode only,
   `nav.teachers` in uk and en.

## Decisions taken while building (to confirm with the owner)

(Filled in as the step is built.)

## Out of scope

Teacher logins and permissions (the pilot is owner-operated); working hours
(L-121).
