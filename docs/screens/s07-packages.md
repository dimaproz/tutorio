# S07 — Package Sale and Package Operations

- Status: Waiting for mockups
- Work packets: 7 (sale) and 6.5 (package read surfaces)
- Depends on: S06 (the directions block the sale starts from)

## User job

Sell a package to a student for one direction — by count, by period from the
schedule, or by period X lessons a week — see what it holds and what is paid,
take a payment for it, extend it, move its unused credits to another
direction, or refund.

## Entry points

- "Sell a package" on a direction of the student profile (S06).
- The package opened from the direction block (sheet or page — decided with
  the mockups).

## Screens and dialogs

1. **Sale form**: direction; kind — by count (N lessons, optional valid
   until), by period from the schedule (start and end, credits prefilled
   from the schedule and editable), by period X a week; price per lesson or a
   total; a live preview of credits, price and window (L-80). Selling creates
   no schedule and no payment (L-87); the next actions follow the sale.
2. **Package detail**: kind, window, credits granted / used / left, what was
   paid and what is still owed, the lessons it paid for, its credit history,
   the pauses that extended it.
3. **Package payment dialog**: amount (capped at what it still costs), method,
   date, note.
4. **Extend dialog**: a new "valid until" (L-84).
5. **Transfer dialog**: to another direction of the same student, credits
   recalculated by price, rounded down, the remainder shown (L-85).
6. **Refund dialog**: credits and/or money, method, note (L-85).
7. **Correction** (adjust credits) and **delete** (only an unused package).

## Data available

- `POST /packages/preview` and `POST /packages` — `studentId`, `groupId?`,
  `teacherId?`, `name`, `sizingMode` (`FIXED_COUNT`, `BY_PERIOD`, `BY_PERIOD_WEEKLY`),
  `lessonsTotal`, `lessonsPerWeek`, `validFrom`, `endDate` / `expiresAt`,
  `pricePerLessonMinor` or `totalPriceMinor`, `currency`, `purchasedAt`,
  `notes`. The legacy
  `schedule` and `initialPayment` inputs are not used by the new form and are
  removed from the contract in this step.
- `GET /packages?studentId=`, `GET /packages/:id`, `GET /packages/:id/ledger`.
- `POST /payments` with `packageId`; errors `OVERPAYMENT`, `CURRENCY_MISMATCH`.
- `POST /packages/:id/extend`, `/transfer`, `/refund`, `/adjust`,
  `DELETE /packages/:id`; errors `NOT_ENOUGH_CREDITS`, `REFUND_TOO_LARGE`,
  `INVALID_TRANSFER_TARGET`, `INVALID_PACKAGE_PLAN`.

## Rules

L-80…L-87, L-102; [`product/packages.md`](../product/packages.md) for the
sale flow and next actions.

## Reuse

`FormPageLayout` or `AdaptiveDialog` (decided with the mockups), `ChoiceCard`
(kind), `TextField`, `CreditMeter`, `ProgressMeter`, `StatBlock`, `Notice`,
`DangerZone`.

## What the mockups must show

- [ ] Sale form for each kind with the live preview; price per lesson and
      total.
- [ ] After the sale: the next actions (take a payment, open the schedule).
- [ ] Package detail: new, half used, used up, expired, extended by a pause.
- [ ] Payment, extend, transfer (with a remainder) and refund dialogs.
- [ ] Phone versions.

## Out of scope

Selling to group members (S08); online payments.

## Open questions

- Package detail: a sheet over the profile or its own page?
- Is there a studio-wide packages list, or only per student?
