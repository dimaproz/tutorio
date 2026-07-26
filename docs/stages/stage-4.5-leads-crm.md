# Stage 4.5 — Leads / CRM Funnel

> **Outcome:** the top of the funnel lives in Tutorio — leads move through a
> pipeline, trial lessons are tracked, and a won lead becomes a student in one
> click. Acquisition stops living in a spreadsheet.
>
> **Pillar:** Growth · **Status:** Planned · **Depends on:** Stage 3 (trial
> lessons are `Lesson`s). Otherwise independent — **can run in parallel with
> Stage 4** if capacity allows.

## 1. Goal & non-goals

**Goals**
- `Lead` entity + a 6-stage pipeline: `new → contacted → trial_scheduled →
  trial_completed → converted → lost`.
- Kanban board with drag-between-stages.
- Trial-lesson scheduling (free or paid) that produces a `Lesson` flagged as a
  trial.
- One-click convert-lead-to-student (creates `Student` [+ `Enrollment`] from the
  lead's data).
- Funnel stats: active leads, trials this week, converted this month,
  conversion %, potential revenue, trial revenue.

**Non-goals**
- No email/marketing automation; no lead import (that's Stage 9 CSV).
- No multi-pipeline / custom stages (single fixed pipeline for MVP).

## 2. Domain / model

- `Lead` (mvp-plan schema): `fullName`, `subject?`,
  `expectedHourlyRateMinor?`+`currency`, `phone?`, `telegramUsername?`, `email?`,
  `source: unknown|referral|instagram|website|other`, `stage` (enum above),
  `trialType: none|free|paid`, `notes`, `convertedStudentId?`, `workspaceId`,
  `deletedAt`.
- Trial lesson: a `Lesson` needs a way to mark "trial" — add `Lesson.isTrial`
  (bool) or a nullable `leadId` link. **Decision:** `Lesson.leadId?` (also gives
  the trial→lead backref for funnel revenue). Migration is additive.

## 3. Domain logic (`packages/domain`)

- `convertLead(lead)` → the `Student` (+ optional `Enrollment`) shape, pure
  mapping + validation (which fields are required to convert). Tested.
- Funnel aggregation is read-side SQL (API), not domain.

## 4. Validation

`CreateLeadDto`, `UpdateLeadStageDto` (stage transition), `ConvertLeadDto`
(overrides for the created student), `ScheduleTrialDto`.

## 5. API — `leads` module

- CRUD `+/leads`, `PATCH /leads/:id/stage` (guarded transitions — mirror the
  lesson state-machine discipline: only legal stage moves).
- `POST /leads/:id/convert` — transaction: create `Student` (+ `Enrollment`),
  set `lead.stage=converted`, `lead.convertedStudentId`. Audited.
- `POST /leads/:id/trial` — creates a trial `Lesson` (reuses `lessons.service`,
  sets `leadId`), moves stage to `trial_scheduled`.
- `GET /leads/funnel` — aggregated stats (counts per stage, trials this week,
  conversions this month, conversion %, potential + trial revenue per currency).

## 6. Web — `features/leads`

TailAdmin reference: **Kanban board** app pattern
(`react.tailwind-admin.com/apps`), **stat cards** for funnel metrics
(`demo.tailadmin.com/analytics`).

- New nav item + `/app/leads` route: kanban with drag-between-columns (reuse the
  dnd approach already used in the calendar), stage columns, lead cards.
- Funnel KPI strip above the board.
- Lead detail/drawer: contact, trial actions, convert button.
- Convert flow opens the student form pre-filled from lead data.

## 7. Sequencing
Model + migration → domain `convertLead` + tests → validation → `leads` module
(CRUD, stage, convert, trial, funnel) → web board + KPIs → convert flow.

## 8. Testing
- Domain: `convertLead` mapping + required-field guards.
- API: illegal stage transition rejected; convert creates student atomically;
  trial creates a `leadId`-linked lesson; funnel aggregation correctness.
- Web: drag moves stage (optimistic + rollback on error); convert opens
  pre-filled form.

## 9. Definition of Done
Global DoD + : a lead can travel new→converted end-to-end producing a real
student; funnel numbers reconcile with underlying rows.

## 10. Risks & decisions
- **Trial revenue double-count** with Stage 4 payments — funnel "trial revenue"
  reads trial `Lesson`s only; keep it separate from the money ledger.
- **Stage transitions** — enforce legal moves server-side, don't trust the board.
