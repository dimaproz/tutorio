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

## Production Reference Audit (2026-07-22)

The live production system at `tutorio.net` (Google-auth login, deployed independently of this branch) is a materially more complete implementation than what's in the repo today. It was walked end-to-end (all 11 sidebar sections plus every create/edit form) to build an accurate gap list before continuing the roadmap. Full findings below; they supersede parts of the original plan where noted.

### What exists locally (this repo, `feature/redesign` branch) vs. production

| Area | Local repo | Production (`tutorio.net`) |
|---|---|---|
| Учні / Students | Full CRUD, soft-delete/restore, audit | Full CRUD + subject, hourly rate, Telegram handle, CEFR/knowledge level, age, grade, on-hold status, parent linking |
| Батьки / Parents | **Missing** — only flat `parentName/parentEmail/parentPhone` strings on `Student` | Full entity: own CRUD, linked to multiple students (many-to-many), own contact fields |
| Групи / Groups | Full CRUD via `Enrollment` | Full CRUD + a group-level `pricePerLesson`, roster with avatars |
| Ліди / Leads | **Missing entirely** | Full CRM pipeline (kanban, 6 stages), trial-lesson tracking, funnel stats, one-click convert-to-student |
| Уроки / Lessons + Календар / Calendar | **Missing entirely** (nav item disabled) | Full: list + drag/drop weekly calendar, conflict detection, bulk multi-date creation, per-lesson status machine, flexible cancellation (charge y/n, attributed to teacher/student) |
| Пакети / Packages | **Missing entirely** (nav item disabled as "Фінанси") | Full: fixed-count or period-based packages, per-student **or per-group**, auto-generates its own recurring `Lesson`s from a weekday/time schedule, payment status (paid/pending/partial) |
| Прогрес / Progress | **Missing entirely** | Grades, homework tracking, test results w/ passing score, per-lesson journal with attachments, group attendance |
| Аналітика / Analytics | **Missing** (dashboard is a static empty-state) | Full KPI dashboard + period comparison, revenue-by-source chart, lesson-status donut, top earners, day-by-day table, Excel payment export |
| Можливості / Features | **Missing** | An in-app marketing/help catalogue page listing every feature with a "try it" deep link — no backend, purely descriptive |
| Налаштування / Settings | Only `defaultCurrency` + `cancellationDeadlineHours` (owner-only) | Also: workspace **timezone**, meeting-link (Zoom/Meet, auto-attached to reminders), Telegram bot connection (teacher's own daily digest), full **PDF receipt/invoice branding** (business info, colors, prefix, currency symbol, payment requisites, footer, live preview) |
| Telegram | Not built | **Core, not optional**: student lesson reminders (timezone-aware, includes meeting link), homework delivery with attachments, teacher's own daily schedule digest. This corrects the original plan, which filed Telegram under "Out of MVP" — production treats it as load-bearing, so it's pulled back into the roadmap below (Stage 5). |

### Key domain-model corrections vs. the original plan

Inspecting every create/edit form in production surfaced a few decisions that refine (and in one case contradict) the original schema in this document:

1. **Parents are a real entity**, not free-text fields on `Student`. Model as `Parent` (fullName, phone, telegramUsername, notes) with a `StudentParent` many-to-many join table. Deprecates `Student.parentName/parentEmail/parentPhone`.
2. **Pricing/timezone defaults live on `Student`, not only on `Enrollment`.** Production's student form has its own `hourlyRate`, `currency`, `timezone`. Keep `Enrollment` as the place financial/scheduling *overrides* live (per-group individual pricing), but `Student` now carries the default. Same override relationship applies to `Group.pricePerLesson` as a group-level default.
3. **`LessonPackage` can bind to a `Group`, not only an `Enrollment`.** This overturns original decision #6 ("the package belongs to the Enrollment, not the group"). Production explicitly supports a single shared package for a whole group (one balance, one progress ring for all members). Recommendation: support both — `LessonPackage.studentId | groupId`, mirroring how `LessonSeries` already needed to support both.
4. **`LessonSeries` materialization is package-driven, not a standalone concept.** In production there's no separate "create a recurring series" flow — the recurring weekday/time schedule is configured *inside* the package-creation form ("Розклад уроків: Рекомендовано") and generates exactly `lessonsTotal` lessons for that package. A package can also be created without a schedule (lessons added manually/in bulk via "Додати ще дату" on the lesson form, which creates several one-off `Lesson`s at once). Model `LessonSeries` as optional and owned by `LessonPackage`, not a top-level entity independent of packages.
5. **Package sizing has two modes**: fixed lesson count (4/10/20/30/custom) or "by period" (generate lessons up to an end date). Needs a `sizingMode: FIXED_COUNT | BY_PERIOD` on `LessonPackage`.
6. **Lesson cancellation charge is baked directly into the status enum**, not a separate boolean. Production's status dropdown has exactly 4 options: `Заплановано` (scheduled), `Завершені` (completed), `Скасувати (Оплачено)` (cancelled, charged), `Скасувати (Без оплати)` (cancelled, not charged) → `status: scheduled | completed | cancelled_charged | cancelled_uncharged`. Who cancelled (teacher/student/**group**, confirmed as a third value from the group detail page's "хто скасував" breakdown) and a free-text reason are attached separately (visible in the package ledger's note text, e.g. "Reason: Mutual agreement") — likely captured by a small cancel-confirmation step rather than being additional edit-form fields. Cancelling **without** charge also auto-books a replacement lesson from the same package/pattern to keep the paid slot usable — confirmed directly in a package's ledger history ("Lesson auto-scheduled from the package schedule to replace a cancelled lesson").
7. **Student status includes an explicit "on hold" (`канікули`) state**, separate from soft-delete: hides the student from active lists without losing data, one click to restore. Add `Student.status: ACTIVE | ON_HOLD` (soft-delete `deletedAt` stays the separate "actually removed" mechanism).
8. **A group package's schedule is shared, but the money isn't.** Opening a real group `LessonPackage` (`/dashboard/packages/1`) shows a "Оплати учасників групи" block: the total price is split per student (e.g. 9500₴ package → 4750₴ owed by each of 2 students), each with their own `Сплачено: X / Y`, a paid/unpaid badge, and its own "Внести оплату" action. So `LessonPackage.groupId` drives lesson generation for the whole group, but **`Payment`/balance-owed still resolves per `Enrollment`** — add a per-participant share (equal split of `totalPriceMinorSnapshot` by default) rather than treating a group package as one shared wallet.
9. **`LessonCreditEntry` types match the original plan almost exactly** — confirmed by reading a real package's ledger ("Історія" tab): `purchase` (+N), `lesson_completed` (-1), `late_cancellation`/charged-cancel (-1, "considered held - balance consumed"), `teacher_cancellation_refund`/uncharged-cancel (±0, "paid slot kept open for re-booking" + auto-rebook), and scheduled-but-not-yet-happened entries at Δ0. The original schema for this entity needs no changes.
10. **A package's displayed total price is dynamic**, not just the purchase-time snapshot: production shows `9 500 ₴ ~~10 000 ₴~~ з урахуванням пропущених занять` (adjusted for missed/uncharged lessons) alongside the static snapshot. Keep `totalPriceMinorSnapshot` as the stored purchase-time value; compute the adjusted "effective total" as a read-time derivation from the credit ledger, not a separate stored column.
11. **Progress-tracking entries are looser than "grades."** The student page's "Трекер прогресу" add-entry form is: `date*`, `topic/subject` (free text, e.g. "Алгебра"), `homework: n/a | done | not_done`, `engagement` (1–10 star rating, optional), `notes` — and it is **not** required to link to a specific `Lesson`. `ProgressEntry` should drop the "grade/score" framing entirely in favor of these four fields.
12. **Test results are a separate, lesson-linkable entity.** Its add form: `date*`, `type` (dropdown: Вікторина/quiz, Самостійна робота/independent work, Контрольна робота/test, …), an *optional* "Прив'язати до уроку" lesson link, `name`, `topic/subject`, `score` as a `X out of Y` fraction, an optional `passingScore`, `notes`.
13. **Homework lives inside the lesson journal, not as its own entity.** "Щоденник уроків" entries are `date, title, description` plus an embedded homework text block with its own "Надіслати в Telegram" send action. Drop the standalone `HomeworkEntry` model from the schema — fold `homeworkText` + `sentToTelegramAt` into `LessonJournalEntry`.
14. **Group attendance is a tri-state, not boolean+flag.** The group detail page's "Відвідуваність" legend is `Присутній` (present) / `Відсутній, оплачено` (absent, paid) / `Відсутній, без оплати` (absent, unpaid) → `AttendanceRecord.status: present | absent_paid | absent_unpaid`.
15. **Telegram student reminders fire twice**: 24h before *and* 1h before (confirmed on the student detail page's reminder card), not once as originally assumed.
16. **Recurring patterns get their own management view**, separate from both the package-creation flow and the plain lessons list: production has a `/dashboard/lessons/patterns` ("Розклад") route. Plan for a dedicated series/pattern management page in Stage 3, not just an embedded package-form step.
17. **Packages generate a downloadable PDF receipt** (`Завантажити квитанцію` on the package detail page) — this is the concrete consumer of the `WorkspaceReceiptSettings` branding from Stage 8; a package (and presumably a manual `Payment`) needs its own PDF endpoint, not just the settings/branding data.

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
- `User`, `WorkspaceMember` (role: owner | teacher)
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

All business tables have `workspaceId` + composite indexes; `deletedAt` for soft delete.

## Stage Plan (revised 2026-07-22 after the production audit)

Each stage ends with a working slice deployed to the dev environment. Stages 0–2.5 are **done**; the plan from Stage 3 onward is expanded/reordered based on the production reference audit above — scope grew (Parents, Leads, Progress, Analytics, receipts, Telegram all turned out to be real, shipped product surface, not "later" ideas), so treat the original 14–16 week horizon as superseded rather than tightened.

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

**Stage 3. Scheduling core** — the riskiest stage, unchanged in substance from the original plan
`packages/domain`: recurrence + materialization with tests for DST transitions. `LessonSeries` (now optionally owned by a package, see decision #4 above), cron materialization, day/week/month calendar with drag-and-drop rescheduling, conflict detection, bulk one-off lesson creation (multiple explicit dates in one form, as seen in production), rescheduling ("only this / this and following"), lesson statuses and the state machine of transitions, and the cancellation dialog (charge y/n + attributed to teacher/student/group). No financial consequences beyond the state machine yet — ledger wiring is Stage 4.

**Stage 4. Packages, ledger, payments** — the product core
`packages/domain`: the "status transition → ledger operation" rules with full test coverage (all 8 complex cases from the original plan: 8 lessons for 9 lessons in a month, late cancellation, refund on teacher cancellation, freeze, price snapshot, etc., plus the confirmed auto-rebook-on-uncharged-cancel behavior). `LessonPackage` supporting **both** `studentId` and `groupId` targets, fixed-count and by-period sizing, `LessonCreditEntry` with idempotency, manual `Payment`, **per-participant payment shares for group packages** (`PackageParticipantShare`, equal split by default, each with its own paid/pending/partial badge and "record payment" action), manual balance adjustment, a student/group finance screen with a "why the balance is what it is" ledger history (mirrors the production "Історія" tab). The package-creation flow's optional recurring schedule (weekdays + time + timezone) is what actually creates the `LessonSeries` from Stage 3, alongside a standalone pattern-management view (`/lessons/patterns` equivalent) — build the package form and the series materializer together.

**Stage 4.5. Leads / CRM funnel**
`Lead` entity + 6-stage pipeline (new → contacted → trial_scheduled → trial_completed → converted → lost), kanban board with drag-between-stages, funnel stats (active leads, trials this week, converted this month, conversion %, potential revenue, trial revenue), trial-lesson scheduling (free or paid, produces a `Lesson` flagged as a trial), one-click convert-lead-to-student (creates `Student` [+ `Enrollment`] from the lead's data). Depends on Stage 3 for trial-lesson scheduling but is otherwise independent — can run in parallel with Stage 4 if capacity allows.

**Stage 5. Dashboard, Analytics, and Telegram**
Real dashboard widgets replacing the current empty-state (`apps/web/src/components/app/dashboard.tsx`): today's lessons, low-balance/debtor alerts, monthly income per currency. A dedicated `analytics` module: period presets + custom range, revenue/lessons/new-students KPI cards with period-over-period change, revenue-by-source chart (lessons vs. packages), lesson-status breakdown, top earners, day-by-day table, and a payment report with Excel export. Telegram integration — corrected from "out of MVP" per the audit: student reminders (timezone-aware, includes the workspace meeting link, sent **24h and 1h** before), homework delivery (triggered from a lesson journal entry, with attachments), and the teacher's own daily digest bot. Cron-driven, `@nestjs/schedule` is sufficient at this volume.

**Stage 6. Learning progress tracking**
`ProgressEntry` (date/topic/homework-done/engagement rating, not lesson-linked), `TestResult` (optionally lesson-linked, with passing-score pass/fail), `LessonJournalEntry` (title/description/homework text + attachments, with a "send homework to Telegram" action), `AttendanceRecord` for group lessons (present / absent-paid / absent-unpaid tri-state). Surface all three as tabs on the student detail page (as in production) plus a standalone Progress page for picking a student or a whole group. Depends on Stage 3 (`Lesson` must exist for the optional links) and benefits from Stage 5's Telegram module (homework send action).

**Stage 7. Public student page**
A mobile page by token link: upcoming lessons, balance, payment history, lesson confirmation/cancellation (respecting the deadline), rate limiting.

**Stage 8. Receipts, branding, and remaining workspace settings**
`WorkspaceReceiptSettings` (business info, colors, invoice prefix, currency symbol, payment requisites, footer text) with a live preview, PDF receipt generation per lesson/package payment, plus the workspace-level settings still missing locally: `timezone`, `meetingLink`. Lower urgency than Stages 2.5–7 since it doesn't block core CRM usage, but every production settings tab depends on it.

**Stage 9. Import, SpeakWise pilot, and the in-app Features catalogue**
CSV import of students/schedule/balances, migration of real SpeakWise data, a full payment month through the system, recording every manual fix as a bug report, bugfixes. GDPR minimum: privacy policy, workspace export/deletion. Optionally add the `/features` ("Можливості") in-app catalogue page last — it's pure static content linking to real routes, cheapest to build once everything else exists.

**Out of MVP (next stages, when ready):** Stripe/WayForPay payment links + webhooks, Google Calendar sync, Expo app on top of the finished API, SaaS subscription billing, multi-currency FX-rate rollup in analytics (production does this nightly; defer until real multi-currency workspaces exist).

## Verification

- **Unit tests** for `packages/domain` (vitest): recurrence/DST, lesson state machine, all ledger rules, idempotency, money utilities, group-vs-enrollment package targeting, lead-to-student conversion — run in CI on every PR.
- **API integration tests** (supertest + a test Postgres) for critical flows: buy package → complete lesson → charge; teacher cancellation → refund.
- **Manual scenario checklist** for the 8 complex cases from the positioning — run on the dev environment at the end of stages 4 and 7.
- **Seed script** with a realistic demo workspace for development and demos.
- **Final check**: a month of real SpeakWise operation without manual data fixes in the DB.
