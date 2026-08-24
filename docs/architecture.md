# Tutorio Architecture Overview

Last verified: 2026-08-24.

## System context

Tutorio is a modular monolith with a web client and one API backed by one
PostgreSQL database. This is the correct scale for the pilot. Do not split into
microservices; strengthen module contracts, transactions, and observability.

```text
Browser
  |
  v
Next.js web application
  |  validated JSON/HTTP
  v
NestJS API
  |---- pure decisions ----> packages/domain
  |---- DTO contracts -----> packages/validation
  |---- persistence -------> Prisma --> PostgreSQL
  |---- API schema --------> OpenAPI --> packages/api-client
```

## Repository boundaries

| Area                  | Owns                                                                           | Must not own                                                   |
| --------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `apps/web`            | Routes, task flows, form state, presentation, localization                     | Authoritative money, credit, status, or authorization rules    |
| `apps/api`            | Authentication, authorization, orchestration, transactions, persistence, audit | Duplicated pure calculations that belong in domain             |
| `packages/domain`     | Deterministic business decisions and calculations                              | I/O, framework code, Prisma, HTTP, current clock without input |
| `packages/validation` | Shared request/response shapes and runtime parsing                             | Database queries or UI rendering state                         |
| `packages/api-client` | Generated OpenAPI types/client surface                                         | Handwritten business rules                                     |
| PostgreSQL/Prisma     | Constraints, relations, indexes, durable state                                 | Product interpretation hidden only in triggers/SQL             |

## Request and command flow

1. Web feature model validates/formats user input.
2. API runtime DTO parses the request; TypeScript-only types are not validation.
3. Guard establishes user, workspace, and role.
4. Service loads all related records within the workspace and validates the
   relationship between them.
5. Pure domain function decides deltas, status, allocation, or conflicts where
   the rule is deterministic.
6. One Prisma transaction writes the aggregate, append-only histories, and root
   audit event.
7. Response maps durable state into a stable read model.

Controllers remain thin. Services orchestrate an aggregate, not arbitrary tables.
The web never infers a financial consequence that the API has not returned.

## Aggregate boundaries

- Access and tenancy: `User`, `Workspace`, `WorkspaceMember`, `AuthSession`.
- People: `Student`, `Parent`, `StudentParent`, `Teacher`.
- Learning operations: `Group`, `Enrollment`, `LessonSeries`, `Lesson`.
- Finance: `LessonPackage`, `LessonCreditEntry`,
  `PackageParticipantShare`, `Payment`.
- Audit: `AuditLog` written alongside every aggregate mutation.

See [`domain/README.md`](./domain/README.md) for entity contracts.

## Consistency model

- Commands affecting one aggregate and its ledger/audit side effects are strongly
  consistent inside one database transaction.
- Derived list/detail metrics must be computed from the same authoritative data
  or refreshed cache. A stored status and displayed derived status cannot diverge
  without an explicit reconciliation rule.
- Recurring materialization is retryable and idempotent. It must tolerate process
  restarts and repeated horizons without duplicate lessons.
- External notifications, when added, are outside the core transaction and use
  an outbox/retry model. The pilot does not need a message broker.

## Time and recurrence

- Series store local scheduling intent plus IANA timezone.
- Lessons store concrete UTC timestamps and the relevant commercial snapshot.
- DST and timezone conversions are pure/testable inputs.
- Edits declare scope and conflict-check the resulting occurrences before commit.
- Materialization respects enrollment/group/teacher/package lifecycle and logs
  failures; a cron that silently skips work is not acceptable.

## Finance architecture

- Credit units and money are different ledgers.
- Packages are immutable commercial snapshots.
- Lessons persist the exact package they consume.
- Credit and payment records are append-only and idempotent.
- Group shares are creation-time allocation snapshots, not live roster formulas.
- Read models expose reconciled lessons remaining, plan total, received, and
  outstanding with one currency.

## Authorization architecture

- Workspace scope is mandatory but not sufficient; commands also need role and,
  after staff access exists, subject/teacher scope.
- The pilot is owner-operated under ADR 0004.
- Public/student access, if built later, is a separate trust boundary with
  minimal endpoints and subject-level scoping; it must not reuse broad tutor APIs.

## Testing strategy

| Layer              | Primary evidence                                                      |
| ------------------ | --------------------------------------------------------------------- |
| Domain             | Table-driven unit tests for decisions and edge cases                  |
| Validation         | Runtime parsing/coercion tests and shared contract examples           |
| API service        | Authorization, workspace relation, transaction, and side-effect tests |
| API E2E            | Four pilot journeys against isolated PostgreSQL and real migrations   |
| Web model          | Defaults, mapping, formatting, and error normalization tests          |
| Web interaction    | Required task paths, loading/error/success/destructive states         |
| Browser acceptance | Desktop/mobile, uk/en, keyboard, and realistic seeded journeys        |

Test totals are not a coverage strategy. Pilot risks determine required cases.

## Deployment shape

The target remains one web deployment, one API deployment, and managed
PostgreSQL. See [`deploy.md`](./deploy.md). Add database readiness, monitoring,
backup restore proof, and privacy runbooks before real data. Do not add queues,
caches, or services until an observed load/reliability need justifies them.

## Architectural debt order

1. Domain/lifecycle contradictions that can corrupt or disconnect history.
2. Runtime authorization and DTO parsing gaps.
3. Missing orchestration tests in scheduling and finance.
4. Oversized web features and missing interaction tests in workflows being
   simplified.
5. Generated API client adoption or removal of the false boundary claim.
6. Operational readiness and service-specific runbooks.

Avoid a broad “clean architecture” rewrite. Reduce debt vertically while fixing
the pilot behavior that exercises it.
