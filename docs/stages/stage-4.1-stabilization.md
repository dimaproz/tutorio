# Stage 4.1 — Pilot Core Stabilization

Last verified: 2026-08-24.

> **Outcome:** the existing Students-to-Money core is correct, understandable,
> tested, and operationally safe enough for a controlled owner-operated pilot.
>
> **Pillar:** Foundation · **Status:** Active · **Depends on:** Stages 0–4.

## Why this stage exists

The broad visual refactor has already merged into `develop`. Acceptance is no
longer a merge task. The remaining risk is that polished workflows conceal
unsafe lifecycle, financial, scheduling, and authorization behavior. This stage
therefore follows the order: decisions, failing tests, correctness fixes, then
targeted UX simplification.

## Non-goals

- No analytics, Telegram, progress, portal, receipts, leads, or SaaS modules.
- No design-system rewrite or speculative custom component library.
- No period/monthly or group-package expansion until their pilot contract passes.
- No teacher login with real pilot data.

## Slice A — executable contracts

- Adopt ADRs 0001–0004 and convert them into domain/API tests.
- Add finance-rich and lifecycle-rich seed scenarios.
- Make an isolated PostgreSQL end-to-end run reproducible locally and in CI.
- Produce failing regression tests for every confirmed P0 defect.

**Exit:** no P0 behavior depends on undocumented interpretation.

## Slice B — integrity stabilization

- Group archive/restore preserves relationships and history.
- Student/archive/privacy behavior matches ADR 0002.
- Payment enrollment belongs to package target/share and currency/date/
  idempotency rules are enforced.
- A lesson persists the charged package; compensation returns to the same one.
- Package and charged-lesson archive cannot leave active recurrence or broken
  ledger history.
- Cancellation/restore and participant shares match ADR 0003.
- Pause/archive stops new materialization; recurrence edits conflict-check and
  apply correct scope.
- `force=false` is false at runtime; misleading automatic replacement is removed
  or implemented as a real conflict-checked scheduling command.
- Pilot business mutations are owner-only.

**Exit:** mandatory integrity rows in the pilot acceptance matrix pass.

## Slice C — pilot workflow simplification

- Student quick create contains only required/common fields and navigates to
  useful next actions on the saved profile.
- Parent creation/linking happens after student persistence unless supported by
  one atomic backend command.
- Fixed lesson-pack creation is separate from scheduling and payment.
- Package detail explains lessons remaining, plan total, received, outstanding,
  and chronological history.
- Archive confirmations enumerate operational and historical consequences.
- Oversized form components are split while replacing the affected flow, with
  interaction tests for loading, error, success, dirty close, and destructive
  states.

**Exit:** a first-time tutor completes student creation and a lesson-pack sale in
an observed session without developer explanation.

## Slice D — pilot operations

- Minimal CSV student import with preview and row-level errors.
- Database readiness, monitoring, backup/restore, workspace export, and privacy
  runbooks have executed evidence.
- One realistic staging workspace completes the four critical journeys and a
  full operational week without direct database edits.

**Exit:** every mandatory row in
[`../quality/pilot-acceptance.md`](../quality/pilot-acceptance.md) is `Pass`.

## Verification commands

Run separately and record exact results:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @tutorio/api test:e2e
```

The end-to-end command requires an isolated disposable PostgreSQL database. Do
not point destructive test setup at development or pilot data.

## Handoff

When complete, update `docs/current-state.md` with the verified commit and pilot
evidence. Select the next module from pilot observations, not automatically from
the next historical stage number.
