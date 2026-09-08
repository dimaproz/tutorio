# Tutorio Deployment and Operations Runbook

Last verified from repository configuration: 2026-08-24. Actual Railway,
Vercel, Sentry, backup, and restore state has not been externally verified.

## Environment policy

| Environment      | Data                                                 | Purpose                                  |
| ---------------- | ---------------------------------------------------- | ---------------------------------------- |
| Local            | Disposable local PostgreSQL                          | Development and destructive E2E          |
| CI               | Fresh service PostgreSQL per run                     | Full automated verification              |
| Staging          | Synthetic or explicitly approved representative data | Migration rehearsal and pilot acceptance |
| Production/pilot | Real customer data                                   | Controlled owner-operated pilot only     |

Never point migrations with reset behavior, seeds, or E2E teardown at staging or
production. Database URLs are environment secrets and must not appear in logs,
docs, screenshots, or client bundles.

## Required configuration

### API and PostgreSQL

- Railway project deployed from this repository using `railway.json`.
- Managed PostgreSQL with daily backups and documented retention.
- `DATABASE_URL` references the environment’s PostgreSQL service.
- Separate high-entropy `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.
- `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL=30d`, or reviewed equivalents.
- `JWT_ISSUER=tutorio-api`, `JWT_AUDIENCE=tutorio-clients`.
- `WEB_ORIGIN` is an exact allowlist for the deployed web origin.
- `SENTRY_DSN` is environment-specific.
- `NODE_ENV=production` outside local/CI.

The configured pre-deploy command runs `prisma migrate deploy`. The API exposes
Swagger under `/docs` and liveness under `/api/health`. Before pilot, health must
also expose a database readiness signal so a disconnected API is not considered
ready.

### Web

- Vercel project rooted at `apps/web`.
- `API_URL` points to the environment API `/api` base and remains server-only.
- `NEXT_PUBLIC_SENTRY_DSN` is environment-specific.
- The deployed web origin is reflected in API `WEB_ORIGIN` before acceptance.

## Local setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @tutorio/api prisma:migrate
pnpm dev
```

Use a local disposable database for E2E:

```bash
pnpm --filter @tutorio/api test:e2e
```

Before deploying the Exact Credit Compensation migration, run its legacy-data
upgrade proof against a second empty disposable database (never the deployment
database):

```bash
FINANCE_MIGRATION_UPGRADE_DATABASE_URL=postgresql://... pnpm --filter @tutorio/api verify:finance-migration-upgrade
```

Run this finance-history preflight on the deployment database before that
migration. Any returned row is a manual-repair gate: preserve the append-only
ledger, review the source evidence, and do not deploy until every conflict has
an approved mapping. The migration only backfills a NULL lesson package when
exactly one ledger package exists; it never guesses from a newer package.

```sql
WITH lesson_packages AS (
  SELECT l.id AS "lessonId", l."workspaceId", l."packageId" AS "lessonPackageId",
         ARRAY_AGG(DISTINCT e."packageId") FILTER (WHERE e."packageId" IS NOT NULL) AS "ledgerPackageIds",
         COUNT(DISTINCT e."packageId") FILTER (WHERE e."packageId" IS NOT NULL) AS "ledgerPackageCount"
  FROM "lessons" l
  LEFT JOIN "lesson_credit_entries" e ON e."lessonId" = l.id
  GROUP BY l.id, l."workspaceId", l."packageId"
)
SELECT *, CASE
  WHEN "ledgerPackageCount" > 1 THEN 'MULTIPLE_LEDGER_PACKAGES'
  WHEN "lessonPackageId" IS NOT NULL AND "ledgerPackageCount" > 0
       AND NOT ("lessonPackageId" = ANY("ledgerPackageIds")) THEN 'LESSON_LEDGER_MISMATCH'
  WHEN "lessonPackageId" IS NULL AND "ledgerPackageCount" <> 1
       AND EXISTS (SELECT 1 FROM "lessons" l WHERE l.id = "lessonId"
                   AND l.status IN ('COMPLETED', 'CANCELLED_CHARGED')) THEN 'TERMINAL_LESSON_UNRESOLVED'
END AS conflict
FROM lesson_packages
WHERE "ledgerPackageCount" > 1
   OR ("lessonPackageId" IS NOT NULL AND "ledgerPackageCount" > 0
       AND NOT ("lessonPackageId" = ANY("ledgerPackageIds")))
   OR ("lessonPackageId" IS NULL AND "ledgerPackageCount" <> 1
       AND EXISTS (SELECT 1 FROM "lessons" l WHERE l.id = "lessonId"
                   AND l.status IN ('COMPLETED', 'CANCELLED_CHARGED')));
```

Generate the contract after API changes:

```bash
pnpm generate
git diff --exit-code -- openapi.json packages/api-client
```

## Pre-deploy gate

1. Confirm the exact commit and clean `develop`-based release branch.
2. Run root `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
3. Run API E2E against an isolated database.
4. Generate the API contract and confirm expected diff is committed.
5. Review Prisma SQL for locks, destructive statements, backfill cost, and
   compatibility with the currently deployed application.
6. Back up the target database and record restore instructions before a risky
   migration.
7. Verify environment variables without printing their values.
8. Confirm the pilot acceptance matrix has no newly introduced failed row.
9. Run the legacy destructive-group audit before deploying the lifecycle
   migration. Any returned group requires manual repair before restore:

```sql
SELECT g."id", g."workspaceId", g."name", g."deletedAt"
FROM "groups" AS g
WHERE g."deletedAt" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "audit_logs" AS a
    WHERE a."workspaceId" = g."workspaceId"
      AND a."entity" = 'GROUP'
      AND a."entityId" = g."id"
      AND a."action" = 'DELETE'
      AND a."diff" IS NULL
  );
```

Do not clear tombstones or reconstruct `groupId` by guesswork. Preserve the
query output and repair each group from verified backups or a reviewed manual
mapping.

## Deployment order

1. Deploy backward-compatible database/API changes.
2. Verify migration completion, readiness, auth, and one read-only API query.
3. Deploy the web application.
4. Run smoke journeys: login, student list/detail, calendar load, package
   list/detail, and a non-mutating audit/settings read.
5. Perform a controlled mutation only in staging: create/archive a fixture and
   reconcile its audit event.
6. Observe logs, error rate, latency, and database connections before declaring
   the release healthy.

Use expand-and-contract migrations when a change cannot be deployed atomically:
add compatible structure, backfill, switch readers/writers, then remove legacy
structure in a later release.

## Rollback

- Application rollback: redeploy the last known-good API/web artifacts when the
  schema remains backward-compatible.
- Database rollback: do not improvise reverse SQL in production. Use an reviewed
  down migration when safe or restore into a new database and reconcile writes
  made since the backup.
- If financial or lifecycle integrity is uncertain, stop mutations, keep reads
  available when safe, preserve logs/audit evidence, and reconcile before resume.
- Record incident timeline, affected workspaces/entities, containment, recovery,
  and follow-up regression tests.

## Backup and restore proof

Before real pilot data:

1. Confirm automated backup schedule and retention.
2. Restore a backup into an isolated environment.
3. Run migrations and application smoke checks against the restored copy.
4. Reconcile counts and sampled relationships for students, enrollments, lessons,
   packages, credits, shares, payments, and audit events.
5. Record restore duration, data-loss window, operator, and evidence in the pilot
   acceptance report.

A configured backup is not considered verified until a restore succeeds.

## Monitoring and alerting

- API and web errors are captured in separate Sentry projects.
- Alerts cover sustained 5xx errors, authentication failures beyond baseline,
  migration failure, database unavailability, and materialization failures.
- Logs include request/correlation ID, workspace ID when safe, command name, and
  error class; they never include secrets or full sensitive payloads.
- A named operator owns pilot incidents and knows how to disable risky mutations.

## Post-deploy record

Update [`current-state.md`](./current-state.md) with commit, environment, migration,
verification commands, smoke results, known issues, and rollback point. Update
[`quality/pilot-acceptance.md`](./quality/pilot-acceptance.md) only when evidence
exists.
