# S05 — Schedules

- Status: Done (2026-09-25, commits `8dfe70f`…`395ac42`)
- Work packet: 6.4 (screens)
- Depends on: S02 (the form language), S04 (navigation)

## User job

See every recurring schedule of the studio, create one, change its days and
times from a date knowing exactly which lessons move, and stop it.

## Route

`/app/schedules`, its own page and navigation item («Розклади»,
`RepeatIcon`, after «Заняття»; under «Ще» on phones). The schedule form and
its dialogs are shared: the student profile (S06) and the group page (S08)
open them too.

## Screens and dialogs

1. **Schedules list**: who (student or group), teacher, slots ("ВТ 18:00"
   chips with the length), state with a caption (since, until, the planned
   change), the next lesson and how far ahead lessons are booked; state tabs
   (active, with a change, ended, all) with counts, teacher, student or
   group, type; search; sort.
2. **Schedule form** «Новий розклад»: student or group, teacher, weekdays
   each with its own time, one duration, the horizon (studio default 4
   weeks), the first lesson and an optional end (L-20…L-22); a check step
   with the dates and the conflicts.
3. **Change** «Змінити розклад»: the form with «Зміни діють з» (default
   today), then the consequences — moved, removed, created, untouched, lost
   topics and notes, conflicts (L-25…L-27).
4. **Stop** «Зупинити розклад»: from a date, removed and kept lessons (L-24).
5. **Horizon** «Заняття наперед» (weeks ahead).

## Data available

- `GET /schedules?state=&teacherId=&studentId=&groupId=&kind=&search=&sort=`
  — paged with `counts`; `slots`, `nextChange`, `nextLessonAt`,
  `lastLessonAt`, `startsAt`, `horizonWeeks`, `endsAt`, `state`.
- `POST /schedules/preview` (`created`, `dates`, `firstLessonAt`,
  `existingScheduleId`, `conflicts`), `POST /schedules` (`?force=true`),
  `GET /schedules/:id`, `PATCH /schedules/:id` (horizon),
  `POST /schedules/:id/horizon/preview`.
- `POST /schedules/:id/changes/preview` and `/changes`,
  `POST /schedules/:id/stop/preview` and `/stop` — counts with `moves`,
  `removals`, `creates`, `keptLessons`, `notesLost`, `conflicts`.
- Errors: `SCHEDULE_EXISTS` (one active per direction and per group),
  `SCHEDULE_ENDED`, `SCHEDULE_CONFLICT`.

## Rules

L-20…L-27, L-110, L-111, L-120.

## Reuse

`CollectionFrame`, `DataTable`, `Segmented`, `FilterPill`, `StatusBadge`,
`WeekdayPicker`, `TimeField`, `DurationField`, `DateField`, `TextField`,
`EntityPicker`, `AdaptiveDialog`, `Notice`, `ImpactList`, `DateTile`, the S02
band and weekly fields, the S01 conflict wording.

## What the mockups must show

- [x] List on desktop and phone, with an ended schedule and a planned change.
- [x] Form with different times per day; "a schedule already exists" state.
- [x] Change preview with moved and removed lessons, lost notes, a conflict.
- [x] Stop preview.
- [x] Empty, loading, error.

## Out of scope

Package sale (S07); group-specific schedule presentation (S08 reuses this
step's form and dialogs).

## Mockups

The owner's handoff `tutorio-s05-schedules`: boards «SchedulesList» (9
desktop states, 11 phone states), «ScheduleForm» (6 states) and
«ScheduleChange» (7 states), 1440 and 390, light and dark, with the canvas
source. The repository does not keep mockups.

| NN               | State                          | Story (`Schedules/Screens/Schedules`)          |
| ---------------- | ------------------------------ | ---------------------------------------------- |
| List 01          | Активні                        | Playground                                     |
| List 02          | Зі змінами                     | ChangingTab                                    |
| List 03          | Завершені                      | Ended                                          |
| List 04          | Меню рядка                     | RowMenu                                        |
| List 05          | Нічого не знайдено             | NoResults                                      |
| List 06          | Ще немає розкладів             | Empty                                          |
| List 07          | Завантаження                   | Loading                                        |
| List 08          | Помилка                        | LoadError                                      |
| List 09          | Соло-режим                     | Solo                                           |
| Form 01          | Новий · учень                  | NewForStudent                                  |
| Form 02          | Новий · група                  | NewForGroup                                    |
| Form 03          | Розклад уже є                  | NewExists                                      |
| Form 04          | Помилки                        | NewErrors                                      |
| Form 05          | Перевірка · нові заняття       | NewCreate                                      |
| Form 06          | Перевірка · накладки           | NewConflicts                                   |
| Change 01–03, 07 | Зміна · форма, наслідки, після | Change                                         |
| Change 04        | Зміна · накладка               | ChangeConflict                                 |
| Change 05        | Зупинка                        | Stop                                           |
| Change 06        | Заняття наперед                | Horizon                                        |
| Phone 01–11      | Cards, form, sheets            | PhoneList, PhoneNew (and the viewport toolbar) |

Checked at 1440 and 390, light and dark, Ukrainian and English.

## Decisions (with the owner, from the handoff)

1. **Own page and navigation item** «Розклади» (`/app/schedules`) after
   «Заняття»; under «Ще» on phones. The brief's route
   `/app/lessons/schedules` is dropped.
2. **List = table** (chosen over a week strip and cards): slots are chips
   «ВТ 18:00» with the length under them; the state with a caption; the next
   lesson with «заплановано до <date>».
3. **Change is two steps**: form, then consequences (the brief's open
   question).
4. **Conflicts always name what they overlap**: each conflicting date shows
   the new lesson and the existing one side by side, the teacher named in the
   explanation.
5. **«Already exists»** is a warning callout inside the form with «Відкрити
   розклад» as its action (`Notice`); «Далі» is disabled.
6. **Dates in the check step** are cards with `DateTile`, the time and the
   month in the nominative.

## Data (answers to the handoff's section 4)

1. **Tab counts, «Тип», search and sort**: added to `GET /schedules` in this
   step (with API tests): `state=CHANGING` (active with a change planned),
   `counts` (active, changing, ended, all, with the other filters applied),
   `kind` (individual or group), `search` (student, group or teacher name)
   and `sort=next` (by the next lesson).
2. **«заплановано до <date>»**: `lastLessonAt`, the last lesson booked; the
   caption «з 1 вер» reads `startsAt`. Avatars and «Група · 6 учнів» read
   `student.avatarKey` and `group.memberCount`, added too.
3. **Header subtitle**: `counts` and this week's lessons (the Lessons list
   read for the current week, one row).
4. **The dates of a new schedule**: `POST /schedules/preview` returns them
   (`dates`), computed as the create would.
5. **The package line** of the check step: the student billing read the
   form already uses.
6. **Dates of moved, removed and kept lessons**: the change and stop
   previews return `moves`, `removals`, `creates` and `keptLessons` (with
   why each is kept: held, cancelled, no-show, moved by hand, marked).
7. **Horizon**: `POST /schedules/:id/horizon/preview` saves the horizon in a
   transaction it rolls back and returns the lessons it would add and the
   last lesson booked then.
8. **Conflict pairs**: the conflicts carry the candidate time, the teacher,
   the student or group and the booked lesson's time.

## Decided while building (for the owner's confirmation)

- **The dialogs live in `@/features/lessons`** next to the lesson form whose
  band and weekly block they reuse; the page is `@/features/schedules`.
- **A new schedule starts next Monday** (today on a Monday), with the studio's
  horizon; the price comes from the direction or the group (no price field).
- **«Відкрити розклад»** in the «already exists» callout opens that schedule's
  change dialog.
- **The page sorts by the next lesson by default**; «Спочатку нові» is the
  other order. Ended rows are dimmed and show «—» for the next lesson.
- **«38 занять цього тижня»** counts every lesson of the current week, not
  only the schedules' ones.
- **Row click does nothing**; the row menu carries the actions (as on the
  board).
- **A change from today** says «З сьогодні: минулі заняття не зміняться»; a
  later date says «Заняття до … не зміняться».
- **The planned change caption** lists every weekday it touches («ВТ 17:00 →
  18:00», «+ СР 16:00», «− ПТ 18:30»).

## Open questions

- The «ВЖЕ Є · ВІДПРАЦЮВАННЯ» label of a conflict pair needs the booked
  lesson's kind in the conflict; the pair says «Вже є».
- The phone form stacks «Перше заняття з» and «До» on the board; they stay
  side by side as in the lesson form.
