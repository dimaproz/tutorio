import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cpSync, mkdtempSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const NEW_MIGRATION = '20260907120000_recurrence_pause_suspension';
const apiRoot = resolve(__dirname, '..');
const prismaRoot = resolve(apiRoot, 'prisma');
const targetUrl = process.env.RECURRENCE_MIGRATION_UPGRADE_DATABASE_URL;

if (!targetUrl || targetUrl === process.env.DATABASE_URL) {
  throw new Error(
    'RECURRENCE_MIGRATION_UPGRADE_DATABASE_URL must be a separate empty database',
  );
}

function deploy(schemaPath: string) {
  execFileSync(
    process.execPath,
    [
      require.resolve('prisma/build/index.js'),
      'migrate',
      'deploy',
      '--schema',
      schemaPath,
    ],
    {
      cwd: apiRoot,
      env: { ...process.env, DATABASE_URL: targetUrl },
      stdio: 'inherit',
    },
  );
}

async function main() {
  const scratch = mkdtempSync(join(tmpdir(), 'tutorio-recurrence-upgrade-'));
  const scratchPrisma = join(scratch, 'prisma');
  const migrations = join(scratchPrisma, 'migrations');
  const schemaPath = join(scratchPrisma, 'schema.prisma');
  try {
    mkdirSync(migrations, { recursive: true });
    cpSync(join(prismaRoot, 'schema.prisma'), schemaPath);
    for (const migration of readdirSync(join(prismaRoot, 'migrations'))) {
      if (migration === 'migration_lock.toml' || migration === NEW_MIGRATION)
        continue;
      cpSync(
        join(prismaRoot, 'migrations', migration),
        join(migrations, migration),
        {
          recursive: true,
        },
      );
    }
    const preflight = new PrismaClient({
      datasources: { db: { url: targetUrl } },
    });
    const [{ exists }] = await preflight.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '_prisma_migrations') AS "exists"
    `;
    await preflight.$disconnect();
    assert.equal(exists, false, 'upgrade database must be empty');
    deploy(schemaPath);

    const before = new PrismaClient({
      datasources: { db: { url: targetUrl } },
    });
    const now = new Date('2026-09-07T12:00:00.000Z');
    const ids = {
      workspace: randomUUID(),
      user: randomUUID(),
      teacher: randomUUID(),
      student: randomUUID(),
      group: randomUUID(),
      enrollment: randomUUID(),
      series: randomUUID(),
      lesson: randomUUID(),
    };
    await before.$executeRaw`
      INSERT INTO "users" (id, email, "passwordHash", name, "createdAt", "updatedAt")
      VALUES (${ids.user}, 'recurrence-upgrade@example.com', 'fixture', 'Upgrade owner', ${now}, ${now})`;
    await before.$executeRaw`
      INSERT INTO "workspaces" (id, name, plan, mode, "defaultCurrency", "cancellationDeadlineHours", "primaryColor", "secondaryColor", timezone, "createdAt", "updatedAt")
      VALUES (${ids.workspace}, 'Recurrence upgrade', 'FREE', 'SOLO', 'EUR', 24, '#465FFF', '#49BEFF', 'UTC', ${now}, ${now})`;
    await before.$executeRaw`
      INSERT INTO "teachers" (id, "workspaceId", "fullName", subjects, status, "createdAt", "updatedAt")
      VALUES (${ids.teacher}, ${ids.workspace}, 'Upgrade teacher', ARRAY[]::text[], 'ACTIVE', ${now}, ${now})`;
    await before.$executeRaw`
      INSERT INTO "students" (id, "workspaceId", "fullName", timezone, status, "createdAt", "updatedAt")
      VALUES (${ids.student}, ${ids.workspace}, 'Upgrade student', 'UTC', 'ACTIVE', ${now}, ${now})`;
    await before.$executeRaw`
      INSERT INTO "groups" (id, "workspaceId", name, "createdAt", "updatedAt")
      VALUES (${ids.group}, ${ids.workspace}, 'Upgrade group', ${now}, ${now})`;
    await before.$executeRaw`
      INSERT INTO "enrollments" (id, "workspaceId", "studentId", "groupId", "teacherId", status, "billingType", "priceMinor", currency, "createdAt", "updatedAt")
      VALUES (${ids.enrollment}, ${ids.workspace}, ${ids.student}, ${ids.group}, ${ids.teacher}, 'ACTIVE', 'PACKAGE', 1000, 'EUR', ${now}, ${now})`;
    await before.$executeRaw`
      INSERT INTO "lesson_series" (id, "workspaceId", "groupId", "teacherId", weekdays, "localTime", timezone, "durationMin", "priceMinor", currency, "startDate", "horizonMaterializedUntil", "createdAt", "updatedAt")
      VALUES (${ids.series}, ${ids.workspace}, ${ids.group}, ${ids.teacher}, ARRAY[1], '10:00', 'UTC', 60, 1000, 'EUR', ${now}, ${now}, ${now}, ${now})`;
    await before.$executeRaw`
      INSERT INTO "lessons" (id, "workspaceId", "groupId", "seriesId", "teacherId", "startsAtUtc", "durationMin", "priceMinor", currency, status, "isDetached", "rescheduledCount", "createdAt", "updatedAt")
      VALUES (${ids.lesson}, ${ids.workspace}, ${ids.group}, ${ids.series}, ${ids.teacher}, ${new Date('2026-09-14T10:00:00.000Z')}, 60, 1000, 'EUR', 'SCHEDULED', false, 0, ${now}, ${now})`;
    await before.$disconnect();

    cpSync(
      join(prismaRoot, 'migrations', NEW_MIGRATION),
      join(migrations, NEW_MIGRATION),
      { recursive: true },
    );
    deploy(schemaPath);
    const after = new PrismaClient({ datasources: { db: { url: targetUrl } } });
    const rows = await after.$queryRaw<
      {
        rosterSuspensionToken: string | null;
        enrollmentToken: string | null;
        seriesToken: string | null;
        lessonToken: string | null;
      }[]
    >`
      SELECT g."rosterSuspensionToken", e."scheduleSuspensionToken" AS "enrollmentToken",
        s."scheduleSuspensionToken" AS "seriesToken", l."scheduleSuspensionToken" AS "lessonToken"
      FROM "groups" g JOIN "enrollments" e ON e."groupId" = g.id
      JOIN "lesson_series" s ON s."groupId" = g.id
      JOIN "lessons" l ON l."seriesId" = s.id WHERE g.id = ${ids.group}`;
    assert.deepEqual(rows, [
      {
        rosterSuspensionToken: null,
        enrollmentToken: null,
        seriesToken: null,
        lessonToken: null,
      },
    ]);
    await after.$disconnect();
    console.log('Recurrence migration upgrade verification passed.');
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

void main();
