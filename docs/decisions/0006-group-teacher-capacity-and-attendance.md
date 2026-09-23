# ADR 0006: Group Teacher, Seats and Attendance

- Status: Accepted and implemented (Work Packet 6.3)
- Date: 2026-09-23

## Context

The approved group screens show things the model could not answer: the
teacher of a group before it has students ("Dmytro Tutor · just created"),
"6 of 8 seats", and who came to each of the last eight lessons with a
two-absences-in-a-row warning. A group had no teacher of its own (the teacher
lived on each enrollment), no capacity, and `Lesson` had one status for the
whole group lesson, so attendance could not be told per student. The work
packet named three options for attendance and asked for the schema changes to
be raised rather than faked.

## Decision

### Group teacher

`Group.teacherId` (nullable FK to `Teacher`) names the teacher who runs the
group. It is the default teacher of new roster enrollments and of the group's
recurring schedule. The migration backfills it from the newest live group
series, else the most common teacher of the live roster. A group without a
teacher named in the request gets the workspace's only active teacher (the
solo tutor), otherwise none.

Changing it moves the group together: the live roster enrollments, the live
or roster-suspended series, and every upcoming scheduled lesson go to the new
teacher after one batched clash check against that teacher's calendar
(`409 SCHEDULE_CONFLICT`, nothing moves). Taught and cancelled lessons keep
the teacher who had them. When legacy enrollments disagree, the page shows the
group's teacher (else the roster's most common) and says the roster is mixed.

### Seats

`Group.capacity` is an optional integer 1–500 (DB CHECK). It is informational:
a full group never refuses a student. The list and page show "6 of 8 seats"
and free seats only when a capacity is set; otherwise just the count.

### Attendance (option 1 of the work packet)

`LessonAttendance` holds one mark per (lesson, enrollment): `PRESENT`,
`ABSENT` or `EXCUSED`, with `markedAt` and `markedById`. Marks are set by
`PUT /lessons/:id/attendance` for a lesson that has started and was not
cancelled (`409 ATTENDANCE_NOT_MARKABLE`), for participants of that lesson
(the live group roster, anyone already marked, or the individual lesson's
enrollment). Changes are audited on the lesson. `GET /groups/:id/attendance`
summarizes the current roster over the last N held lessons (default 8) with
the rules in `@tutorio/domain` `summarizeAttendance`:

- a cancelled lesson is grey for everyone and in no rate;
- an excused absence is neither a presence nor a miss;
- a participant on hold (paused membership or student on hold) is shown but
  kept out of the group figures;
- "at risk" is two or more absences in a row at the end of the window, not a
  low rate.

Option 2 (deriving presence from credits) was rejected: it is wrong for
period packages and charged cancellations. Option 3 (an empty block) would
have left the design's central card permanently empty.

The work packet kept the marking UI out of scope. Without it no mark could
ever exist, so the group page's taught-lesson rows offer a small "Mark
attendance" dialog until the lesson screen (Work Packet 6.4) owns marking.

### Schedule in the group form

The form creates only a group's first schedule, as a lesson series in the
workspace timezone at the group price. Changing an existing schedule rebuilds
booked lessons, so it stays on the recurring-lessons screen, which shows what
it rebuilds; the form shows the schedule read-only with a link
(`409 GROUP_SCHEDULE_EXISTS` from the API). The confirmation flow the work
packet deferred is still to be designed.

## Consequences

- Migration `20260924120000_group_teacher_capacity_attendance` adds the two
  columns, the check, the table and the backfill; the Prisma schema has no
  drift.
- The first student of a group whose schedule was set while it was empty now
  generates the lessons immediately rather than at the nightly run, and a
  schedule set on an empty group is clash-checked when it is set.
- The session's workspace carries its `timezone`, so the form can say which
  zone the schedule is generated in.
- Attendance marking moves to the lesson screen in Work Packet 6.4; the API
  contract does not change.
