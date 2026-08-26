# ADR 0002: Record Lifecycle and Deletion

- Status: Accepted; implemented for Student and Group archive/restore in Work Packets 2 and 2.1
- Date: 2026-08-24
- Last verified: 2026-08-26

## Context

Current entities mix business statuses, soft deletion, and hard deletion. Group
deletion disconnects related data and restore restores only the group. Student
hard deletion can conflict with finance foreign keys. The UI cannot make a
truthful promise until one lifecycle policy applies across aggregates.

## Decision

### Normal removal

- `Archive` is the normal user action for students, parents, teachers, groups,
  enrollments, series, and packages.
- Archive hides the record from default operational views and stops future work
  where applicable, but preserves relationships and historical lesson, credit,
  payment, share, and audit facts.
- Restore reverses only reversible operational effects and revalidates conflicts
  and uniqueness before activation.
- Business status (`ACTIVE`, `PAUSED`, `ARCHIVED`) and technical deletion
  (`deletedAt`) must not represent the same state without a documented reason.

### Hard deletion

- Hard deletion is owner-only and available only for unused records with no
  business history or dependent operational records.
- If history exists, the API returns a typed conflict with a consequence summary;
  it does not cascade or partially delete.
- Financial ledger, payment, package share, and audit history are never hard
  deleted through a routine entity endpoint.

### Privacy requests

- Privacy deletion is a separate workspace-level workflow, not an entity CRUD
  action.
- It exports data first, then deletes data that can legally and safely be removed
  and anonymizes identity/contact fields where accounting or audit history must
  remain.
- The workflow is transactional by aggregate, resumable, logged, and covered by
  a runbook and restoration test.

## Relationship effects

- Archiving a group stops its series and future scheduled lessons or explicitly
  asks how to handle them; it never clears historical `groupId` links.
- Archiving an enrollment prevents new materialization and defines treatment of
  already-generated future lessons.
- Archiving a package stops package-owned recurrence and prevents new charges;
  existing ledger and payment history remains readable.
- Archiving a student does not destroy enrollments, packages, lessons, payments,
  parent links, or audit history.
- An archived student cannot be edited through a normal PATCH and must be
  restored through its dedicated command first. Student archive temporarily
  marks linked group enrollments with the same archive timestamp and records
  their prior `ACTIVE` or `PAUSED` state; restore changes only those markers.
- A group deleted by the pre-archive destructive implementation is not treated
  as safely restorable. The API returns a typed manual-repair refusal because
  cleared enrollment links are not deterministically recoverable.

## Consequences

- Existing group and student deletion paths must change before pilot use.
- List defaults, filters, copy, API endpoints, and tests must distinguish archive,
  restore, and privacy deletion.
- Destructive confirmation dialogs must show affected future work and retained
  history, not generic warnings.
- Work Packet 4 owns the remaining group recurrence policy when no active
  participants remain; this lifecycle implementation does not suspend a group
  series merely because one student is archived.
