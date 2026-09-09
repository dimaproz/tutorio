import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { AuditService } from '../src/audit/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { StudentsService } from '../src/students/students.service';

const NEW_MIGRATION = '20260825120000_lifecycle_closure_and_legacy_repair';
const apiRoot = resolve(__dirname, '..');
const prismaRoot = resolve(apiRoot, 'prisma');
const targetUrl = process.env.MIGRATION_UPGRADE_DATABASE_URL;

if (!targetUrl) {
  throw new Error(
    'MIGRATION_UPGRADE_DATABASE_URL must point to an isolated PostgreSQL database',
  );
}
if (targetUrl === process.env.DATABASE_URL) {
  throw new Error('MIGRATION_UPGRADE_DATABASE_URL must not reuse DATABASE_URL');
}

function prismaCommand(schemaPath: string) {
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
  const scratchRoot = mkdtempSync(join(tmpdir(), 'tutorio-lifecycle-upgrade-'));
  const scratchPrisma = join(scratchRoot, 'prisma');
  const scratchMigrations = join(scratchPrisma, 'migrations');
  const schemaPath = join(scratchPrisma, 'schema.prisma');

  try {
    mkdirSync(scratchMigrations, { recursive: true });
    cpSync(join(prismaRoot, 'schema.prisma'), schemaPath);
    for (const migration of readdirSync(join(prismaRoot, 'migrations'))) {
      if (migration === 'migration_lock.toml' || migration === NEW_MIGRATION) {
        continue;
      }
      cpSync(
        join(prismaRoot, 'migrations', migration),
        join(scratchMigrations, migration),
        { recursive: true },
      );
    }

    // The target database is supplied exclusively for this verification. It
    // must be empty; a preflight query makes an accidental reuse explicit.
    const preflight = new PrismaClient({
      datasources: { db: { url: targetUrl } },
    });
    await preflight.$connect();
    const existingTables = await preflight.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
      ) AS "exists"
    `;
    await preflight.$disconnect();
    assert.equal(
      existingTables[0]?.exists,
      false,
      'upgrade verification database must be empty',
    );

    prismaCommand(schemaPath);

    const preMigration = new PrismaClient({
      datasources: { db: { url: targetUrl } },
    });
    const suffix = randomUUID();
    const archivedAt = new Date('2026-08-20T10:00:00.000Z');
    const deletedAt = new Date('2026-08-21T10:00:00.000Z');
    const futureAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const user = await preMigration.user.create({
      data: {
        email: `migration-upgrade-${suffix}@example.com`,
        name: 'Upgrade Owner',
        passwordHash: 'not-used',
      },
      select: { id: true },
    });
    const workspace = await preMigration.workspace.create({
      data: { name: 'Migration Upgrade Workspace', mode: 'SCHOOL' },
      select: { id: true },
    });
    const membership = await preMigration.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: user.id, role: 'OWNER' },
      select: { id: true },
    });
    const teacher = await preMigration.teacher.create({
      data: {
        workspaceId: workspace.id,
        workspaceMemberId: membership.id,
        fullName: 'Upgrade Teacher',
        subjects: [],
      },
      select: { id: true },
    });
    const group = await preMigration.group.create({
      data: { workspaceId: workspace.id, name: 'Upgrade Group' },
      select: { id: true },
    });
    const archivedStudent = await preMigration.student.create({
      data: {
        workspaceId: workspace.id,
        fullName: 'Legacy Archived',
        timezone: 'UTC',
        status: 'ARCHIVED',
        updatedAt: archivedAt,
      },
      select: { id: true },
    });
    const deletedStudent = await preMigration.student.create({
      data: {
        workspaceId: workspace.id,
        fullName: 'Legacy Deleted',
        timezone: 'UTC',
        status: 'ACTIVE',
        updatedAt: deletedAt,
        deletedAt,
      },
      select: { id: true },
    });
    const individualEnrollment = await preMigration.enrollment.create({
      data: {
        workspaceId: workspace.id,
        studentId: archivedStudent.id,
        teacherId: teacher.id,
        billingType: 'PACKAGE',
        priceMinor: 0,
        currency: 'EUR',
      },
      select: { id: true },
    });
    const groupEnrollment = await preMigration.enrollment.create({
      data: {
        workspaceId: workspace.id,
        studentId: archivedStudent.id,
        groupId: group.id,
        teacherId: teacher.id,
        billingType: 'PACKAGE',
        priceMinor: 0,
        currency: 'EUR',
      },
      select: { id: true },
    });
    await preMigration.enrollment.create({
      data: {
        workspaceId: workspace.id,
        studentId: deletedStudent.id,
        groupId: group.id,
        teacherId: teacher.id,
        billingType: 'PACKAGE',
        priceMinor: 0,
        currency: 'EUR',
      },
      select: { id: true },
    });
    const series = await preMigration.lessonSeries.create({
      data: {
        workspaceId: workspace.id,
        enrollmentId: individualEnrollment.id,
        teacherId: teacher.id,
        weekdays: [1],
        localTime: '10:00',
        timezone: 'UTC',
        durationMin: 60,
        priceMinor: 0,
        currency: 'EUR',
        startDate: archivedAt,
        horizonMaterializedUntil: futureAt,
      },
      select: { id: true },
    });
    const lesson = await preMigration.lesson.create({
      data: {
        workspaceId: workspace.id,
        enrollmentId: individualEnrollment.id,
        seriesId: series.id,
        teacherId: teacher.id,
        startsAtUtc: futureAt,
        durationMin: 60,
        priceMinor: 0,
        currency: 'EUR',
      },
      select: { id: true },
    });
    await preMigration.$disconnect();

    cpSync(
      join(prismaRoot, 'migrations', NEW_MIGRATION),
      join(scratchMigrations, NEW_MIGRATION),
      { recursive: true },
    );
    prismaCommand(schemaPath);

    process.env.DATABASE_URL = targetUrl;
    const prisma = new PrismaService();
    const migratedArchived = await prisma.student.findUniqueOrThrow({
      where: { id: archivedStudent.id },
      select: { status: true, archivedAt: true, deletedAt: true },
    });
    assert.deepEqual(migratedArchived, {
      status: 'ARCHIVED',
      archivedAt,
      deletedAt: null,
    });
    const migratedDeleted = await prisma.student.findUniqueOrThrow({
      where: { id: deletedStudent.id },
      select: { status: true, archivedAt: true, deletedAt: true },
    });
    assert.deepEqual(migratedDeleted, {
      status: 'ARCHIVED',
      archivedAt: deletedAt,
      deletedAt: null,
    });
    const migratedEnrollment = await prisma.enrollment.findUniqueOrThrow({
      where: { id: groupEnrollment.id },
      select: {
        status: true,
        studentArchivedAt: true,
        statusBeforeStudentArchive: true,
      },
    });
    assert.deepEqual(migratedEnrollment, {
      status: 'ARCHIVED',
      studentArchivedAt: archivedAt,
      statusBeforeStudentArchive: 'ACTIVE',
    });
    assert.deepEqual(
      await prisma.lessonSeries.findUniqueOrThrow({
        where: { id: series.id },
        select: { deletedAt: true },
      }),
      { deletedAt: archivedAt },
    );
    assert.deepEqual(
      await prisma.lesson.findUniqueOrThrow({
        where: { id: lesson.id },
        select: { deletedAt: true },
      }),
      { deletedAt: archivedAt },
    );

    const students = new StudentsService(prisma, new AuditService(prisma));
    await students.restore(
      {
        userId: user.id,
        sessionId: 'migration-upgrade',
        workspaceId: workspace.id,
        role: 'OWNER',
      },
      archivedStudent.id,
    );
    assert.deepEqual(
      await prisma.enrollment.findUniqueOrThrow({
        where: { id: groupEnrollment.id },
        select: {
          status: true,
          studentArchivedAt: true,
          statusBeforeStudentArchive: true,
        },
      }),
      {
        status: 'ACTIVE',
        studentArchivedAt: null,
        statusBeforeStudentArchive: null,
      },
    );
    assert.deepEqual(
      await prisma.lesson.findUniqueOrThrow({
        where: { id: lesson.id },
        select: { deletedAt: true },
      }),
      { deletedAt: null },
    );
    await prisma.$disconnect();
    console.log('Lifecycle migration upgrade verification passed.');
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
}

void main();
