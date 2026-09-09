# Stage 5 — Action Centre, Telegram, and Analytics

> **Outcome:** the product starts saving hours and retaining. The work is
> delivered through two gates so operational value is not blocked by reporting:
> 5A action centre + Telegram, then 5B analytics and exports.
>
> **Pillar:** Growth · **Status:** Deferred pending pilot evidence · **Depends
> on:** Stage 4 (money to analyse and to alert on), Stage 3 (lessons to remind
> about). The Stage 3.7 "today" widget is upgraded here into the full dashboard.

## 1. Goal & non-goals

**Goals**
- **5A Action centre** replacing the Stage 3.7 minimal version: today's lessons,
  unmarked lessons, schedule conflicts, low-balance / debtor alerts, unsent
  homework, and monthly income per currency. Every item links to a resolving
  action.
- **`analytics` module:** period presets + custom range; revenue / lessons /
  new-students KPI cards with period-over-period change; revenue-by-source chart
  (lessons vs packages); lesson-status breakdown; top earners; day-by-day table;
  payment report with Excel export.
- **Telegram** is load-bearing: student reminders (timezone-aware, include the workspace
  meeting link, sent **24h and 1h** before); homework delivery (Stage 6 consumer,
  built here as the send channel); teacher's own daily digest; bot linking.

**Non-goals**
- No FX rollup across currencies (out of MVP) — analytics shows per currency.
- No BullMQ/Redis — `@nestjs/schedule` cron is sufficient at this volume.

## 2. Domain / model

- `TelegramLink` (`workspaceMemberId`, `chatId`, `connectedAt`) — teacher's own
  bot connection for the digest.
- Student reminder linkage: `Student.telegramUsername` + `telegramChatId`
  (captured via the bot's chat-start webhook). Fields already planned on
  `Student`.
- Workspace needs `timezone` + `meetingLink` (formally landed in Stage 8, but
  reminders need at least `timezone`; if Stage 8 hasn't run, add `timezone`
  here and let Stage 8 add branding around it).

## 3. Domain logic (`packages/domain`)

- **Reminder scheduling is timezone/DST-correct** — reuse the recurrence/tz
  utilities from Stage 3. Pure function `dueReminders(now, lessons, offsets=[24h,
  1h])` → which reminders to send, idempotent by `(lessonId, offset)`.
- Analytics aggregations are read-side SQL, not domain — but money summation
  **never crosses currencies** (a shared guard/helper).

## 4. Validation
`AnalyticsQueryDto` (period preset | custom range, groupBy), `TelegramLinkDto`.
Response DTOs for KPI cards, series, and the payment export.

## 5. API

### `analytics` module
- `GET /analytics/summary?from&to` — KPI cards + period-over-period deltas.
- `GET /analytics/revenue-by-source`, `/lesson-status`, `/top-earners`,
  `/daily`.
- `GET /analytics/payments/export` — streamed Excel (xlsx) of payments.
- All workspace-scoped, per-currency, indexed reads.

### `telegram` module
- Bot webhook (`POST /telegram/webhook`) — captures `telegramChatId` on
  chat-start; links teacher members.
- Cron (`@nestjs/schedule`): reminder dispatcher (24h + 1h), teacher daily
  digest. Idempotent send log (`(lessonId, offset)` unique) so a re-run never
  double-sends.
- `sendHomework(journalEntry)` — used by Stage 6.

## 6. Web

UI reference: an architect-approved analytics brief using official shadcn
dashboard, Card, Chart, Badge, and Table compositions. KPI cards, status
breakdown, revenue charts, top-earners, and tables must follow verified user
jobs rather than a generic analytics demo.

- `features/dashboard` — full widget set (today, alerts, income-per-currency).
- `features/analytics` — `/app/analytics` route: period picker, KPI grid,
  charts, day-by-day table, export button.
- Settings: Telegram connection card (bot link, connected state), meeting link
  (if not yet from Stage 8).

## 7. Sequencing

**Gate 5A — operational value:** workspace `timezone` (if missing) → action
centre queries and resolving deep links → Telegram bot linking + webhook →
reminder domain fn + cron + send log → teacher digest.

**Gate 5B — reporting:** analytics endpoints → period-aware KPI/charts →
day-by-day and payment report → Excel export. Gate 5B starts only after 5A is
accepted; it does not block reminders or the action centre.

## 8. Testing
- Domain: `dueReminders` DST-correctness + idempotency.
- API: analytics aggregation correctness on a seeded dataset; reminder dispatch
  idempotent; webhook captures chatId.
- Web: dashboard alerts render for a low-balance fixture; analytics period
  switch; export downloads.

## 9. Definition of Done
Global DoD + : Gate 5A is complete when a real reminder fires 24h and 1h before
a dev lesson and every action-centre item resolves into a concrete workflow.
Gate 5B is complete when analytics reconciles with ledger/payments and the Excel
export opens.

## 10. Risks & decisions
- **Double-send on cron re-run / deploy** — unique send-log key `(lessonId,
  offset)`.
- **Timezone drift** — reminders computed from the lesson's stored tz rule, not
  server local.
- **Telegram API failures** — retry with backoff, dead-letter to a log; never
  block the cron loop on one failure.
- **Currency summing** — analytics guards against cross-currency addition.
