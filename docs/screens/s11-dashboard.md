# S11 — Today Dashboard

- Status: Done (2026-09-26, `e87090a`..`0b92696`); mockups: the
  `tutorio-s11-today` handoff
- Work packet: 6.6
- Depends on: S01 (lesson panel), S02 (lesson form), S04 (the lists the
  exceptions link to), S06 (payment, pause), S07 (sale, extend), S09 (the
  owner's teaching profile), S10 (the low-credit threshold)

## User job

"I open Tutorio in the morning — or between lessons — and in ten seconds I
know what today holds, what I must deal with, and where the money stands.
Every problem I see has its fix one click away."

The page is the owner's home screen. It answers three questions, in this
order of weight:

1. **What is my day?** — today's lessons, the one running now or next, and a
   glance at tomorrow.
2. **What needs me?** — the exceptions to act on, each with its action.
3. **Where is the money?** — received this month, owed now, due soon.

It is an action surface, not analytics: no charts, no period pickers, no
comparisons.

## Route and navigation

- `/app` becomes the dashboard (today it redirects to the students).
- «Сьогодні» is the **first navigation item everywhere**: first in the
  sidebar (Сьогодні · Календар · Заняття · …) and first in the phone tab bar,
  which becomes **Сьогодні · Календар · Заняття · Учні · Ще** — «Групи» moves
  under «Ще». Both modes, owner only (as every business route in the pilot).
- The page's name in the header and breadcrumbs is «Сьогодні».

## Whose day: the scope

The dashboard adapts to who the owner is (answers of 2026-09-26):

| Studio                                                                         | What the page shows                                                                                                            |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Tutor mode (solo)                                                              | The tutor's day. No switch, no teacher marks.                                                                                  |
| Studio mode, the owner **has an active teaching profile** and colleagues teach | The switch **«Мої · Студія»**, «Мої» by default; the choice is remembered in the browser. «Студія» adds each lesson's teacher. |
| Studio mode, the owner **does not teach**                                      | The studio's day at once. No switch; each lesson shows its teacher.                                                            |
| Studio mode, the owner teaches and is the only active teacher                  | Same as tutor mode (the two views would be identical, so no switch).                                                           |

The switch filters **the day, «Завтра», the summary line and «Потребує
уваги»** to the owner's own lessons, students and groups. **Money is always
the whole studio's** — the owner answers for all of it.

## Layout

Desktop (1440): the header across the top, then **two columns** — the day on
the left (wide), «Гроші за місяць» and «Потребує уваги» on the right
(narrow). Tablet: one column in the phone order. Phone (390), top to bottom:
header and summary → «Зараз / Наступне» → «Потребує уваги» → the rest of the
day → «Завтра» → «Гроші за місяць». The designer may propose a different
place for the money on the phone.

## Blocks

### 1. Header

- Greeting by the time of day on the studio's clock with the owner's first
  name — «Доброго ранку, Олено» / «Доброго дня» / «Доброго вечора» — and the
  date: «субота, 26 вересня».
- **The summary line** (no tiles): «6 занять · 5 год · 10:00–19:30» for the
  current scope; a free day reads «Сьогодні занять немає».
- The scope switch «Мої · Студія» where the table above says so.
- **Actions** (answer: one primary + a menu):
  - desktop: primary «Додати заняття» (the S02 form, today's date
    prefilled), outline «Записати оплату» (the S06 payment dialog, which here
    starts with a student picker), and a «Створити ▾» menu with «Продати
    пакет» (the S07 sale with the student and direction picker, as on
    «Пакети») and «Новий учень» (the full-page student form);
  - phone: one «+» in the top bar opening a bottom sheet with the four
    actions.

### 2. Today's lessons (left column)

- **«Зараз» / «Наступне»** — a prominent card (`NextLessonCard`) for the
  lesson running now (with its progress and «ще 25 хв») or, between lessons,
  the next one («через 40 хв»). Who (student with avatar, or group with its
  size), time and length, kind, topic, the teacher in the studio view, and
  its payment state (package credits «3 з 8», unpaid, pay-per-lesson).
- **The day's list** (`LessonList`) in time order. A row: start–end, who,
  the kind chip (індивідуальне · група · відпрацювання), the teacher and
  their colour in the studio view, the topic, the payment mark, the status.
  Lessons cancelled today stay in the list, struck through, with «Скасовано ·
  учень / викладач».
- **Past lessons of today — the owner will choose between two variants; the
  mockups must draw both:**
  - **Variant A — collapsed.** The card on top, then the lessons still ahead;
    the ones already over fold into «Вже проведено · 3» that opens in place.
  - **Variant B — one timeline.** Every lesson of the day in time order, the
    past ones muted, a «зараз» line between the past and the future (as in
    the calendar).
- **Row actions** (answer: panel + menu): a click opens the S01 panel
  (`?lesson=`); the row's ⋯ is the S04 row menu (move, cancel, no-show,
  assign a makeup). A group lesson that is over with unconfirmed attendance
  shows a visible «Відмітити» that opens the panel on its attendance (S08).
- **End of the day** — every lesson is over: the card reads «На сьогодні
  все» with the time of tomorrow's first lesson.

### 3. «Завтра»

A compact block under the day: «Завтра · неділя, 27 вересня · 4 заняття ·
перше о 09:00», collapsed; it expands in place into short rows (time, who,
teacher in the studio view). «У календарі →» opens the calendar's day view on
tomorrow. With no lessons tomorrow: «Завтра занять немає».

### 4. A free day — the owner will choose; the mockups draw three variants

- **A — nearest day.** A compact «Сьогодні вільно» and, straight under it,
  the nearest day with lessons as the day's list: «Понеділок, 28 вересня ·
  5 занять». When that day is tomorrow, «Завтра» is not repeated.
- **B — empty state.** «Сьогодні занять немає» (`EmptyState`) with «Додати
  заняття», then the usual «Завтра» block.
- **C — work day.** The day column shrinks to one line («Сьогодні вільно ·
  наступне заняття пн, 28 вересня о 10:00») and «Потребує уваги» with the
  money take the whole width — a free day is for clearing the backlog.

### 5. «Гроші за місяць» (right column, always the whole studio)

Money is shown as **state and running totals, not as a daily flow**, so the
block is never empty in the middle of the month when nobody pays (the owner's
concern: payments come in at the start of the month). Three figures, **one
row per currency**, never converted or added across currencies:

1. **«Отримано у вересні»** — payments recorded this calendar month on the
   studio's clock, refunds subtracted; «+3 200 ₴ сьогодні» under it when
   something came in today.
2. **«Борги зараз»** — what students owe now: unpaid pay-per-lesson lessons
   and lessons held on debt in package mode (L-82, L-90), «18 400 ₴ · у 5
   учнів»; it scrolls to or opens «Боржники». Zero reads «Боргів немає».
3. **«До оплати за 7 днів» (≈)** — money expected soon: packages that will
   run out or expire within 7 days, at the price of the current package, plus
   the unpaid rest of packages already sold. Marked approximate.

On the 1st of the month «Отримано» is 0 ₴ but the other two figures still
carry the block.

### 6. «Потребує уваги» (right column)

One card per kind of exception, **in this fixed order** (answer: lessons
first, cards never jump):

| #   | Card                       | What falls in                                                                                                        | A row reads                                                                | Row action                              | «Усі N →»                         |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------- | --------------------------------- |
| 1   | «Присутність не відмічена» | Group lessons that are over, not cancelled, whose attendance nobody confirmed (everyone counted present, L-72, L-74) | «B2 Intermediate · вт, 22 вересня, 18:00»                                  | «Відмітити» → S01 attendance            | Lessons list, the new filter      |
| 2   | «Потрібна відпрацювання»   | Cancelled or no-show individual lessons without a makeup (L-60)                                                      | «Анна Шевченко · пт, 25 вересня · не прийшла»                              | «Призначити» → S01 makeup dialog        | `/app/lessons?quick=needs_makeup` |
| 3   | «Боржники»                 | Students who owe: pay-per-lesson debt and package-mode lessons on debt (L-82, L-90)                                  | «Максим Бойко · 1 200 ₴ · 3 заняття»                                       | «Записати оплату» → S06                 | `/app/lessons?quick=unpaid`       |
| 4   | «Продано, але не оплачено» | Sold packages not paid or partly paid (L-87)                                                                         | «Ірина Коваль · «Жовтень» · сплачено 1 000 з 3 200 ₴»                      | «Записати оплату» → S07 package payment | `/app/packages?tab=UNPAID`        |
| 5   | «Пакети закінчуються»      | Packages with credits at or under the studio threshold (S10, default 2), or none left (L-82)                         | «Олег Мельник · з Дмитром · лишилось 1 заняття»                            | «Продати пакет» → S07, prefilled        | `/app/packages?tab=ENDING`        |
| 6   | «Пакети за датою»          | Packages whose «Діє до» ends **within 3 days** while credits are left (they would expire unused, L-84)               | «Софія Лисенко · діє до чт, 1 жовтня · згорить 3 заняття»                  | «Подовжити» → S07 extend                | `/app/packages?tab=ENDING`        |
| 7   | «Повертаються з паузи»     | Pauses ending **within 3 days** (L-103), and pauses **without an end date longer than 30 days**                      | «Марія Ткач · повертається пн, 28 вересня» / «на паузі без дати · 45 днів» | profile / «Повернути» → S06 end pause   | the student's profile             |

Card rules:

- A card has its title, the count, **up to three most urgent rows** (the
  oldest or the soonest first) each with **one action**, and «Усі N →» when
  there are more. Row names open the student's profile.
- A card with nothing in it is hidden. With every card empty the block reads
  **«Усе під контролем»** — a calm, positive state, not an empty one.
- **Nothing can be hidden or snoozed** (answer): an item leaves only when its
  cause is resolved — paid, marked, sold, extended, returned. After an action
  in a dialog the card updates in place.
- The scope switch applies: in «Мої» a card holds only the owner's lessons,
  students and groups.
- A student can sit in two cards for two reasons (owes money and runs out of
  credits); a direction sits in only one of cards 3 and 5 (a direction on
  debt is a debtor, not «running out»).

### 7. First run

A new studio sees **the setup checklist** (`SetupChecklist`) in place of the
day and the exceptions. Steps tick themselves from the data and the checklist
disappears once all are done:

1. «Додати викладача» — studio mode only; done when a colleague exists.
2. «Додати учня».
3. «Створити розклад або заняття».
4. «Продати пакет або записати оплату».

While the checklist is partly done, the blocks that already have data show
under it (for example the day once the first lesson is booked). Demo data is
out of scope.

## States every block must cover

- Loading: skeletons shaped like each block; blocks load independently, so
  one slow read does not hold the page.
- A block's error with «Спробувати ще» inside the block, the rest of the page
  working.
- Busy day, quiet day (one or two lessons), free day, end of the day, first
  run.
- Each exception card with numbers, with more than three rows, and the page
  with nothing to report.
- One and two currencies in the money block; the 1st of the month.
- Phone layout (390): the «+» sheet, the scope switch, the cards stacked.
- Ukrainian and English, the longest Ukrainian strings; light and dark.

## Rules

L-50, L-60, L-72, L-74, L-82, L-84, L-87, L-90, L-91, L-100, L-103, L-120
([`product/scheduling.md`](../product/scheduling.md)).

## Reuse

`PageHeader`, `NextLessonCard`, `LessonList` / `LessonItem`, `StatBlock`
(the money figures), `SetupChecklist`, `Notice`, `PersonItem`, `EmptyState`,
`Segmented` (the scope switch), `EntityAvatar`, `Badge`, `Card`, `Item`,
`Collapsible`, `DropdownMenu`, `AdaptiveDialog` / `Drawer` (the phone «+»
sheet); the S01 panel, the S02 form, the S04 row menu, the S06 payment and
pause dialogs, the S07 sale and extend. New shared pattern expected: the
exception card («title · count · three rows with an action · Усі N»), with
its Storybook story.

## Data available

- The day and tomorrow: `GET /lessons?from&to&teacherId` — status, kind,
  student with avatar, group, teacher with colour, topic, charges with their
  paid state, `attendance.confirmed`, the makeup link.
- The owner's teaching profile: `GET /teachers` → `me` (null or archived: the
  owner does not teach); the mode from the session.
- Card 2 and the unpaid count: `GET /lessons/list?filter=needs_makeup` /
  `unpaid`, with `teacherId` and `counts`.
- Cards 3 (package debt) and 5: `GET /billing/warnings` (`ON_DEBT`,
  `NO_CREDITS`, `LOW_CREDITS`, the teacher and group on each item).
- Card 4: `GET /packages?status=UNPAID&teacherId` with `owed[]`.
- Card 7: `GET /pauses?state=current` (scheduled or running, open-ended
  included).
- First run: the counts of `GET /students/summary`, `GET /teachers`,
  `GET /schedules`, `GET /lessons/list`, `GET /packages`, `GET /payments`.

## Data gaps (to close in the build, not the designer's concern)

1. **Money received** — `GET /payments` has no date range and no totals:
   needed per currency for the month and for today.
2. **Studio debt** — no studio-wide read gives debt per currency or the
   debtors with amounts; `GET /billing/warnings` covers package mode only,
   without money.
3. **«До оплати за 7 днів»** — no read; to be computed by the domain from
   ending packages and unpaid sold packages.
4. **Unconfirmed attendance** — no filter on `GET /lessons/list`; card 1 and
   its «Усі N →» need one.
5. **Expiry in 3 days** — the packages' `ENDING` tab mixes low credits and
   a 7-day expiry; card 6 needs expiry within 3 days with credits left.
6. **Pauses** — no end-date window, no direction's teacher or group name, no
   teacher filter.
7. **Scope** — `GET /billing/warnings` and `GET /pauses` take no `teacherId`.

Architect's recommendation: one read `GET /dashboard?teacherId=` (a
`dashboard` API module) that answers the summary, the exception cards (count
and first three rows each) and the money in one request, with the rules in
`packages/domain` under unit tests; the day and tomorrow keep using
`GET /lessons`. Decided at the build, with tests first.

## What the mockups must show

Fixture: Kyiv English Studio (Europe/Kyiv, UAH, studio mode, 5 active
teachers), the owner Olena Kovalenko, who also teaches. Desktop 1440 and
phone 390, light and dark where they differ.

- [x] **Busy day, «Мої»**, mid-day with a lesson running — **variant A**
      (past lessons collapsed).
- [x] The same day — **variant B** (one timeline with the «зараз» line).
- [x] The same day in **«Студія»** with the teachers' marks.
- [x] An owner who does not teach (no switch) and a solo tutor (no teachers
      anywhere).
- [x] End of the day: «На сьогодні все» and «Завтра» expanded.
- [x] **Free day — variants A, B and C.**
- [x] «Потребує уваги»: every card with numbers, one card with more than
      three rows and «Усі N →», and «Усе під контролем».
- [x] «Гроші за місяць»: one currency, two currencies, the 1st of the month.
- [x] First run: nothing yet, and partly done with the first lessons booked.
- [x] The row ⋯ menu and «Відмітити» on a finished group lesson.
- [x] The «Створити ▾» menu (desktop) and the «+» sheet (phone).
- [x] Loading and a block's error.
- [x] Phone: busy day, free day, the navigation with «Сьогодні» first.

## Decisions (the owner's answers, 2026-09-26)

1. **Scope.** An owner who teaches sees their own day with a «Мої · Студія»
   switch; an owner who does not teach sees the studio at once.
2. **Horizon.** Today, plus a short collapsed «Завтра».
3. **Money** is shown as a month's running total, the debt now and the next
   7 days — never as today's payments alone, which would be empty most of the
   month.
4. **Layout.** The day on the left, «Потребує уваги» on the right; on the
   phone the next lesson, then the exceptions, then the rest of the day.
5. **Exceptions.** Seven cards: unconfirmed attendance, makeups, debtors,
   sold but unpaid, running out, expiring by date, pauses. Students with no
   lessons at all are not an exception in the pilot.
6. **Cards** show a count, three rows with a one-click action and «Усі N →»;
   the order is fixed, lessons first.
7. **Nothing is snoozed**: an exception leaves only when resolved.
8. **Row actions**: a click opens the S01 panel, ⋯ the S04 menu.
9. **Header actions**: «Додати заняття», «Записати оплату», «Продати
   пакет», «Новий учень» — one primary, one outline, the rest in «Створити ▾»;
   one «+» on the phone.
10. **Summary** is one line under the greeting, no tiles.
11. **Navigation**: «Сьогодні» first in the sidebar and the tab bar; «Групи»
    moves under «Ще» on phones.
12. **Windows**: expiring packages and returning pauses within 3 days; open
    pauses flagged after 30 days; the money forecast looks 7 days ahead.
13. **The «Мої» switch** filters the lessons and the exceptions; money stays
    the studio's.
14. **First run**: four steps ticked from the data.
15. **To be chosen from the mockups**: how past lessons show (A or B) and
    the free day (A, B or C) — chosen below.

## Decisions from the mockups (the owner, 2026-09-26, on the canvas)

The `tutorio-s11-today` handoff is the design authority for this step.

1. **Layout: the «квитки» variant (V3).** V1 and V2 were dropped.
2. **Past lessons: variant B, one timeline.** Every lesson of the day stays
   in time order; a red time badge with a line («13:05») sits under the
   lessons that have started. The collapsed «Вже проведено · N» (A) was
   dropped.
3. **Free day: variant A.** A green «Сьогодні вільно · наступні заняття — у
   понеділок» strip, then the nearest day's list. B and C were dropped.
4. **No summary line under the greeting.** The day card's title keeps «7
   занять · 1 скасовано»; the first run keeps «Tutorio готовий до роботи».
5. **«Потребує уваги» is one card with an accordion**, not seven cards: one
   row per category in the fixed order (a tinted 34px tile, the title, the
   count in the tile's colour, a chevron, and a two-name summary «… і ще N»
   while closed). The first non-empty category is open; opening another
   closes it; a click on the open one closes it. Up to three `PersonItem`
   rows (`tone="soft"`, `size="sm"`, full card width) with one outline action
   each and «Усі N →» under them. Empty: «Усе під контролем». In «Мої» only
   the owner's items.
6. **The money card «M2»**: the brand indigo #4b4fe0 in both themes with
   white text (a theme-stable token, not `--brand`), a thin coin with «₴»
   and a dot at 14%; three rows; with two currencies each label over a
   two-column grid. Always the whole studio.
7. **The «Зараз» ticket**: radius 28 on `--primary`; a 128px stub with the
   start and «до 13:30», a 2px dashed divider, «ЗАРАЗ» with «ще 25 хв», the
   avatar and name, the meta line and a progress bar, a white «Відкрити
   заняття». At the end of the day it reads «На сьогодні все». Phones: an
   82px stub, an 18px name.
8. **Header**: the date, the greeting, the «Мої · Студія» switch; outline
   «Записати оплату», «Створити ▾», primary «Додати заняття»; a 44px «+» on
   phones opening the «Створити» sheet.
9. **First run** stays the checklist only (no placeholder blocks, no demo
   data); every step button is outline.
10. **Time and amounts use the sans font with `tabular-nums`**, not Geist
    Mono — on Today and everywhere a time or an amount is shown.
11. **The shared timed row `LessonTimeRow`** (handoff section 3) is the one
    row for one day's lessons by time: the Today timeline, the free day,
    «Завтра», the phone calendar's week and month-day lists, the teacher
    profile's phone day list. It replaces `CalendarEvent variant="row"`.
12. **A teacher's own Today** (board 04) is a future direction, not S11.

## Out of scope

Analytics, charts and period comparisons (Stage 5B); Telegram reminders and
the digest (Stage 5A); snoozing or hiding exceptions; demo data; students
without lessons as an exception; conversion between currencies.

## Delivery

**Data.** One read per block instead of the single `GET /dashboard` the
architect recommended, so that each block loads and fails on its own:

- `GET /dashboard/money` — per currency, the whole studio: received this
  studio month and today (refunds taken off), the debt now with the debtors
  (lessons held on debt at their price plus pay-per-lesson balances), and the
  approximate amount due within 7 days (the current package's price where the
  week's booked lessons or its window use it up, plus the unpaid rest of
  every sold package). The studio's default currency is always listed.
- `GET /dashboard/attention?teacherId=` — the seven categories in the fixed
  order, each with its count, its three most urgent rows and a two-name
  summary. `teacherId` keeps one teacher's lessons, directions, packages and
  pauses («Мої»).
- `GET /dashboard/setup` — the four first-run steps.
- `GET /lessons/list` — the new quick filter `unconfirmed` (with its count)
  behind the attendance card's «Усі N →». The day, tomorrow and the two
  weeks after it are read through the same list (`order=asc`), which also
  names each direction's current package («пакет 3 з 8»).
- A lesson now carries `originalStartsAtUtc` (a makeup's «за 19 вересня») and
  `groupMembers` («група · 4 учні»).

The rules live in `packages/domain` (`dashboard.ts`, unit-tested first); the
API has an E2E suite (`apps/api/test/dashboard.e2e-spec.ts`).

**Web.** `features/today` at `/app`; `LessonTimeRow` in `components/shared`
with its lesson mapping `TimedLessonRow` in `features/lessons`; the phone
calendar's lists and the teacher profile's phone day list use it; the S03
tiles and the S09 week tiles follow section 3 of the handoff; `font-mono`
gave way to `tabular-nums` for times, amounts and counts (kept for keyboard
shortcuts, colour codes, UTC offsets and phone numbers). Navigation:
«Сьогодні» first in the sidebar and the tab bar (Сьогодні · Календар ·
Заняття · Учні · Ще). Stories: `Today/Screens/Today` (every state of boards
01 and 06 through controls, with the interaction tests),
`Shared/Lists/LessonTimeRow`, `Lessons/Patterns/TimedLessonRow` (the board 03
catalogue), and the calendar agenda with the teacher tint (board 05).

## Decisions taken while building

1. **Three reads instead of one** (above).
2. **Lesson exceptions newest first.** The attendance and makeup cards list
   the most recent lessons first, as the mockups do (the brief said «the
   oldest or the soonest first»); debtors by amount, packages by sale date or
   end, pauses by return date and then the longest open.
3. **«Усі N →»** opens the lessons list with `period=all` (it opens on this
   month otherwise) and the same teacher; the pause card opens the students
   on hold; the package cards open «Пакети» on «Не оплачені» and
   «Закінчуються».
4. **A free day shows no «Завтра» card** — the strip already names the next
   lessons (board 08 draws none).
5. **The row badge of a lesson ahead** is how it will be paid: «пакет N з M»
   (warning at the studio threshold) or «за заняття». Board 01 draws «не
   оплачено» on an upcoming pay-per-lesson lesson; a lesson has no charge
   before it is held, so that badge appears once it is held and unpaid.
6. **A finished group lesson the automation has not held yet** also asks
   «Відмітити» in the day list (the attendance card counts held ones only).
7. **The greeting uses the owner's first name as registered** («Доброго
   дня, Olena»); Ukrainian vocative forms («Олено») are not derived.
8. **«Записати оплату» from the header** picks the student (and the
   direction when there are several) before the S06 payment dialog; a
   debtor's row starts at that student and direction.
9. **«Перенесено з HH:MM»** reads «перенесено»: the API keeps a moved
   lesson's former time only in the audit log.
10. **A tablet (834) is one column in the phone order with desktop rows**;
    the two columns start at 1280px.
11. **The money card's muted text** is white at 88% (AA on the indigo).

## Answers after the build (the owner, 2026-09-26)

1. **Unconfirmed attendance: the last 7 days only**, so a group nobody marks
   does not fill the card forever. The card and its «Усі N →» list (the
   `unconfirmed` quick filter) both look back seven days.
2. **A lesson ahead keeps «пакет N з M» / «за заняття»**; no «не оплачено»
   before it is held.
3. **The greeting keeps the name as registered.**
4. **«Отримано»** subtracts refunds (the month's net money), as proposed.

## Open questions

None.
