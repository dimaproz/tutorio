# S08 — Group Page Operations

- Status: Waiting for mockups
- Work packet: 6.4 (screens)
- Depends on: S01 (attendance in the lesson panel), S05 (schedule form and
  change dialog), S07 (the package spec the member sale reuses)

## User job

Run a group from its page: change its one schedule knowing what moves, mark
who came (everyone present by default), sell the same package to several
members at once, and see each member's billing state.

## Route

`/app/groups/[groupId]` — changes to the existing rebuilt group page.

## Screens and dialogs

1. **Schedule block**: the group's slots and next lessons; create, change
   (S05 change consequence dialog), stop (L-23…L-25).
2. **Lessons and attendance**: the group's lessons open the S01 panel with
   attendance; the interim attendance dialog is retired.
3. **Sell to members dialog**: pick members, one package spec (from S07),
   preview per member, result (L-86).
4. **Members' billing**: per member — mode, credits left, debt, warning,
   paused ("on pause", L-73); the member's own rate override.
5. **Member rate dialog**: the group price or the member's own rate (L-11).

## Data available

- `GET /groups/:id`, `GET /groups/:id/attendance`.
- `GET /schedules?groupId=`, schedule routes as in S05.
- `POST /packages/members` — `groupId`, `studentIds[]`, the package spec.
- `GET /enrollments/:id/billing` per member (or `GET /students/:id/billing`),
  `PATCH /enrollments/:id` (rate).
- `GET /pauses?studentId=` for members on pause.

## Rules

L-3, L-11, L-23…L-27, L-62, L-70…L-74, L-86.

## Reuse

The existing group page blocks (`GroupHero`, roster, lessons card),
`AttendanceList`, `LessonList`, `CreditMeter`, `PersonItem`, S01/S05/S07
dialogs.

## What the mockups must show

- [ ] Schedule block with and without a schedule; a planned change.
- [ ] Members with mixed billing: package low, pay-per-lesson debt, on pause.
- [ ] Sell to members: selection, preview, result.
- [ ] Phone version.

## Out of scope

Group creation and editing (done in Work Packet 6.3).

## Open questions

- Should the members' billing be a column of the roster or its own block?
