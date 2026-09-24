# S01 — Lesson Side Panel and Lesson Actions

- Status: Waiting for mockups
- Work packet: 6.4 (screens)
- Depends on: nothing; opened first from the lesson lists already on the
  student profile and the group page

## User job

Open any lesson and do everything that concerns it: see when, who, with which
teacher, whether it is paid; mark it held, cancelled or missed; change its
time, length, teacher, price or topic; assign a makeup; mark who came to a
group lesson.

## Entry points

- A lesson row on the student profile and the group page (`LessonList`
  `onSelect`) — this step.
- Later: the calendar (S03) and the Lessons list (S04).
- Deep link: `?lesson=<id>` on the page that opened it; phone: a full-screen
  sheet.

## Screens and dialogs

1. **Side panel** (sheet on phones): date and time, duration, teacher, student
   or group, status, kind (regular or makeup), topic, notes, price, the charge
   of each participant and whether it is paid, the makeup or the original it
   replaces, the schedule it comes from, history.
2. **Cancel dialog**: who cancelled (student, teacher), a reason, and "charge /
   do not charge" pre-selected by the deadline suggestion (L-51).
3. **Status corrections** for a past lesson: held ↔ cancelled ↔ no-show
   (L-53); no return to "scheduled" after the end.
4. **Edit**: date and time, duration, teacher (substitution), price (only while
   unpaid), topic, notes (L-40, L-12).
5. **Move scope dialog** for a schedule lesson: "this lesson only" or "this
   and following" with the consequence numbers (L-41, L-25).
6. **Makeup dialog**: date and time, optional other teacher and duration,
   topic (L-60, L-61); only for a cancelled or missed individual lesson.
7. **Attendance** of a group lesson: present / absent / excused per member,
   "everyone came", paused members shown "on pause" and not markable
   (L-71…L-74). Replaces the interim attendance dialog of the group page.
8. **Delete** a lesson with no charges (a charged one must be cancelled free
   first).
9. **Conflict dialog** shared by edit, move and makeup: what overlaps (teacher
   or student), "Save anyway" (L-110, L-111).

## Data available

- `GET /lessons/:id` — the lesson, `charges[]` with `source` and `paid`,
  `original`, `makeup`, `schedule`, `history[]` (audit entries with actor),
  `cancellationDeadlineHours`, `attendance` counts.
- `PATCH /lessons/:id/status` — `targetStatus`, `cancelledBy`, reason; charge
  choice.
- `PATCH /lessons/:id` — time, duration, teacher, price, topic, notes
  (`?force=true` after a conflict).
- `PATCH /lessons/:id/reschedule` — `startsAtUtc`, `scope`
  (`this` | `this_and_following`); schedule change preview:
  `POST /schedules/:id/changes/preview`.
- `POST /lessons/:id/makeup`, `DELETE /lessons/:id`.
- `GET` / `PUT /lessons/:id/attendance`.
- Errors: `SCHEDULE_CONFLICT` (with `details.conflicts[]`), `LESSON_ENDED`,
  `LESSON_PAID`, `LESSON_CHARGED`, `MAKEUP_NOT_ALLOWED`, `MAKEUP_EXISTS`,
  `NO_SHOW_INDIVIDUAL_ONLY`, `ATTENDANCE_NOT_MARKABLE`.

## Rules

L-1, L-12, L-40, L-41, L-50…L-53, L-60…L-62, L-70…L-74, L-110, L-111.

## Reuse

`AdaptiveDialog` (dialogs, sheet on phones), `ConfirmDialog`, `LessonItem` /
`LessonList`, `AttendanceList`, `PersonItem`, `Segmented`, `TextField`,
`Notice`, `LessonStatusBadge`, shadcn `Sheet`.

## What the mockups must show

- [ ] Panel for an individual scheduled lesson, a held one (paid and unpaid),
      a cancelled one with a makeup, a makeup, a group lesson.
- [ ] Panel loading and "lesson not found" (deleted or taken out by a pause).
- [ ] Cancel dialog with the late-cancellation suggestion both ways.
- [ ] Edit form, including the price locked after payment.
- [ ] Move scope dialog with numbers.
- [ ] Makeup dialog.
- [ ] Attendance with a paused member and "everyone came".
- [ ] Conflict dialog.
- [ ] History list (long).
- [ ] Phone versions of the panel and each dialog.

## Out of scope

Creating lessons (S02), the calendar drag (S03), bulk cancel (S04), schedule
editing beyond "this and following" (S05).

## Open questions

- Does the panel show the price for package lessons, or only "1 credit"?
- Is history shown by default or behind "Show history"?
