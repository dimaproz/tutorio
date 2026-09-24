# Finance Aggregate

Last verified: 2026-09-24 (Work Packet 6.4 phase 3: root static/unit/build
checks and isolated PostgreSQL 17 E2E).

The rules are [`product/scheduling.md`](../product/scheduling.md) `L-10`…`L-13`,
`L-61`, `L-70`…`L-74`, `L-80`…`L-91` and
[ADR 0007](../decisions/0007-schedules-per-student-charging-package-credits.md).
Three histories stay separate:

- package credits: `LessonCreditEntry` (what a package was granted, in lessons);
- what each lesson costs each participant: `LessonCharge`;
- money received: `Payment`, in integer minor units and one currency.

A **direction** (an `Enrollment`: a student with one teacher, or a student's
membership of one group) is paid in one of two modes, `Enrollment.billingType`:
`PER_LESSON` (the default for a new direction) or `PACKAGE` (set when its first
package is sold; switchable by hand). The pure rules live in
`packages/domain/src/billing.ts`; `apps/api/src/billing/billing.service.ts`
applies them.

## LessonCharge

| Concern      | Contract                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose      | One participant's cost for one lesson and what pays for it: `PACKAGE` (one credit of `packageId`), `DEBT` (package mode with no credit left) or `BALANCE` (pay-per-lesson; `amountMinor` on the direction's balance).                                                                                                                                                                                                                   |
| Ownership    | Workspace-scoped; unique `(lessonId, enrollmentId)`; `packageId` is set exactly when the source is `PACKAGE` (DB CHECK).                                                                                                                                                                                                                                                                                                                |
| Who owes     | An individual lesson has one participant. A group lesson's participants are the members charged or marked so far plus today's active roster (the roster a tutor backfilling an existing group has). A participant owes the lesson when its status is held, charged-cancelled or no-show, it is not a makeup whose original was charged (L-61), and — in a group — they were not marked excused (no mark counts as present, L-71, L-72). |
| Amount       | An individual lesson's own price; a group member's own rate (the group price unless overridden on their membership). A package charge costs one credit whatever the amount.                                                                                                                                                                                                                                                             |
| Evaluation   | Re-evaluated from state after every status change, attendance change and lesson creation in a final status (`BillingService.syncLesson`), and for the makeup of a lesson whose status changed. Repeating it changes nothing. A charge no longer owed is voided (`voidedAt`, kept as history) and revived with a fresh source when owed again.                                                                                           |
| Package pick | The oldest live package of the direction with a credit left that has not expired at the lesson time (L-81, L-84); none → `DEBT` (L-82). A voided package charge gives its credit back.                                                                                                                                                                                                                                                  |
| Debt cover   | New credits — a sale, a positive correction, a credit given back — cover `DEBT` charges oldest lesson first (L-82). `BALANCE` charges stay money (L-91).                                                                                                                                                                                                                                                                                |
| Price change | An individual lesson's price can change while payments do not reach its balance charge (`409 LESSON_PAID`, L-12); the unpaid charge takes the new amount.                                                                                                                                                                                                                                                                               |
| Delete guard | A lesson with an active charge cannot be deleted (`409 LESSON_CHARGED`); cancel it free or return it to scheduled first.                                                                                                                                                                                                                                                                                                                |

## LessonPackage

| Concern      | Contract                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose      | Prepaid lesson credits for one direction (`enrollmentId`; `studentId` is its student), valid until `expiresAt` when set. The purchase-time price is an immutable snapshot.                                                                                                                                                                                                                                                              |
| Ownership    | Workspace-scoped. A group's packages are its members' packages for the group (`GET /packages?groupId=`).                                                                                                                                                                                                                                                                                                                                |
| Create       | `POST /packages` with `studentId` and, for a group membership, `groupId` (else the student's lessons with `teacherId` or their only teacher; a new direction is created silently, L-2). Writes the package, its `purchase` credit entry and an optional first payment; switches a pay-per-lesson direction to packages; covers the direction's debt. The old package form may still ask for the direction's schedule (not for a group). |
| Credits      | Remaining = credit entries − active charges it pays for; consumed = those charges. `GET /packages/:id/ledger` lists the entries and one `lesson` row per paid lesson.                                                                                                                                                                                                                                                                   |
| Correction   | `POST /packages/:id/adjust` appends a signed `manual_adjustment` with a note; a positive one covers debt.                                                                                                                                                                                                                                                                                                                               |
| Archive      | Soft delete: pays for no new lesson; its credits, charges and payments stay. Restore is not supported.                                                                                                                                                                                                                                                                                                                                  |
| Current gaps | Package kinds by period, extension, transfer, refund and "sell to members" are Work Packet 6.4 phase 5; the low-credit warning is phase 7.                                                                                                                                                                                                                                                                                              |

## LessonCreditEntry

| Concern   | Contract                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------- |
| Purpose   | Append-only record of the credits a package was granted: `purchase` and `manual_adjustment`.                  |
| Ownership | Workspace and package-scoped; unique `idempotencyKey`.                                                        |
| Lifecycle | Insert only; a correction is a new entry, never an edit. What a package paid for is its charges, not entries. |

## Payment

| Concern      | Contract                                                                                                                                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose      | Append-only record of money received for a direction, separate from lesson credits.                                                                                                                                                                                 |
| Ownership    | Workspace and enrollment-scoped; `packageId` for a package payment.                                                                                                                                                                                                 |
| Package      | A package is paid by its own direction (`409 INVALID_PACKAGE_PAYMENT_RELATION`), in its currency (`CURRENCY_MISMATCH`), up to what it still costs (`OVERPAYMENT`). Settled money refreshes the package's cached `paymentStatus`; responses derive it from payments. |
| Balance      | A payment without a package goes on the direction's pay-per-lesson balance, in the direction's currency, and may run ahead of the lessons. It settles the oldest balance charges first (L-90); nothing is stored per lesson.                                        |
| Replay       | A matching `idempotencyKey` replays the original payment; a changed command under the same key is `409 IDEMPOTENCY_CONFLICT`.                                                                                                                                       |
| Current gaps | Future `paidAt` is accepted; there is no refund/correction API.                                                                                                                                                                                                     |

## Billing summary

`GET /enrollments/:enrollmentId/billing` reports a direction's mode and rate,
each live package's remaining credits and whether it is usable now, the credits
left, the lessons held on debt, and the pay-per-lesson balance (charged, paid,
debt, advance, unpaid lessons). The balance counts only charges and payments in
the direction's currency.

Acceptance scenarios (`apps/api/test/billing.e2e-spec.ts`): pay-per-lesson
balance with oldest-first settlement and advance, price change refused once
paid, first sale switching the mode, oldest valid package first with an expired
one skipped, one charge per lesson under concurrent completion and correction,
credit given back on a free cancellation, debt covered by a correction and by
the next sale, balance money kept after the switch, per-member group charges by
attendance, package payment caps and replay, archive, cross-workspace denial.
