# Domain Model Guide

Last verified: 2026-09-23 against `apps/api/prisma/schema.prisma` and API
services.

This guide documents every persisted entity. Aggregate documents separate the
implemented behavior from the accepted target contract. They are required
reading before changing an entity’s schema, service, API, or UI lifecycle.

## Relationship overview

```text
User -- WorkspaceMember --> Workspace
              |                 |
              v                 +--> Student <--> Parent
           Teacher              |       |
                                |       v
                                +--> Enrollment <-- Group --> Teacher
                                         |
                                         +--> Schedule --> LessonSeries --> Lesson
                                         |                       |
                                         +------------------> LessonAttendance
                                         |
                                         +--> LessonPackage --> LessonCreditEntry
                                                      |  \
                                                      |   --> Payment
                                                      +------> PackageParticipantShare

Every business write -------------------------------> AuditLog
```

The `Workspace` is the tenant boundary. `Enrollment` is the operational link
between a student and individual/group teaching. `LessonPackage` is a purchase
snapshot. Lesson credits and money are separate histories.

## Entity registry

| Entity                    | Aggregate                                                        | Lifecycle summary                                                 |
| ------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| `User`                    | [Access and tenancy](./access-and-tenancy.md#user)               | Global login identity; soft-delete flag; no account lifecycle API |
| `Workspace`               | [Access and tenancy](./access-and-tenancy.md#workspace)          | Tenant root; no export/delete workflow yet                        |
| `WorkspaceMember`         | [Access and tenancy](./access-and-tenancy.md#workspacemember)    | User-to-workspace role; read-only after registration              |
| `AuthSession`             | [Access and tenancy](./access-and-tenancy.md#authsession)        | Rotating refresh-token session; revoke supported                  |
| `Student`                 | [People](./people.md#student)                                    | Business status plus unsafe hard-delete endpoint                  |
| `Parent`                  | [People](./people.md#parent)                                     | Reusable contact; current hard delete                             |
| `StudentParent`           | [People](./people.md#studentparent)                              | Join record managed through student/parent aggregates             |
| `Teacher`                 | [People](./people.md#teacher)                                    | Profile status plus soft delete/restore                           |
| `Group`                   | [Learning operations](./learning-operations.md#group)            | Optional teacher and seats; archive/restore preserves history     |
| `Enrollment`              | [Learning operations](./learning-operations.md#enrollment)       | Active/paused/archived plus soft delete/restore                   |
| `Schedule`                | [Learning operations](./learning-operations.md#schedule)         | One active per direction; active until stopped or its end date    |
| `LessonSeries`            | [Learning operations](./learning-operations.md#lessonseries)     | One start time of one schedule version; ended by a later version  |
| `Lesson`                  | [Learning operations](./learning-operations.md#lesson)           | Scheduled occurrence; status machine plus soft delete             |
| `LessonAttendance`        | [Learning operations](./learning-operations.md#lessonattendance) | Per-student mark per held lesson                                  |
| `LessonPackage`           | [Finance](./finance.md#lessonpackage)                            | Purchase snapshot; soft delete; no restore/edit                   |
| `LessonCreditEntry`       | [Finance](./finance.md#lessoncreditentry)                        | Append-only lesson-unit ledger                                    |
| `PackageParticipantShare` | [Finance](./finance.md#packageparticipantshare)                  | Group package debt snapshot                                       |
| `Payment`                 | [Finance](./finance.md#payment)                                  | Append-only money event; create/list only                         |
| `AuditLog`                | [Audit](./audit.md#auditlog)                                     | Append-only mutation evidence                                     |

## Universal implementation checklist

Before changing any entity:

1. State tenant ownership and validate every related ID in the same workspace.
2. State the aggregate root and which service may mutate the record.
3. Define create, update, archive, restore, and hard-delete behavior.
4. List side effects on scheduling, credit, money, and audit history.
5. Put business writes and audit evidence in one transaction.
6. Add cross-workspace, authorization, idempotency, conflict, and lifecycle tests.
7. Update this guide, the relevant ADR, and the pilot acceptance matrix.
