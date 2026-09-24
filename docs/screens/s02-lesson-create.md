# S02 — Lesson Create Form

- Status: Waiting for mockups
- Work packet: 6.4 (screens)
- Depends on: S01 (the conflict dialog)

## User job

Book a lesson for a student or a group — once, on several dates, in the past
(to record what already happened), or repeating (which creates or extends the
direction's schedule).

## Entry points

- "Add lesson" on the student profile and the group page.
- Later: a click or drag on the calendar (S03) prefilling date, time and
  duration; the Lessons list (S04).

## Screens and dialogs

1. **Lesson form** (dialog; sheet on phones): student or group, teacher
   (prefilled from the direction; hidden in solo mode), date and time — one
   or more dates, duration, price (prefilled from the student's rate with
   that teacher or the group price, L-11), topic, notes.
2. **Past lesson**: a date in the past offers held (default), cancelled or
   no-show (L-31).
3. **Repeat** toggle: weekdays with a time each, "from" date, optional end;
   when the direction already has a schedule the form shows what the schedule
   becomes and adds the day to it (L-20, L-23).
4. **Conflict dialog** from S01 on save (L-111).

## Data available

- `POST /lessons` — `studentId` or `groupId`, `teacherId`, `startsAt[]`
  (up to 50), `durationMin`, `priceMinor`, `currency`, `status`
  (`?force=true` after a conflict). A student without a direction with that
  teacher gets one, paid per lesson until a package is sold (L-10).
- Repeat: `POST /schedules` (new) or `POST /schedules/:id/changes/preview` and
  `POST /schedules/:id/changes` (add a day to the existing one);
  `GET /schedules?studentId=&teacherId=` to find it.
- Pickers: `GET /students`, `GET /groups/options`, `GET /teachers`.

## Rules

L-2, L-3, L-10, L-11, L-12, L-20…L-23, L-30, L-31, L-110, L-111.

## Reuse

`AdaptiveDialog`, `EntityPicker`, `WeekdayPicker`, `TextField`, `Segmented`,
`Notice`, the S01 conflict dialog.

## What the mockups must show

- [ ] Form for a student, for a group, with several dates.
- [ ] Past date with the status choice.
- [ ] Repeat on, for a direction without a schedule and with one (the
      "schedule becomes" summary).
- [ ] Validation errors; solo mode without the teacher field.
- [ ] Phone version.

## Out of scope

Editing a schedule on its own (S05); packages (S07).

## Open questions

- Several dates: a list of date-time rows, or a calendar multi-pick?
- Does "Repeat" live in this form or open the schedule form (S05)?
