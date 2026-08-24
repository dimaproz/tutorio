# Tutorio — Idea Analysis and Web-MVP Development Plan

## Context

Product: a "financial calendar" for private tutors and small schools (up to 3–5 teachers). The core is lesson packages, lesson credit balance, and an operations ledger — not just a CRM/calendar. The first pilot is our own school, SpeakWise.

Decisions made with the user:
- **Stack**: monorepo, a separate **NestJS API + Next.js web** (as in the user's original plan).
- **UI languages**: Ukrainian + English from the start (an i18n scaffold is mandatory).
- **Payments in the MVP**: manual recording only; online acquiring is a later stage, but the `PaymentProvider` interface is defined up front.
- **Development mode**: a single developer working alongside a main job → the plan is built in vertical slices over a ~14–16 week horizon.
- Mobile app (Expo) — after the web MVP, out of scope for this plan.

## Assessment of the Original Plan

Strengths (kept as-is): positioning via complex financial cases; a ledger instead of a mutable `balance`; price snapshot at purchase time; `LessonSeries` ≠ `Lesson`; money in minor units; workspace model; refusing to accept money on our own account; a clear anti-scope list.

### What to refine in the plan (gaps to address up front)

1. **Two separate ledgers, not one.** The money ledger (Payment, in currency, minor units) and the lesson-credit ledger (LessonCreditEntry, in lesson units) are different entities with different semantics. Mixing them into a single `LedgerEntry` is not allowed: "+8 lessons" and "+200 EUR" are operations in different units. The link between them: buying a package = Payment (money) + credit accrual (lessons).
2. **Timezones and DST.** A recurring schedule is stored as a rule in the teacher's timezone (`weekday + local time + tz`); concrete `Lesson`s are materialized in UTC. Otherwise, on the DST switch, all recurring lessons would "drift" by an hour. Students have their own timezone — each sees the time in their own zone.
3. **Series materialization.** `Lesson`s are generated from `LessonSeries` over a rolling horizon (e.g., 12 weeks ahead) by a cron job. Editing a series follows "only this lesson / this and following" semantics (like Google Calendar). A rescheduled/cancelled lesson is marked `isDetached` and is not regenerated.
4. **Lesson status state machine.** Explicit statuses and allowed transitions: `scheduled → completed | cancelled_by_teacher | cancelled_by_student | no_show`; student cancellation splits into "on time" and "late" by a configurable deadline (hours before the lesson). Each transition produces (or does not produce) an operation in the credit ledger — this is the core of the product; it lives in `packages/domain` and is covered by unit tests first.
5. **Idempotency of ledger operations.** A unique key like `(lessonId, entryType)` on a charge/refund protects against double-charging on repeated clicks or retries. Moving a lesson status back (completed → scheduled) creates a compensating entry rather than deleting the old one.
6. **The package belongs to the Enrollment, not the group.** In a group each student has their own package, own price, own payment date. All financial entities are tied to `Enrollment` (student+group or student+individual).
7. **Import from spreadsheets (CSV).** Critical both for migrating SpeakWise and for onboarding any teacher — they all come from Google Sheets. Missing in the original plan; added in stage 7.
8. **Public student page — token link.** Access via an unguessable token (e.g., 32 bytes), read-only; the "confirm/cancel lesson" actions are separate signed actions with rate limiting. No registration required for students (this was already in the plan — we lock in the mechanics).
9. **Freeze = Enrollment status** (`active | paused | archived`), not a separate feature. Pausing stops lesson generation and reminders.
10. **The dashboard does not sum currencies.** Income is shown separately per currency (EUR: …, UAH: …, PLN: …) — without conversion rates in the MVP.
11. **Soft delete + AuditLog** for students, lessons, and financial records — the teacher will make mistakes, and "delete permanently" is unacceptable.
12. **GDPR minimum in the MVP**: privacy policy, workspace data export (JSON), full workspace deletion on request, a "parent contact" field for minors. DPA and an access log — after reaching paying EU customers.
13. **Testing strategy**: unit tests of the domain logic (ledger, cancellation policy, recurrence/DST, price snapshot) are mandatory and written together with the code; e2e is a thin smoke layer later. The domain logic is exactly the competitive advantage, so that is what we test.
14. **Infrastructure simplifications for a solo developer**: instead of Docker-on-VPS — a managed platform (Railway/Fly.io: API + Postgres + Redis together), web on Vercel. BullMQ is not needed in the MVP — `@nestjs/schedule` cron is enough; Redis will be added together with online payments. Mandatory: automatic Postgres backups from day one, Sentry.
15. **Monetization**: we do not build billing in the MVP, but `Workspace` already has a `plan` field (`free | pro`) and limits — so we don't have to migrate later.

### What to remove from the original MVP module list
`payments-webhooks`, `integrations`, `reports` (the dashboard is enough), `BullMQ/Redis`, Google Calendar sync.

## Architecture

### Monorepo structure (pnpm workspaces + Turborepo)

```
apps/
  web/            — Next.js (App Router, TS, Tailwind, shadcn/ui, TanStack Query,
                    React Hook Form, next-intl, react-big-calendar)
  api/            — NestJS (REST, Swagger/OpenAPI, Prisma, passport-jwt, @nestjs/schedule)
packages/
  domain/         — pure business logic without I/O: charge/refund rules,
                    cancellation policy, recurrence/materialization, money utilities.
                    Maximum test coverage (vitest).
  validation/     — Zod DTO schemas, shared by web and api
  api-client/     — TS client generated from OpenAPI (openapi-typescript + fetch wrapper)
  config/         — eslint-config, tsconfig
```

`ui-tokens` — deferred until the mobile app.

### NestJS modules (MVP set)

`auth`, `workspaces` (incl. receipt/branding settings, timezone, meeting link), `students`, `parents`, `groups`, `enrollments`, `leads`, `scheduling` (packages + series + lessons + attendance statuses), `packages` (packages + credit ledger), `payments` (manual, + a PaymentProvider interface with a single `manual` implementation), `progress` (grades, homework, test results, journal, attendance), `analytics` (aggregation/reporting endpoints), `telegram` (reminders, homework delivery, teacher digest, bot linking), `dashboard`, `audit`, `public` (student page by token), `import` (CSV). `receipts` (PDF generation) can live inside `workspaces` or as its own thin module — decide at implementation time.

### Data schema (Prisma, key entities)

- `Workspace` (plan, defaultCurrency, cancellationDeadlineHours, **timezone**, **meetingLink**)
- `WorkspaceReceiptSettings` (workspaceId 1:1, businessName, recipientLine, email, phone, taxId, address, primaryColor, secondaryColor, invoicePrefix, currencySymbol, paymentRequisites, footerText)
- `User`, `WorkspaceMember` (role: owner | teacher) — the login/auth identity
- `Teacher` (workspaceId, fullName, email?, phone?, telegramUsername?, subjects[] (validated against the subject catalogue at the app layer), bio?, defaultRateMinor?+currency?, color? (hex, per-teacher calendar tint), avatarKey?, status: active|archived, workspaceMemberId? (unique; links a teacher profile to a login account — null for account-less teachers), notes) — the **teaching profile**, decoupled from the login account. A teacher may exist without a `User`/`WorkspaceMember` (a hired tutor with no login). `Enrollment.teacherId`, `Lesson.teacherId` and `LessonSeries.teacherId` reference **`Teacher`**, not `WorkspaceMember` (repointed 2026-07-24; a `Teacher` row is backfilled for every existing teacher member in the migration).
- `TelegramLink` (workspaceMemberId, chatId, connectedAt) — teacher's own bot connection for the daily digest; a student's reminder link instead keys off `Student.telegramUsername` + the bot's own chat-start webhook to capture `Student.telegramChatId`
- `Student` (fullName, phone?, **telegramUsername?**, **telegramChatId?**, **subject?**, **hourlyRateMinor**, currency, timezone, notes, **status: active|on_hold**, **languageLevel?** (CEFR), **knowledgeLevel?**, **age?**, **grade?**, publicToken) — `parentName/parentEmail/parentPhone` are replaced by the `Parent` relation below
- `Parent` (fullName, phone?, telegramUsername?, notes)
- `StudentParent` (studentId, parentId) — many-to-many join table
- `Group` (name, notes, **pricePerLesson (Minor)**, currency)
- `Enrollment` (studentId, groupId?, teacherId, status: active|paused|archived, priceMinor, currency, cancellationDeadlineHours?, billingType: package|monthly|per_lesson) — `priceMinor`/`currency` are overrides; default comes from `Student.hourlyRateMinor` or `Group.pricePerLesson`
- `Lead` (fullName, subject?, expectedHourlyRateMinor?, currency, phone?, telegramUsername?, email?, source: unknown|referral|instagram|website|other, stage: new|contacted|trial_scheduled|trial_completed|converted|lost, trialType: none|free|paid, notes, convertedStudentId?)
- `LessonPackage` (studentId? | groupId? — exactly one set, name, **sizingMode: fixed_count|by_period**, lessonsTotal? (fixed mode), endDate? (period mode), pricePerLessonMinorSnapshot, totalPriceMinorSnapshot, currency, **paymentStatus: paid|pending|partial**, purchasedAt, expiresAt?, notes) — the *effective* total (adjusted for uncharged-cancelled lessons) is a read-time derivation from `LessonCreditEntry`, not a stored column
- `PackageParticipantShare` (packageId, enrollmentId, oweMinor, paidMinor) — only populated for group packages, one row per member; an individual package's single implicit share can just use `Payment.enrollmentId` directly
- `LessonSeries` (packageId? | enrollmentId? | groupId?, weekdays[], localTime, timezone, durationMin, horizonMaterializedUntil) — optional; created when a package (or the standalone `/lessons/patterns` view) opts into auto-generation
- `Lesson` (enrollmentId? | groupId?, seriesId?, packageId?, startsAtUtc, durationMin, priceMinor, currency, **status: scheduled|completed|cancelled_charged|cancelled_uncharged**, isDetached, cancelledBy?: teacher|student|group, cancelledReason?, cancelledAt?, paidAt?, notes)
- `LessonCreditEntry` (packageId, enrollmentId, delta: ±N, type: purchase|lesson_completed|late_cancellation|teacher_cancellation_refund|manual_adjustment, lessonId?, idempotencyKey unique, note, createdBy) — a `teacher_cancellation_refund` (Δ0, uncharged) also triggers auto-booking a replacement `Lesson` from the same series/pattern
- `Payment` (enrollmentId, amountMinor, currency, method: cash|bank_transfer|other, packageId?, paidAt, note)
- `ProgressEntry` (studentId, date, topic?, homework: n_a|done|not_done, engagement? (1–10), notes) — intentionally **not** linked to a specific `Lesson`
- `TestResult` (studentId, date, type: quiz|independent_work|test|…, lessonId?, name, topic?, scoreValue, scoreMax, passingScore?, notes)
- `LessonJournalEntry` (lessonId?, studentId, date, title, description, homeworkText?, sentToTelegramAt?, attachments[]) — homework is a field on the journal entry, not its own entity
- `AttendanceRecord` (lessonId, studentId, **status: present|absent_paid|absent_unpaid**)
- `AuditLog` (workspaceId, actorId, entity, entityId, action, diff)

All business tables have `workspaceId` + composite indexes; `deletedAt` for soft delete — **except `Student` and `Parent`, which use hard delete**.

## Stage Plan (revised 2026-08-04 after the repository audit)

Each stage ends with a working slice deployed to the dev environment. Stages 0–4 are implemented. Stage 4.1 is an explicit acceptance gate for the broad core-product refactor before any new feature module begins. See `current-state.md` for the active checkpoint and `design-system.md` for the UI contract.

**Stage 0. Foundation** — ✅ done
Monorepo (pnpm + turbo), api/web skeletons, Prisma + Postgres (Railway), auth groundwork, CI (GitHub Actions: lint + typecheck + test), deploy api → Railway, web → Vercel, Sentry, api-client generation from Swagger.

**Stage 1. Auth + Workspace** — ✅ done
Email/password + JWT (access/refresh), registration → auto-create workspace, owner/teacher roles, i18n scaffold (next-intl, uk + en), base layout on shadcn/ui, responsive from the mobile breakpoint.

**Stage 2. Students and groups** — ✅ done
CRUD for students, groups, enrollments with statuses and individual rules (price, currency, cancellation deadline). Workspace settings (default currency, default deadline). Soft delete + AuditLog from this stage.

**Stage 2.5. Parents, and closing the Student/Group model gap** — ✅ done
- `Parent` entity + `StudentParent` join table (many-to-many); `parents` NestJS module (CRUD + soft delete/restore, same audit-in-transaction pattern as students/groups); `Student.parentIds` reconciled in the same transaction as the student update (full-replace semantics, `[]` clears all links). Migrated off `Student.parentName/parentEmail/parentPhone`.
- Added to `Student`: `telegramUsername`, `subject` (curated 26-value catalogue), `hourlyRateMinor`+`currency`, `status: ACTIVE|ON_HOLD` (real Prisma enum, one-click toggle from the row-actions menu, distinct from soft-delete), `languageLevel` (CEFR A1–C2), `knowledgeLevel` (beginner/intermediate/advanced), `age`, `grade` — the last five validated at the app layer (zod), not DB enums, to stay cheap to extend.
- Added `Group.pricePerLesson`+`currency` as the group-level default.
- Web: new `/app/parents` list + detail routes, parent chip-list with an "add existing / create new" combobox on the student form, status badge + hold/reactivate toggle on student rows, price+currency fields on the group form. Sidebar and `messages/{uk,en}.json` updated (key-parity verified).
- Verified live in the browser: created a student with every new field plus a linked parent, edited a group's price, confirmed both persist and render correctly; e2e (25 tests) and unit suites green across `apps/api`, `packages/validation`, `apps/web`.
- **Update (redesign session, 2026-07-23) — supersedes the soft-delete/restore pattern above for two entities:** `Student` and `Parent` now hard-delete (irreversible; removes the record plus every link to it — `StudentParent` rows, and for students, `Enrollment` rows — in one transaction). There is no trash, no `state=deleted|all` filter, and no `/restore` endpoint for these two anymore; `Group`/`Enrollment` are untouched and still soft-delete. Added `Student.status: ARCHIVED` (third value alongside `ACTIVE`/`ON_HOLD`) as the non-destructive alternative surfaced right in the delete-confirmation dialog. Also shipped in this pass: student list filters (status/subject/group) and a parent list filter by linked student (avatar + search combobox), plus a redesigned delete-confirmation dialog (shows the person card, an explicit "this is permanent" warning, and an inline archive action). `docs/mvp-plan.md` line noting "`deletedAt` for soft delete" for all business tables amended accordingly.

**Stage 3. Scheduling core** — ✅ done · the riskiest stage, unchanged in substance from the original plan
`packages/domain`: recurrence + materialization with tests for DST transitions. `LessonSeries` can optionally be owned by a package. Add cron materialization, a day/week/month calendar with drag-and-drop rescheduling, conflict detection, bulk one-off lesson creation with multiple explicit dates, rescheduling ("only this / this and following"), lesson statuses and the state machine of transitions, and the cancellation dialog (charge y/n + attributed to teacher/student/group). No financial consequences beyond the state machine yet — ledger wiring is Stage 4.

**Stage 3.6. Teachers (staff directory)** — ✅ done · inserted 2026-07-24
`Teacher` entity + `teachers` NestJS module (CRUD + soft delete/restore, OWNER-only, same audit-in-transaction pattern as students/groups). Repoint `Enrollment/Lesson/LessonSeries.teacherId` from `WorkspaceMember` to `Teacher` (backfill migration). Teacher list + detail web pages, sidebar nav. The teacher selector in the enrollment editor, lesson form and series form switches from the workspace-members roster to the teachers list. The group create/edit form gains a member block (student + teacher + price + currency) that creates/reconciles `Enrollment`s for the group. `Teacher.defaultRateMinor` prefills the enrollment price; `Teacher.color` will tint that teacher's calendar events.

**Stage 4. Packages, ledger, payments** — ✅ done · the product core
`packages/domain`: the "status transition → ledger operation" rules with full test coverage (all 8 complex cases from the original plan: 8 lessons for 9 lessons in a month, late cancellation, refund on teacher cancellation, freeze, price snapshot, etc., plus the auto-rebook-on-uncharged-cancel behavior). `LessonPackage` supports **both** `studentId` and `groupId` targets, fixed-count and by-period sizing, `LessonCreditEntry` with idempotency, manual `Payment`, **per-participant payment shares for group packages** (`PackageParticipantShare`, equal split by default, each with its own paid/pending/partial badge and "record payment" action), manual balance adjustment, and a student/group finance screen with a human-readable ledger history. The package-creation flow's optional recurring schedule (weekdays + time + timezone) creates the `LessonSeries` from Stage 3, alongside a standalone pattern-management view. Build the package form and the series materializer together.

**Stage 4.1. Core acceptance and UX stabilization** — active
Accept and merge the current `refactor/students-design` branch before expanding scope. Capture desktop/mobile visual evidence, run realistic Students-to-Money scenarios, simplify high-frequency forms and action rows, confirm loading/error/empty states, and freeze the current domain decisions. A realistic seed and the pilot scenario checklist move forward into this stage; the full CSV migration and month-long pilot remain Stage 9.

**Stage 5. Dashboard, Analytics, and Telegram**

Deliver this stage through two independent gates. **5A** ships the action centre and Telegram: today's lessons, unmarked lessons, conflicts, low balances, debtors, reminders at **24h and 1h**, homework delivery, and the teacher daily digest. Every dashboard item leads to a resolving action. **5B** then ships the read-only analytics module: period comparison, revenue/lessons/new-students KPIs, revenue by source, lesson status, top teachers in school mode, day-by-day detail, and payment export. Analytics never sums currencies and should not block the operational value of 5A.

### Stage 5 analytics contract

Written up front because the aggregation semantics are not derivable from the
Stage 4 schema alone, and two of them require migrations that are cheap now and
expensive once the widgets exist.

#### Three money figures, never one

The product has two ledgers (`Payment` = money, `LessonCreditEntry` = lesson
credits), so "income" is ambiguous until it is split:

| Figure | Definition | Answers |
| --- | --- | --- |
| **Accrued** | What the tutor has earned, paid or not | "How much did I make in July?" |
| **Received** | `Payment` rows with `status = PAID` | "How much money actually arrived?" |
| **Expected** | Earned-but-unpaid plus scheduled-but-unearned | "What is still coming?" |

`Accrued − Received` is student debt. Reporting `Payment` alone would silently
drop every pay-as-you-go lesson — the default flow for a solo tutor who bills at
month end — which is precisely the hole Stage 4 leaves open (it can only express
debt as a negative package balance, and only when a package exists at all).

Recognition rules — each event contributes to exactly one figure, at one
timestamp, for one amount:

| Event | Figure | Timestamp | Amount |
| --- | --- | --- | --- |
| Package purchased | accrued | `purchasedAt` | `totalPriceMinorSnapshot` |
| Uncovered lesson reaches `COMPLETED` or `CANCELLED_CHARGED` | accrued | `startsAtUtc` | `Lesson.priceMinor` |
| Payment recorded `PAID` | received | `paidAt` | `amountMinor` |
| Package with unsettled remainder | expected | — | total − payments |
| Uncovered future lesson still `SCHEDULED` | expected | `startsAtUtc` | `Lesson.priceMinor` |

Lessons are recognised on `startsAtUtc`, not `completedAt`: a tutor reconciling
a month means "the lessons that happened in it", and it keeps the chart's lesson
series aligned with the calendar. Note the two series in the revenue chart are
therefore driven by **different events** — packages by purchase date, lessons by
lesson date — which is why a single package can spike one day while lessons
trickle across the others.

#### The double-counting invariant

A lesson contributes to accrued revenue **only when no `LessonCreditEntry`
references it**. Money for a covered lesson was already recognised inside its
package total.

Do **not** express "uncovered" as `Lesson.packageId IS NULL`. That is the trap:
`LedgerService.resolvePackageForLesson` falls back to the student's (or group's)
most recent package when the lesson carries no `packageId` of its own, so a
lesson with a null `packageId` can still have consumed a credit. The only honest
test is the ledger itself:

```sql
LEFT JOIN lesson_credit_entries lce ON lce."lessonId" = l.id
WHERE lce.id IS NULL
```

Related rules that fall out of the same principle:

- `CANCELLED_UNCHARGED` never accrues; `CANCELLED_CHARGED` accrues exactly like
  `COMPLETED` (mirror `planTransition` in `packages/domain/src/ledger.ts` rather
  than re-deciding it in SQL).
- `manual_adjustment` entries move credits, never money — they must never appear
  in any revenue figure.
- A group package accrues **once** (`totalPriceMinorSnapshot`); the per-member
  `PackageParticipantShare` rows are a split of that same money, not extra
  revenue. Received still comes from `Payment`, which resolves per enrollment.
- `REFUNDED` and `FAILED` payments are excluded from received; a refund reduces
  it. `PENDING` (online acquiring) counts as expected, not received.

#### Schema work that must land before the widgets

1. **Reschedule tracking — done ahead of the stage** (migration
   `20260725200000_lesson_reschedule_tracking`). The "Перенесені на ін. день"
   slice had no source: `LessonStatus` has four values and none of them is
   "rescheduled" — a reschedule moves `startsAtUtc` and sets `isDetached`,
   leaving the lesson `SCHEDULED`. `isDetached` cannot stand in for it (it is
   also set when a single lesson of a series is cancelled, and means "this slot
   left the pattern"), and deriving it from `AuditLog.diff` means parsing JSON
   per row on every dashboard load. `Lesson.rescheduledCount` /
   `Lesson.rescheduledAt` are now bumped by `LessonsService.reschedule` in both
   scopes — `this` on the lesson itself, `this_and_following` on the regenerated
   lesson occupying the new slot — and exposed on `lessonResponseSchema`. Brought
   forward because every move made before it existed is unrecoverable; rows
   predating the migration start at 0 and are deliberately not backfilled.
   Still open for the stage: decide whether the donut slices are mutually
   exclusive — a rescheduled lesson is still `SCHEDULED`, so either "rescheduled"
   wins over "scheduled" or the slices stop summing to 100%.
2. **Revenue target — deferred to the stage on purpose.** "Виконання плану" has
   nothing to render against: no goal exists anywhere in the model. Add
   `Workspace.monthlyRevenueTargetMinor Int?` (denominated in `defaultCurrency`)
   plus a settings field. Unlike the counters above, nothing is lost by waiting —
   a target is a static setting, not accumulating history — and shipping the
   settings control before any widget consumes it would be dead UI. A per-period
   goal table is not worth it for the MVP.
3. **Index `LessonPackage @@index([workspaceId, purchasedAt])` — done** (same
   migration). Revenue by period scans packages by purchase date and only
   `[workspaceId, deletedAt]` existed. `Payment` already has
   `[workspaceId, paidAt]` and `Lesson` has `[workspaceId, startsAtUtc]`; no work
   needed there.

#### Currency and time

- **Never sum across currencies** (constraint 10). Every response is a list keyed
  by currency; the UI renders the workspace default first and the rest beneath.
  A KPI tile that adds UAH to EUR is a bug, not a rounding detail.
- **Period bounds are computed in `Workspace.timezone`**, then converted to UTC
  once for the query. Day buckets for the chart need per-row conversion:
  `date_trunc('day', l."startsAtUtc" AT TIME ZONE $tz)`. Getting this wrong shows
  up as lessons landing in the wrong day at the month boundary.
- Period-over-period compares against the immediately preceding window of equal
  length. An empty period returns zeros, never a 404.

#### Module shape

Read-only `analytics` module: no writes, no audit rows, no side effects.
Aggregate in SQL (`groupBy` / `$queryRaw`) — never load lesson rows into JS to
sum them. Every query filters `deletedAt IS NULL` on lessons, packages, payments
and students alike.

Access follows the workspace mode: an `OWNER` sees the whole workspace; in
`SCHOOL` mode a `TEACHER` sees only rows for their own `teacherId`. The "top
earners" widget is meaningless in `SOLO` mode and is hidden there, the same way
every other teacher control is.

Endpoints (all take `from`, `to`, optional `teacherId`):
`GET /api/analytics/summary` (KPI tiles + period-over-period),
`GET /api/analytics/revenue-series` (daily buckets, split lessons/packages),
`GET /api/analytics/lesson-breakdown` (donut),
`GET /api/analytics/top-teachers` (SCHOOL only),
`GET /api/analytics/payments/export` (streamed XLSX — build the sheet from the
payment rows, not from the aggregates, so the export reconciles with "received").

**Stage 6. Learning progress tracking**
`ProgressEntry` (date/topic/homework-done/engagement rating, not lesson-linked), `TestResult` (optionally lesson-linked, with passing-score pass/fail), `LessonJournalEntry` (title/description/homework text + attachments, with a "send homework to Telegram" action), `AttendanceRecord` for group lessons (present / absent-paid / absent-unpaid tri-state). Surface all three as tabs on the student detail page plus a standalone Progress page for picking a student or a whole group. Depends on Stage 3 (`Lesson` must exist for the optional links) and benefits from Stage 5's Telegram module (homework send action).

**Stage 7. Public student page**
A mobile page by token link: upcoming lessons, balance, payment history, lesson confirmation/cancellation (respecting the deadline), rate limiting.

**Stage 8. Receipts, branding, and remaining workspace settings**
`WorkspaceReceiptSettings` (business info, colors, invoice prefix, currency symbol, payment requisites, footer text) with a live preview, PDF receipt generation per lesson/package payment, plus the workspace-level settings still missing locally: `timezone`, `meetingLink`. Lower urgency than Stages 2.5–7 since it does not block core CRM usage.

**Stage 9. Import, SpeakWise pilot, and the in-app Features catalogue**
CSV import of students/schedule/balances, migration of real SpeakWise data, a full payment month through the system, recording every manual fix as a bug report, bugfixes. GDPR minimum: privacy policy, workspace export/deletion. Optionally add the `/features` ("Можливості") in-app catalogue page last — it's pure static content linking to real routes, cheapest to build once everything else exists.

**Stage 9.5. Leads / CRM funnel** — moved back from 4.5 on 2026-07-26
Deliberately after the pilot: a lead funnel wins new students, it does not run the ones already enrolled, so nothing here blocks launching the system or migrating SpeakWise.
`Lead` entity + 6-stage pipeline (new → contacted → trial_scheduled → trial_completed → converted → lost), kanban board with drag-between-stages, funnel stats (active leads, trials this week, converted this month, conversion %, potential revenue, trial revenue), trial-lesson scheduling (free or paid, produces a `Lesson` flagged as a trial), one-click convert-lead-to-student (creates `Student` [+ `Enrollment`] from the lead's data). Depends only on Stage 3 for trial-lesson scheduling, so it can be pulled forward if paid acquisition starts before the pilot ends.

**Out of MVP (next stages, when ready):** Stripe/WayForPay payment links + webhooks, Google Calendar sync, Expo app on top of the finished API, SaaS subscription billing, and multi-currency FX-rate rollup in analytics after real multi-currency workspaces exist.

## Verification

- **Unit tests** for `packages/domain` (vitest): recurrence/DST, lesson state machine, all ledger rules, idempotency, money utilities, group-vs-enrollment package targeting, lead-to-student conversion — run in CI on every PR.
- **API integration tests** (supertest + a test Postgres) for critical flows: buy package → complete lesson → charge; teacher cancellation → refund.
- **Manual scenario checklist** for the 8 complex cases from the positioning — run on the dev environment at the end of stages 4 and 7.
- **Seed script** with a realistic demo workspace for development and demos.
- **Final check**: a month of real SpeakWise operation without manual data fixes in the DB.
