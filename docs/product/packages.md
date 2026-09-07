# Lesson Package Workflow

Last verified: 2026-08-24 through source inspection and a local authenticated
visual audit of `/app/packages` and the create dialog at a desktop viewport.

## User job

“Sell a defined set of lessons, know how many remain, and record what I received.”

A package is a commercial agreement and entitlement record. It is not the same
job as scheduling lessons, and it is not the same job as recording a payment.

## Current experience

The current “New package” dialog performs up to four jobs atomically:

1. Select a student or group and name the plan.
2. Choose fixed-count or period sizing, quantity, expiry, price, and currency.
3. Create a recurring series with weekday, time, duration, timezone, and start.
4. Select an initial payment state and optionally create a payment.

The form is almost 800 lines
([package dialog](../../apps/web/src/components/packages/package-form-dialog.tsx)).
Its default state enables a Monday 10:00 recurring schedule, creating a
high-impact side effect before the user has intentionally chosen a time.

### Observed comprehension and trust issues

- “Fixed count” and “By period” expose implementation categories before the
  tutor understands the promise to the student.
- The dialog requires schedule and payment concepts before the plan exists.
- The initial payment flow asks the user to choose pending/partial/paid even
  though status should be derived from payments.
- Group “price per lesson” is the price for the whole group lesson, then split
  across participants, but the split is not previewed before creation.
- List cards emphasize payment status but do not clearly distinguish active,
  depleted, expired, or archived lifecycle.
- The package page has no complete search/filter/pagination experience and loads
  a fixed first page.
- Student detail has no package summary or prefilled “Add package” action even
  though the form supports a locked target.
- Archive/delete copy does not explain that package-owned recurrence can continue.

## Pilot vocabulary

Use human terms in primary UI and keep ledger terminology inside history/help.

| Internal/current term | Pilot-facing meaning       |
| --------------------- | -------------------------- |
| Package               | Lesson pack or lesson plan |
| Fixed count           | Pack of lessons            |
| By period             | Monthly/date-range plan    |
| Credit balance        | Lessons remaining          |
| Effective total       | Plan total                 |
| Paid                  | Received                   |
| Pending               | Payment due                |
| Adjust balance        | Correct lessons remaining  |
| Delete package        | Archive plan               |
| Credit ledger         | Activity history           |

Validate the localized “subscription/pass” concept against the existing
localized “package” concept with Ukrainian-speaking pilot tutors; change locale
copy from evidence rather than internal preference.

## Target pilot flow

The primary entry point is the student or group profile: `Add lesson plan`. The
target is already selected. The package list remains a secondary global entry.

### Step 1: Create the plan

Primary fixed-pack fields:

| Field            | Behavior                                                             |
| ---------------- | -------------------------------------------------------------------- |
| Lessons included | Default 8; required positive integer                                 |
| Price per lesson | Required for a paid plan; minor-unit conversion at the boundary      |
| Plan total       | Computed and shown before submit                                     |
| Expiration       | Optional, with a visible workspace default rather than hidden policy |

Name and notes are under “More options.” Confirmation says explicitly:
“Adds 8 lessons to this student. It does not schedule lessons or record payment.”

Fixed-count individual plans are the default pilot path. Period plans are hidden
or advanced until their separate cancellation/entitlement matrix passes. Group
plans require participant/price preview and may be deferred until individual
plans are proven.

### Step 2: Post-create next actions

- Primary: Schedule lessons.
- Secondary: Record payment.
- Tertiary: View plan.

No schedule is created by default. When scheduling, reuse a current student/group
pattern if one exists, show weekday/time/duration, and keep timezone and conflict
override under advanced controls. Never silently default a real occurrence to
Monday at 10:00.

### Step 3: Record payment

- Prefill the outstanding amount.
- Ask amount, method, and received date.
- Derive payment status from settled money; do not ask for pending/partial/paid.
- Reject unrelated enrollment, currency mismatch, duplicate idempotency, and
  accidental overpayment with specific recovery guidance.

### Group plan preview

If enabled in the pilot, state: “The entered price is for one group lesson and
is split across the current active students.” Preview each participant’s total
share before save. Shares are a purchase-time snapshot; later roster changes do
not silently rewrite past debt.

## Detail and list contract

Package detail leads with four plain metrics:

- Lessons remaining.
- Plan total.
- Received.
- Outstanding.

Then show linked schedule and one chronological activity history combining
human-readable credit, payment, adjustment, and lifecycle events without mixing
their units. “Correct lessons remaining” and archive belong in an owner/admin
overflow menu.

The list supports search, target filter, payment-due filter, active/depleted/
expired/archived states, and real pagination. Default order prioritizes active
plans needing attention.

## Lifecycle and cancellation contract

- Archive prevents new charges, stops package-owned series, and archives only
  future scheduled package lessons; it preserves credit, payment, share, lesson,
  and audit history.
- A charged lesson always references the exact package it consumed.
- Cancellation follows ADR 0003: free/teacher cancellation retains credit but
  does not reduce plan total; a monetary discount is explicit.
- Cancellation never creates a replacement lesson automatically. A tutor may
  explicitly schedule or reschedule a real replacement through the normal,
  conflict-checked scheduling flow.
- Corrections and refunds are append-only, reasoned events; plan/payment history
  is not edited away.

## State and accessibility contract

- Loading: target search and defaults have skeleton/progress states; query errors
  are not rendered as empty choices.
- Validation: server relationship/currency/conflict errors map to the responsible
  step and preserve all input.
- Success: next-action screen replaces toast-only completion.
- Destructive: archive preview lists series, future lessons, remaining credits,
  received money, and what is retained.
- Keyboard/mobile: segmented controls expose selected state, actions stay visible,
  and the primary flow fits without nested horizontal/vertical traps.
- Locale: product terms, money, dates, weekday names, and timezone explanations
  are verified in Ukrainian and English.

## Domain/API requirements before redesign

1. Parse `force=false` as false at the runtime boundary and regression-test
   conflict blocking.
2. Require payment enrollment to belong to the package target/share; validate
   currency, date, idempotency, and overpayment policy.
3. Persist the charged package on every package-funded lesson and remove
   newest-package compensation fallback.
4. Implement ADR 0003 and keep package total/payment status independent from
   zero-delta credit events.
5. Define archive behavior for linked series and future lessons.
6. Resolve multiple-enrollment, group-teacher, and group-currency assumptions.

## Acceptance criteria

- A first-time tutor can explain lessons included, total, received, outstanding,
  and the next action before saving.
- Creating a plan alone creates no series, lesson, or payment.
- Recording payment cannot affect another student/group or currency.
- Repeating a cancellation/restore command does not change totals or shares.
- Every displayed balance reconciles to its chronological history.
- Interaction tests cover create, schedule-next, payment-next, group preview,
  conflict, archive consequence, loading/error, and locale states.

## Implementation slices

1. Fix P0 finance/scheduling invariants and add domain/service/E2E regression tests.
2. Add prefilled “Add lesson plan” to student detail; defer or explicitly gate
   group/period paths.
3. Implement compact fixed-pack creation with a consequence summary.
4. Add separate post-create schedule and record-payment flows.
5. Rework detail/list lifecycle and attention states with pagination.
6. Split the legacy dialog by feature concern as the new flow replaces it; avoid
   a standalone cosmetic refactor.
