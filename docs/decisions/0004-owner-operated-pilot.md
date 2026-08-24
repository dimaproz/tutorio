# ADR 0004: Owner-Operated Pilot

- Status: Accepted target; enforcement pending
- Date: 2026-08-24

## Context

The schema supports `OWNER` and `TEACHER` workspace memberships, but most
business endpoints allow any workspace member to mutate workspace-wide records.
There is no complete invitation, workspace switching, own-teacher scoping, or
permission matrix. Presenting staff login as supported would create an
authorization and privacy risk.

## Decision

- The first pilot is operated through an `OWNER` membership.
- `Teacher` is a teaching-profile and assignment entity; it does not imply that
  the person can sign in.
- Business mutations, finance, audit, settings, export, and destructive actions
  are owner-only for the pilot.
- Existing non-owner accounts are not used with real pilot data until endpoints
  are explicitly denied or a complete staff-access design is implemented.

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

- Owner-only enforcement is a pilot blocker, not a post-launch enhancement.
- School-mode collaboration remains a product direction but is not an MVP claim.
- UI role labels and onboarding must not imply unsupported staff capabilities.
