# Learning Operations Aggregate

Last verified: 2026-08-27.

This aggregate connects the roster to the calendar. Lifecycle actions must not
silently erase historical finance or scheduling relationships.

## Group

| Concern              | Contract                                                                                                                                                                                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose              | Teaching cohort with optional default price and roster.                                                                                                                                                                                                    |
| Ownership            | Workspace-scoped.                                                                                                                                                                                                                                          |
| Relationships        | Enrollments, lessons, series, and group packages.                                                                                                                                                                                                          |
| Create/update        | Roster reconciliation creates or archives enrollments; price fallback is group, then student, then free. Writes are audited.                                                                                                                               |
| Archive              | Owner-only and idempotent. It preserves roster, all finance, audit history, completed/non-scheduled lessons, and every foreign key. It archives group series and only future `SCHEDULED` group lessons.                                                    |
| Restore              | Owner-only and idempotent. It restores only series/lessons marked by the matching group archive timestamp, after checking every restored lesson against live teacher conflicts.                                                                            |
| Active/paused roster | The default operational roster/counts include only `ACTIVE`/`PAUSED` enrollments whose student is not archived. Student archive preserves `groupId`, temporarily archives its enrollment, and restore returns its exact preceding `ACTIVE`/`PAUSED` state. |

Acceptance scenarios: archive empty group; archive active/paused group;
preserve completed lessons and finance; restore roster; repeated archive/restore;
cross-workspace and non-owner denial.

A group recurring series materializes only while it has at least one active,
non-archived participant. The roster-empty transition token-suspends future
scheduled work; the first active participant restores only that marked work
after checking teacher conflicts.

## Enrollment

| Concern               | Contract                                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose               | Authoritative student-to-individual/group teaching relationship and billing-policy snapshot.                                                                   |
| Ownership             | Workspace-scoped.                                                                                                                                              |
| Relationships         | Student, teacher, optional group; lessons, series, payments, package shares, and credit entries.                                                               |
| Create/update         | Relationship identity is immutable after create; status, billing, price, and deadline are editable. Partial unique indexes prevent equivalent live duplicates. |
| Lifecycle             | `ACTIVE`, `PAUSED`, `ARCHIVED`; technical soft delete/restore is separate and restore rechecks uniqueness.                                                     |
| Required side effects | Pause/archive/delete token-suspends only future `SCHEDULED` individual work. Resume/restore rechecks conflicts and restores only rows marked by that action.   |
| Current gap           | No known Work Packet 4 lifecycle gap.                                                                                                                          |

Acceptance scenarios: individual/group uniqueness, pause/resume, future-lesson
treatment, duplicate-safe restore, and package/payment history preservation.

## LessonSeries

| Concern        | Contract                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose        | Recurring local-time rule that materializes UTC lesson occurrences.                                                                               |
| Ownership      | Workspace-scoped.                                                                                                                                 |
| Relationships  | Exactly one target: enrollment or group; teacher; optional package; generated lessons.                                                            |
| Create/update  | Resolve target and timezone; conflict-check; materialize idempotently. Updates declare one occurrence, this-and-following, or whole-series scope. |
| Delete/restore | Archive stops future generation and handles future scheduled occurrences; historical/detached lessons remain. Restore is not implemented.         |
| Current gaps   | No known Work Packet 4 recurrence gap. Series updates validate generated candidates, and following edits create a new future rule boundary.       |

Acceptance scenarios: DST boundaries, overlapping series, weekday shift,
detached occurrence preservation, pause/archive propagation, delete idempotency.

## Lesson

| Concern       | Contract                                                                                                                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose       | One scheduled occurrence with UTC time, teacher, target, price/currency snapshot, status, and optional charged package.                                                                                                                           |
| Ownership     | Workspace-scoped.                                                                                                                                                                                                                                 |
| Relationships | Enrollment/group, teacher, optional series, exact package, and credit entries.                                                                                                                                                                    |
| Create/update | One-off create conflict-checks unless explicitly forced. Note/price updates, reschedule, and status transitions are separate audited commands. Price/currency become immutable after a non-zero credit entry; notes and `paidAt` remain editable. |
| Status        | Commands and list filters use one effective-status definition. Time-derived display status must not contradict stored command state.                                                                                                              |
| Package rule  | The first non-zero debit persists the exact compatible fixed-count `packageId`; eligibility is evaluated at the occurrence time. Compensation uses that id even after the package is archived.                                                    |
| Delete        | A lesson with non-zero net credit cannot be archived until it returns to `SCHEDULED` and appends compensation. A compensated or never-charged lesson archives/detaches idempotently.                                                              |
| Current gaps  | No known Work Packet 4 status/filter gap. Stored status is authoritative; temporal buckets are derived separately.                                                                                                                                |

Acceptance scenarios: conflict/force parsing, every state transition, repeated
command idempotency, charged and uncharged cancellation, restore, archive with
credit, filters, DST, and series edit scope.
