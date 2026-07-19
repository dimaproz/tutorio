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
`payments-webhooks`, `integrations`, `reports` (the dashboard is enough), `BullMQ/Redis`, push notifications (web MVP: email + copy-to-Telegram text), Google Calendar sync.

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

`auth`, `workspaces`, `students` (incl. parents), `groups`, `enrollments`, `scheduling` (series + lessons + attendance statuses), `packages` (packages + credit ledger), `payments` (manual, + a PaymentProvider interface with a single `manual` implementation), `notifications` (email + texts), `dashboard`, `audit`, `public` (student page by token), `import` (CSV).

### Data schema (Prisma, key entities)

- `Workspace` (plan, defaultCurrency, cancellationDeadlineHours)
- `User`, `WorkspaceMember` (role: owner | teacher)
- `Student` (name, contacts, timezone, parentContact?, notes, publicToken)
- `Group`
- `Enrollment` (studentId, groupId?, teacherId, status: active|paused|archived, priceMinor, currency, cancellationDeadlineHours?, billingType: package|monthly|per_lesson)
- `LessonSeries` (enrollmentId|groupId, weekday, localTime, timezone, durationMin, horizonMaterializedUntil)
- `Lesson` (seriesId?, startsAtUtc, status, isDetached, cancelledBy?, cancelledAt?)
- `LessonPackage` (enrollmentId, lessonsTotal, priceMinorSnapshot, currency, purchasedAt, expiresAt?)
- `LessonCreditEntry` (packageId, enrollmentId, delta: ±N, type: purchase|lesson_completed|late_cancellation|teacher_cancellation_refund|manual_adjustment, lessonId?, idempotencyKey unique, note, createdBy)
- `Payment` (enrollmentId, amountMinor, currency, method: cash|bank_transfer|other, packageId?, paidAt, note)
- `AuditLog` (workspaceId, actorId, entity, entityId, action, diff)

All business tables have `workspaceId` + composite indexes; `deletedAt` for soft delete.

## Stage Plan (solo, ~14–16 weeks)

Each stage ends with a working slice deployed to the dev environment.

**Stage 0. Foundation (weeks 1–2)**
Monorepo (pnpm + turbo), api/web skeletons, Prisma + Postgres (Railway), auth groundwork, CI (GitHub Actions: lint + typecheck + test), deploy api → Railway, web → Vercel, Sentry, api-client generation from Swagger.

**Stage 1. Auth + Workspace (weeks 2–3)**
Email/password + JWT (access/refresh), registration → auto-create workspace, owner/teacher roles, i18n scaffold (next-intl, uk + en), base layout on shadcn/ui, responsive from the mobile breakpoint.

**Stage 2. Students and groups (weeks 4–5)**
CRUD for students (a card from the original plan's list), groups, enrollments with statuses and individual rules (price, currency, cancellation deadline). Workspace settings (default currency, default deadline). Soft delete + AuditLog from this stage.

**Stage 3. Scheduling (weeks 6–8)** — the riskiest stage
`packages/domain`: recurrence + materialization with tests for DST transitions. `LessonSeries`, cron materialization over 12 weeks, day/week/month calendar (react-big-calendar), one-off lessons, rescheduling ("only this / this and following"), lesson statuses and the state machine of transitions. No financial consequences yet — those are in stage 4.

**Stage 4. Packages, ledger, payments (weeks 9–11)** — the product core
`packages/domain`: the "status transition → ledger operation" rules with full test coverage (all 8 complex cases from the original plan as test scenarios: 8 lessons for 9 lessons in a month, late cancellation, refund on teacher cancellation, freeze, price snapshot, etc.). LessonPackage, LessonCreditEntry with idempotency, manual Payment, partial payment and debt, manual balance adjustment, a student finance screen with a "why the balance is what it is" history.

**Stage 5. Dashboard and reminders (week 12)**
Main screen: today's lessons, "≤2 lessons left", debtors, monthly income per currency, cancellations. Cron reminders by email (Resend), a "copy reminder text for Telegram" button.

**Stage 6. Public student page (week 13)**
A mobile page by token link: upcoming lessons, balance, payment history, lesson confirmation/cancellation (respecting the deadline), rate limiting.

**Stage 7. Import and SpeakWise pilot (weeks 14–16)**
CSV import of students/schedule/balances, migration of real SpeakWise data, a full payment month through the system, recording every manual fix as a bug report, bugfixes. GDPR minimum: privacy policy, workspace export/deletion.

**Out of MVP (next stages, when ready):** Stripe/WayForPay payment links + webhooks, Google Calendar sync, Telegram integration, Expo app on top of the finished API, SaaS subscription billing.

## Verification

- **Unit tests** for `packages/domain` (vitest): recurrence/DST, lesson state machine, all ledger rules, idempotency, money utilities — run in CI on every PR.
- **API integration tests** (supertest + a test Postgres) for critical flows: buy package → complete lesson → charge; teacher cancellation → refund.
- **Manual scenario checklist** for the 8 complex cases from the positioning — run on the dev environment at the end of stages 4 and 7.
- **Seed script** with a realistic demo workspace for development and demos.
- **Final check**: a month of real SpeakWise operation without manual data fixes in the DB.
