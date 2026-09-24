# S05 — Schedules

- Status: Waiting for mockups
- Work packet: 6.4 (screens)
- Depends on: S04 (the Lessons page and its tabs)

## User job

See every recurring schedule of the studio, create one, change its days and
times from a date knowing exactly which lessons move, and stop it.

## Route

`/app/lessons/schedules` — the second tab of the Lessons page. The schedule
form and its dialogs are also opened from the student profile (S06) and the
group page (S08).

## Screens and dialogs

1. **Schedules list**: who (student or group), teacher, slots ("Mon 17:00 ·
   Thu 18:30 · 60 min"), horizon, end date, state, next lesson, a planned
   change; filter by state (active, ended, all), teacher, student, group.
2. **Schedule form**: student or group, teacher, weekdays each with its own
   time, one duration, start date, optional end date, horizon in weeks
   (studio default 4) (L-20…L-22).
3. **Change consequence dialog**: "changes take effect from" (default today)
   and the preview — moved, unchanged, created, removed, kept, lessons whose
   topic or notes would be lost, conflicts (L-25…L-27).
4. **Stop dialog**: from a date, the preview of removed and kept lessons
   (L-24).
5. **Horizon change** (weeks ahead).

## Data available

- `GET /schedules?state=&teacherId=&studentId=&groupId=` — paged;
  `slots`, `nextChange`, `nextLessonAt`, `horizonWeeks`, `endsAt`, `state`.
- `POST /schedules` (`?force=true`), `GET /schedules/:id`,
  `PATCH /schedules/:id` (horizon).
- `POST /schedules/:id/changes/preview` and `/changes`,
  `POST /schedules/:id/stop/preview` and `/stop`.
- Errors: `SCHEDULE_EXISTS` (one active per direction and per group),
  `SCHEDULE_ENDED`, `SCHEDULE_CONFLICT`.

## Rules

L-20…L-27, L-110, L-111, L-120.

## Reuse

`CollectionFrame`, `DataTable`, `WeekdayPicker`, `TextField`, `EntityPicker`,
`AdaptiveDialog`, `Notice`, `StatBlock` (preview numbers).

## What the mockups must show

- [ ] List on desktop and phone, with an ended schedule and a planned change.
- [ ] Form with different times per day; "a schedule already exists" state.
- [ ] Change preview with moved and removed lessons, lost notes, a conflict.
- [ ] Stop preview.
- [ ] Empty, loading, error.

## Out of scope

Package sale (S07); group-specific schedule presentation (S08 reuses this
step's form and dialogs).

## Open questions

- Is the change dialog one step (form and preview together) or two?
