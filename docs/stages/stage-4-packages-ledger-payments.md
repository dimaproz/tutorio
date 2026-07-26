# Stage 4 — Packages, Credit Ledger, Payments

> **Outcome:** the single source of truth for money. A tutor always knows who
> owes how much and *why*, backed by an append-only ledger that explains every
> balance. This is the product's differentiator — the reason Tutorio is not
> "Google Calendar with extra steps".
>
> **Pillar:** Money · **Status:** Core · **Depends on:** Stage 3 (lessons,
> state machine), Stage 3.6 (teachers), Stage 3.7 (enrollment resolution).

## 1. Goal & non-goals

**Goals**
1. `LessonPackage` for a student **or** a group; fixed-count and by-period sizing.
2. `LessonCreditEntry` — idempotent, append-only credit ledger in *lesson units*.
3. Wire the Stage 3 state machine to actually write ledger entries on transition
   (the `CreditEffectDescriptor` consumer).
4. Auto-rebook a replacement lesson on uncharged cancellation.
5. `Payment` (manual) in *currency minor units*, separate from the credit ledger.
6. `PackageParticipantShare` — per-member owed/paid split for group packages.
7. Finance screens: package detail with a "why the balance is this" history, and
   per-student/group balance views; manual balance adjustment.
8. Package-creation flow optionally provisions the recurring `LessonSeries`
   (built together with the Stage 3 materializer).

**Non-goals**
- No online acquiring (Stage 5+/out of MVP) — only the `PaymentProvider`
  interface with a single `manual` implementation.
- No multi-currency FX rollup (out of MVP) — balances shown per currency.
- No receipts/PDF (Stage 8).

## 2. Two ledgers, never one

Money ledger and credit ledger are **different entities in different units** and
must not be merged (mvp-plan gap #1):

- **`Payment`** — currency minor units. "The student paid 200 EUR."
- **`LessonCreditEntry`** — lesson units (±N). "The balance gained 8 lessons /
  consumed 1 lesson." Buying a package produces both: a `Payment` (money) and a
  `purchase` credit entry (lessons).

## 3. Domain model (Prisma deltas)

Per mvp-plan §"Data schema"; concretely:

- `LessonPackage` — `studentId? | groupId?` (exactly one), `sizingMode:
  FIXED_COUNT | BY_PERIOD`, `lessonsTotal?`, `endDate?`,
  `pricePerLessonMinorSnapshot`, `totalPriceMinorSnapshot`, `currency`,
  `paymentStatus: PAID | PENDING | PARTIAL`, `purchasedAt`, `expiresAt?`, `notes`,
  `workspaceId`, `deletedAt`.
- `LessonCreditEntry` — `packageId`, `enrollmentId`, `delta: Int`, `type:
  purchase | lesson_completed | late_cancellation | teacher_cancellation_refund
  | manual_adjustment`, `lessonId?`, `idempotencyKey @unique`, `note`,
  `createdBy`, `createdAt`, `workspaceId`. **Append-only.**
- `PackageParticipantShare` — `packageId`, `enrollmentId`, `oweMinor`,
  `paidMinor`. One row per group member (equal split of
  `totalPriceMinorSnapshot` by default).
- `Payment` — `enrollmentId`, `amountMinor`, `currency`, `method: CASH |
  BANK_TRANSFER | OTHER`, `packageId?`, `paidAt`, `note`, `workspaceId`,
  `deletedAt`.
- `Lesson.packageId` already exists (Stage 3); `LessonSeries.packageId` already
  exists. No calendar migration needed.

Indexes: `LessonCreditEntry(packageId, createdAt)`, `(idempotencyKey)`;
`Payment(enrollmentId, paidAt)`; `LessonPackage(workspaceId, studentId)` /
`(workspaceId, groupId)`.

**Effective (adjusted) total is a read-time derivation** from the credit ledger
(uncharged-cancelled lessons reduce it), never a stored column. Keep
`totalPriceMinorSnapshot` as the immutable purchase value.

## 4. Domain logic (`packages/domain`) — the heart of this stage

This is where the competitive advantage lives; **write tests first**.

### 4.1 Status → ledger rules
Consume the existing `transitionEffect` from
[lesson-state.ts](../../packages/domain/src/lesson-state.ts) and turn each
`CreditEffectDescriptor` into a concrete, idempotent `LessonCreditEntry` intent:

- `COMPLETED` → `lesson_completed` Δ−1.
- `CANCELLED_CHARGED` → `late_cancellation` Δ−1 (slot held, credit consumed).
- `CANCELLED_UNCHARGED` → `teacher_cancellation_refund` Δ0 **+ an auto-rebook
  intent** (a replacement lesson from the same series/pattern).
- Revert to `SCHEDULED` → compensating entry (negation), never a delete.

`idempotencyKey = f(lessonId, entryType)` so repeated clicks / retries / moving a
lesson back never double-write.

### 4.2 Package math (pure)
- `planPackage(input)` → number of lessons + per-lesson snapshot + total, for
  both sizing modes (fixed count; by-period given weekday rule + endDate).
- `effectiveTotal(pkg, entries)` → adjusted total after uncharged cancellations.
- `splitShares(totalMinor, members)` → equal split with remainder distribution
  (last member absorbs the rounding remainder so shares sum exactly).
- `packageBalance(entries)` → remaining credits; `paymentStatus(shares|payments)`
  derivation.

### 4.3 The 8 canonical cases (mvp-plan verification)
Encode each as a domain test: "8 lessons for a 9-lesson month", late
cancellation, refund on teacher cancellation, freeze (paused enrollment stops
generation), price snapshot immutability, idempotent double-charge, revert
compensating entry, auto-rebook-on-uncharged-cancel.

## 5. Validation (`packages/validation`)

- `CreatePackageDto` (studentId XOR groupId; sizingMode discriminated union:
  fixed → `lessonsTotal`, period → `endDate`; pricePerLesson; currency; optional
  recurring `schedule` = weekdays + localTime + timezone + durationMin).
- `RecordPaymentDto` (enrollmentId, amountMinor, currency, method, packageId?,
  paidAt, note?).
- `AdjustBalanceDto` (packageId, delta, note) — manual adjustment.
- `PackageResponse` includes derived `effectiveTotalMinor`, `remainingCredits`,
  `paymentStatus`, `shares[]`.

## 6. API (NestJS) — `packages` + `payments` modules

Follows the existing module shape (dto/, controller, service, module, spec),
`AccessTokenGuard`, audit-in-transaction, `business.errors.ts`.

### `packages` module
- `POST /packages` — creates `LessonPackage`, the `purchase` credit entry, group
  `PackageParticipantShare[]`, and (if a schedule is given) the `LessonSeries`,
  then materializes it via the Stage 3 `MaterializerService`. **All in one
  transaction** + audit.
- `GET /packages?studentId|groupId` , `GET /packages/:id` (with derived fields +
  ledger history for the "Історія"-style view).
- `POST /packages/:id/adjust` — manual `manual_adjustment` entry (owner-gated).
- `GET /packages/:id/ledger` — append-only entries, newest first.
- `DELETE /packages/:id` — soft delete (does not delete ledger history).

### `payments` module
- `PaymentProvider` interface with a single `ManualPaymentProvider`
  implementation (keeps the door open for acquiring later).
- `POST /payments` — records a `Payment`, updates the relevant
  `PackageParticipantShare.paidMinor` / package `paymentStatus`. Transaction +
  audit.
- `GET /payments?enrollmentId|packageId`.

### Ledger-write integration
- `lessons.service.transition` (Stage 3) now, inside its transaction, calls a
  `ledger.service.applyTransition(lesson, from, to, actor)` that writes the
  idempotent entry and, for uncharged cancel, enqueues the auto-rebook via the
  materializer. Idempotency key prevents duplicates on retry.

**Concurrency:** ledger writes take the package row in the same transaction;
unique `idempotencyKey` is the backstop against races.

## 7. Web (`apps/web`)

Enable the **Finance** nav item (currently "coming soon" in
[app-sidebar.tsx](../../apps/web/src/components/app/app-sidebar.tsx)).

TailAdmin references first: **invoice/transaction table + status badges** and
**stat cards** from `demo.tailadmin.com/analytics`; package "history" as a
timeline/activity list.

- `features/packages` — package create dialog (sizing-mode toggle, optional
  recurring schedule sub-form that feeds the series), package detail (snapshot
  vs effective total, remaining credits ring, group "Оплати учасників" block
  with per-share paid/pending badges + "record payment"), ledger history tab.
- `features/payments` — record-payment dialog, payment list.
- Student & group detail pages gain a **Balance** card + link into the finance
  view (fulfils the Stage 3.7 "student as hub" with real money now).
- Cancellation dialog's transitional "billing soon" hint is **removed** — the
  effect is now real and visible in the ledger.

## 8. Sequencing

1. Prisma migration (packages, credit entries, shares, payments).
2. Domain: package math + status→ledger rules + the 8 cases (tests first).
3. Validation DTOs + `api-client`.
4. `packages` module (create + read + ledger) with service tests.
5. Ledger-write integration into `lessons.transition` + auto-rebook.
6. `payments` module + share updates.
7. Web finance slices; enable Finance nav.
8. Supertest integration for the two critical flows.

## 9. Testing

- **Domain (vitest):** all package math + the 8 canonical cases + idempotency +
  compensating reverts.
- **API (supertest + test Postgres):** buy package → complete lesson → credit
  consumed; teacher-cancel (uncharged) → refund Δ0 + replacement lesson booked;
  record payment → share/paymentStatus updates; double-transition → single entry.
- **Web:** package create (both sizing modes), record payment updates badge,
  ledger history renders derivation.

## 10. Definition of Done

Global DoD + : the **manual scenario checklist** for the 8 complex cases runs
green on the dev environment; a package's detail page answers "why is the balance
this" from real ledger rows; group package splits money per participant while
sharing one schedule.

## 11. Risks & decisions

- **Merging the two ledgers** — forbidden; enforced by separate tables/units.
- **Double-charging on retries** — `idempotencyKey (lessonId, entryType)` unique.
- **Rounding on group split** — remainder to the last share; `splitShares` sums
  exactly; tested.
- **Series ownership** — `LessonSeries` is created/owned by the package flow;
  the standalone `/lessons/patterns` view edits the same entity (built in Stage 3
  already), so keep one materializer path.
- **Freeze semantics** — a paused/archived `Enrollment` stops generation and
  ledger accrual; the materializer already skips non-active enrollments.
