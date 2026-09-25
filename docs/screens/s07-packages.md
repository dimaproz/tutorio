# S07 — Package Sale and Package Operations

- Status: Done (2026-09-25, commits `5c88801`…`7d42c35`; this brief closes
  it)
- Work packets: 7 (sale) and 6.5 (package read surfaces)
- Depends on: S06 (the directions block the sale starts from)

## User job

Sell a package to a student for one direction — by count, by period from the
schedule, or by period X lessons a week — see what it holds and what is paid,
take a payment for it, extend it, move its unused credits to another
direction, or refund.

## Entry points

- «Продати пакет» on a direction's pass (the next step once nothing is owed;
  the ink one once the credits run low or out), in the direction's ⋯ and on
  the profile's «Пакети» tab.
- «Продати пакет» on the «Пакети» page: the student and direction are picked
  in the sale's band.
- The ticket opens from the pass's stub, a row of the profile's «Пакети» tab,
  a row of the «Пакети» page and its menu, and `?package=<id>` on either page.

## Screens and dialogs

1. **Sale form** (`PackageSaleDialog`): the band with the direction card and
   «Інший напрям» (plus «Інший учень» on the «Пакети» page), the kind as
   radio cards, the size (count and optional «Діє до»; a window with the
   schedule's count, editable; a window with 1–5 a week), the linked price
   pair and the live ticket preview. Phones: full screen with the summary in
   the footer.
2. **«Пакет продано»**: the horizontal ticket (upright on phones) and «Що
   далі»: the schedule it will pay for (or none yet), «Записати оплату · N»
   and «Відкрити розклад» / «Додати розклад».
3. **Package ticket** (`PackageTicketModal`): the vertical ticket — a 580px
   modal that scrolls as a whole, a bottom sheet with its handle on the stub
   on phones — new, active, used up, expired, extended by a pause.
4. **Operations** over the ticket: payment, extend, transfer, refund,
   correction, delete (and its blocked state).
5. **«Пакети»** (`/app/packages`): tabs with counts, search, teacher, student
   or group and kind filters, the order, the table, the phone cards, the row
   menu, the empty, loading and error states.

## Mockups

The owner's handoff `tutorio-s07-packages`: boards «SaleForm» (6 desktop
states, 3 phone), «PackageDetail» (5 and 5), «PackageDialogs» (8 and 6) and
«PackagesList» (5 and 3), 1440 and 390, light and dark, with the canvas
source. The repository does not keep mockups.

| Board · state                      | Story                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| SaleForm 01 · Кількість занять     | `Packages/Screens/Sale` Playground                                                    |
| SaleForm 02 · Період за розкладом  | Sale · ByPeriod                                                                       |
| SaleForm 03 · Період, N на тиждень | Sale · Weekly                                                                         |
| SaleForm 04 · Ціна за пакет        | Sale · TotalPrice                                                                     |
| SaleForm 05 · Помилки              | Sale · Errors                                                                         |
| SaleForm 06 · Пакет продано        | Sale · SellByCount, Sold                                                              |
| PackageDetail 01–05                | `Packages/Screens/Ticket` New, Playground (`partial`), `state: used`, Expired, Paused |
| PackageDialogs 01–02 · Оплата      | Ticket · Payment (part and overpayment)                                               |
| PackageDialogs 03 · Продовжити     | Ticket · Extend                                                                       |
| PackageDialogs 04 · Перенести      | Ticket · Transfer (remainder)                                                         |
| PackageDialogs 05 · Повернути      | Ticket · Refund                                                                       |
| PackageDialogs 06 · Коригування    | Ticket · Correction                                                                   |
| PackageDialogs 07–08 · Видалити    | Ticket · Delete, DeleteBlocked                                                        |
| PackagesList 01–05                 | `Packages/Screens/Packages` Playground, Ending, Unpaid, RowMenu, Empty, Filters       |
| Phone boards                       | the `Phone` story of each file (and the viewport toolbar)                             |

Checked at 1440 and 390, light and dark, Ukrainian and English, including
Mark's 480 zł package and a transfer target in another currency.

## Decisions (the owner's, from the handoff)

1. **The sale is a dialog, not a page**, over the profile with the direction
   preselected, with «Інший напрям».
2. **Price: two linked fields**; the one typed last wins and the other is
   derived; the request sends `pricePerLessonMinor` **or** `totalPriceMinor`;
   the default is the direction's rate.
3. **The preview is a ticket**, the language of the S06 pass.
4. **The package detail is a modal, not a page** (the brief's first open
   question): a vertical ticket on desktop, a bottom sheet on phones; no
   `/app/packages/:id` — `?package=` over the list or the profile.
5. **Charts are `StatBlock`s**: a `date` block for the window, a `ring` for
   the payment (the small `sm` tiles on phones).
6. **The operation dialogs open over the ticket** and return to it with the
   new values.
7. **Payment method defaults to «Переказ»**, in the refund too, sent
   explicitly.
8. **Transfer is limited to the same currency**; other directions are listed
   disabled with «інша валюта».
9. **Delete only a package with no charges and no payments**; otherwise the
   blocked dialog offers the refund.
10. **A studio-wide «Пакети» page exists** (the brief's second open question),
    after «Розклади» in the navigation, under «Ще» on phones.
11. **Colours of state**: indigo new or active, grey used up, warning
    expired, running low or part paid, red unpaid, green paid and the
    transfer target.

## Data (answers to the handoff's section 4)

1. **Direction and teacher on the package**: every package read carries the
   direction's `teacher` (`id`, `name`, `avatarKey`, `subjects`) and the
   student's `avatarKey`; a direction is named by its group, else the
   teacher's first subject.
2. **The lesson rows**: `GET /packages/:id/ledger` gives each `lesson` entry
   its `lesson` (`startsAt`, `durationMin`, `status`).
3. **The pause extension**: `GET /packages/:id` (`PackageDetailResponse`)
   lists `pauseExtensions` — the pause's start, end and seconds added.
4. **The queue** (L-81): the detail's `ahead` — the older live package with
   credits, their credits, and when the direction's booked lessons use the
   last of them; the sale preview returns `ahead` (the newest live package
   with credits) and `debtLessons` (what the new credits cover first, L-82).
5. **Transfer preview**: computed on the client with the domain's
   `transferCredits`, the function the API runs — no endpoint needed.
6. **Delete only when unused**: `DELETE /packages/:id` answers 409
   `PACKAGE_IN_USE` (`details.charges`, `details.payments`); the dialog turns
   to its blocked state on it.
7. **The list**: `GET /packages` takes `status` (ACTIVE, ENDING, UNPAID,
   FINISHED), `search` (student, group or package name), `teacherId`,
   `sizingMode` and `sort=ending`, and returns `counts` per tab, `owed` per
   currency and `lowCreditThreshold`. «Running out» is the studio's low-credit
   threshold or a window closing within 7 days (`isPackageEnding` in the
   domain). The page is counted from the read rows, not in SQL (a pilot
   studio's packages fit in one read).
8. **The legacy `schedule` and `initialPayment`** are gone from the create
   contract; `POST /packages` no longer takes `?force`.

API tests: `package-operations.e2e-spec.ts` (ticket reads, pause extension,
list tabs, search, teacher and kind filters, delete); `billing.e2e-spec.ts`
now refuses to delete a used package.

## Decided while building

- **A package sold here has no name**: the sale shows no name field, so it
  is called «Пакет на 8 занять» / «Пакет 1–31 жовт» wherever it appears.
- **The kind picker is `ChoiceCardGroup`**: it already lays out as the
  board's stacked list.
- **The window shell is shared**: the lesson windows' dialog became
  `BandWindow` in `components/shared` (the lesson forms and the sale), with a
  900px size for the preview column.
- **`EntityPicker` options can be disabled** (the other-currency directions).
- **Operations from a list row** open directly over the list; the ticket's
  operations over the ticket.
- **The profile's «Пакети» tab rows open the ticket** (no separate ⋯: the
  ticket holds every operation).
- **Selling is the pass's next step** when nothing is owed on a package
  direction (the ink button once the credits run low or out).
- **A period from the schedule counts its own lessons**: switching to it
  clears the typed count; the field shows the schedule's with «З розкладу».
- **A weekly package's price follows the preview's count** (the API's
  `weeks × N`), so the two fields and the preview agree.
- **The correction stepper** stops at no credits left and at +50.
- **The profile's phone metrics row** takes the focus (the axe
  scrollable-region rule failed on a student with several currencies).

## Open questions

- **13 vs 12 lessons**: board 01 state 03 shows 13 for 3 a week over 1–31
  October (31 days × 3 ÷ 7); the API rounds the weeks first (L-80 «X ×
  weeks») and sells 12. Which rule does the owner want?
- **«Спершу закриє заняття в борг, якщо вони є»** is shown only with the
  number when there are lessons on debt; the generic line is dropped.
- **A package's name**: keep the derived title, or add an optional name to
  the sale?
- **An extension by hand is not in «Історія»**: `POST /packages/:id/extend`
  writes the audit log only; the history lists the pause extensions.
- **The sale's dates use the browser's time zone** (the known S02 issue):
  «Діє до 30.10» ends at the browser's midnight.
