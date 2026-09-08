# API Permission Matrix

Last verified: 2026-09-08.

This is the pilot access contract from [ADR 0004](./decisions/0004-owner-operated-pilot.md).
All non-public routes require a valid access token. `Self/session` routes expose
only the caller's active authentication context; every business route requires
an `OWNER` membership in that token's workspace. `TEACHER` is denied every
business read and mutation. Tenant filtering remains mandatory after the role
check: an owner token from another workspace must not reveal or alter records.

The executable companion is
[`apps/api/src/common/roles-metadata.spec.ts`](../apps/api/src/common/roles-metadata.spec.ts).
It enumerates all controller handlers and fails if a route is omitted from this
matrix's public, self/session, or owner-only policy.

## Public

| Method | Path             | Policy                                      |
| ------ | ---------------- | ------------------------------------------- |
| POST   | `/auth/register` | Public registration                         |
| POST   | `/auth/login`    | Public login                                |
| POST   | `/auth/refresh`  | Public refresh-token rotation               |
| POST   | `/auth/logout`   | Public, idempotent refresh-token revocation |
| GET    | `/health`        | Public liveness check                       |

## Authenticated self/session

| Method | Path                  | Policy                                           |
| ------ | --------------------- | ------------------------------------------------ |
| GET    | `/auth/me`            | Caller identity, active workspace, and role only |
| GET    | `/workspaces/current` | Caller active workspace and role only            |

## Owner-only business routes

| Area             | Methods and paths                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace        | `PATCH /workspaces/current/settings`; `GET /workspaces/current/members`                                                                                   |
| Audit            | `GET /audit-logs`                                                                                                                                         |
| Students         | `GET`, `POST /students`; `GET`, `PATCH`, `DELETE /students/:studentId`; `POST /students/:studentId/restore`; `DELETE /students/:studentId/permanently`    |
| Parents          | `GET`, `POST /parents`; `GET`, `PATCH`, `DELETE /parents/:parentId`                                                                                       |
| Teacher profiles | `GET`, `POST /teachers`; `GET`, `PATCH`, `DELETE /teachers/:teacherId`; `POST /teachers/:teacherId/restore`                                               |
| Groups           | `GET`, `POST /groups`; `GET`, `PATCH`, `DELETE /groups/:groupId`; `POST /groups/:groupId/restore`                                                         |
| Enrollments      | `GET`, `POST /enrollments`; `GET`, `PATCH`, `DELETE /enrollments/:enrollmentId`; `POST /enrollments/:enrollmentId/restore`                                |
| Lessons          | `GET`, `POST /lessons`; `PATCH`, `DELETE /lessons/:lessonId`; `PATCH /lessons/:lessonId/reschedule`; `PATCH /lessons/:lessonId/status`                    |
| Lesson series    | `GET`, `POST /lesson-series`; `GET`, `PATCH`, `DELETE /lesson-series/:seriesId`                                                                           |
| Packages         | `GET`, `POST /packages`; `GET /packages/:packageId`; `GET /packages/:packageId/ledger`; `POST /packages/:packageId/adjust`; `DELETE /packages/:packageId` |
| Payments         | `GET`, `POST /payments`                                                                                                                                   |

There are 59 routed handlers: 5 public, 2 self/session, and 52 owner-only.
No invitation, role-management, workspace-switching, teacher self-service, or
own-teacher scope is part of this policy.
