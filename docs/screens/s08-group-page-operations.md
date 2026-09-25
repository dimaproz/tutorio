# S08 — Group Page Operations

- Status: In progress (mockups in 2026-09-25, brief checked)
- Work packet: 6.4 (screens)
- Depends on: S01 (attendance in the lesson panel), S05 (schedule form and
  change dialog), S07 (the package spec the member sale reuses)

## User job

Run a group from its page: change its one schedule knowing what moves, mark
who came (everyone present by default), sell the same package to several
members at once, and see each member's billing state.

## Route

`/app/groups/[groupId]` — changes to the existing rebuilt group page.

## Screens and dialogs

1. **Schedule block**: the group's slots and next lessons; create, change
   (S05 change consequence dialog), stop (L-23…L-25).
2. **Lessons and attendance**: the group's lessons open the S01 panel with
   attendance; the interim attendance dialog is retired.
3. **Sell to members dialog**: pick members, one package spec (from S07),
   preview per member, result (L-86).
4. **Members' billing**: per member — mode, credits left, debt, warning,
   paused ("on pause", L-73); the member's own rate override.
5. **Member rate dialog**: the group price or the member's own rate (L-11).
   **Done 2026-09-25** ahead of the step, from the owner's handoff
   `tutorio-group-member-prices` (see "Member prices" below).

## Data available

- `GET /groups/:id`, `GET /groups/:id/attendance`.
- `GET /schedules?groupId=`, schedule routes as in S05.
- `POST /packages/members` — `groupId`, `studentIds[]`, the package spec.
- `GET /enrollments/:id/billing` per member (or `GET /students/:id/billing`),
  `PATCH /enrollments/:id` (rate).
- `GET /pauses?studentId=` for members on pause.

## Rules

L-3, L-11, L-23…L-27, L-62, L-70…L-74, L-86.

## Reuse

The existing group page blocks (`GroupHero`, roster, lessons card),
`AttendanceList`, `LessonList`, `CreditMeter`, `PersonItem`, S01/S05/S07
dialogs.

## What the mockups must show

- [ ] Schedule block with and without a schedule; a planned change.
- [ ] Members with mixed billing: package low, pay-per-lesson debt, on pause.
- [ ] Sell to members: selection, preview, result.
- [ ] Phone version.

## Mockups

The owner's handoff `tutorio-s08-group-operations`: board 01 «GroupPage» (6
desktop states, 2 phone) and board 02 «SellToMembers» (4 desktop, 3 phone),
1440 and 390, light and dark, with the canvas source. The fixture is the
story's B2 group on Wednesday 9 September: Artem (pays per lesson, 800 ₴ owed
for 2 lessons), Anna (package 2 of 8, running low), Denys (5 of 8, 1 600 of
3 200 ₴ paid), Sofiia (pays per lesson, no package), Mark (6 of 8, own price
350 ₴) and Kateryna (paused until 4 October, 3 of 8 waiting). The repository
does not keep mockups.

The page is not redesigned: only the blocks below change.

## Decisions (the owner's, from the handoff)

1. **Keep the existing page**; every block outside S08 stays as built.
2. **Members' billing lives in «Склад групи» as expanded cards** (variant C;
   the brief's open question). The «Пакети учасників» card goes.
3. **Calm actions**: member actions are outline `xs` buttons; the group sale
   is a soft row at the bottom of the block, not a dark header button.
4. **The same add button everywhere**: «+ Додати учня» is the outline `sm`
   button of «+ Додати заняття».
5. **Paused means grey**: the member card, the attendance row and the
   metric's badge.
6. **Attendance numbers only in «Відвідуваність»**: lesson rows no longer
   say «прийшли 5 з 6».
7. **Tooltips on attendance cells**, in the member rows and in the metric:
   the date, the topic and who came or missed; a tap on phones.
8. **Sale price**: one price for everyone; a member's own rate (L-11) is a
   hint with «N × rate», applied in one click, never automatically, and
   reset with «Як у групи».
9. **The sale is atomic**: all or nothing; the preview flags each member's
   situation before the sale, so the result is always «Продано N».
10. **Default selection**: running low, no package, or debt are ticked;
    paused members and members with enough credits are not, but can be.
11. **The schedule card gets a ⋯ menu**: «Змінити дні або час» (the S05
    change dialog), «Додати день» and «Зупинити розклад» (the S05 stop
    dialog). A planned change shows inside the card with «Скасувати зміну».

## Data (answers to the handoff's section 4)

1. **Members' billing**: new `GET /groups/:id/billing` — one row per live
   member: the direction's billing as `GET /enrollments/:id/billing` reads it
   (mode, rate, packages with credits, window and money, debt lessons, the
   pay-per-lesson balance, the warning) plus the member's current or next
   pause (`startsAt`, `endsAt`) and the studio's low-credit threshold. Fixed
   number of queries, whatever the roster. The summary badges are counted on
   the client, never across currencies.
2. **A per-member price**: `POST /packages/members` takes an optional
   `prices: [{ studentId, pricePerLessonMinor }]` for the members sold at
   their own rate; the others take the shared price.
3. **A batch preview**: new `POST /packages/members/preview` — the same body,
   per member: lessons, price, total, the lessons on debt the credits cover
   first (L-82) and the pause that holds the first lessons back.
4. **Atomic**: the sale runs in one serializable transaction; one member that
   fails (not a member, archived) sells nothing. Covered by an E2E test.
5. **Cancelling a planned change**: new `POST /schedules/:id/changes/cancel`
   (`?force` for conflicts) re-applies the rule in force before the change
   from the change's date, so the moved lessons move back (L-26) through the
   change path; a later version identical to the one before it is no longer
   reported as a change. A planned stop has no cancel yet (not in the
   mockups).
6. **`nextChange` on the card**: the card reads the group's schedule itself
   (`GET /schedules?groupId=`), which the change and stop dialogs need anyway.
7. **The topic in the attendance read**: `GET /groups/:id/attendance`
   `lessons[]` carry `topic`.
8. **An unmarked past lesson**: a held group lesson always has marks — the
   automation marks the roster present (L-72) — so «not marked» means no
   person marked it: the lesson read's `attendance` gains `confirmed` (a mark
   with a person behind it). A started group lesson, not cancelled, with
   `attendance` null or not confirmed reads «присутність не відмічена» with
   «Відмітити». Saving the S01 sheet of an unconfirmed lesson sends every
   mark, so it becomes confirmed even when nothing changed.

## Raised against the contract

- **A package does not close pay-per-lesson debt.** Board 02 shows Artem —
  who pays per lesson and owes 800 ₴ for 2 lessons — with «Спершу закриє 2
  заняття в борг — у пакеті лишиться 7». By L-82 and L-90 new credits cover
  only lessons held on debt in package mode; a pay-per-lesson balance stays
  money owed. The build follows the contract: the note shows only when the
  preview returns lessons on debt (as in S07), and Artem is still ticked by
  default (he owes money). Open question below.

## Member prices (done 2026-09-25)

Built from the handoff `tutorio-group-member-prices` (board 01 GroupPrices,
10 states; board 02 GroupFormPrice, 3; board 03 LessonGroupCard, 1; desktop
and phone, light and dark). The repository does not keep mockups.

- **Data**: `Enrollment.ownPrice` (migration `20261001120000_member_own_price`,
  existing members whose price differs from the group's backfilled as own).
  `PATCH /enrollments/:id { priceMinor, currency }` sets the member's price;
  a price equal to the group's clears the override. `PATCH /groups/:id` with
  a new `pricePerLesson` reprices every member without one. A charge keeps its
  amount, so held and charged lessons never change (E2E in `billing`).
- **Roster**: the price column appears once somebody has an own price
  (captions «Учень / Ціна за заняття»); the group price muted, an own price in
  600 with «своя ціна» and its tooltip «Ціна групи 400 ₴» (a tap on phones,
  where the badge moves into the meta line). «Змінити ціну» sits between the
  profile and the removal.
- **«Ціна для учня»**: `AdaptiveDialog` with the eyebrow, the comparison row,
  `PriceField` focused with its value selected, the difference hint, the
  future-only note with the next lesson's date, «Повернути ціну групи» for an
  override, validation (empty, negative) and the saving state; after saving
  the row is marked and a toast offers «Скасувати».
- **Group form**: the hint under the price, and once it changes the sky block
  with who follows, who keeps their own price (each listed) and the
  future-only line.
- **S02**: the group card's pill «400 ₴ з учасника │ 1 зі своєю» with the
  members in its tooltip, the compact pause chip, and the price hint naming
  the members with their own price.
- **Notice glyphs**: `info` defaults to Info and `warning` to TriangleAlert;
  the hold banner passes Pause and the archived notices Archive.

Stories: `Groups/Screens/Page` (`Prices*`, `Price*`), `Groups/Screens/Form`
(`PriceUnchanged`, `PriceChanged`), `Lessons/Screens/NewLesson` (`Group`),
`Shared/Cards/LinkedCard` (`WithAside`), `Shared/Dialogs/AdaptiveDialog`
(`EyebrowAndTertiary`), `Shared/Feedback/Alert`.

Left out: the form's «Учні» list does not show the price column (the shared
`LinkPicker` has no value column yet), and the save bar keeps «1 незбережена
зміна» rather than naming the section.

## Out of scope

Group creation and editing (done in Work Packet 6.3).

## Open questions

- Should a package sold to a pay-per-lesson member close their unpaid
  lessons (board 02, Artem), which L-82 and L-90 do not allow today?
