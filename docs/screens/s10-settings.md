# S10 — Studio Settings

- Status: Waiting for mockups
- Work packet: 6.6
- Depends on: nothing

## User job

Set the studio defaults the rest of the product uses, and look up who changed
what.

## Route

`/app/settings` — a new navigation item (owner only).

## Screens and dialogs

1. **Studio**: name (read-only in the pilot), default currency, timezone
   (read-only in the pilot), mode (solo tutor / studio).
2. **Lessons**: cancellation deadline in hours (default 24, L-51), schedule
   horizon in weeks (default 4, L-120), low-credit warning in lessons
   (default 2, 0 turns it off, L-82, L-120).
3. **Audit log**: who changed what and when, filterable by entity, action,
   person and period.
4. Saving feedback; the solo-mode refusal when a second teacher is active.

## Data available

- `GET /workspaces/current` — `defaultCurrency`, `cancellationDeadlineHours`,
  `timezone`, `mode`, `scheduleHorizonWeeks`, `lowCreditThreshold`.
- `PATCH /workspaces/current/settings` — any of `defaultCurrency`,
  `cancellationDeadlineHours`, `scheduleHorizonWeeks`, `lowCreditThreshold`,
  `mode`; error `SOLO_MODE_SINGLE_TEACHER`.
- `GET /audit-logs?entity=&entityId=&actorId=&action=&from=&to=`.

## Rules

L-51, L-82, L-120; ADR 0004.

## Reuse

`FormPageLayout`, `SectionNav`, `TextField`, `Segmented`, `ChoiceCard`,
`ActionBar`, `DataTable`, `FilterPill`, `Notice`.

## What the mockups must show

- [ ] Each section on desktop and phone.
- [ ] Unsaved changes and the save bar; the solo-mode refusal.
- [ ] Audit log with a long diff, empty and filtered.

## Out of scope

Branding and receipts, billing plans, invitations and roles.

## Open questions

- Are studio name and timezone editable in the pilot?
