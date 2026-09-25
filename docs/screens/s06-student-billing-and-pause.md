# S06 — Student Profile: Directions, Billing, Schedules and Pause

- Status: Done (2026-09-25, commits `babec39`…`a9f3aa3`; the owner's answers
  `30145da`…`1654c66`)
- Work packet: 6.4 (screens)
- Depends on: S05 (schedule form), S07 for the package sale button target
  (until then the button is hidden)

## User job

On one student's profile, see for each direction (a teacher, or a group) how
it is paid — packages and credits left, debt, balance, the warning — its
schedule, and whether the student is on a break; record a payment; pause the
student or one direction and bring them back.

## Route

`/app/students/[studentId]` — new blocks on the existing rebuilt profile.

## Screens and dialogs

1. **Directions block**: per direction — teacher or group, billing mode
   (packages / pay per lesson), rate, credits left, lessons on debt,
   pay-per-lesson debt ("Debt: 1 200 ₴ · 3 lessons") or advance, the warning
   (on debt, no credits, running low), the schedule summary, actions.
2. **Totals** per currency.
3. **Direction settings dialog**: billing mode, rate, cancellation deadline
   (L-10, L-11).
4. **Record a payment dialog** (pay-per-lesson): amount, currency, method,
   date, note; settles the oldest lessons first (L-90).
5. **Pause block and pause dialog**: whole student or one direction, from
   (now or later), until (optional), reason; what it does — lessons off the
   calendar, no charges, packages extended (L-100…L-104).
6. **End or cancel a pause**: return now, with the conflict dialog if a
   returning lesson overlaps (force), or cancel one that has not begun.
7. Replaces the current "On a break" hold dialog with the pause dialog.

## Data available

- `GET /students/:id/billing` — `directions[]` (mode, rate, packages, credits
  left, debt lessons, balance, `warning`, teacher, group, status), `totals[]`,
  `lowCreditThreshold`.
- `PATCH /enrollments/:id` — `billingType`, `priceMinor`, `currency`,
  `cancellationDeadlineHours`.
- `POST /payments` — `enrollmentId`, `amountMinor`, `currency`, `method`,
  `paidAt`, `note`; `GET /payments?enrollmentId=`.
- `GET /schedules?studentId=`.
- `GET /pauses?studentId=&state=current|all`, `POST /pauses`,
  `POST /pauses/:id/end?force=`; errors `PAUSE_OVERLAP`, `PAUSE_ENDED`,
  `SCHEDULE_CONFLICT`.
- `PATCH /students/:id` `status` `ON_HOLD` / `ACTIVE` still opens and ends a
  whole-student pause.

## Rules

L-10, L-11, L-20, L-23, L-80…L-85, L-90, L-91, L-100…L-104.

## Reuse

`InfoCard`, `CreditMeter`, `StatBlock`, `LinkedCard`, `Notice`,
`AdaptiveDialog`, `TextField`, `Segmented`, `StudentStatusControl`
(re-pointed to the pause dialog).

## What the mockups must show

- [x] A student with one package direction (credits running low), one
      pay-per-lesson direction with debt, one group direction.
- [x] A direction on debt; a student with advance; several currencies.
- [x] Pause dialog (whole student and one direction), a running pause, a
      scheduled one, ending early.
- [x] Payment dialog.
- [x] Phone version of the blocks.

## Out of scope

Selling and operating packages (S07); the group side of a membership (S08).

## Mockups

The owner's handoff `tutorio-s06-student-billing`: boards «ProfileLearning»
(13 desktop states, 10 phone states) and «ProfileDialogs» (13 desktop states,
4 phone sheets), 1440 and 390, light and dark, with the canvas source. The
repository does not keep mockups.

| NN            | State                                | Story (`Students/Screens/Learning`)           |
| ------------- | ------------------------------------ | --------------------------------------------- |
| Profile 01    | Один напрям · пакет                  | Playground (`state: package`)                 |
| Profile 02    | Пакет оплачено частково              | Playground (`partial`)                        |
| Profile 03    | Пакет закінчується                   | Playground (`low`)                            |
| Profile 04    | Борг                                 | Playground (`debt`)                           |
| Profile 05    | Аванс                                | Playground (`advance`)                        |
| Profile 06    | Два напрями                          | Playground (`two`)                            |
| Profile 07    | Три напрями · дві валюти             | MultiCurrency (`three`)                       |
| Profile 08    | Пауза запланована                    | Playground (`pauseScheduled`)                 |
| Profile 09    | На паузі                             | Playground (`paused`)                         |
| Profile 10    | Напрям на паузі                      | Playground (`directionPaused`)                |
| Profile 11    | Меню напряму                         | DirectionMenu                                 |
| Profile 12    | Вкладка «Пакети»                     | PackagesTab                                   |
| Profile 13    | Вкладка «Оплати»                     | PaymentsTab                                   |
| Dialogs 01–02 | Оплата · форма, більше за борг       | Payment                                       |
| Dialogs 03    | Оплата · частина пакета              | PaymentPackagePart                            |
| Dialogs 04    | Оплата · помилка                     | PaymentError                                  |
| Dialogs 05–06 | Налаштування, зміна режиму           | DirectionSettings                             |
| Dialogs 07–08 | Статус · меню, пауза усього навчання | PauseWholeStudent                             |
| Dialogs 09    | Пауза · один напрям                  | PauseOneDirection                             |
| Dialogs 10    | Пауза · помилки                      | PauseErrors                                   |
| Dialogs 11    | Скасувати паузу                      | CancelPause                                   |
| Dialogs 12    | Повернути зараз                      | ReturnNow                                     |
| Dialogs 13    | Повернути · накладки                 | ReturnConflicts                               |
| Phone         | Cards, menu sheet, dialog sheets     | Phone (and the viewport toolbar on any story) |

Checked at 1440 and 390, light and dark, Ukrainian and English, including the
three-direction, two-currency student.

## Decisions (with the owner, from the handoff)

1. **Directions are stacked pass cards** (the brief's first open question),
   one per direction, under the metrics and above the tabs: a stub, a dashed
   perforation, the body. On phones the stub sits above the body.
2. **The stub's tint follows the state**: indigo package, warning running
   low, danger debt, success advance, grey paused; a ticket, a receipt with
   «!» or coins (no currency glyph) as inline SVG in
   `components/shared/pass-art.tsx`.
3. **Currency comes from the amount** (`+240 zł`, `−1 050 ₴`); totals are
   chips per currency, never summed.
4. **A package's price is shown whole**: «4 000 ₴ за пакет», «8 занять ·
   500 ₴ за заняття».
5. **A package can be paid in part**: the card shows what is paid and left,
   and the payment dialog asks what it pays for.
6. **The first metric follows the billing mode**: «Залишок занять» for
   packages, «Баланс» (debt or advance) when every direction pays per lesson;
   with several currencies «Оплачено» reads «—» and «Кілька валют».
7. **Payment method defaults to «Переказ»**, first in the segmented control.
8. **The pause is its own dialog** (the brief's second open question),
   reached from the status control («На паузі»), the direction's ⋯ and the
   banner. `ON_HOLD` reads «На паузі» / «Paused»; the old hold dialog is gone.
9. **The pause banner** is an info `Notice` above the hero with its actions
   grouped; on phones they sit under the text (`Notice actionPlacement`).
10. **A paused direction keeps its debt red** («борг лишається»).
11. **The tabs stay**: «Пакети» is the package history, «Оплати» the ledger.
12. **Next-lesson actions return**: «Відкрити урок» and «Перенести» (the S01
    move); the lessons tab has «+ Заняття» (full width on phones).
13. **`StudentLearningCard` is removed**, with the old packages card and the
    enrollment and package badges only they used.

## Data (answers to the handoff's section 4)

1. **Package price and paid amount**: added to `GET /students/:id/billing`
   `directions[].packages[]` — `lessonsTotal`, `totalPriceMinor`,
   `paidMinor`, `paymentStatus`, `validFrom` (API tests in
   `read-models.e2e-spec.ts`).
2. **Unpaid lesson dates**: `balance.unpaid[]` — each unpaid lesson, oldest
   first, with what is still owed on it. The card's caption, the payment
   dialog's chips and its preview read it.
3. **Payment preview**: computed on the client from `balance.unpaid` with the
   same oldest-first allocation as the API (L-90) — «Закриє 2 заняття», a
   lesson paid in part, «Борг стане 0 ₴», «+1 000 ₴ піде в аванс»; a package
   payment from its price and paid amount.
4. **Pause preview**: `POST /pauses/preview` (the create body, optionally
   `replacesPauseId`) saves the pause in a transaction it rolls back and
   returns, per direction, the individual lessons it takes off and the group
   lessons the student misses, the packages' new ends, and whether the
   student goes on hold.
5. **The conflict payload on ending a pause**: `POST /pauses/:id/end` now
   answers 409 `SCHEDULE_CONFLICT` with described `details.conflicts` (date,
   time, who, kind), student overlaps included; `POST /pauses/:id/end/preview`
   returns the returning lessons, their conflicts and the extension change
   before anything is done, so the dialog shows the pairs up front.
6. **Cancelling a scheduled pause**: the same `POST /pauses/:id/end` before
   `startsAt` (state CANCELLED); the preview says what stays and that the
   package is not extended.
7. **Changing a pause** («Змінити» on both banners): `PATCH /pauses/:id`
   ends the old pause and starts the new one in one transaction — a
   scheduled pause takes a new window, direction and reason, a running one a
   new end and reason (`PAUSE_RUNNING` otherwise).
8. Also added for the pass: each direction's own
   `cancellationDeadlineHours`, the studio's at the top, the teacher's
   `avatarKey` and `subjects` (an individual direction is named by its
   subject: «English · пакет …»).

## Confirmed with the owner after the build (2026-09-25)

- **A pause return with overlaps offers both**: «Повернути без них»
  (`skipConflicts=true`: only the free lessons come back) as the main action
  and «Повернути все одно» (`force=true`: every lesson back on top of the
  others, L-111) as the quieter one; a changed pause the same with «Зберегти
  без них» / «Зберегти все одно».
- **The currency field stays locked** to the direction's currency (the API
  rejects any other, `CURRENCY_MISMATCH`), where the board draws a select.
- **«+ Напрям»** opens «Новий розклад» for the student: a schedule with a new
  teacher opens the direction (L-2). «Змінити розклад» in the ⋯ opens the
  direction's schedule change, or a new schedule when it has none.
- **Row menus** of the package and payment rows stay empty until S07.
- **«закрито N заняття»** under a pay-per-lesson payment, without the dates:
  `GET /payments` returns `settledLessons` — how many lessons each payment
  finished paying, oldest first (L-90, `settledLessonsByPayment` in the
  domain).
- **«Оплачено цього місяця»**: the money metric counts this calendar month's
  payments, refunds taken off, with the owed badge; «Цього місяця оплат не
  було» when there are none.
- **The subject names an individual lesson**: the lesson read returns
  `subject` (the teacher's first subject; null for a group), so the lesson
  rows and the next-lesson card read «English» instead of «Індивідуальне
  заняття».
- **Used and expired packages are muted** by their grey icon tile and a muted
  name and price (the board's row opacity failed the contrast checks).

## Decided while building

- **The low-credit field is left out** of direction settings: the threshold
  is studio-wide (`lowCreditThreshold`, L-120, S10).
- **«Завершити навчання»** archives the direction (`status: ARCHIVED`, kept
  in history) after a confirmation; an archived direction stays in the block
  only while money is owed or paid ahead on it.
- **A payment carries an idempotency key** per opening of the dialog, so a
  double click records the money once.
- **The pause dialog stores the reason chip's key** (`HOLIDAY`, `ILLNESS`,
  …) so each locale names it; other text shows as it is.
- **«Записати оплату» outside a pass** (the «Оплати» tab) goes to the
  direction with money owed first.
- **The ledger's summary** sums on the client from `GET /payments?studentId=`
  (up to 100 rows), refunds from the `REFUNDED` payments.

## Open questions

- **«1 невикористане»** under a refund: the refunded credits are a separate
  credit entry, not on the payment; the row names the package only.
- **«Продати пакет»** stays hidden until S07 (the card, the ⋯ and the
  «Пакети» tab keep its place).
