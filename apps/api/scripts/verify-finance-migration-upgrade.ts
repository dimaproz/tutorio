import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cpSync, mkdtempSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { LessonsService } from '../src/scheduling/lessons.service';

const NEW_MIGRATION = '20260826120000_exact_credit_compensation';
const apiRoot = resolve(__dirname, '..');
const prismaRoot = resolve(apiRoot, 'prisma');
const targetUrl = process.env.FINANCE_MIGRATION_UPGRADE_DATABASE_URL;

if (!targetUrl || targetUrl === process.env.DATABASE_URL) {
  throw new Error(
    'FINANCE_MIGRATION_UPGRADE_DATABASE_URL must point to an isolated database',
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
  const scratch = mkdtempSync(join(tmpdir(), 'tutorio-finance-upgrade-'));
  const scratchPrisma = join(scratch, 'prisma');
  const scratchMigrations = join(scratchPrisma, 'migrations');
  const schemaPath = join(scratchPrisma, 'schema.prisma');
  try {
    mkdirSync(scratchMigrations, { recursive: true });
    cpSync(join(prismaRoot, 'schema.prisma'), schemaPath);
    for (const migration of readdirSync(join(prismaRoot, 'migrations'))) {
      if (migration !== 'migration_lock.toml' && migration !== NEW_MIGRATION) {
        cpSync(
          join(prismaRoot, 'migrations', migration),
          join(scratchMigrations, migration),
          {
            recursive: true,
          },
        );
      }
    }
    const preflight = new PrismaClient({
      datasources: { db: { url: targetUrl } },
    });
    const [{ exists }] = await preflight.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
      ) AS "exists"
    `;
    await preflight.$disconnect();
    assert.equal(exists, false, 'finance upgrade database must be empty');
    deploy(schemaPath);

    const prisma = new PrismaClient({
      datasources: { db: { url: targetUrl } },
    });

    const workspaceId = randomUUID();
    const userId = randomUUID();
    const teacherId = randomUUID();
    const studentId = randomUUID();
    const enrollmentId = randomUUID();
    const packageA = randomUUID();
    const packageB = randomUUID();
    const packagePeriod = randomUUID();
    const lessonSingle = randomUUID();
    const lessonConflict = randomUUID();
    const lessonChargedCancel = randomUUID();
    const lessonMismatch = randomUUID();
    const lessonZero = randomUUID();
    const lessonMissingSource = randomUUID();
    const lessonUnresolved = randomUUID();
    const lessonPeriod = randomUUID();
    const lessonPeriodWrongType = randomUUID();
    const lessonPeriodBalanced = randomUUID();
    const lessonPeriodDebitBlocked = randomUUID();
    const now = new Date('2026-08-26T12:00:00.000Z');
    await prisma.$executeRaw`
      INSERT INTO "users" (id, email, "passwordHash", name, "createdAt", "updatedAt")
      VALUES (${userId}, 'finance-upgrade-owner@example.com', 'fixture', 'Finance upgrade owner', ${now}, ${now})
    `;
    await prisma.$executeRaw`
      INSERT INTO "workspaces" (id, name, plan, mode, "defaultCurrency", "cancellationDeadlineHours", "primaryColor", "secondaryColor", timezone, "createdAt", "updatedAt")
      VALUES (${workspaceId}, 'Finance migration upgrade', 'FREE', 'SOLO', 'EUR', 24, '#5D87FF', '#49BEFF', 'UTC', ${now}, ${now})
    `;
    await prisma.$executeRaw`
      INSERT INTO "teachers" (id, "workspaceId", "fullName", subjects, status, "createdAt", "updatedAt")
      VALUES (${teacherId}, ${workspaceId}, 'Migration teacher', ARRAY[]::text[], 'ACTIVE', ${now}, ${now})
    `;
    await prisma.$executeRaw`
      INSERT INTO "students" (id, "workspaceId", "fullName", timezone, status, "createdAt", "updatedAt")
      VALUES (${studentId}, ${workspaceId}, 'Migration student', 'UTC', 'ACTIVE', ${now}, ${now})
    `;
    await prisma.$executeRaw`
      INSERT INTO "enrollments" (id, "workspaceId", "studentId", "teacherId", status, "billingType", "priceMinor", currency, "createdAt", "updatedAt")
      VALUES (${enrollmentId}, ${workspaceId}, ${studentId}, ${teacherId}, 'ACTIVE', 'PACKAGE', 5000, 'EUR', ${now}, ${now})
    `;
    for (const packageId of [packageA, packageB]) {
      await prisma.$executeRaw`
        INSERT INTO "lesson_packages" (id, "workspaceId", "studentId", "sizingMode", "lessonsTotal", "pricePerLessonMinorSnapshot", "totalPriceMinorSnapshot", currency, "paymentStatus", "purchasedAt", "createdAt", "updatedAt")
        VALUES (${packageId}, ${workspaceId}, ${studentId}, 'FIXED_COUNT', 2, 5000, 10000, 'EUR', 'PENDING', ${now}, ${now}, ${now})
      `;
    }
    await prisma.$executeRaw`
      INSERT INTO "lesson_packages" (id, "workspaceId", "studentId", "sizingMode", "lessonsTotal", "endDate", "pricePerLessonMinorSnapshot", "totalPriceMinorSnapshot", currency, "paymentStatus", "purchasedAt", "expiresAt", "createdAt", "updatedAt")
      VALUES (${packagePeriod}, ${workspaceId}, ${studentId}, 'BY_PERIOD', 4, ${new Date('2026-09-30T23:59:59.999Z')}, 5000, 20000, 'EUR', 'PENDING', ${now}, ${new Date('2026-10-01T00:00:00.000Z')}, ${now}, ${now})
    `;
    const lessons = [
      [lessonSingle, 'COMPLETED'],
      [lessonConflict, 'COMPLETED'],
      [lessonChargedCancel, 'CANCELLED_CHARGED'],
      [lessonMismatch, 'COMPLETED'],
      [lessonZero, 'CANCELLED_UNCHARGED'],
      [lessonMissingSource, 'COMPLETED'],
      [lessonUnresolved, 'COMPLETED'],
      [lessonPeriod, 'COMPLETED'],
      [lessonPeriodWrongType, 'COMPLETED'],
      [lessonPeriodBalanced, 'COMPLETED'],
      [lessonPeriodDebitBlocked, 'SCHEDULED'],
    ] as const;
    for (const [lessonId, status] of lessons) {
      const pinnedPackageId =
        lessonId === lessonMismatch
          ? packageB
          : lessonId === lessonMissingSource ||
              lessonId === lessonPeriodWrongType ||
              lessonId === lessonPeriodBalanced ||
              lessonId === lessonPeriodDebitBlocked
            ? packagePeriod
            : null;
      await prisma.$executeRaw`
        INSERT INTO "lessons" (id, "workspaceId", "enrollmentId", "teacherId", "startsAtUtc", "durationMin", "priceMinor", currency, status, "packageId", "isDetached", "rescheduledCount", "createdAt", "updatedAt")
        VALUES (${lessonId}, ${workspaceId}, ${enrollmentId}, ${teacherId}, ${now}, 60, 5000, 'EUR', ${status}::"lesson_status", ${pinnedPackageId}, false, 0, ${now}, ${now})
      `;
    }
    const entries = [
      [packageA, lessonSingle, -1, 'lesson_completed', 'single'],
      [packageA, lessonConflict, -1, 'lesson_completed', 'conflict-a'],
      [packageB, lessonConflict, 1, 'lesson_completed', 'conflict-b'],
      [
        packageA,
        lessonChargedCancel,
        -1,
        'late_cancellation',
        'charged-cancel',
      ],
      [packageA, lessonMismatch, -1, 'lesson_completed', 'mismatch'],
      [packageA, lessonZero, 0, 'teacher_cancellation_refund', 'legacy-zero'],
      [packagePeriod, lessonPeriod, -1, 'lesson_completed', 'period-exact'],
      [
        packagePeriod,
        lessonPeriodWrongType,
        -1,
        'late_cancellation',
        'period-wrong-type',
      ],
      [
        packagePeriod,
        lessonPeriodBalanced,
        -1,
        'lesson_completed',
        'period-balanced-debit',
      ],
      [
        packagePeriod,
        lessonPeriodBalanced,
        1,
        'lesson_completed',
        'period-balanced-credit',
      ],
    ] as const;
    for (const [packageId, lessonId, delta, type, suffix] of entries) {
      await prisma.$executeRaw`
        INSERT INTO "lesson_credit_entries" (id, "workspaceId", "packageId", "lessonId", delta, type, "idempotencyKey", "createdAt")
        VALUES (${randomUUID()}, ${workspaceId}, ${packageId}, ${lessonId}, ${delta}, ${type}::"credit_entry_type", ${`migration:${suffix}`}, ${now})
      `;
    }
    await prisma.$disconnect();

    cpSync(
      join(prismaRoot, 'migrations', NEW_MIGRATION),
      join(scratchMigrations, NEW_MIGRATION),
      {
        recursive: true,
      },
    );
    deploy(schemaPath);

    process.env.DATABASE_URL = targetUrl;
    const verify = new PrismaClient({
      datasources: { db: { url: targetUrl } },
    });
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleFixture.createNestApplication();
    await app.init();
    const lessonsService = app.get(LessonsService);
    const auth = {
      userId,
      sessionId: 'finance-upgrade',
      workspaceId,
      role: 'OWNER' as const,
    };
    const migratedLessons = await verify.$queryRaw<
      { id: string; packageId: string | null; statusVersion: number }[]
    >`SELECT id, "packageId", "statusVersion" FROM "lessons" WHERE id IN (${lessonSingle}, ${lessonConflict}, ${lessonChargedCancel}, ${lessonMismatch}, ${lessonZero}, ${lessonMissingSource}, ${lessonUnresolved}, ${lessonPeriod}, ${lessonPeriodWrongType}, ${lessonPeriodBalanced}, ${lessonPeriodDebitBlocked})`;
    const byId = new Map(migratedLessons.map((lesson) => [lesson.id, lesson]));
    assert.equal(byId.get(lessonSingle)?.packageId, packageA);
    assert.equal(byId.get(lessonConflict)?.packageId, null);
    assert.equal(byId.get(lessonChargedCancel)?.packageId, packageA);
    assert.equal(byId.get(lessonMismatch)?.packageId, packageB);
    assert.equal(byId.get(lessonZero)?.packageId, packageA);
    assert.equal(byId.get(lessonMissingSource)?.packageId, packagePeriod);
    assert.equal(byId.get(lessonUnresolved)?.packageId, null);
    assert.equal(byId.get(lessonPeriod)?.packageId, packagePeriod);
    assert.equal(byId.get(lessonPeriodWrongType)?.packageId, packagePeriod);
    assert.equal(byId.get(lessonPeriodBalanced)?.packageId, packagePeriod);
    for (const lesson of migratedLessons) {
      assert.equal(lesson.statusVersion, 0);
    }

    const conflicts = await verify.$queryRaw<{ lessonId: string }[]>`
      SELECT l.id AS "lessonId"
      FROM "lessons" l
      LEFT JOIN "lesson_credit_entries" e ON e."lessonId" = l.id
      GROUP BY l.id, l."packageId", l.status
      HAVING COUNT(DISTINCT e."packageId") > 1
        OR (l."packageId" IS NOT NULL AND COUNT(DISTINCT e."packageId") > 0
            AND NOT (l."packageId" = ANY(ARRAY_AGG(DISTINCT e."packageId"))))
        OR (l.status IN ('COMPLETED', 'CANCELLED_CHARGED')
            AND l."packageId" IS NULL AND COUNT(DISTINCT e."packageId") <> 1)
    `;
    assert.deepEqual(
      new Set(conflicts.map((row) => row.lessonId)),
      new Set([lessonConflict, lessonMismatch, lessonUnresolved]),
    );

    const assertRejectedWithoutMutation = async (
      lessonId: string,
      targetStatus: 'SCHEDULED' | 'COMPLETED',
      code: string,
    ) => {
      const before = await verify.lesson.findUniqueOrThrow({
        where: { id: lessonId },
      });
      const beforeEntries = await verify.lessonCreditEntry.count({
        where: { lessonId },
      });
      const beforeAudits = await verify.auditLog.count({
        where: { entityId: lessonId },
      });
      await assert.rejects(
        () => lessonsService.transition(auth, lessonId, { targetStatus }),
        { code },
      );
      const after = await verify.lesson.findUniqueOrThrow({
        where: { id: lessonId },
      });
      assert.equal(after.status, before.status);
      assert.equal(after.statusVersion, before.statusVersion);
      assert.equal(after.packageId, before.packageId);
      assert.equal(
        await verify.lessonCreditEntry.count({ where: { lessonId } }),
        beforeEntries,
      );
      assert.equal(
        await verify.auditLog.count({ where: { entityId: lessonId } }),
        beforeAudits,
      );
    };

    await lessonsService.transition(auth, lessonSingle, {
      targetStatus: 'SCHEDULED',
    });
    await lessonsService.transition(auth, lessonChargedCancel, {
      targetStatus: 'SCHEDULED',
    });
    await lessonsService.transition(auth, lessonZero, {
      targetStatus: 'SCHEDULED',
    });
    await lessonsService.transition(auth, lessonPeriod, {
      targetStatus: 'SCHEDULED',
    });
    await lessonsService.transition(auth, lessonPeriod, {
      targetStatus: 'SCHEDULED',
    });
    await assertRejectedWithoutMutation(
      lessonMismatch,
      'SCHEDULED',
      'LESSON_COMPENSATION_SOURCE_MISSING',
    );
    await assertRejectedWithoutMutation(
      lessonConflict,
      'SCHEDULED',
      'NO_ACTIVE_PACKAGE',
    );
    await assertRejectedWithoutMutation(
      lessonMissingSource,
      'SCHEDULED',
      'LESSON_COMPENSATION_SOURCE_MISSING',
    );
    await assertRejectedWithoutMutation(
      lessonUnresolved,
      'SCHEDULED',
      'NO_ACTIVE_PACKAGE',
    );
    await assertRejectedWithoutMutation(
      lessonPeriodWrongType,
      'SCHEDULED',
      'LESSON_COMPENSATION_SOURCE_MISSING',
    );
    await assertRejectedWithoutMutation(
      lessonPeriodBalanced,
      'SCHEDULED',
      'LESSON_COMPENSATION_SOURCE_MISSING',
    );
    await assertRejectedWithoutMutation(
      lessonPeriodDebitBlocked,
      'COMPLETED',
      'PACKAGE_NOT_ELIGIBLE_FOR_CREDIT',
    );
    const compensation = await verify.lessonCreditEntry.findMany({
      where: {
        lessonId: {
          in: [lessonSingle, lessonChargedCancel, lessonZero, lessonPeriod],
        },
      },
      orderBy: [{ lessonId: 'asc' }, { delta: 'asc' }, { id: 'asc' }],
      select: { lessonId: true, packageId: true, delta: true },
    });
    assert.deepEqual(
      compensation.filter((entry) => entry.lessonId === lessonSingle),
      [
        { lessonId: lessonSingle, packageId: packageA, delta: -1 },
        { lessonId: lessonSingle, packageId: packageA, delta: 1 },
      ],
    );
    assert.deepEqual(
      compensation.filter((entry) => entry.lessonId === lessonChargedCancel),
      [
        { lessonId: lessonChargedCancel, packageId: packageA, delta: -1 },
        { lessonId: lessonChargedCancel, packageId: packageA, delta: 1 },
      ],
    );
    assert.equal(
      compensation.filter((entry) => entry.lessonId === lessonZero).length,
      1,
    );
    assert.deepEqual(
      compensation.filter((entry) => entry.lessonId === lessonPeriod),
      [
        { lessonId: lessonPeriod, packageId: packagePeriod, delta: -1 },
        { lessonId: lessonPeriod, packageId: packagePeriod, delta: 1 },
      ],
    );
    const zeroRows = await verify.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "lesson_credit_entries"
      WHERE "lessonId" = ${lessonZero} AND delta = 0
    `;
    assert.equal(zeroRows[0]?.count, 1n);
    const restored = await verify.lesson.findUniqueOrThrow({
      where: { id: lessonSingle },
    });
    assert.equal(restored.status, 'SCHEDULED');
    assert.equal(restored.statusVersion, 1);
    assert.equal(restored.packageId, packageA);
    const restoreAudit = await verify.auditLog.findFirstOrThrow({
      where: { entityId: lessonSingle, action: 'UPDATE' },
    });
    assert.equal(restoreAudit.actorId, userId);
    assert.deepEqual(restoreAudit.diff, {
      fields: {
        status: { before: 'COMPLETED', after: 'SCHEDULED' },
      },
    });
    const restoredPeriod = await verify.lesson.findUniqueOrThrow({
      where: { id: lessonPeriod },
    });
    assert.equal(restoredPeriod.status, 'SCHEDULED');
    assert.equal(restoredPeriod.statusVersion, 1);
    assert.equal(restoredPeriod.packageId, packagePeriod);
    assert.equal(
      await verify.auditLog.count({ where: { entityId: lessonPeriod } }),
      1,
    );
    await app.close();
    await verify.$disconnect();
    console.log('Finance migration upgrade verification passed.');
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

void main();
