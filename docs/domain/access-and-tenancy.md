# Access and Tenancy Aggregate

Last verified: 2026-09-08.

The enforced pilot access policy is defined by
[ADR 0004](../decisions/0004-owner-operated-pilot.md) and enumerated in the
[API permission matrix](../api-permission-matrix.md).

## User

| Concern        | Contract                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Purpose        | Global login identity identified by unique email.                                                        |
| Ownership      | Global, not workspace-scoped. Access to business data comes only through `WorkspaceMember`.              |
| Relationships  | Memberships, auth sessions, and actor references in audit, credit, and payment records.                  |
| Create/update  | Registration atomically creates the user, workspace, and owner membership. No profile update API exists. |
| Delete/restore | `deletedAt` prevents login and refresh. No account delete, restore, or export endpoint exists.           |
| Invariants     | Normalized unique email; password hash never leaves the auth module; deleted users cannot authenticate.  |
| Known gaps     | No revoke-all/session cleanup, account lifecycle, multi-workspace selection, or privacy workflow.        |

Acceptance: deleting/disabling a user revokes active access without deleting
workspace financial history; privacy handling follows ADR 0002.

## Workspace

| Concern        | Contract                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Purpose        | Tenant root for every business entity and default operating settings.                                                                |
| Ownership      | Owned through an `OWNER` membership; a user may eventually belong to multiple workspaces.                                            |
| Relationships  | Members and all people, scheduling, finance, and audit records.                                                                      |
| Create/update  | Created at registration. Settings update is owner-only and audited; only active-workspace context is readable by a non-owner member. |
| Delete/restore | No implemented workspace export/deletion or restore workflow.                                                                        |
| Invariants     | Every business query is scoped by `workspaceId`; `SOLO` cannot have more than one active teacher profile.                            |
| Known gaps     | `plan` limits are not enforced; timezone is not consistently exposed; readiness/export/deletion are missing.                         |

Acceptance: a cross-workspace identifier always returns a safe not-found or
forbidden result, never another tenant’s record.

## WorkspaceMember

| Concern           | Contract                                                                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose           | Authorization link between `User` and `Workspace` with `OWNER` or `TEACHER` role.                                                                           |
| Ownership         | Workspace-scoped; unique `(workspaceId, userId)`.                                                                                                           |
| Relationships     | Optional one-to-one `Teacher` profile.                                                                                                                      |
| Create/update     | Only the owner membership is created during registration. Roster is currently read-only.                                                                    |
| Delete/restore    | No invitation, role-change, removal, or restore workflow exists.                                                                                            |
| Pilot permissions | Owner-only operation. A legacy `TEACHER` can use only `GET /auth/me` and `GET /workspaces/current`; all business data and mutations return `403 FORBIDDEN`. |
| Known gaps        | Login selects the oldest membership; no invitation, multi-workspace selection, or own-teacher scope exists.                                                 |

Acceptance before staff login: replace the owner-only policy with a complete
staff permission design, including every endpoint's role/read-scope tests and
negative cross-teacher cases.

## AuthSession

| Concern        | Contract                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------- |
| Purpose        | One refresh-token session with rotation, expiry, and revocation state.                          |
| Ownership      | Belongs to one user; indirectly constrained by the active membership encoded in access context. |
| Create/update  | Created on login; refresh atomically rotates the stored token HMAC.                             |
| Delete/restore | Logout idempotently revokes. Sessions are retained as security history; no restore.             |
| Invariants     | Refresh replay revokes the session; raw refresh tokens are not stored.                          |
| Known gaps     | No session list, device label, revoke-all action, or expired-row cleanup policy.                |

Acceptance: concurrent refresh and replay tests prove one valid successor token
and no reusable previous token.
