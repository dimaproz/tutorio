# S02 — Lesson Create Form

- Status: Done (2026-09-24, commits `6b9d8cd`…`6c237a3`)
- Work packet: 6.4 (screens)
- Depends on: S01 (the conflict dialog)

## User job

Book a lesson for a student or a group — once, on several dates, in the past
(to record what already happened), or repeating (which creates or extends the
direction's schedule).

## Entry points

- "Add lesson" on the student profile (the lessons section's action) and the
  group page (the lessons card's header action) — this step.
- Later: a click or drag on the calendar (S03) prefilling date, time and
  duration (`LessonCreateDialog` takes `initial.dates` and
  `initial.durationMin` for it); the Lessons list (S04).

## Screens and dialogs

1. **Lesson form** (dialog; full-screen sheet on phones): student or group,
   teacher (prefilled from the direction; hidden in solo mode), date and time
   — one or more dates, duration, price (prefilled from the student's rate
   with that teacher or the group price, L-11), topic, notes.
2. **Past lesson**: a date in the past offers held (default), cancelled or
   no-show (L-31).
3. **Repeat** toggle: weekdays with a time each, "from" date, optional end;
   when the direction already has a schedule the form shows what the schedule
   becomes and adds the day to it (L-20, L-23).
4. **Conflict dialog** from S01 on save (L-111).

## Data available

- `POST /lessons` — `studentId`, `enrollmentId` or `groupId`, `teacherId`,
  `startsAt[]` (up to 50), `durationMin`, `priceMinor`, `currency`, `status`
  (`?force=true` after a conflict). A student without a direction with that
  teacher gets one, paid per lesson until a package is sold (L-10).
- Repeat: `POST /schedules/preview` and `POST /schedules` (new) or
  `POST /schedules/:id/changes/preview` and `POST /schedules/:id/changes`
  (add a day to the existing one);
  `GET /schedules?studentId=&teacherId=` or `?groupId=` to find it.
- Pickers: `GET /students`, `GET /groups`, `GET /teachers`.

## Rules

L-2, L-3, L-10, L-11, L-12, L-20…L-23, L-30, L-31, L-82, L-110, L-111.

## Reuse

`AdaptiveDialog`, `EntityPicker`, `WeekdayPicker`, `TextField`, `Segmented`,
`Notice`, the S01 conflict dialog.

Built with: the S01 window (`LessonPanelWindow`, now layout A with
`LessonWindowLayout`), `TintBand`/`BandHeader`, the band picker (`WhoTiles`,
`WhoEmptyCard`, `WhoSearch`, `WhoCard`, `WhoChip`, `AvatarStack`),
`EntityPicker` (rich rows, locked) as the teacher field with `FieldNote`
strips, `DateRowsField` with `TimeField`, `DurationField`, `PriceField`,
`WeekdayPicker` (`pills` + `fill`), `DateField`, `ChoiceCardGroup`,
`Segmented`, `Notice` (callout), `ImpactList`, `CreditMeter` (`inline`),
`Badge`, and the S01 conflict dialog through `useConflictGuard`. New shared
patterns, each with a story and a registry row: `TimeField`, `DurationField`,
`DateRowsField`, `PriceField`, the band picker, `FieldNote`, `TintBand`
(`RingsArt`); `TextField` exposes `FieldFrame` and gains `labelAction` and
`locked`.

## What the mockups must show

- [x] Form for a student, for a group, with several dates.
- [x] Past date with the status choice.
- [x] Repeat on, for a direction without a schedule and with one (the
      "schedule becomes" summary).
- [x] Validation errors; solo mode without the teacher field.
- [x] Phone version.

## Out of scope

Editing a schedule on its own (S05); packages (S07).

## Mockups

The owner's handoff `tutorio-s02-lesson-create`: board 01 «NewLesson» (15
states), the four field boards, and the changed S01 boards (01 Main, 02
PanelGroup, 03 PanelEdit with a new group state, 07 Makeup), desktop 1440 and
phone 390, light and dark, with the canvas source of every board. The repository does not keep mockups.

| NN  | State                    | Story (`Lessons/Screens/NewLesson`)     |
| --- | ------------------------ | --------------------------------------- |
| 01  | Учень · одна дата        | Playground (`state: studentOneDate`)    |
| 02  | Учень · кілька дат       | SeveralDates                            |
| 03  | Пакет не покриє всі дати | PackageRunningOut                       |
| 04  | Група                    | Group                                   |
| 05  | Порожня форма            | Playground (`state: emptyForm`)         |
| 06  | Вибір учня               | PickStudent                             |
| 07  | Інший викладач           | OtherTeacher                            |
| 08  | Час — список             | TimeList (phone: the time sheet)        |
| 09  | Тривалість — своя        | CustomDuration (phone: the quick chips) |
| 10  | Дата в минулому          | PastDate                                |
| 11  | Щотижня · новий розклад  | WeeklyNewSchedule                       |
| 12  | Щотижня · розклад уже є  | WeeklyExistingSchedule                  |
| 13  | Помилки                  | Errors                                  |
| 14  | Соло-режим               | Solo                                    |
| 15  | Конфлікт при збереженні  | ConflictOnSave                          |

The field boards are the stories `Shared/Form/TimeField`,
`Shared/Form/DurationField`, `Shared/Form/WhoPicker` (13 states),
`Shared/Form/EntityPicker` (`teacherField`), `Shared/Form/PriceField` (9
states), `Shared/Form/DateRowsField` and `Shared/Form/FieldNote`; the S01
boards are `Lessons/Screens/Panel` (layout A, with the new `EditGroup`).
Every state was checked in the browser at 1440 and 390, light and dark,
Ukrainian and English.

## Decisions (with the owner, from the handoff)

1. **Several dates are a list of rows**, not a calendar multi-pick: each row
   is a date field, its own time and remove.
2. **«Щотижня» lives in this form**: a «Разово / Щотижня» segment next to
   «Коли» swaps the rows for weekday pills, a time per selected day, and «З»
   / optional «До».
3. **Layout B, the colourful header**: one 640px column; the `tint-indigo`
   band holds the title with close on the right, «Учень / Група» tiles as
   tabs, and the picked student or group as a white card. Below: teacher,
   «Коли», length + price, the state's extras, topic/notes; the footer holds
   the result and the actions.
4. **S01 uses the same family, layout A** (see the S01 brief).
5. **Close is always top-right.**
6. **Time and length are comboboxes**: any value can be typed; the list only
   suggests.
7. **Topic and notes are collapsed** behind «Додати тему» / «Додати нотатки».
8. **The footer shows the result before saving**, and the primary label says
   the same («Створити 3 заняття», «Записати заняття», «Створити розклад»,
   «Додати до розкладу»).
9. **The package balance is a `CreditMeter` pill** («5 з 8 у пакеті»), with
   the schedule as a pill with a `Repeat` icon.
10. **`CreditMeter` colours changed in the component**: credits left
    `bg-brand`, used `bg-tint-foreground/15`, running out `bg-danger-mark`;
    the students table picks them up.
11. **Badges on the white card are filled** (`indigo`); a group card fits one
    line (a members pill with the full count as its name, the paused count,
    the price per member).

The brief's open questions are answered by decisions 1 and 2: rows, not a
calendar multi-pick; «Щотижня» lives in this form and never opens S05.

## Conflicts with the contract (decided for the contract; for the owner's confirmation)

- **Lessons past the last credit go on the package's debt (L-82)**, not
  "one-off at 500 ₴" as state 03 reads: the note says «решта підуть у борг
  пакета, їх покриє наступний пакет», the price hint «1-ше — з пакета, решта
  — у борг пакета» and the footer «1 з пакета + 2 у борг» (the S01 payment
  card says the same).
- **The group price is shown, locked.** State 04 draws an editable «Ціна з
  учасника», but each member is charged their own rate — the group price or
  their override (L-11) — and the lesson's price has no effect on it; the
  S01 edit hides it for the same reason. The field shows the group price
  with the board's hint.
- **Another teacher is a substitute on the student's direction** (state 07,
  «лише для цих занять»): the lessons go to the direction (`enrollmentId`)
  with that teacher, priced at the teacher's own rate for a per-lesson
  direction and a credit for a package one. A teacher the student already
  has a direction with books into that direction instead. Only a student
  with no direction at all gets a new one for the picked teacher (L-2,
  L-10).
- **Length 5–480 minutes** in the form (the board's «Від 5 хв до 8 год»);
  the API accepts up to 720.

## Decided while building (for the owner's confirmation)

- **Days added to an existing schedule keep its end**: a schedule change has
  no end date, so «До» is not offered in that mode; the length of the change
  is the schedule's (prefilled) and applies to the whole schedule (L-25).
- **Busy slots** mark the times that start while another lesson of the
  teacher, the student or the student's groups is on (the board's 18:00 and
  18:30 for an 18:00–19:30 lesson); the row's overlap hint and the busy
  teacher warning check the new lesson's whole length. None of them blocks:
  the conflict dialog decides on save.
- **Past dates with dates ahead** save as two bookings: the dates ahead as
  scheduled, the past ones with the chosen outcome. A cancelled past lesson
  asks who cancelled (student or teacher; group or teacher) and whether to
  charge it. A group has no no-show (L-31, L-71).
- **«+ Новий учень» opens the student create page**: there is no student
  quick-create dialog to open in place, and the page takes no name to
  prefill. «+ Нова група» opens the group create page.
- **The teacher's hint** reads «Веде напрям Anna» and a new direction
  «Перше заняття з цим викладачем відкриє напрям — оплата за заняття».
- **Phone**: the band and the body scroll together with the footer pinned;
  the card's meta keeps the level code only («B2 · з Dmytro Tutor»); the
  length's quick chips sit under the field.

## Data (answers to the handoff's section 6)

1. **Busy slots and a busy teacher**: `GET /lessons?from=&to=` — every lesson
   of the days the rows cover — drives the time lists' marks, the teacher
   list's «Зайнятий о 17:00», the row's overlap hint and the busy teacher
   warning (L-110).
2. **«як зазвичай»**: the direction's or group's schedule length
   (`GET /schedules?studentId=&teacherId=` / `?groupId=`); it also prefills
   the length while it is untouched. Without a schedule there is no chip.
3. **«Недавні» students**: `GET /students` has no recency order, so the list
   is headed «Учні» and sorted by name.
4. **Rate per student and teacher (L-11)**: `GET /students/:id/billing` gives
   each direction's teacher, mode, rate and packages; a substitute's rate is
   the teacher's own (`GET /teachers`); a new pair follows the domain's
   default price (the student's rate, else the teacher's). The package total
   and name come from `GET /packages/:id`.
5. **Paused members**: `GET /pauses?state=current` gives each pause's end
   («на паузі до 12 жовтня»); a member on hold without a pause read counts as
   paused without a date. «Візьмуть участь 5 з 6» shows only when someone is
   paused.
6. **The first lessons of a new schedule and «Конфліктів немає»**:
   `POST /schedules/preview` (added 2026-09-25 at the owner's request) takes
   the create body and answers what `POST /schedules` would do, writing
   nothing: the lessons generated at once, the first one, an active schedule
   of the same direction or group, and the teacher or student overlaps. A
   student without a direction with the teacher is checked as that student,
   and no direction is opened. «Що буде» shows its count and «Конфліктів
   немає» or the overlaps while the form is filled in; until it answers the
   count is worked out locally from the studio's horizon
   (`scheduleHorizonWeeks`, L-120). The save still checks again and opens the
   conflict dialog (L-111). Days added to an existing schedule take the
   change preview's `created` and conflicts.

## Open questions (left out rather than invented)

- **Search rows' «рівень · напрям з викладачем» and «Разово · 400 ₴»**: the
  student list read has neither the level nor the direction's teacher and
  rate. The rows show the phone or @telegram, the package from
  `GET /packages` (first 100 active) and the pause.
- **Subjects** («English», «English · Deutsch» in the teacher list and the
  card's meta): no teacher or direction carries a subject. The regular
  teacher's row says «викладач Anna» instead.
- **The price field's error on the errors board** (state 13 shows «−50» with
  nothing picked): the price is editable only once a student is picked, so
  the errors story shows the missing student and date; the price error is in
  `Shared/Form/PriceField`.
- **Dates are the browser's wall clock** (as every form, `lib/datetime`)
  while the app shows times in the studio's zone: a browser outside the
  studio's zone sees the edit form and the busy marks shifted.
