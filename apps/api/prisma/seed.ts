/**
 * Development-only demo seed. Run explicitly with `pnpm db:seed` — it is
 * intentionally NOT wired into prisma's `seed` hook, application startup or
 * any deployment step. Safe to rerun: everything is keyed by the demo emails.
 */
import { hash } from '@node-rs/argon2';
import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const OWNER_EMAIL = 'demo-owner@tutorio.local';
const TEACHER_EMAIL = 'demo-teacher@tutorio.local';
const DEMO_PASSWORD = 'demo passphrase 2026';
const WORKSPACE_NAME = 'Demo SpeakWise';

// Same parameters as the auth PasswordService (OWASP argon2id baseline).
function hashPassword(password: string): Promise<string> {
  return hash(password, {
    algorithm: 2,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

async function upsertUser(email: string, name: string) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, passwordHash },
  });
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production environment');
  }

  const owner = await upsertUser(OWNER_EMAIL, 'Olena Demo');
  const teacher = await upsertUser(TEACHER_EMAIL, 'Taras Demo');

  // One demo workspace owned by the demo owner.
  let ownerMembership = await prisma.workspaceMember.findFirst({
    where: { userId: owner.id, role: 'OWNER' },
  });
  const workspace = ownerMembership
    ? await prisma.workspace.findUniqueOrThrow({
        where: { id: ownerMembership.workspaceId },
      })
    : await prisma.workspace.create({
        data: {
          name: WORKSPACE_NAME,
          defaultCurrency: 'EUR',
          cancellationDeadlineHours: 24,
        },
      });
  ownerMembership ??= await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: owner.id, role: 'OWNER' },
  });

  let teacherMembership = await prisma.workspaceMember.findFirst({
    where: { workspaceId: workspace.id, userId: teacher.id },
  });
  teacherMembership ??= await prisma.workspaceMember.create({
    data: { workspaceId: workspace.id, userId: teacher.id, role: 'TEACHER' },
  });

  async function ensureStudent(
    data: Omit<Prisma.StudentUncheckedCreateInput, 'workspaceId'>,
  ) {
    const existing = await prisma.student.findFirst({
      where: { workspaceId: workspace.id, fullName: data.fullName },
    });
    if (existing) {
      return existing;
    }
    const created = await prisma.student.create({
      data: { workspaceId: workspace.id, ...data },
    });
    await prisma.auditLog.create({
      data: {
        workspaceId: workspace.id,
        actorId: owner.id,
        action: 'CREATE',
        entity: 'STUDENT',
        entityId: created.id,
        diff: { fields: { fullName: { before: null, after: data.fullName } } },
      },
    });
    return created;
  }

  // Varied optional contacts: full parent contact, minimal card, adult
  // student, and one soft-deleted record for the owner's trash view.
  const alice = await ensureStudent({
    fullName: 'Alice Demo',
    email: 'alice.demo@example.com',
    phone: '+380 50 111 22 33',
    timezone: 'Europe/Kyiv',
    parentName: 'Iryna Demo',
    parentEmail: 'iryna.demo@example.com',
    parentPhone: '+380 50 111 22 34',
    notes: 'Preparing for B2 exam in spring.',
  });
  const bohdan = await ensureStudent({
    fullName: 'Bohdan Demo',
    timezone: 'Europe/Warsaw',
    phone: '+48 600 100 200',
  });
  const clara = await ensureStudent({
    fullName: 'Clara Demo',
    email: 'clara.demo@example.com',
    timezone: 'Europe/London',
    notes: 'Adult learner, invoices to company email.',
  });
  const deleted = await ensureStudent({
    fullName: 'Deleted Demo',
    timezone: 'Europe/Kyiv',
  });
  if (!deleted.deletedAt) {
    await prisma.student.update({
      where: { id: deleted.id },
      data: { deletedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: {
        workspaceId: workspace.id,
        actorId: owner.id,
        action: 'DELETE',
        entity: 'STUDENT',
        entityId: deleted.id,
      },
    });
  }

  let group = await prisma.group.findFirst({
    where: { workspaceId: workspace.id, name: 'B1 English Evenings' },
  });
  group ??= await prisma.group.create({
    data: {
      workspaceId: workspace.id,
      name: 'B1 English Evenings',
      notes: 'Tuesday and Thursday, 19:00 Kyiv time.',
    },
  });

  async function ensureEnrollment(
    studentId: string,
    groupId: string | null,
    teacherId: string,
    data: Pick<
      Prisma.EnrollmentUncheckedCreateInput,
      | 'status'
      | 'billingType'
      | 'priceMinor'
      | 'currency'
      | 'cancellationDeadlineHours'
    >,
  ) {
    const existing = await prisma.enrollment.findFirst({
      where: { workspaceId: workspace.id, studentId, groupId, teacherId },
    });
    if (existing) {
      return existing;
    }
    return prisma.enrollment.create({
      data: {
        workspaceId: workspace.id,
        studentId,
        groupId,
        teacherId,
        ...data,
      },
    });
  }

  // Individual + group enrollments across statuses and currencies.
  await ensureEnrollment(alice.id, null, teacherMembership.id, {
    status: 'ACTIVE',
    billingType: 'PACKAGE',
    priceMinor: 45000, // 450.00 UAH per lesson
    currency: 'UAH',
    cancellationDeadlineHours: null,
  });
  await ensureEnrollment(alice.id, group.id, ownerMembership.id, {
    status: 'ACTIVE',
    billingType: 'MONTHLY',
    priceMinor: 120000, // 1200.00 EUR per month
    currency: 'EUR',
    cancellationDeadlineHours: 48,
  });
  await ensureEnrollment(bohdan.id, group.id, teacherMembership.id, {
    status: 'PAUSED',
    billingType: 'PER_LESSON',
    priceMinor: 8000, // 80.00 PLN per lesson
    currency: 'PLN',
    cancellationDeadlineHours: null,
  });
  await ensureEnrollment(clara.id, null, ownerMembership.id, {
    status: 'ARCHIVED',
    billingType: 'PACKAGE',
    priceMinor: 3500, // 35.00 GBP per lesson
    currency: 'GBP',
    cancellationDeadlineHours: 24,
  });

  console.log('Seed complete.');
  console.log(`  Workspace: ${workspace.name} (${workspace.id})`);
  console.log(`  Owner:     ${OWNER_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Teacher:   ${TEACHER_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
