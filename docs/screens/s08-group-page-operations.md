# S08 — Group Page Operations

- Status: Waiting for mockups
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

- Should the members' billing be a column of the roster or its own block?
