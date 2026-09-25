# S03 — Calendar

- Status: Done (2026-09-25, commits `3a4d5cd`…`8bbeb91`)
- Work packet: 6.4 (screens)
- Depends on: S01 (panel), S02 (create form)

## User job

See the studio's lessons in time, find a free slot, book by clicking, move by
dragging, and open any lesson.

## Route

`/app/calendar` — the first navigation item (sidebar and phone tab bar,
`CalendarDaysIcon`). `?lesson=<id>` opens the S01 panel over it.

## Screens and dialogs

1. **Week view** (default on desktop), **day view** (default on phones),
   **month view**; the choice is remembered per browser (page map), phone and
   desktop apart.
2. **Filters**: teacher, status; "today", previous and next.
3. **Event**: time, student or group, type colour, status (held,
   cancelled, no-show, makeup), unpaid mark, the teacher when several show.
4. **Click or drag on empty time** opens the S02 form prefilled.
5. **Drag an event** to move it: a schedule lesson asks "this lesson only /
   this and following" (S01 move scope dialog); conflicts show the S01
   conflict dialog.
6. Empty week, loading, error.

## Data available

- `GET /lessons?from=&to=` — the period's lessons with student (with
  `avatarKey` since this step), group, teacher colour, kind, topic and each
  charge's `paid`. The calendar reads every teacher's lessons of the period
  and filters on the client, so the filters can count.
- Move: `PATCH /lessons/:id/reschedule` (`scope`, `?force=true`), preview
  through `POST /schedules/:id/changes/preview`; the drop reads
  `GET /lessons/:id` for the schedule and `GET /schedules/:id`.
- `GET /teachers` for the filter; `GET /lessons/list?from=&status=SCHEDULED&
order=asc&pageSize=1` for the next lesson after an empty period.

## Rules

L-30, L-40, L-41, L-42, L-110, L-111, L-121; page map "Calendar".

## Reuse

`PageHeader` (new `md` size), `Segmented`, `FilterPill`, `IconButton`,
`EntityAvatar`, `EmptyState`, `ImpactList`, `Badge`, `Popover`, `Drawer`,
`Checkbox`, `Switch`, `useStoredChoice`, the S01 panel, move scope and
conflict dialogs (through `useLessonMove` from `@/features/lessons`), and the
S02 form. The grid is custom (no calendar library).

Built in `features/calendar`: `CalendarEvent`, `CalendarTimeGrid` with
`useGridPointer`, `CalendarMonthGrid` and `CalendarMonthDots`,
`CalendarWeekStrip`, `CalendarDaySide`, `CalendarDayLine`, `CalendarAgenda`,
`CalendarToolbar`, `CalendarPhoneBar`, `TeacherFilterMenu`,
`StatusFilterMenu`, `CalendarFilterSheet`, `CalendarLegend`, and the state
cards, each with stories and a registry row. Tokens: `lesson-group`,
`lesson-makeup` (with dark values) and `hatch`; utilities `lesson-*` and
`bg-hatch`. `inkOn` picks the readable ink on a teacher's colour.

## What the mockups must show

- [x] Week with overlapping lessons, a long lesson, a cancelled and a makeup.
- [x] Day view on the phone, and navigation between days.
- [x] Month view with more lessons than fit in a day cell.
- [x] Dragging feedback and the drop onto a conflict.
- [x] Empty week, loading, error.
- [x] Dark theme (teacher colours on dark).

## Out of scope

Teacher working hours (L-121); the Lessons list (S04).

## Mockups

The owner's handoff `tutorio-s03-calendar`: board «Календар» (14 desktop
states) and «Телефон — календар» (8 phone states), 1440 and 390, light and
dark, with the canvas source. The repository does not keep mockups.

| NN       | State                       | Story (`Calendar/Screens/Calendar`)                      |
| -------- | --------------------------- | -------------------------------------------------------- |
| 01       | Тиждень                     | Week                                                     |
| 02       | Тиждень · кілька викладачів | SeveralTeachers                                          |
| 03       | Фільтр статусу              | StatusFilter                                             |
| 04       | Перетягування               | Dragging (DragCancelled for Esc)                         |
| 05       | Перетягування на перетин    | DraggingOntoConflict                                     |
| 06       | Лише це чи наступні         | MoveScope                                                |
| 07       | Перетин після перенесення   | MoveConflict (MoveWithUndo for a plain move)             |
| 08       | Клік по вільному часу       | PickSlot                                                 |
| 09       | День                        | Day                                                      |
| 10       | Місяць                      | Month                                                    |
| 11       | Місяць · «+ ще»             | MonthMore                                                |
| 12       | Порожній тиждень            | EmptyWeek                                                |
| 13       | Завантаження                | Loading                                                  |
| 14       | Помилка                     | LoadError                                                |
| Phone 01 | День                        | PhoneDay                                                 |
| Phone 02 | Вільний день                | PhoneFreeDay                                             |
| Phone 03 | Тиждень · список            | PhoneWeek                                                |
| Phone 04 | Місяць                      | PhoneMonth                                               |
| Phone 05 | Фільтри                     | PhoneFilters                                             |
| Phone 06 | Перетягування               | the same grid (long press); covered by the desktop drags |
| Phone 07 | Завантаження                | PhoneLoading                                             |
| Phone 08 | Помилка                     | PhoneError                                               |

The patterns have their own stories under `Calendar/Patterns/CalendarEvent`
(the event in every variant and state, the time grid, the month grid, the
phone parts, the day side panel, the agenda and the legend). Checked in the
browser at 1440 and 390, light and dark, Ukrainian and English.

## Decisions (with the owner, from the handoff)

1. **Hours.** Week and day show 08:00–21:00 without scrolling at 1440×960;
   earlier and later hours scroll. The day view opens an hour before its
   first lesson.
2. **Cancelled lessons are shown, muted**: grey hatching, a grey bar, the
   time struck through; «Статус» can hide them.
3. **Colour means lesson type**: individual `brand`, group `lesson-group`
   (teal), makeup `lesson-makeup` (orange).
4. **The fill means time**: upcoming white with a 1.5px type border, past
   filled at 14%, cancelled hatched, running filled with a 2px border and a
   pulsing dot.
5. **Marks**: `CircleCheck` held, `UserX` no-show, `RotateCcw` makeup,
   `Users` before a group, the orange «₴» unpaid (a charge not paid).
6. **Several teachers**: the colour stays the type; the teacher's initials
   in their colour on the time row, and a teacher legend under the grid.
7. **The teacher filter shows the selection**: one teacher as avatar and
   name, several as «Викладачі» with a count.
8. **Phone**: day by default, the week as an agenda, the month as dots with
   the day's list, filters in a sheet, new lessons from the «+» button.
9. **Navigation**: «Календар» first in the sidebar and the tab bar.

The brief's open questions are answered by decisions 1 and 2.

## Decided while building (for the owner's confirmation)

- **The calendar opens on the owner's own lessons** (the teacher profile
  with `isMe`); with none, on everyone. The teacher filter is hidden in a
  studio with one teacher.
- **Only a scheduled lesson moves** (L-40); a held, missed or cancelled one
  opens the panel on click and does not lift.
- **A drop opens the scope dialog on «Лише це заняття»** (the board's
  choice), while the panel's edit keeps «Це і наступні».
- **The undo toast is for a plain move**; a schedule lesson's move ends with
  a confirmation toast only.
- **Times are a 24-hour clock in both locales** and read in the browser's
  zone, the clock the grid places lessons by (the forms' known zone issue
  applies: a browser outside the studio's zone sees its own wall clock).
- **Free windows** in the day summary are the gaps of 30 minutes or more
  between the day's lessons; nothing before the first or after the last
  lesson, since working hours are out of scope (L-121). The board's
  «Вільно 10:00–15:00» before the first lesson is left out; the phone line
  names the first gap.
- **Status counts**: a makeup counts under its status and under
  «Відпрацювання»; hiding either hides it. The pill's number is the lines
  left on (plus «Лише не оплачені»).
- **Keyboard**: ←/→ step the period, T goes to today, Esc cancels a drag;
  every card is a button named by its time, name, type and status.

## Data (answers to the handoff's section 4)

1. **Makeup kind and topic**: in the list response (`kind`, `topic`).
2. **Status counts**: counted on the client from the period's lessons.
3. **«Найближче заняття» / «до наступного заняття»**: the Lessons list read
   (`GET /lessons/list?from=<periodEnd>&status=SCHEDULED&order=asc&
pageSize=1`), for the selected teacher when there is one.
4. **Free windows**: computed on the client between the day's lessons (see
   above).
5. **Remembered view**: `useStoredChoice` (`tutorio.calendar.view`,
   `tutorio.calendar.view.phone`).

The day view's avatars needed the student's avatar in the lesson list:
`student.avatarKey` was added to the lesson response (API, validation,
client).

## Open questions (left out rather than invented)

- **The phone's first-time hint strip** for the long press: not built; the
  drag hint shows while a lesson is lifted.
- **Moving a lesson by keyboard**: not offered on the grid; the panel's
  edit moves it.
- **Free time before the first lesson**: needs teacher working hours
  (L-121).
