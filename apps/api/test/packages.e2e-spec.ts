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
  let outsiderWorkspaceId: string | null = null;

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
    const workspaceIds = [
      workspaceId,
      ...(outsiderWorkspaceId ? [outsiderWorkspaceId] : []),
    ];
    await prisma.lessonCreditEntry.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.payment.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.packageParticipantShare.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.lesson.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.lessonSeries.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.lessonPackage.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.enrollment.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.group.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.teacher.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.student.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.auditLog.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    const users = await prisma.user.findMany({
      where: { email: { startsWith: `e2e-${runId}-` } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
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
          slots: [{ weekday: 2, localTime: '03:17' }],
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

    // Retrying the same semantic transition is idempotent.
    await server()
      .patch(`/api/lessons/${lessonId}/status`)
      .set('Authorization', auth(owner))
      .send({ targetStatus: 'COMPLETED' })
      .expect(200);

    const entries = await prisma.lessonCreditEntry.findMany({
      where: { lessonId, type: 'lesson_completed' },
    });
    expect(entries).toHaveLength(1);
  });

  it('writes one financial effect for concurrent duplicate transitions', async () => {
    const start = new Date(Date.now() + 5 * DAY_MS);
    start.setUTCHours(6, 0, 0, 0);
    const created = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({ studentId, startsAt: [start.toISOString()], durationMin: 60 })
      .expect(201);
    const lessonId = created.body.items[0].id;
    const responses = await Promise.all([
      server()
        .patch(`/api/lessons/${lessonId}/status`)
        .set('Authorization', auth(owner))
        .send({ targetStatus: 'COMPLETED' }),
      server()
        .patch(`/api/lessons/${lessonId}/status`)
        .set('Authorization', auth(owner))
        .send({ targetStatus: 'COMPLETED' }),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(
      await prisma.lessonCreditEntry.count({
        where: { lessonId, type: 'lesson_completed', delta: -1 },
      }),
    ).toBe(1);
  });

  it('rejects a changed cancellation replay without changing financial history', async () => {
    const created = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        studentId,
        startsAt: [new Date(Date.now() + 10 * DAY_MS).toISOString()],
        durationMin: 60,
      })
      .expect(201);
    const lessonId = created.body.items[0].id;
    await server()
      .patch(`/api/lessons/${lessonId}/status`)
      .set('Authorization', auth(owner))
      .send({
        targetStatus: 'CANCELLED_UNCHARGED',
        cancelledBy: 'TEACHER',
        cancelledReason: 'Weather',
      })
      .expect(200);
    await server()
      .patch(`/api/lessons/${lessonId}/status`)
      .set('Authorization', auth(owner))
      .send({
        targetStatus: 'CANCELLED_UNCHARGED',
        cancelledBy: 'STUDENT',
        cancelledReason: 'Weather',
      })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('LESSON_TRANSITION_REPLAY_CONFLICT'),
      );
    expect(await prisma.lessonCreditEntry.count({ where: { lessonId } })).toBe(
      0,
    );
  });

  it('rejects conflicting cancellation metadata during a concurrent replay', async () => {
    const created = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        studentId,
        startsAt: [new Date(Date.now() + 11 * DAY_MS).toISOString()],
        durationMin: 60,
      })
      .expect(201);
    const lessonId = created.body.items[0].id;
    const responses = await Promise.all([
      server()
        .patch(`/api/lessons/${lessonId}/status`)
        .set('Authorization', auth(owner))
        .send({
          targetStatus: 'CANCELLED_UNCHARGED',
          cancelledBy: 'TEACHER',
          cancelledReason: 'Weather',
        }),
      server()
        .patch(`/api/lessons/${lessonId}/status`)
        .set('Authorization', auth(owner))
        .send({
          targetStatus: 'CANCELLED_UNCHARGED',
          cancelledBy: 'STUDENT',
          cancelledReason: 'Transport',
        }),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(
      responses.find((response) => response.status === 409)?.body.code,
    ).toBe('LESSON_TRANSITION_REPLAY_CONFLICT');
    expect(
      await prisma.auditLog.count({
        where: { entity: 'LESSON', entityId: lessonId, action: 'UPDATE' },
      }),
    ).toBe(1);
    expect(await prisma.lessonCreditEntry.count({ where: { lessonId } })).toBe(
      0,
    );
  });

  it('never compensates a terminal lesson without an exact debit source', async () => {
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
    const forged = await prisma.lesson.create({
      data: {
        workspaceId,
        enrollmentId,
        teacherId,
        startsAtUtc: new Date(Date.now() + 11 * DAY_MS),
        durationMin: 60,
        priceMinor: 50000,
        currency: 'UAH',
        packageId: pkg.body.id,
        status: 'COMPLETED',
        statusVersion: 1,
      },
    });
    await server()
      .patch(`/api/lessons/${forged.id}/status`)
      .set('Authorization', auth(owner))
      .send({ targetStatus: 'SCHEDULED' })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('LESSON_COMPENSATION_SOURCE_MISSING'),
      );
    const unchanged = await prisma.lesson.findUniqueOrThrow({
      where: { id: forged.id },
    });
    expect(unchanged.status).toBe('COMPLETED');
    expect(unchanged.statusVersion).toBe(1);
    expect(
      await prisma.lessonCreditEntry.count({ where: { lessonId: forged.id } }),
    ).toBe(0);
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

    // No zero-delta ledger row is created: cancellation remains in lesson and
    // audit history, while both credit and money stay unchanged.
    expect(after.body.remainingCredits).toBe(before.body.remainingCredits);
    expect(after.body.effectiveTotalMinor).toBe(
      before.body.effectiveTotalMinor,
    );
    expect(after.body.paymentStatus).toBe(before.body.paymentStatus);
    expect(await prisma.lessonCreditEntry.count({ where: { lessonId } })).toBe(
      0,
    );
  });

  it('pins a debit to its package and compensates that same archived package', async () => {
    const packageA = await server()
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
    const start = new Date(Date.now() + 4 * DAY_MS);
    start.setUTCHours(6, 0, 0, 0);
    const created = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        studentId,
        packageId: packageA.body.id,
        startsAt: [start.toISOString()],
        durationMin: 60,
      })
      .expect(201);
    const lessonId = created.body.items[0].id;

    await server()
      .patch(`/api/lessons/${lessonId}/status`)
      .set('Authorization', auth(owner))
      .send({ targetStatus: 'COMPLETED' })
      .expect(200);
    expect(
      (await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } }))
        .packageId,
    ).toBe(packageA.body.id);

    await server()
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
    await server()
      .delete(`/api/packages/${packageA.body.id}`)
      .set('Authorization', auth(owner))
      .expect(204);

    await server()
      .delete(`/api/lessons/${lessonId}`)
      .set('Authorization', auth(owner))
      .expect(409);
    await server()
      .patch(`/api/lessons/${lessonId}/status`)
      .set('Authorization', auth(owner))
      .send({ targetStatus: 'SCHEDULED' })
      .expect(200);
    await server()
      .delete(`/api/lessons/${lessonId}`)
      .set('Authorization', auth(owner))
      .expect(204);

    const history = await prisma.lessonCreditEntry.findMany({
      where: { lessonId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { packageId: true, delta: true },
    });
    expect(history).toEqual([
      { packageId: packageA.body.id, delta: -1 },
      { packageId: packageA.body.id, delta: 1 },
    ]);
  });

  it('locks a charged lesson financial snapshot while leaving notes editable', async () => {
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
    const created = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        studentId,
        packageId: pkg.body.id,
        startsAt: [new Date(Date.now() + 6 * DAY_MS).toISOString()],
        durationMin: 60,
      })
      .expect(201);
    const lessonId = created.body.items[0].id;
    await server()
      .patch(`/api/lessons/${lessonId}/status`)
      .set('Authorization', auth(owner))
      .send({ targetStatus: 'COMPLETED' })
      .expect(200);

    await server()
      .patch(`/api/lessons/${lessonId}`)
      .set('Authorization', auth(owner))
      .send({ priceMinor: 60000, currency: 'UAH' })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('LESSON_FINANCIAL_HISTORY_IMMUTABLE'),
      );
    await server()
      .patch(`/api/lessons/${lessonId}`)
      .set('Authorization', auth(owner))
      .send({ priceMinor: 50000, currency: 'EUR' })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('LESSON_FINANCIAL_HISTORY_IMMUTABLE'),
      );
    await server()
      .patch(`/api/lessons/${lessonId}`)
      .set('Authorization', auth(owner))
      .send({ notes: 'Corrected attendance note' })
      .expect(200)
      .expect(({ body }) =>
        expect(body.notes).toBe('Corrected attendance note'),
      );
    await server()
      .patch(`/api/lessons/${lessonId}/status`)
      .set('Authorization', auth(owner))
      .send({ targetStatus: 'SCHEDULED' })
      .expect(200);
    expect(
      await prisma.lessonCreditEntry.findMany({
        where: { lessonId },
        orderBy: { createdAt: 'asc' },
        select: { packageId: true, delta: true },
      }),
    ).toEqual([
      { packageId: pkg.body.id, delta: -1 },
      { packageId: pkg.body.id, delta: 1 },
    ]);
  });

  it('does not select period or expired packages for fixed-count credit debits', async () => {
    const future = new Date(Date.now() + 8 * DAY_MS);
    const isolatedStudent = await server()
      .post('/api/students')
      .set('Authorization', auth(owner))
      .send({ fullName: 'Eligibility Isolation', timezone: 'Europe/Kyiv' })
      .expect(201);
    const isolatedEnrollment = await server()
      .post('/api/enrollments')
      .set('Authorization', auth(owner))
      .send({
        studentId: isolatedStudent.body.id,
        teacherId,
        priceMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);
    const period = await server()
      .post('/api/packages')
      .set('Authorization', auth(owner))
      .send({
        studentId: isolatedStudent.body.id,
        sizingMode: 'BY_PERIOD',
        endDate: new Date(Date.now() + 30 * DAY_MS).toISOString(),
        pricePerLessonMinor: 50000,
        currency: 'UAH',
        schedule: {
          slots: [{ weekday: 2, localTime: '09:00' }],
          timezone: 'Europe/Kyiv',
          durationMin: 60,
          startDate: future.toISOString(),
        },
      })
      .expect(201);
    await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        studentId: isolatedStudent.body.id,
        packageId: period.body.id,
        startsAt: [future.toISOString()],
        durationMin: 60,
      })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('PACKAGE_NOT_ELIGIBLE_FOR_CREDIT'),
      );

    await prisma.lessonPackage.create({
      data: {
        workspaceId,
        studentId: isolatedStudent.body.id,
        sizingMode: 'FIXED_COUNT',
        lessonsTotal: 2,
        pricePerLessonMinorSnapshot: 50000,
        totalPriceMinorSnapshot: 100000,
        currency: 'UAH',
        expiresAt: new Date(Date.now() + DAY_MS),
      },
    });
    const lesson = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        enrollmentId: isolatedEnrollment.body.id,
        teacherId,
        startsAt: [future.toISOString()],
        durationMin: 60,
        priceMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);
    await server()
      .patch(`/api/lessons/${lesson.body.items[0].id}/status`)
      .set('Authorization', auth(owner))
      .send({ targetStatus: 'COMPLETED' })
      .expect(200);
    expect(
      await prisma.lessonCreditEntry.count({
        where: { lessonId: lesson.body.items[0].id },
      }),
    ).toBe(0);
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

  it('rejects an unrelated package enrollment and a package-less currency mismatch', async () => {
    const unrelatedStudent = await server()
      .post('/api/students')
      .set('Authorization', auth(owner))
      .send({ fullName: 'Unrelated Payer', timezone: 'Europe/Kyiv' })
      .expect(201);
    const unrelatedEnrollment = await server()
      .post('/api/enrollments')
      .set('Authorization', auth(owner))
      .send({
        studentId: unrelatedStudent.body.id,
        teacherId,
        priceMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);
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

    const unrelated = await server()
      .post('/api/payments')
      .set('Authorization', auth(owner))
      .send({
        enrollmentId: unrelatedEnrollment.body.id,
        packageId: pkg.body.id,
        amountMinor: 10000,
        currency: 'UAH',
      })
      .expect(409);
    expect(unrelated.body.code).toBe('INVALID_PACKAGE_PAYMENT_RELATION');

    const currencyMismatch = await server()
      .post('/api/payments')
      .set('Authorization', auth(owner))
      .send({
        enrollmentId,
        amountMinor: 10000,
        currency: 'EUR',
      })
      .expect(409);
    expect(currencyMismatch.body.code).toBe('CURRENCY_MISMATCH');
  });

  it('reconciles partial and full payments, rejects overpayment, and replays idempotently', async () => {
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
    const firstCommand = {
      enrollmentId,
      packageId: pkg.body.id,
      amountMinor: 40000,
      currency: 'UAH',
      method: 'BANK_TRANSFER',
      idempotencyKey: `payment-${runId}-partial`,
    };

    const partial = await server()
      .post('/api/payments')
      .set('Authorization', auth(owner))
      .send(firstCommand)
      .expect(201);
    const replay = await server()
      .post('/api/payments')
      .set('Authorization', auth(owner))
      .send(firstCommand)
      .expect(201);
    expect(replay.body.id).toBe(partial.body.id);

    await server()
      .post('/api/payments')
      .set('Authorization', auth(owner))
      .send({ ...firstCommand, amountMinor: 1 })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('IDEMPOTENCY_CONFLICT');
      });

    const completed = await server()
      .post('/api/payments')
      .set('Authorization', auth(owner))
      .send({
        enrollmentId,
        packageId: pkg.body.id,
        amountMinor: 60000,
        currency: 'UAH',
        idempotencyKey: `payment-${runId}-full`,
      })
      .expect(201);
    expect(completed.body.status).toBe('PAID');

    const overpayment = await server()
      .post('/api/payments')
      .set('Authorization', auth(owner))
      .send({
        enrollmentId,
        packageId: pkg.body.id,
        amountMinor: 1,
        currency: 'UAH',
      })
      .expect(409);
    expect(overpayment.body.code).toBe('OVERPAYMENT');

    const detail = await server()
      .get(`/api/packages/${pkg.body.id}`)
      .set('Authorization', auth(owner))
      .expect(200);
    expect(detail.body.paidMinor).toBe(100000);
    expect(detail.body.paymentStatus).toBe('PAID');
    expect(
      await prisma.payment.count({ where: { packageId: pkg.body.id } }),
    ).toBe(2);
  });

  it('only accepts group payments from a creation-time participant share', async () => {
    const group = await server()
      .post('/api/groups')
      .set('Authorization', auth(owner))
      .send({ name: 'Payment Share Group' })
      .expect(201);
    const groupStudent = await server()
      .post('/api/students')
      .set('Authorization', auth(owner))
      .send({ fullName: 'Share Participant', timezone: 'Europe/Kyiv' })
      .expect(201);
    const groupEnrollment = await server()
      .post('/api/enrollments')
      .set('Authorization', auth(owner))
      .send({
        studentId: groupStudent.body.id,
        groupId: group.body.id,
        teacherId,
        priceMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);
    const pkg = await server()
      .post('/api/packages')
      .set('Authorization', auth(owner))
      .send({
        groupId: group.body.id,
        sizingMode: 'FIXED_COUNT',
        lessonsTotal: 2,
        pricePerLessonMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);

    await server()
      .post('/api/payments')
      .set('Authorization', auth(owner))
      .send({
        enrollmentId,
        packageId: pkg.body.id,
        amountMinor: 10000,
        currency: 'UAH',
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('INVALID_PACKAGE_PAYMENT_RELATION');
      });

    await server()
      .post('/api/payments')
      .set('Authorization', auth(owner))
      .send({
        enrollmentId: groupEnrollment.body.id,
        packageId: pkg.body.id,
        amountMinor: 60000,
        currency: 'UAH',
      })
      .expect(201);
    await server()
      .post('/api/payments')
      .set('Authorization', auth(owner))
      .send({
        enrollmentId: groupEnrollment.body.id,
        packageId: pkg.body.id,
        amountMinor: 40000,
        currency: 'UAH',
      })
      .expect(201);

    const detail = await server()
      .get(`/api/packages/${pkg.body.id}`)
      .set('Authorization', auth(owner))
      .expect(200);
    expect(detail.body.shares).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          enrollmentId: groupEnrollment.body.id,
          oweMinor: 100000,
          paidMinor: 100000,
          paymentStatus: 'PAID',
        }),
      ]),
    );
  });

  it('preserves group package shares through charged cancellation and restoration cycles', async () => {
    const group = await server()
      .post('/api/groups')
      .set('Authorization', auth(owner))
      .send({ name: 'Cycle Group' })
      .expect(201);
    const members = await Promise.all(
      ['Cycle One', 'Cycle Two'].map(async (fullName) => {
        const student = await server()
          .post('/api/students')
          .set('Authorization', auth(owner))
          .send({ fullName, timezone: 'Europe/Kyiv' })
          .expect(201);
        return server()
          .post('/api/enrollments')
          .set('Authorization', auth(owner))
          .send({
            studentId: student.body.id,
            groupId: group.body.id,
            teacherId,
            priceMinor: 50000,
            currency: 'UAH',
          })
          .expect(201);
      }),
    );
    const pkg = await server()
      .post('/api/packages')
      .set('Authorization', auth(owner))
      .send({
        groupId: group.body.id,
        sizingMode: 'FIXED_COUNT',
        lessonsTotal: 3,
        pricePerLessonMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);
    const sharesBefore = pkg.body.shares
      .map(
        (share: {
          enrollmentId: string;
          oweMinor: number;
          paidMinor: number;
        }) => ({ ...share }),
      )
      .sort((a: { enrollmentId: string }, b: { enrollmentId: string }) =>
        a.enrollmentId.localeCompare(b.enrollmentId),
      );
    expect(members).toHaveLength(2);
    const lesson = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        groupId: group.body.id,
        packageId: pkg.body.id,
        teacherId,
        priceMinor: 50000,
        currency: 'UAH',
        startsAt: [new Date(Date.now() + 12 * DAY_MS).toISOString()],
        durationMin: 60,
      })
      .expect(201);
    const lessonId = lesson.body.items[0].id;
    for (const targetStatus of [
      'CANCELLED_CHARGED',
      'SCHEDULED',
      'CANCELLED_CHARGED',
    ] as const) {
      await server()
        .patch(`/api/lessons/${lessonId}/status`)
        .set('Authorization', auth(owner))
        .send(
          targetStatus === 'CANCELLED_CHARGED'
            ? { targetStatus, cancelledBy: 'STUDENT', cancelledReason: 'Late' }
            : { targetStatus },
        )
        .expect(200);
    }
    const entries = await prisma.lessonCreditEntry.findMany({
      where: { lessonId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        packageId: true,
        lessonId: true,
        delta: true,
        idempotencyKey: true,
      },
    });
    expect(entries.map((entry) => entry.delta)).toEqual([-1, 1, -1]);
    expect(new Set(entries.map((entry) => entry.packageId))).toEqual(
      new Set([pkg.body.id]),
    );
    expect(new Set(entries.map((entry) => entry.idempotencyKey)).size).toBe(3);
    const after = await server()
      .get(`/api/packages/${pkg.body.id}`)
      .set('Authorization', auth(owner))
      .expect(200);
    expect(
      after.body.shares
        .map(
          (share: {
            enrollmentId: string;
            oweMinor: number;
            paidMinor: number;
          }) => ({ ...share }),
        )
        .sort((a: { enrollmentId: string }, b: { enrollmentId: string }) =>
          a.enrollmentId.localeCompare(b.enrollmentId),
        ),
    ).toEqual(sharesBefore);
    const uncharged = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        groupId: group.body.id,
        packageId: pkg.body.id,
        teacherId,
        priceMinor: 50000,
        currency: 'UAH',
        startsAt: [new Date(Date.now() + 13 * DAY_MS).toISOString()],
        durationMin: 60,
      })
      .expect(201);
    await server()
      .patch(`/api/lessons/${uncharged.body.items[0].id}/status`)
      .set('Authorization', auth(owner))
      .send({ targetStatus: 'CANCELLED_UNCHARGED', cancelledBy: 'TEACHER' })
      .expect(200);
    await server()
      .patch(`/api/lessons/${uncharged.body.items[0].id}/status`)
      .set('Authorization', auth(owner))
      .send({ targetStatus: 'SCHEDULED' })
      .expect(200);
    expect(
      await prisma.lessonCreditEntry.count({
        where: { lessonId: uncharged.body.items[0].id },
      }),
    ).toBe(0);
  });

  it('archives package-owned work while preserving and compensating history', async () => {
    const group = await server()
      .post('/api/groups')
      .set('Authorization', auth(owner))
      .send({ name: 'Archive Package Group' })
      .expect(201);
    for (const fullName of ['Archive One', 'Archive Two']) {
      const student = await server()
        .post('/api/students')
        .set('Authorization', auth(owner))
        .send({ fullName, timezone: 'UTC' })
        .expect(201);
      await server()
        .post('/api/enrollments')
        .set('Authorization', auth(owner))
        .send({
          studentId: student.body.id,
          groupId: group.body.id,
          teacherId,
          priceMinor: 50000,
          currency: 'UAH',
        })
        .expect(201);
    }

    const scheduleStart = new Date(Date.now() + 20 * DAY_MS);
    scheduleStart.setUTCHours(10, 0, 0, 0);
    const pkg = await server()
      .post('/api/packages')
      .set('Authorization', auth(owner))
      .send({
        groupId: group.body.id,
        sizingMode: 'FIXED_COUNT',
        lessonsTotal: 4,
        pricePerLessonMinor: 50000,
        currency: 'UAH',
        purchasedAt: new Date(Date.now() - 30 * DAY_MS).toISOString(),
        schedule: {
          slots: [{ weekday: scheduleStart.getUTCDay(), localTime: '10:00' }],
          timezone: 'UTC',
          durationMin: 60,
          startDate: scheduleStart.toISOString(),
        },
        initialPayment: {
          amountMinor: 200000,
          paidAt: new Date(Date.now() - DAY_MS).toISOString(),
        },
      })
      .expect(201);
    const generated = await prisma.lesson.findMany({
      where: { packageId: pkg.body.id },
      orderBy: { startsAtUtc: 'asc' },
    });
    expect(generated).toHaveLength(4);

    const historicalCompleted = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        groupId: group.body.id,
        packageId: pkg.body.id,
        teacherId,
        priceMinor: 50000,
        currency: 'UAH',
        startsAt: [
          new Date(Date.now() - 10 * DAY_MS).toISOString(),
        ],
        durationMin: 60,
      })
      .expect(201);
    const historicalCancelled = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        groupId: group.body.id,
        packageId: pkg.body.id,
        teacherId,
        priceMinor: 50000,
        currency: 'UAH',
        startsAt: [new Date(Date.now() - 9 * DAY_MS).toISOString()],
        durationMin: 60,
      })
      .expect(201);
    const completedId = historicalCompleted.body.items[0].id;
    const cancelledId = historicalCancelled.body.items[0].id;
    await server()
      .patch(`/api/lessons/${completedId}/status`)
      .set('Authorization', auth(owner))
      .send({ targetStatus: 'COMPLETED' })
      .expect(200);
    await server()
      .patch(`/api/lessons/${cancelledId}/status`)
      .set('Authorization', auth(owner))
      .send({
        targetStatus: 'CANCELLED_CHARGED',
        cancelledBy: 'STUDENT',
        cancelledReason: 'Late notice',
      })
      .expect(200);

    const detached = await server()
      .patch(`/api/lessons/${generated[0].id}/reschedule`)
      .set('Authorization', auth(owner))
      .send({
        startsAtUtc: new Date(
          generated[0].startsAtUtc.getTime() + 3 * 60 * 60 * 1000,
        ).toISOString(),
        scope: 'this',
      })
      .expect(200);
    expect(detached.body.isDetached).toBe(true);

    const oneOff = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        groupId: group.body.id,
        packageId: pkg.body.id,
        teacherId,
        priceMinor: 50000,
        currency: 'UAH',
        startsAt: [
          new Date(scheduleStart.getTime() + 50 * DAY_MS).toISOString(),
        ],
        durationMin: 60,
      })
      .expect(201);
    const oneOffId = oneOff.body.items[0].id;

    const unrelatedPackage = await server()
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
    const unrelatedLesson = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        studentId,
        packageId: unrelatedPackage.body.id,
        startsAt: [
          new Date(scheduleStart.getTime() + 60 * DAY_MS).toISOString(),
        ],
        durationMin: 60,
      })
      .expect(201);

    const sharesBefore = await prisma.packageParticipantShare.findMany({
      where: { packageId: pkg.body.id },
      orderBy: { enrollmentId: 'asc' },
      select: { enrollmentId: true, oweMinor: true, paidMinor: true },
    });
    const paymentsBefore = await prisma.payment.findMany({
      where: { packageId: pkg.body.id },
      orderBy: { enrollmentId: 'asc' },
      select: {
        id: true,
        enrollmentId: true,
        amountMinor: true,
        currency: true,
        status: true,
      },
    });
    const entriesBefore = await prisma.lessonCreditEntry.findMany({
      where: { packageId: pkg.body.id },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        lessonId: true,
        delta: true,
        type: true,
        packageId: true,
      },
    });

    await server()
      .delete(`/api/packages/${pkg.body.id}`)
      .set('Authorization', auth(owner))
      .expect(204);
    await server()
      .delete(`/api/packages/${pkg.body.id}`)
      .set('Authorization', auth(owner))
      .expect(204);

    const archivedSeries = await prisma.lessonSeries.findMany({
      where: { packageId: pkg.body.id },
      select: { deletedAt: true },
    });
    expect(archivedSeries.length).toBeGreaterThan(0);
    expect(archivedSeries.every((series) => series.deletedAt != null)).toBe(
      true,
    );
    const lessonsAfterArchive = await prisma.lesson.findMany({
      where: { packageId: pkg.body.id },
      select: { id: true, status: true, deletedAt: true },
    });
    const lessonById = new Map(
      lessonsAfterArchive.map((lesson) => [lesson.id, lesson]),
    );
    expect(lessonById.get(completedId)?.deletedAt).toBeNull();
    expect(lessonById.get(cancelledId)?.deletedAt).toBeNull();
    for (const lesson of lessonsAfterArchive.filter(
      (candidate) => candidate.status === 'SCHEDULED',
    )) {
      expect(lesson.deletedAt).not.toBeNull();
    }
    expect(lessonById.get(detached.body.id)?.deletedAt).not.toBeNull();
    expect(lessonById.get(oneOffId)?.deletedAt).not.toBeNull();
    expect(
      (
        await prisma.lessonPackage.findUniqueOrThrow({
          where: { id: unrelatedPackage.body.id },
        })
      ).deletedAt,
    ).toBeNull();
    expect(
      (
        await prisma.lesson.findUniqueOrThrow({
          where: { id: unrelatedLesson.body.items[0].id },
        })
      ).deletedAt,
    ).toBeNull();

    const archivedDetail = await server()
      .get(`/api/packages/${pkg.body.id}`)
      .set('Authorization', auth(owner))
      .expect(200);
    expect(archivedDetail.body.deletedAt).not.toBeNull();
    expect(archivedDetail.body.paidMinor).toBe(200000);
    expect(archivedDetail.body.totalPriceMinorSnapshot).toBe(200000);
    expect(archivedDetail.body.shares).toHaveLength(2);

    await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        groupId: group.body.id,
        packageId: pkg.body.id,
        teacherId,
        priceMinor: 50000,
        currency: 'UAH',
        startsAt: [
          new Date(scheduleStart.getTime() + 70 * DAY_MS).toISOString(),
        ],
        durationMin: 60,
      })
      .expect(409)
      .expect(({ body }) => expect(body.code).toBe('NO_ACTIVE_PACKAGE'));

    await server()
      .patch(`/api/lessons/${completedId}/status`)
      .set('Authorization', auth(owner))
      .send({ targetStatus: 'SCHEDULED' })
      .expect(200);
    expect(
      await prisma.lessonCreditEntry.findMany({
        where: { lessonId: completedId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { packageId: true, delta: true, type: true },
      }),
    ).toEqual([
      {
        packageId: pkg.body.id,
        delta: -1,
        type: 'lesson_completed',
      },
      {
        packageId: pkg.body.id,
        delta: 1,
        type: 'lesson_completed',
      },
    ]);
    expect(
      await prisma.packageParticipantShare.findMany({
        where: { packageId: pkg.body.id },
        orderBy: { enrollmentId: 'asc' },
        select: { enrollmentId: true, oweMinor: true, paidMinor: true },
      }),
    ).toEqual(sharesBefore);
    expect(
      await prisma.payment.findMany({
        where: { packageId: pkg.body.id },
        orderBy: { enrollmentId: 'asc' },
        select: {
          id: true,
          enrollmentId: true,
          amountMinor: true,
          currency: true,
          status: true,
        },
      }),
    ).toEqual(paymentsBefore);
    const entriesAfter = await prisma.lessonCreditEntry.findMany({
      where: { packageId: pkg.body.id },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        lessonId: true,
        delta: true,
        type: true,
        packageId: true,
      },
    });
    expect(
      entriesAfter.filter((entry) =>
        entriesBefore.some((before) => before.id === entry.id),
      ),
    ).toEqual(entriesBefore);
    expect(entriesAfter).toHaveLength(entriesBefore.length + 1);
    expect(
      await prisma.auditLog.count({
        where: {
          entity: 'LESSON_PACKAGE',
          entityId: pkg.body.id,
          action: 'DELETE',
        },
      }),
    ).toBe(1);
  });

  it('does not reveal or accept package payment identifiers from another workspace', async () => {
    const outsider = await server()
      .post('/api/auth/register')
      .send({
        name: 'Outsider S4',
        workspaceName: `E2E outsider S4 ${runId}`,
        email: emailFor('outsider'),
        password: 'correct horse battery staple',
      })
      .expect(201);
    outsiderWorkspaceId = outsider.body.workspace.id;

    const rejected = await server()
      .post('/api/payments')
      .set('Authorization', auth(outsider.body.tokens.accessToken))
      .send({
        enrollmentId,
        amountMinor: 10000,
        currency: 'UAH',
      })
      .expect(404);
    expect(rejected.body.code).toBe('ENROLLMENT_NOT_FOUND');
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
