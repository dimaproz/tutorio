# Pilot Acceptance Matrix

Last verified: 2026-08-24.

Status values: `Not run`, `Fail`, `Pass`, or `Not applicable`. A row may be
marked `Pass` only with a linked automated test, screenshot/report, or run log.

## Mandatory business journeys

| Journey                                                                     | Required evidence                                                   | Status                                                                                                                                    |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Add a student, optionally link a parent, and start individual study         | API/service tests, browser interaction test, audit row              | Not run                                                                                                                                   |
| Create a group, enroll students, archive, and restore it                    | E2E test proving schedules and financial history are preserved      | Fail — current behavior is unsafe                                                                                                         |
| Create one-off and recurring lessons across time zones                      | Conflict, DST, edit-scope, pause/resume, and materialization tests  | Not run                                                                                                                                   |
| Sell an individual fixed package and record partial/full payment            | Relationship, currency, idempotency, ledger, and audit assertions   | Pass — uncommitted Work Packet 1 tree based on `3d985d5`; isolated PostgreSQL evidence in `apps/api/test/packages.e2e-spec.ts` (12 tests) |
| Sell a group package and calculate participant shares                       | Deterministic share tests including cancellation/restore repetition | Fail — zero-delta events can distort shares                                                                                               |
| Complete, cancel charged, cancel uncharged, restore, and reschedule lessons | Human-readable history and exact compensating-entry assertions      | Fail — compensation and replacement behavior are unsafe                                                                                   |
| Archive a student with financial history and restore access                 | E2E proof that history remains queryable and no FK failure occurs   | Not run                                                                                                                                   |

## UX acceptance

| Surface                     | Required evidence                                                                | Status                                        |
| --------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------- |
| Student quick create        | First-time user completes required path; interaction test; mobile/desktop; uk/en | Fail — current all-in-one modal is overloaded |
| Package sale                | User can explain entitlement, price, payment state, and next step before submit  | Fail — creation mixes three jobs              |
| Package detail/history      | Every balance change is traceable to a dated human-readable event                | Not run                                       |
| Destructive confirmation    | Consequences list affected lessons, credits, payments, and reversibility         | Not run                                       |
| Loading/empty/error/success | Each pilot route has tested recoverable states                                   | Not run                                       |
| Accessibility               | Keyboard flow, focus return, labels, contrast, and non-drag alternative verified | Not run                                       |

## Engineering and operations

| Gate               | Required evidence                                                                      | Status                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Static pipeline    | Root lint, typecheck, unit tests, and build                                            | Pass — uncommitted Work Packet 1 tree based on `3d985d5`                                              |
| API end-to-end     | Isolated PostgreSQL run using the same command and migrations as CI                    | Fail — isolated PostgreSQL run: 55/57; two Stage 2 group-deletion assertions fail                     |
| Generated contract | OpenAPI generation is reproducible and web usage policy is resolved                    | Fail — `pnpm --filter @tutorio/api-client generate` passes; web integration policy remains unresolved |
| Database readiness | Health check fails when PostgreSQL is unavailable                                      | Not run                                                                                               |
| Backup recovery    | Restore representative workspace into a clean database and reconcile counts            | Not run                                                                                               |
| Monitoring         | Server errors and failed background/materialization work are visible and actionable    | Not run                                                                                               |
| Privacy exit       | Workspace export and controlled deletion/anonymization complete on representative data | Not run                                                                                               |
| Pilot seed         | People, schedules, packages, shares, payments, ledger events, and edge cases exist     | Fail — finance scenarios are incomplete                                                               |

## Release decision

- Any failed data-integrity, authorization, money, backup, or privacy row blocks
  a real-data pilot.
- A visual mismatch does not block the pilot unless it harms comprehension,
  accessibility, responsive use, or task completion.
- “Works manually” is not enough for finance and lifecycle rules; automated
  domain/service coverage plus one end-to-end assertion is required.
- Update [`../current-state.md`](../current-state.md) with evidence and the exact
  commit whenever a mandatory row becomes `Pass`.
