# S06 — Student Profile: Directions, Billing, Schedules and Pause

- Status: Waiting for mockups
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

- [ ] A student with one package direction (credits running low), one
      pay-per-lesson direction with debt, one group direction.
- [ ] A direction on debt; a student with advance; several currencies.
- [ ] Pause dialog (whole student and one direction), a running pause, a
      scheduled one, ending early.
- [ ] Payment dialog.
- [ ] Phone version of the blocks.

## Out of scope

Selling and operating packages (S07); the group side of a membership (S08).

## Open questions

- Directions as cards, or a table with an expandable row?
- Is the pause its own block or part of the status control?
