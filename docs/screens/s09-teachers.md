# S09 — Teachers

- Status: Done (2026-09-25, commits `14533a3`…`824e8f5` and the closing
  docs commit)
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

## Stories

Every board state is a story against the story backend (the handoff's
fixture, Wednesday 9 September, 16:00). The tablet (834, new in the
viewport toolbar) and phone (390) boards are the same stories at those
widths.

| Board · state                                      | Story                                                        |
| -------------------------------------------------- | ------------------------------------------------------------ |
| TeachersList 01 · Таблиця                          | `Teachers/Screens/Collection` Playground                     |
| TeachersList 02 · Картки                           | Cards (the table/cards switch, remembered)                   |
| TeachersList 03 · Власниця не викладає             | OwnerNotTeaching (`scenario: notTeaching`, «Я теж викладаю») |
| TeachersList 04 · Архів                            | Archive                                                      |
| TeachersList 05 · Лише власниця                    | OnlyOwner (`scenario: onlyMe`)                               |
| TeachersList 06 · Режим репетитора                 | TutorMode (`scenario: solo`)                                 |
| TeachersList 07 · Перехід у соло · не можна        | SoloRefused                                                  |
| TeacherProfile 01 · Профіль                        | `Teachers/Screens/Profile` Playground, MoreStudents          |
| TeacherProfile 02 · Вкладка «Розклади»             | SchedulesTab (with «Показати ще»)                            |
| TeacherProfile 03 · Мій профіль (власниця)         | OwnProfile (`teacher: olena`)                                |
| TeacherProfile 04 · Вимкнути викладання · наслідки | TurnTeachingOff                                              |
| TeacherProfile 05 · Архівувати · наслідки          | ArchiveWithTransfer (the hand-over and its overlap)          |
| TeacherProfile 06 · В архіві                       | ArchivedAndRestore (`archived: true`)                        |
| TeacherForm 01 · Новий викладач                    | `Teachers/Screens/Form` Playground, ColourChoice             |
| TeacherForm 02 · Предмети · вибір                  | SubjectsPopover (pick and create)                            |
| TeacherForm 03 · Помилка                           | NameMissing                                                  |
| TeacherForm 04 · Мій профіль (власниця)            | OwnProfile (`mode: own`), EditSaved                          |

`Shared/Page/PageHeader` NarrowColumn covers the header fix. Checked at
1440, 834 and 390, light and dark, Ukrainian and English; the collection,
the solo switch and its refusal, and the owner's profile were also checked
in the running app against the local database.

## Decisions taken while building (to confirm with the owner)

1. **Gender-neutral copy.** The boards say «Власниця студії», «Викладачка»,
   «Викладачку буде приховано»; the product cannot know a teacher's gender,
   so the pages say «Керує студією», «Викладає з …» and «Зникне з вибору
   викладача, історія збережеться» (as the S01 cancellation title).
2. **The table/cards switch follows the Groups page**: the Students switch
   is still disabled, so the working one was the model. The choice is
   remembered per browser, the table first. Below a desktop (`lg`, 1024 px)
   the list shows cards only and hides the switch, as the tablet and phone
   boards do.
3. **The hand-over defaults to a colleague** (the first active teacher who
   is not the owner; the owner only when nobody else teaches), with «Не
   передавати» in the same picker. Once someone is picked, the first line
   says «3 розклади перейдуть до Dmytro» instead of the board's «лишаться за
   Iryna», which is what happens without a hand-over.
4. **Overlaps with the new teacher** show under the picker with the S05
   `ConflictPairs` and the primary becomes «Все одно передати» (L-111).
5. **Directions and their billing stay with the archived teacher**; the
   hand-over moves the future lessons, the active schedules and the led
   groups (see Data 5).
6. **The switch to tutor mode** sits in the owner's ⋯ menu on the collection
   and on her profile, «Перейти в режим репетитора»; the refusal dialog is
   exported for the settings step (S10). «Перейти в режим студії» in the
   solo notice switches at once, with a toast.
7. **«Я викладаю» is a command, not a form field**: turning it off opens the
   consequences dialog, turning it on restores at once — on the profile and
   in the form alike. The card is shown only in studio mode.
8. **The owner who does not teach** is not listed or counted among the
   archived teachers: the tabs count the others (the board kept «Активні 5»).
9. **Readable colours**: the filled «next» lesson darkens the teacher's
   colour when white text would miss WCAG AA, or keeps it with dark ink
   (orange); `readableFill` in `lib/theme/user-colors`. The crown's gold is
   three theme tokens.
10. **Who teaches a subject** counts active teachers only (the board's
    «English · 3 викладачі»); a new teacher starts with the first colour no
    active teacher uses.
11. **An archived profile** keeps its metrics, groups, schedules (read-only),
    students and notes; no week, no editing, «Відновити» asks first. The
    owner's «Я теж викладаю» restores at once.
12. **«Відкрити в календарі»** opens the calendar on that week, filtered to the
    teacher (`?date=&teacher=`); «Нове заняття», «Новий розклад» and «Нова
    група» start with the teacher picked.
13. **Soft delete** (`DELETE /teachers/:id`) is not offered anywhere.

## Open questions

1. Should an archive with a hand-over also move the teacher's individual
   directions — their packages and debt — to the new teacher? A student who
   already has a direction with the new teacher would then have two.
2. Is the owner's ⋯ menu the right place for «Перейти в режим репетитора»
   until the settings step, or should it live only in settings?
3. Is the gender-neutral wording acceptable, or should the profile carry a
   form of address?
4. In tutor mode the owner cannot turn teaching off (the card is hidden):
   is that right, or should a solo tutor be able to stop teaching too?

## Out of scope

Teacher logins and permissions (the pilot is owner-operated); working hours
(L-121).
