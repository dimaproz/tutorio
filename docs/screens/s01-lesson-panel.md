# S01 — Lesson Side Panel and Lesson Actions

- Status: Done (2026-09-24, commits `effab27`…`1d5c771`)
- Work packet: 6.4 (screens)
- Depends on: nothing; opened first from the lesson lists already on the
  student profile and the group page

## User job

Open any lesson and do everything that concerns it: see when, who, with which
teacher, whether it is paid; mark it held, cancelled or missed; change its
time, length, teacher, price or topic; assign a makeup; mark who came to a
group lesson.

## Entry points

- A lesson row on the student profile and the group page (`LessonList`
  `onSelect`) — this step.
- Later: the calendar (S03) and the Lessons list (S04).
- Deep link: `?lesson=<id>` on the page that opened it; phone: a full-screen
  sheet.

## Screens and dialogs

1. **Side panel** (sheet on phones): date and time, duration, teacher, student
   or group, status, kind (regular or makeup), topic, notes, price, the charge
   of each participant and whether it is paid, the makeup or the original it
   replaces, the schedule it comes from, history.
2. **Cancel dialog**: who cancelled (student, teacher), a reason, and "charge /
   do not charge" pre-selected by the deadline suggestion (L-51).
3. **Status corrections** for a past lesson: held ↔ cancelled ↔ no-show
   (L-53); no return to "scheduled" after the end.
4. **Edit**: date and time, duration, teacher (substitution), price (only while
   unpaid), topic, notes (L-40, L-12).
5. **Move scope dialog** for a schedule lesson: "this lesson only" or "this
   and following" with the consequence numbers (L-41, L-25).
6. **Makeup dialog**: date and time, optional other teacher and duration,
   topic (L-60, L-61); only for a cancelled or missed individual lesson.
7. **Attendance** of a group lesson: present / absent / excused per member,
   "everyone came", paused members shown "on pause" and not markable
   (L-71…L-74). Replaces the interim attendance dialog of the group page.
8. **Delete** a lesson with no charges (a charged one must be cancelled free
   first).
9. **Conflict dialog** shared by edit, move and makeup: what overlaps (teacher
   or student), "Save anyway" (L-110, L-111).

## Data available

- `GET /lessons/:id` — the lesson, `charges[]` with `source` and `paid`,
  `original`, `makeup`, `schedule`, `history[]` (audit entries with actor),
  `cancellationDeadlineHours`, `attendance` counts.
- `PATCH /lessons/:id/status` — `targetStatus`, `cancelledBy`, reason; charge
  choice.
- `PATCH /lessons/:id` — time, duration, teacher, price, topic, notes
  (`?force=true` after a conflict).
- `PATCH /lessons/:id/reschedule` — `startsAtUtc`, `scope`
  (`this` | `this_and_following`); schedule change preview:
  `POST /schedules/:id/changes/preview`.
- `POST /lessons/:id/makeup`, `DELETE /lessons/:id`.
- `GET` / `PUT /lessons/:id/attendance`.
- Errors: `SCHEDULE_CONFLICT` (with `details.conflicts[]`), `LESSON_ENDED`,
  `LESSON_PAID`, `LESSON_CHARGED`, `MAKEUP_NOT_ALLOWED`, `MAKEUP_EXISTS`,
  `NO_SHOW_INDIVIDUAL_ONLY`, `ATTENDANCE_NOT_MARKABLE`.

## Rules

L-1, L-12, L-40, L-41, L-50…L-53, L-60…L-62, L-70…L-74, L-110, L-111.

## Reuse

`AdaptiveDialog` (dialogs, sheet on phones), `ConfirmDialog`, `LessonItem` /
`LessonList`, `AttendanceList`, `PersonItem`, `Segmented`, `TextField`,
`Notice`, `LessonStatusBadge`, shadcn `Sheet`.

Built with: shadcn `Dialog` (the panel window, a full-screen sheet on phones),
`DropdownMenu`, `Calendar`/`Popover` (the new `DateField`); `AdaptiveDialog`
(now with a close button, a scrolling body and a wide size), `ChoiceCardGroup`,
`Segmented` (new mark `tone`), `TextField`, `EntityPicker` (field), `LessonItem`,
`DateTile`, `PersonItem`, `EntityAvatar`, `Badge`, `LessonStatusBadge`, and
`Notice` (new `callout` appearance). New shared patterns, each with a story
and a registry row: `LessonPaymentCard`, `LessonCancellationCard`,
`LessonTimeline`, `AttendanceSummaryCard`, `MemberChargeRow`, `ImpactList`,
`MoveChange`, `DateField`. The group page's interim attendance dialog is
replaced by the panel's.

## What the mockups must show

- [x] Panel for an individual scheduled lesson, a held one (paid and unpaid),
      a cancelled one with a makeup, a makeup, a group lesson.
- [x] Panel loading and "lesson not found" (deleted or taken out by a pause).
- [x] Cancel dialog with the late-cancellation suggestion both ways.
- [x] Edit form, including the price locked after payment.
- [x] Move scope dialog with numbers.
- [x] Makeup dialog.
- [x] Attendance with a paused member and "everyone came".
- [x] Conflict dialog.
- [x] History list (long).
- [x] Phone versions of the panel and each dialog.

## Out of scope

Creating lessons (S02), the calendar drag (S03), bulk cancel (S04), schedule
editing beyond "this and following" (S05).

## Mockups

The owner's handoff `tutorio-s01-lesson-panel` (built on `develop@6964b85`):
ten boards, desktop 1440×960 and phone 390×844, light and dark, with the
canvas source of every board.

| Board                      | States                                                                                                                                                                                                                 | Story                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 01 Main — individual panel | scheduled (package, running out, one-off), «⋯» menu, held (package, paid, unpaid), no-show, cancelled charged with a makeup, cancelled by the teacher, cancelled in time, makeup, history expanded, loading, not found | `Lessons/Screens/Panel` › Playground (`state`), Menu, HistoryExpanded, NotFound |
| 02 PanelGroup              | scheduled, in progress, held with marks, held without marks, cancelled                                                                                                                                                 | Playground (`state: group*`)                                                    |
| 03 PanelEdit               | price editable, paid (locked), package (1 credit)                                                                                                                                                                      | Edit (`state` picks the price mode)                                             |
| 04 Cancel                  | student late, student in time, teacher                                                                                                                                                                                 | CancelLate (`clock`), Playground + "Cancel lesson"                              |
| 05 StatusFix               | held → no-show                                                                                                                                                                                                         | StatusFix                                                                       |
| 06 Move                    | this and following, with numbers                                                                                                                                                                                       | Move                                                                            |
| 07 Makeup                  | free makeup                                                                                                                                                                                                            | Makeup                                                                          |
| 08 Attendance              | with a paused member                                                                                                                                                                                                   | Attendance                                                                      |
| 09 Delete                  | can delete, already charged                                                                                                                                                                                            | Playground + menu › Delete, DeleteCharged                                       |
| 10 Conflict                | variant C                                                                                                                                                                                                              | Conflict                                                                        |

The screens are the design authority; every state was captured headless at
both sizes and themes in Ukrainian and compared with its board.

## Decisions (with the owner, from the handoff)

1. A package lesson shows «1 заняття з пакета» and the package balance, never
   a money price; its price field reads "1 lesson from the package".
2. History is a timeline: three entries, «Показати всю історію · ще N», and
   «Згорнути історію» at the end when expanded. On desktop only the history
   list scrolls under the fixed payment card.
3. Edit happens inside the panel (same window).
4. One primary action pinned at the bottom (desktop) or in the phone footer;
   everything else in «⋯»: edit · move · no-show (disabled before the start
   with «Доступно після початку заняття») · copy link · delete (destructive,
   after a divider). Scheduled: «Перенести» + «Скасувати заняття»; held:
   «Виправити статус»; no-show / cancelled individual without a makeup:
   «Призначити відпрацювання» (status fix moves to «⋯»); running group:
   «Відмітити присутність» (cancel moves to «⋯»).
5. The cancellation card repeats the status icon and tone
   (`CANCELLED_CHARGED` → `CircleX` danger, `CANCELLED_UNCHARGED` →
   `CircleSlash` warning) and quotes the reason.
6. Credits-left tone: danger at ≤ 1, warning at 2 — on the package card and
   on the group members.
7. One colour per attendance mark everywhere: present success, absent danger,
   excused info, paused warning.
8. Deleting a charged lesson explains why and offers «Скасувати без
   списання».
9. Conflict dialog = variant C: the new lesson in the feature card, a
   «перетинається з» divider, one `LessonItem` per overlap with a chip naming
   who is double-booked; «Змінити час» and «Зберегти все одно» (`?force=true`).

Decided while building (for the owner's confirmation):

- **«Перенести» opens the edit form.** The move board has no date picker of
  its own; the new date and time are set in the panel's edit form, and a
  schedule lesson asks «лише це / це і наступні» on save (L-41), with the
  schedule change preview's numbers (L-25).
- **Group held with marks: «Виправити статус», not «Призначити
  відпрацювання».** Board 02 shows a makeup button, but group lessons have no
  makeups (L-62) and the API refuses one (`MAKEUP_NOT_ALLOWED`). Marks change
  through «Змінити» on the attendance card, as the board says.
- **Cancellation title is gender-neutral.** «Скасувала/Скасував {actor}»
  needs the actor's grammatical gender, which no record holds. The card says
  who cancelled by role («Скасовано учнем пізно», «Скасовано викладачем»,
  matching the history titles) and puts the actor's name after the time.
- **Status fix to a cancellation** keeps who cancelled when the lesson was
  already cancelled, else records the student (the group for a group lesson).
- **A lesson whose end passed but is not held yet** (the automation runs every
  10 minutes) offers «Виправити статус».

## Data (answers to the handoff's section 5)

- **Package balance on the card:** `GET /enrollments/:id/billing` (mode and
  usable packages) + `GET /packages/:id` (total, name, price, expiry). The
  package that will pay a scheduled lesson is the charge's package once
  charged, else the oldest usable package with credits (L-81, the domain's
  `pickPackage` order). "Left after this one" subtracts the direction's
  scheduled lessons before it (`GET /lessons?enrollmentId=`); with none left
  the card says the lesson goes on debt.
- **Per-member balance in a group:** `GET /groups/:id` (each member's billing
  mode and rate) + `GET /packages?groupId=` (their packages) +
  `GET /lessons/:id/attendance` (marks) + the lesson's `charges[]`.
- **Paused members:** the attendance sheet now flags each participant
  `paused` (API change `effab27`, L-73).
- **Actor name on the cancellation card:** the `history[]` entry of the
  cancel.
- **History:** decoded from `history[]`; a billing entry written with a status
  change or marks folds into it ("списано 1 заняття"). Lessons generated by a
  schedule have no creation entry, so the lesson's `createdAt` stands in.
- **Conflicts:** `409 SCHEDULE_CONFLICT` `details.conflicts[]`; the move
  preview is `POST /schedules/:id/changes/preview` with the lesson's weekday
  replaced from its start (the API's own slot rule).

## Open questions (left out rather than invented)

- **Payment method chip** («Готівка») on a paid one-off: payments are
  allocated to lessons oldest first (L-90) and a lesson does not know which
  payment covered it. The chip shows «Оплачено» and the date only.
- **«Внести оплату»** (unpaid one-off) and **«Запропонувати пакет»**
  (package running out): recording a payment is S06 and selling a package is
  S07; neither flow exists yet, so the buttons are left out.
- **"Assigned a makeup" in the original's history** (board 01, state 9): the
  API audits the makeup's creation on the makeup, not on the original.
- **«з 1 вересня» after the schedule** («Пн і Пт о 17:00 · з 1 вересня»):
  the schedule read has no start date.
- **Group lesson price:** the edit form hides the price of a group lesson;
  members pay their own rate (L-11) and a per-lesson group price has no
  defined effect on their charges.
- **«До 18 грудня»** in the move preview: the preview does not say where the
  rebuilt range ends.

## Known issue fixed

The `EntityPicker` field rendered as a pill: `cn` now knows the product radius
scale (`@/lib/utils`), so a caller's `rounded-field` replaces the Button's
`rounded-pill`.
