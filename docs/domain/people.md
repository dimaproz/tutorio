# People Aggregate

Last verified: 2026-08-24.

Normal removal must follow
[ADR 0002](../decisions/0002-record-lifecycle-and-deletion.md). Current student
and parent hard-delete behavior is not the accepted target.

## Student

| Concern            | Contract                                                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose            | Learner identity, contacts, timezone, optional learning profile, default lesson price, and operational status.                                                                                                                        |
| Ownership          | Workspace-scoped.                                                                                                                                                                                                                     |
| Relationships      | Parents through `StudentParent`; enrollments; individual packages; indirect lessons, series, payments, shares, and credit history.                                                                                                    |
| Create/update      | Name and timezone are the only essential create fields. Updates may replace the complete parent-link set and are audited transactionally.                                                                                             |
| Business lifecycle | `ACTIVE -> ON_HOLD -> ARCHIVED`; status controls operational visibility, not historical deletion.                                                                                                                                     |
| Target removal     | Archive/restore is normal. Hard delete is owner-only and permitted only before business history exists.                                                                                                                               |
| Current gap        | DELETE removes enrollments then the student and may fail on payment/share `RESTRICT` foreign keys. Packages can be detached, contradicting “remove every link.” Stale deleted/trash concepts remain without a coherent restore route. |
| Permissions gap    | Mutations, including permanent delete, are not consistently owner-only.                                                                                                                                                               |

Required side effects: archive stops new scheduling/charges through active
enrollments but preserves all historical relations. Restore revalidates conflicts.

Acceptance scenarios: quick create; parent link reconciliation; archive with
future lessons; archive with package/payment history; restore; hard-delete conflict;
cross-workspace and non-owner denial.

## Parent

| Concern        | Contract                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Purpose        | Reusable guardian/contact record linked to one or more students.                                                                    |
| Ownership      | Workspace-scoped.                                                                                                                   |
| Relationships  | Many-to-many students through `StudentParent`.                                                                                      |
| Create/update  | Contact fields plus optional student IDs; updates currently replace the full student-link set in one audited transaction.           |
| Target removal | Archive/restore is normal. Unused record may be hard-deleted by owner.                                                              |
| Current gap    | DELETE hard-deletes the parent and links; stale `deletedAt`/trash concepts imply a restore lifecycle that the API does not provide. |
| UX rule        | Do not persist a nested parent before an unsaved student. Create/link after student save unless one atomic API command owns both.   |

Acceptance scenarios: create unlinked, link to multiple students, unlink one,
archive without breaking student history, and reject cross-workspace student IDs.

## StudentParent

| Concern   | Contract                                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| Purpose   | Relationship between a student and a parent.                                                                            |
| Ownership | No direct `workspaceId`; tenant safety is inherited from both endpoints and must be validated by the aggregate service. |
| Lifecycle | Created/deleted only through student or parent commands; unique student-parent pair; no independent API.                |
| Audit     | Link-set changes are recorded in the aggregate audit diff.                                                              |
| Known gap | Database shape alone cannot prevent a cross-workspace link; service validation is mandatory.                            |

Acceptance: both sides must belong to the authenticated workspace in the same
transaction; duplicate links are idempotent or rejected predictably.

## Teacher

| Concern           | Contract                                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose           | Teaching profile and assignment target, independent from login access.                                                                                |
| Ownership         | Workspace-scoped; may link to one `WorkspaceMember`.                                                                                                  |
| Relationships     | Enrollments, lessons, recurring series, and optional login membership.                                                                                |
| Create/update     | Solo mode permits one active profile. A linked membership must belong to the workspace and be unique.                                                 |
| Lifecycle         | `ACTIVE`/`ARCHIVED` business status plus soft delete/restore.                                                                                         |
| Pilot permissions | Owner-only CRUD. Teacher login is unsupported until ADR 0004’s future gate is complete.                                                               |
| Current gaps      | Updating unrelated fields can erase `subjects`; mutations are not consistently owner-only; archive/delete does not define behavior for active series. |

Acceptance scenarios: solo limit, member-link uniqueness, subject preservation,
archive with assigned future work, restore conflict, and non-owner denial.
