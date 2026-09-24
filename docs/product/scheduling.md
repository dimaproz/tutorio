# Lessons, Schedules and Charging — Product Contract

Status: **accepted target contract, not implemented yet** (2026-09-23).
Agreed with the product owner in a question-and-answer session; the model
changes are recorded in
[ADR 0007](../decisions/0007-schedules-per-student-charging-package-credits.md).
It supersedes the lesson, series and package rules of the current
implementation wherever they differ; `docs/domain/learning-operations.md` and
`docs/domain/finance.md` describe what the code does today until each phase
lands.

Every rule has an id (`L-…`). A test that proves a rule names it.

## User job

"Know who I teach when, move and cancel lessons without losing track, and
always know who has paid for what — without doing bookkeeping by hand."

## Concepts

| Term (UI)            | Meaning                                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lesson               | One dated occurrence with a teacher, a duration and a status.                                                                                                                                           |
| Direction (internal) | What a student is taught and how it is paid: individual lessons with one teacher, or membership of one group. Stored as an `Enrollment`; never named in the UI (the UI says "with Dmytro", "group B2"). |
| Schedule             | A recurring rule for one direction's lessons: weekdays, each with its own start time, one duration.                                                                                                     |
| Horizon              | How many weeks ahead a schedule keeps lessons generated.                                                                                                                                                |
| Package              | Prepaid lesson credits for one direction, valid in a window.                                                                                                                                            |
| Balance              | Money a pay-per-lesson direction owes (or has in advance).                                                                                                                                              |
| Charge               | One participant's cost for one lesson: a credit from a package, or an amount on the balance, or a debt.                                                                                                 |
| Makeup               | An individual lesson given in place of a cancelled or missed one, linked to it.                                                                                                                         |
| Pause                | A period in which a student (or one direction) takes no lessons and is not charged; packages are extended by its length.                                                                                |

## Lesson kinds

- **L-1** Kinds: **individual**, **group**, **makeup** (always individual).
  Trial lessons are deferred to the leads module; when built they are free by
  default, may carry a price and never use a package.
- **L-2** An individual lesson belongs to one direction (student × teacher).
  The first lesson or schedule with a new teacher creates the direction
  silently.
- **L-3** A group lesson belongs to the group; its participants are the
  group's active members who are not paused at the lesson's time.

## Billing modes and prices

- **L-10** Each direction is paid in one of two modes:
  **package** (credits) or **pay-per-lesson** (balance). A new direction
  starts **pay-per-lesson**; selling its first package switches it to
  package. The tutor can switch by hand.
- **L-11** Price of an individual lesson: the student's **rate with that
  teacher**, which defaults to the teacher's rate and can be changed for the
  pair. Price of a group lesson: the group price, optionally overridden per
  member.
- **L-12** A lesson can carry its own price. It can be changed until the
  lesson is **paid**; a change after it was charged is recorded in the
  history. A package lesson always costs one credit, whatever its price.
- **L-13** Monthly subscriptions without a lesson count are not supported.

## Schedules

- **L-20** A schedule belongs to a **student with one teacher** or to a
  **group**, never to a package. A student has at most **one schedule per
  teacher**; a group has **one schedule**, taught by the group's teacher.
- **L-21** A schedule has weekdays, **each with its own start time**, one
  **duration**, a **start date**, an optional **end date**, and a
  **horizon** in weeks.
- **L-22** Lessons are generated for the next _horizon_ weeks at once and
  topped up daily, indefinitely, while the schedule is active. The horizon
  defaults to the studio setting (**4 weeks**) and can be changed per
  schedule.
- **L-23** A schedule is created from the student profile, the group page
  and form, the lesson form ("Repeat"), or the Schedules tab of the Lessons
  page. "Repeat" for a student who already has a schedule with that teacher
  **adds the day to that schedule** after showing what it becomes.
- **L-24** **Stop** ends a schedule from a chosen date: its lessons from that
  date are removed. Lessons moved by hand are kept, and the confirmation says
  so.
- **L-25** A **change** (days, times, duration) takes effect **from a chosen
  date** (default today). Lessons before it are untouched. Before saving, a
  confirmation shows the consequence: how many lessons are rebuilt, created
  and kept, which lessons with a topic or notes would lose them, and the
  conflicts.
- **L-26** A change **moves** existing lessons where it can (same week and
  weekday, or the next free day in the same week), so their topic, notes and
  history survive; only the rest are removed or created.
- **L-27** Held, cancelled and hand-moved lessons are never touched by a
  schedule change or stop. Nothing is hard-deleted.

## One-off lessons

- **L-30** A one-off lesson is created from the calendar (click or drag on
  an empty slot), the lesson form, the student profile or the group page.
  The form can create several dates at once.
- **L-31** A lesson **in the past** can be created: it is saved as
  **held** (and charged) by default, or directly as cancelled or no-show.

## Changing a lesson

- **L-40** A lesson's **date and time, duration, teacher** (a substitution:
  the schedule does not change) and **price** (L-12) can be changed, plus
  its **topic** and **notes**. The topic is shown in the calendar and lists.
- **L-41** Moving a lesson that belongs to a schedule — by the button or by
  dragging in the calendar — asks **"this lesson only"** or **"this and
  following"**. "This and following" changes that weekday's time in the
  schedule from that date (L-25 applies); other weekdays are untouched.
- **L-42** A moved lesson that is not part of a schedule change stays
  hand-moved (L-27).

## Holding, cancelling, no-show

- **L-50** A lesson that was not cancelled **becomes held automatically at
  its end** and is charged. The tutor can correct it afterwards: cancel it
  (charged or free) or mark a no-show.
- **L-51** Cancelling suggests whether to charge by the **cancellation
  deadline** (studio setting, default 24 h, overridable per direction): a
  student cancelling later than the deadline → charged; earlier, or a
  teacher cancelling → free. The tutor can switch it. "Cancelled by" is
  teacher, student or group; a reason is optional.
- **L-52** **No-show** (individual lessons): the student did not come
  without notice. Charged like a held lesson, shown as a miss in history and
  statistics. Group lessons record absences through attendance instead.
- **L-53** A lesson in the past moves between final statuses directly
  (held, cancelled, no-show); it never goes back to "scheduled".
- **L-54** **Bulk cancel**: all lessons of one teacher, or of the whole
  studio, in a period (holiday, illness). Free, "cancelled by teacher" with a
  reason. A preview says how many lessons are cancelled.

## Makeups

- **L-60** A makeup is assigned by hand from a cancelled or no-show
  individual lesson ("Assign a makeup") and is linked to it; one makeup per
  lesson.
- **L-61** **Exactly one of the pair is charged**: if the original was
  charged (late cancellation or no-show), the makeup is free; otherwise the
  makeup is charged like a normal lesson.
- **L-62** Group lessons have no makeups.

## Attendance and group charging

- **L-70** Group lessons are charged **per participant**, from that
  student's own package or balance for the group direction.
- **L-71** A participant marked **present** or **absent** is charged;
  **excused** is not. Not charging an absent student is a deliberate, rare
  exception (mark excused).
- **L-72** When a group lesson becomes held with no marks, **every
  participant counts as present**; the tutor marks only the exceptions.
- **L-73** A participant who is **paused** at the lesson's time takes no
  part: not marked, not charged, excluded from the group's figures, shown
  "on pause".
- **L-74** Attendance can be marked or changed once the lesson has started,
  unless it was cancelled; a change re-evaluates that participant's charge.

## Packages

- **L-80** A package is **a number of credits for one direction**, valid in
  a window. Kinds:
  - **by count** — N lessons, optional "valid until";
  - **by period, from the schedule** — start and end date; the credits are
    the lessons the direction's schedule produces in the window (prefilled,
    editable);
  - **by period, flexible** — start and end date, X lessons per week; the
    credits are X × weeks.
    Price: per lesson × credits, or a total for the period.
- **L-81** A lesson uses the **oldest valid package with credits left**.
- **L-82** With no credits left the lesson is held **on debt**. The next
  package bought for the direction **covers those lessons first**. A warning
  appears when a package is nearly used up (studio setting, default **2
  lessons left**).
- **L-83** A later schedule change does not change a package's credits:
  extra lessons go on debt, unused credits expire at the end of the window.
- **L-84** An **expired** package is no longer used; the tutor can
  **extend** it.
- **L-85** Unused credits stay when a student leaves a group or is archived.
  The tutor can **transfer** them to another direction of the same student
  (recalculated by price, rounded down, the remainder shown) or record a
  **refund**.
- **L-86** **Sell to members**: from the group page, one package spec is
  sold to each selected member; each member pays separately.
- **L-87** Selling a package never creates a schedule or lessons and never
  records a payment by itself; those are the next actions.

## Pay-per-lesson balance

- **L-90** In pay-per-lesson mode each charged lesson adds its price to the
  direction's balance; a payment reduces it and settles the **oldest**
  lessons first. The profile shows "Debt: 1 200 ₴ · 3 lessons".
- **L-91** A debt from a pay-per-lesson period stays money; a later package
  covers only lessons that were on debt in package mode.

## Pause (freeze)

- **L-100** A **pause** has a start and an optional end, for the **whole
  student** or **one direction** (for example group B2).
- **L-101** During a pause: the student's individual lessons in the window
  are removed; in groups the student takes no part (L-73); nothing is
  charged.
- **L-102** Every package valid at the pause start is **extended by the
  pause length** (an open-ended pause extends on return).
- **L-103** The student **returns automatically** at the end date; lessons
  after it come back, checked for conflicts.
- **L-104** "On hold" for a student means an active pause; there is no
  separate hold state.

## Conflicts

- **L-110** A conflict is an overlap for the **teacher** or the **student**
  (their individual lessons and the lessons of groups they take part in).
- **L-111** Every path — lesson, move, schedule create or change, group
  schedule, pause return — shows **what it overlaps** and offers **"Save
  anyway"**. Nothing is refused silently.

## Settings (studio)

- **L-120** Horizon for new schedules (default 4 weeks); cancellation
  deadline (default 24 h); low-credit warning (default 2 lessons).
- **L-121** Teacher working hours are not part of the pilot.

## Pages

| Page                | Route                                  | Purpose                                                                                                                                                  |
| ------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calendar            | `/app/calendar`                        | Week (Day on phones, remembered per browser), month and day views; create by click/drag, move by drag (L-41), filters by teacher and status.             |
| Lessons — List      | `/app/lessons`                         | Every lesson with filters: unpaid, cancelled, no-show, needs a makeup; teacher, student, group, period; bulk cancel.                                     |
| Lessons — Schedules | `/app/lessons/schedules`               | Every schedule: who, teacher, slots ("Mon 17:00 · Thu 18:30 · 60 min"), horizon, end date, state; create, change, stop. Replaces "Lesson Patterns".      |
| Lesson side panel   | `?lesson=<id>` on Calendar and Lessons | A side panel (a sheet on phones) with its own URL: details, topic and notes, edit, hold/cancel/no-show, makeup link, group attendance, charges, history. |
| Student profile     | `/app/students/[id]`                   | Schedules per teacher; billing per direction (mode, rate, packages, debt, warnings); pause; transfer and refund.                                         |
| Group page          | `/app/groups/[id]`                     | Editable schedule (L-25 confirmation); attendance, present by default; sell to members; each member's billing state.                                     |

Required states for every page: loading, empty, error with retry, and the
phone layout. Destructive consequences (rebuilt lessons, cancellations,
removed lessons) are always previewed with numbers before they apply.

## Implementation phases

Tracked in [`next-work.md`](../next-work.md): (1) lesson core and conflicts,
(2) schedule model, (3) billing core, (4) automation and bulk cancel,
(5) package kinds and operations, (6) pause, (7) read APIs; the screens
follow the owner's mockups.

| Phase                            | State                                                                                                                      | Rules in force                                                                                                                                                                                                                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — Lesson core and conflicts    | Implemented 2026-09-23 (API; interim web actions)                                                                          | L-1 (makeup kind), L-31, L-40, L-52, L-53, L-60, L-61 (decided when the makeup's status changes), L-110 and L-111 on lesson create, move, edit and makeup                                                                                                                                                                  |
| 2 — Schedule model               | Implemented 2026-09-24 (API; the pattern screen, group form and package form run on it)                                    | L-20, L-21, L-22 (per-schedule horizon, studio default 4 weeks, nightly top-up), L-23 (a pattern or "this and following" for a direction with a schedule changes that schedule), L-24, L-25, L-26, L-27, L-41, L-110 and L-111 on schedule create and change, L-120 (horizon setting)                                      |
| 3 — Billing core                 | Implemented 2026-09-24 (API; interim web: members' packages on the group page, student-only package form)                  | L-10, L-11 (member rate = group price or its override), L-12, L-61 (re-evaluated when the original changes), L-70, L-71, L-72 (today's roster), L-74, L-80 (one direction; kinds in phase 5), L-81, L-82 (debt and cover; warning in phase 7), L-83, L-84 (expired not used; extension in phase 5), L-90, L-91             |
| 4 — Automation                   | Implemented 2026-09-24 (API every 10 minutes; bulk cancel API only; the cancel dialog follows L-51)                        | L-50 (held at its end, charged), L-51 (a teacher or group cancellation is suggested free), L-54, L-72 (unmarked active members marked present when a group lesson is held)                                                                                                                                                 |
| 5 — Package kinds and operations | Implemented 2026-09-24 (API; the current package form keeps its schedule and first-payment inputs until the new sale form) | L-80 (by count, by period from the direction's schedule — editable, by period X a week; per-lesson or total price; a period window), L-84 (extend), L-85 (transfer by price, rounded down, remainder shown; refund of credits and money), L-86, L-87 for the member sale                                                   |
| 6 — Pause                        | Implemented 2026-09-24 (API; the student "on a break" status runs on it)                                                   | L-73 (a paused member is not marked or charged), L-100 (one pause at a time for the same lessons), L-101, L-102 (packages valid at the start; an early end takes the unused part back), L-103 (return: lessons from then on come back, checked for teacher conflicts unless forced; status synced every 10 minutes), L-104 |
| 7                                | Not started                                                                                                                | —                                                                                                                                                                                                                                                                                                                          |
