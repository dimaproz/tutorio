# ADR 0007: Schedules, Per-Student Charging and Package Credits

- Status: Accepted; phases 1–5 implemented (Work Packet 6.4), the rest pending
- Date: 2026-09-23
- Supersedes: parts of [ADR 0003](./0003-cancellation-and-package-accounting.md)
  (which package a lesson debits; period plans; group packages and shares).
- Amends: [ADR 0006](./0006-group-teacher-capacity-and-attendance.md)
  (attendance now drives group charging).

## Context

Recurring lessons could be created in four places with four different rules,
one of them tied to a package. A package's schedule ended with the package,
period packages could not be debited, and a lesson debited the newest package
without checking its balance. A group lesson debited one shared group package,
so a student's absence or freeze could not be expressed in money. The
enrollment's billing type was stored and never used. The product owner
re-decided the model end to end; the full contract is
[`product/scheduling.md`](../product/scheduling.md).

## Decision

1. **A schedule belongs to a direction, not to a package.** A direction is a
   student with one teacher, or a student's membership of one group
   (the existing `Enrollment`, still hidden from the UI). One schedule per
   student–teacher, one per group. A schedule has per-weekday start times,
   one duration, a start date, an optional end date and a rolling horizon
   (default 4 weeks from a studio setting). Its rule is versioned by
   effective date, so a change applies from a chosen date and moves existing
   lessons instead of deleting them.
2. **Each direction is paid by package or per lesson.** A new direction is
   pay-per-lesson until its first package. Prices come from the student's
   rate with the teacher (default: the teacher's rate) or the group price.
3. **Charges are per participant.** A lesson produces one charge per
   participant: individual lessons one, group lessons one per active,
   unpaused member, decided by attendance (present or absent charged,
   excused free; no marks means present). This replaces the group package
   and participant shares.
4. **A package is credits with a validity window** for one direction: by
   count, by period from the schedule, or by period with X lessons per week —
   all expressed as credits, so one ledger serves every kind. A lesson uses
   the oldest valid package with credits; with none it is held on debt, and
   the next package covers debt first. Expired credits are not used unless
   the package is extended. Credits can be transferred between a student's
   directions or refunded.
5. **Lessons complete themselves.** A lesson not cancelled becomes held at
   its end; the tutor corrects afterwards. "No-show" is a charged status for
   individual lessons. Past lessons move between final statuses and never
   return to scheduled.
6. **A makeup is a linked individual lesson**; exactly one of the pair is
   charged.
7. **A pause** (whole student or one direction, optional end) removes
   individual lessons in its window, excludes the student from group lessons,
   extends every valid package by its length, and ends automatically.
8. **Conflicts** cover the teacher and the student on every path, always with
   "save anyway".

## Consequences

- New or changed tables: schedule versions and slots; lesson topic, kind,
  makeup link, no-show status and price override; direction billing mode and
  rate; per-participant lesson charges; package credits, validity and
  extensions; pauses. Group packages and participant shares are removed.
  Only test data exists, so the dev database is reset and reseeded rather
  than converted.
- `LedgerService.applyTransition` is replaced by a billing service whose
  rules (FIFO, debt cover, payment allocation, makeup pairing) are pure
  functions in `@tutorio/domain`.
- New jobs: horizon top-up, auto-complete, pause start and end; each is
  idempotent and takes the existing advisory locks.
- The patterns screen, the package form's schedule and the enrollment dialog
  are replaced by the pages in the product contract.

## Implementation notes

- Phase 3 (2026-09-24) stores a charge as one `LessonCharge` row per lesson
  and participant, re-evaluated from the lesson's state rather than from
  transition deltas; a charge no longer owed is voided and revived later, so
  history stays and repeats are harmless. `LessonCreditEntry` now records only
  the credits a package was granted; a package's remaining credits are its
  entries minus its active charges. Lesson and series package pins are gone.
- A group lesson's participants are today's roster plus whoever was charged
  or marked, the same roster attendance uses, so a tutor can backfill an
  existing group's past lessons.
- A group member's charge is their own rate; the lesson's price is the group
  reference price. An individual lesson's charge follows its price until
  payments reach it.
- The pay-per-lesson balance is derived: payments without a package settle
  the oldest balance charges first; nothing is stored per lesson.
- Phase 5 keeps packages as credits: a transfer creates a new count package on
  the target direction that owes nothing (the money stays on the source), and
  a refund is a `REFUNDED` payment plus a `refund` credit entry, so neither
  history is edited.
