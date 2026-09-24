# S11 — Today Dashboard

- Status: Waiting for mockups
- Work packet: 6.6
- Depends on: S01 (panel), S04 (the list the exceptions link to), S06 (billing)

## User job

Open the app in the morning and know what today holds and what needs action:
today's lessons, lessons waiting for a makeup, unpaid lessons, packages
running out.

## Route

`/app` (today it redirects to the students) — becomes the dashboard.

## Screens and dialogs

1. **Today**: today's lessons in time order, the next one highlighted; each
   opens the S01 panel.
2. **Exceptions**, each linking to the filtered Lessons list (S04) or the
   student:
   - unpaid lessons (count),
   - lessons that need a makeup (count),
   - packages running out / on debt (`GET /billing/warnings`),
   - students on a break returning soon.
3. First-run state: no students or lessons yet — the setup steps.

## Data available

- `GET /lessons?from=<today>&to=<tomorrow>`.
- `GET /lessons/list?filter=unpaid&pageSize=1` and
  `?filter=needs_makeup&pageSize=1` — the `counts` give every number in one
  call.
- `GET /billing/warnings` — `items[]` with student, teacher, group, warning,
  credits left, debt lessons.
- `GET /pauses?state=current`.
- `GET /students/summary` for the first-run state.

## Rules

L-50, L-60, L-82, L-90, L-103.

## Reuse

`PageHeader`, `NextLessonCard`, `LessonList`, `StatBlock`, `SetupChecklist`,
`Notice`, `PersonItem`, `EmptyState`.

## What the mockups must show

- [ ] A busy day, a free day, first run.
- [ ] Each exception with numbers and with nothing to report.
- [ ] Phone version.

## Out of scope

Analytics and charts, Telegram reminders.

## Open questions

- Does the dashboard show money (today's income, total debt) in the pilot?
