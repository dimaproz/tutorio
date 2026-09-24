# S03 — Calendar

- Status: Waiting for mockups
- Work packet: 6.4 (screens)
- Depends on: S01 (panel), S02 (create form)

## User job

See the studio's lessons in time, find a free slot, book by clicking, move by
dragging, and open any lesson.

## Route

`/app/calendar` — a new navigation item. `?lesson=<id>` opens the S01 panel
over it.

## Screens and dialogs

1. **Week view** (default on desktop), **day view** (default on phones),
   **month view**; the choice is remembered per browser (page map).
2. **Filters**: teacher, status; "today", previous and next.
3. **Event**: time, student or group, teacher colour, status (held,
   cancelled, no-show, makeup), unpaid mark.
4. **Click or drag on empty time** opens the S02 form prefilled.
5. **Drag an event** to move it: a schedule lesson asks "this lesson only /
   this and following" (S01 move scope dialog); conflicts show the S01
   conflict dialog.
6. Empty week, loading, error.

## Data available

- `GET /lessons?from=&to=&teacherId=&status=` — the period's lessons with
  student, group, teacher colour and each charge's `paid`.
- Move: `PATCH /lessons/:id/reschedule` (`scope`), preview through
  `POST /schedules/:id/changes/preview`.
- `GET /teachers` for the filter; the workspace timezone from the session.

## Rules

L-30, L-41, L-42, L-110, L-111; page map "Calendar".

## Reuse

`PageHeader`, `Segmented` (view switch), `FilterPill`, `EntityPicker`
(teacher filter), `useStoredChoice`, S01 and S02 dialogs. The calendar grid
itself is new: an existing library (`react-big-calendar` was used before the
reset) or a custom grid is decided with the mockups.

## What the mockups must show

- [ ] Week with overlapping lessons, a long lesson, a cancelled and a makeup.
- [ ] Day view on the phone, and navigation between days.
- [ ] Month view with more lessons than fit in a day cell.
- [ ] Dragging feedback and the drop onto a conflict.
- [ ] Empty week, loading, error.
- [ ] Dark theme (teacher colours on dark).

## Out of scope

Teacher working hours (L-121); the Lessons list (S04).

## Open questions

- Which hours does the week show by default (for example 08:00–21:00, with
  scrolling)?
- Are cancelled lessons shown in the calendar or hidden behind a filter?
