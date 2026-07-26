import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const runId = randomUUID().slice(0, 8);
const emailFor = (label: string) => `e2e-${runId}-${label}@example.com`;
const DAY_MS = 24 * 60 * 60 * 1000;

describe('Stage 4: packages, credit ledger, payments (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let owner: string;
  let workspaceId: string;
  let teacherId: string;
  let studentId: string;
  let enrollmentId: string;

  const server = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);

    const register = await server()
      .post('/api/auth/register')
      .send({
        name: 'Owner S4',
        workspaceName: `E2E WS S4 ${runId}`,
        email: emailFor('owner'),
        password: 'correct horse battery staple',
      })
      .expect(201);
    owner = register.body.tokens.accessToken;
    workspaceId = register.body.workspace.id;

    const teachers = await server()
      .get('/api/teachers')
      .set('Authorization', auth(owner))
      .expect(200);
    teacherId = teachers.body.items[0].id;

    const student = await server()
      .post('/api/students')
      .set('Authorization', auth(owner))
      .send({ fullName: 'Package Student', timezone: 'Europe/Kyiv' })
      .expect(201);
    studentId = student.body.id;

    const enrollment = await server()
      .post('/api/enrollments')
      .set('Authorization', auth(owner))
      .send({
        studentId,
        teacherId,
        priceMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);
    enrollmentId = enrollment.body.id;
  });

  afterAll(async () => {
    await prisma.lessonCreditEntry.deleteMany({ where: { workspaceId } });
    await prisma.payment.deleteMany({ where: { workspaceId } });
    await prisma.packageParticipantShare.deleteMany({ where: { workspaceId } });
    await prisma.lesson.deleteMany({ where: { workspaceId } });
    await prisma.lessonSeries.deleteMany({ where: { workspaceId } });
    await prisma.lessonPackage.deleteMany({ where: { workspaceId } });
    await prisma.enrollment.deleteMany({ where: { workspaceId } });
    await prisma.group.deleteMany({ where: { workspaceId } });
    await prisma.teacher.deleteMany({ where: { workspaceId } });
    await prisma.student.deleteMany({ where: { workspaceId } });
    await prisma.auditLog.deleteMany({ where: { workspaceId } });
    const users = await prisma.user.findMany({
      where: { email: { startsWith: `e2e-${runId}-` } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
    await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('buys a package, consumes a credit on completion, and explains the balance', async () => {
    const pkg = await server()
      .post('/api/packages')
      .set('Authorization', auth(owner))
      .send({
        studentId,
        name: 'Autumn 8',
        sizingMode: 'FIXED_COUNT',
        lessonsTotal: 8,
        pricePerLessonMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);

    // The opening purchase entry grants the whole package up front.
    expect(pkg.body.lessonsTotal).toBe(8);
    expect(pkg.body.totalPriceMinorSnapshot).toBe(400000);
    expect(pkg.body.remainingCredits).toBe(8);
    expect(pkg.body.paymentStatus).toBe('PENDING');

    const start = new Date(Date.now() + DAY_MS);
    start.setUTCHours(6, 0, 0, 0);
    const lessons = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({ studentId, startsAt: [start.toISOString()], durationMin: 60 })
      .expect(201);
    const lessonId = lessons.body.items[0].id;

    await server()
      .patch(`/api/lessons/${lessonId}/status`)
      .set('Authorization', auth(owner))
      .send({ targetStatus: 'COMPLETED' })
      .expect(200);

    const afterLesson = await server()
      .get(`/api/packages/${pkg.body.id}`)
      .set('Authorization', auth(owner))
      .expect(200);
    expect(afterLesson.body.remainingCredits).toBe(7);
    expect(afterLesson.body.consumedCredits).toBe(1);

    // The ledger explains the balance rather than just asserting it.
    const ledger = await server()
      .get(`/api/packages/${pkg.body.id}/ledger`)
      .set('Authorization', auth(owner))
      .expect(200);
    expect(ledger.body.balance).toBe(7);
    expect(
      ledger.body.items.map((item: { type: string }) => item.type),
    ).toEqual(['lesson_completed', 'purchase']);
  });

  it('buys a package for a student who has never been scheduled', async () => {
    // No enrollment exists yet — the tutor should not have to create one first.
    const fresh = await server()
      .post('/api/students')
      .set('Authorization', auth(owner))
      .send({ fullName: 'Never Scheduled', timezone: 'Europe/Kyiv' })
      .expect(201);

    const pkg = await server()
      .post('/api/packages')
      .set('Authorization', auth(owner))
      .send({
        studentId: fresh.body.id,
        sizingMode: 'FIXED_COUNT',
        lessonsTotal: 4,
        pricePerLessonMinor: 30000,
        // A different currency than any existing enrollment: the package
        // carries its own currency.
        currency: 'EUR',
        schedule: {
          weekdays: [2],
          localTime: '09:00',
          timezone: 'Europe/Kyiv',
          durationMin: 60,
          startDate: new Date(Date.now() + 7 * DAY_MS).toISOString(),
        },
      })
      .expect(201);

    expect(pkg.body.remainingCredits).toBe(4);
    expect(pkg.body.currency).toBe('EUR');
  });

  it('rejects a group package when the group has no active students', async () => {
    const group = await server()
      .post('/api/groups')
      .set('Authorization', auth(owner))
      .send({ name: 'Empty Group' })
      .expect(201);

    const rejected = await server()
      .post('/api/packages')
      .set('Authorization', auth(owner))
      .send({
        groupId: group.body.id,
        sizingMode: 'FIXED_COUNT',
        lessonsTotal: 4,
        pricePerLessonMinor: 30000,
        currency: 'UAH',
      })
      .expect(400);
    expect(rejected.body.code).toBe('INVALID_PACKAGE_PLAN');
  });

  it('never charges twice for the same lesson', async () => {
    // The package only has to exist for the lesson to resolve against it.
    await server()
      .post('/api/packages')
      .set('Authorization', auth(owner))
      .send({
        studentId,
        sizingMode: 'FIXED_COUNT',
        lessonsTotal: 4,
        pricePerLessonMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);

    const start = new Date(Date.now() + 2 * DAY_MS);
    start.setUTCHours(6, 0, 0, 0);
    const lessons = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({ studentId, startsAt: [start.toISOString()], durationMin: 60 })
      .expect(201);
    const lessonId = lessons.body.items[0].id;

    await server()
      .patch(`/api/lessons/${lessonId}/status`)
      .set('Authorization', auth(owner))
      .send({ targetStatus: 'COMPLETED' })
      .expect(200);

    // Repeating the same transition is rejected by the state machine, so the
    // balance cannot move a second time.
    await server()
      .patch(`/api/lessons/${lessonId}/status`)
      .set('Authorization', auth(owner))
      .send({ targetStatus: 'COMPLETED' })
      .expect(409);

    const entries = await prisma.lessonCreditEntry.findMany({
      where: { lessonId, type: 'lesson_completed' },
    });
    expect(entries).toHaveLength(1);
  });

  it('keeps the credit when a lesson is cancelled without charge', async () => {
    const pkg = await server()
      .post('/api/packages')
      .set('Authorization', auth(owner))
      .send({
        studentId,
        sizingMode: 'FIXED_COUNT',
        lessonsTotal: 4,
        pricePerLessonMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);

    const start = new Date(Date.now() + 3 * DAY_MS);
    start.setUTCHours(6, 0, 0, 0);
    const lessons = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({ studentId, startsAt: [start.toISOString()], durationMin: 60 })
      .expect(201);
    const lessonId = lessons.body.items[0].id;

    const before = await server()
      .get(`/api/packages/${pkg.body.id}`)
      .set('Authorization', auth(owner))
      .expect(200);

    await server()
      .patch(`/api/lessons/${lessonId}/status`)
      .set('Authorization', auth(owner))
      .send({ targetStatus: 'CANCELLED_UNCHARGED', cancelledBy: 'TEACHER' })
      .expect(200);

    const after = await server()
      .get(`/api/packages/${pkg.body.id}`)
      .set('Authorization', auth(owner))
      .expect(200);

    // Delta 0: the paid slot survives the cancellation, and the package's
    // effective total drops by one lesson's price.
    expect(after.body.remainingCredits).toBe(before.body.remainingCredits);
    expect(after.body.effectiveTotalMinor).toBe(
      before.body.effectiveTotalMinor - 50000,
    );
  });

  it('records a payment and moves the package to paid', async () => {
    const pkg = await server()
      .post('/api/packages')
      .set('Authorization', auth(owner))
      .send({
        studentId,
        sizingMode: 'FIXED_COUNT',
        lessonsTotal: 2,
        pricePerLessonMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);

    const payment = await server()
      .post('/api/payments')
      .set('Authorization', auth(owner))
      .send({
        enrollmentId,
        packageId: pkg.body.id,
        amountMinor: 100000,
        currency: 'UAH',
        method: 'CASH',
      })
      .expect(201);

    // Manual money is settled the moment it is recorded; the provider fields
    // are already in place for online acquiring.
    expect(payment.body.status).toBe('PAID');
    expect(payment.body.provider).toBe('manual');
    expect(payment.body.externalId).toBeNull();

    const paid = await server()
      .get(`/api/packages/${pkg.body.id}`)
      .set('Authorization', auth(owner))
      .expect(200);
    expect(paid.body.paidMinor).toBe(100000);
    expect(paid.body.paymentStatus).toBe('PAID');

    // Money and credits are separate ledgers: paying grants no lessons.
    expect(paid.body.remainingCredits).toBe(2);
  });

  it('rejects a payment in a different currency than the package', async () => {
    const pkg = await server()
      .post('/api/packages')
      .set('Authorization', auth(owner))
      .send({
        studentId,
        sizingMode: 'FIXED_COUNT',
        lessonsTotal: 2,
        pricePerLessonMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);

    const mismatch = await server()
      .post('/api/payments')
      .set('Authorization', auth(owner))
      .send({
        enrollmentId,
        packageId: pkg.body.id,
        amountMinor: 10000,
        currency: 'EUR',
      })
      .expect(409);
    expect(mismatch.body.code).toBe('CURRENCY_MISMATCH');
  });

  it('appends a manual adjustment instead of editing history', async () => {
    const pkg = await server()
      .post('/api/packages')
      .set('Authorization', auth(owner))
      .send({
        studentId,
        sizingMode: 'FIXED_COUNT',
        lessonsTotal: 4,
        pricePerLessonMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);

    const adjusted = await server()
      .post(`/api/packages/${pkg.body.id}/adjust`)
      .set('Authorization', auth(owner))
      .send({ delta: 2, note: 'Goodwill lessons after a scheduling mistake' })
      .expect(201);
    expect(adjusted.body.remainingCredits).toBe(6);

    const ledger = await server()
      .get(`/api/packages/${pkg.body.id}/ledger`)
      .set('Authorization', auth(owner))
      .expect(200);
    // Both rows survive — the correction is an addition, not an edit.
    expect(ledger.body.items).toHaveLength(2);
    expect(ledger.body.items[0].type).toBe('manual_adjustment');
    expect(ledger.body.items[0].note).toContain('Goodwill');
  });
});
