# Learning Operations Aggregate

Last verified: 2026-08-26.

This aggregate connects the roster to the calendar. Lifecycle actions must not
silently erase historical finance or scheduling relationships.

## Group

| Concern              | Contract                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose              | Teaching cohort with optional default price and roster.                                                                                                                                                 |
| Ownership            | Workspace-scoped.                                                                                                                                                                                       |
| Relationships        | Enrollments, lessons, series, and group packages.                                                                                                                                                       |
| Create/update        | Roster reconciliation creates or archives enrollments; price fallback is group, then student, then free. Writes are audited.                                                                            |
| Archive              | Owner-only and idempotent. It preserves roster, all finance, audit history, completed/non-scheduled lessons, and every foreign key. It archives group series and only future `SCHEDULED` group lessons. |
| Restore              | Owner-only and idempotent. It restores only series/lessons marked by the matching group archive timestamp, after checking every restored lesson against live teacher conflicts.                         |
| Active/paused roster | The default operational roster/counts include only `ACTIVE`/`PAUSED` enrollments whose student is not archived. Student archive preserves `groupId`, temporarily archives its enrollment, and restore returns its exact preceding `ACTIVE`/`PAUSED` state. |

Acceptance scenarios: archive empty group; archive active/paused group;
preserve completed lessons and finance; restore roster; repeated archive/restore;
cross-workspace and non-owner denial.

The policy for a group recurring series when every participant is paused or
archived remains deliberately deferred to Work Packet 4.

## Enrollment

| Concern               | Contract                                                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose               | Authoritative student-to-individual/group teaching relationship and billing-policy snapshot.                                                                   |
| Ownership             | Workspace-scoped.                                                                                                                                              |
| Relationships         | Student, teacher, optional group; lessons, series, payments, package shares, and credit entries.                                                               |
| Create/update         | Relationship identity is immutable after create; status, billing, price, and deadline are editable. Partial unique indexes prevent equivalent live duplicates. |
| Lifecycle             | `ACTIVE`, `PAUSED`, `ARCHIVED`; technical soft delete/restore is separate and restore rechecks uniqueness.                                                     |
| Required side effects | Pause/archive/delete prevents new materialization and requires an explicit policy for already-generated future lessons. Resume must not create duplicates.     |
| Current gap           | Future lessons remain; soft-deleted active enrollments can still be considered by materialization; group series continue when all members are paused.          |

Acceptance scenarios: individual/group uniqueness, pause/resume, future-lesson
treatment, duplicate-safe restore, and package/payment history preservation.

## LessonSeries

| Concern        | Contract                                                                                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose        | Recurring local-time rule that materializes UTC lesson occurrences.                                                                                                                     |
| Ownership      | Workspace-scoped.                                                                                                                                                                       |
| Relationships  | Exactly one target: enrollment or group; teacher; optional package; generated lessons.                                                                                                  |
| Create/update  | Resolve target and timezone; conflict-check; materialize idempotently. Updates declare one occurrence, this-and-following, or whole-series scope.                                       |
| Delete/restore | Archive stops future generation and handles future scheduled occurrences; historical/detached lessons remain. Restore is not implemented.                                               |
| Current gaps   | Create/update conflict checks are inconsistent; target lifecycle is not propagated; this-and-following cannot correctly move weekday; group series may run with no active participants. |

Acceptance scenarios: DST boundaries, overlapping series, weekday shift,
detached occurrence preservation, pause/archive propagation, delete idempotency.

## Lesson

| Concern       | Contract                                                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Purpose       | One scheduled occurrence with UTC time, teacher, target, price/currency snapshot, status, and optional charged package.                                                                          |
| Ownership     | Workspace-scoped.                                                                                                                                                                                |
| Relationships | Enrollment/group, teacher, optional series, exact package, and credit entries.                                                                                                                   |
| Create/update | One-off create conflict-checks unless explicitly forced. Note/price updates, reschedule, and status transitions are separate audited commands.                                                   |
| Status        | Commands and list filters use one effective-status definition. Time-derived display status must not contradict stored command state.                                                             |
| Package rule  | When a lesson consumes credit, persist the exact `packageId`; compensation always returns credit to it.                                                                                          |
| Delete        | Archive/detach only after resolving any charged credit. Completed/financial history is not removed.                                                                                              |
| Current gaps  | Charged delete has no compensation; package fallback can change between transitions; automatic replacement usually creates nothing; effective/stored status and recurrence edit scope can drift. |

Acceptance scenarios: conflict/force parsing, every state transition, repeated
command idempotency, charged and uncharged cancellation, restore, replacement,
delete with credit, filters, DST, and series edit scope.
