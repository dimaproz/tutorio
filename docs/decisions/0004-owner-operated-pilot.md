# ADR 0004: Owner-Operated Pilot

- Status: Accepted and enforced
- Date: 2026-08-24

## Context

The schema supports `OWNER` and `TEACHER` workspace memberships, but there is
no complete invitation, workspace switching, own-teacher scoping, or staff
permission design. Presenting staff login as supported would create an
authorization and privacy risk.

## Decision

- The first pilot is operated through an `OWNER` membership.
- `Teacher` is a teaching-profile and assignment entity; it does not imply that
  the person can sign in.
- All business reads and mutations, finance, audit, settings, member roster,
  archive/restore, and destructive actions are owner-only for the pilot.
- Only authenticated self/session context (`GET /auth/me` and
  `GET /workspaces/current`) remains available to a legacy `TEACHER`
  membership. It cannot read or mutate pilot business data.
- The full endpoint contract is maintained in
  [`../api-permission-matrix.md`](../api-permission-matrix.md) and executable
  controller metadata tests prevent unclassified routes from remaining open.

## Future staff-access gate

Before enabling teacher login, implement and test:

- Invitation, acceptance, removal, and role-change lifecycle.
- Workspace selection for users with multiple memberships.
- A permission matrix for every command and read model.
- “Own teacher profile” mapping and scoping for students, groups, lessons,
  schedules, and notes.
- Explicit restrictions for payments, credit adjustments, audit, settings,
  export, and deletion.
- Cross-workspace and cross-teacher negative end-to-end tests.

## Consequences

- Owner-only enforcement is implemented through controller `@Roles('OWNER')`
  metadata and the global `RolesGuard`; services retain tenant scoping rather
  than adding ad-hoc role checks.
- School-mode collaboration remains a product direction but is not an MVP claim.
- UI role labels and onboarding must not imply unsupported staff capabilities.
