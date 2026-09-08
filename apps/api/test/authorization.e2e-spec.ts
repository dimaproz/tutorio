import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const runId = randomUUID().slice(0, 8);
const emailFor = (label: string) => `e2e-${runId}-${label}@example.com`;

describe('Pilot authorization: legacy TEACHER denial (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: string;
  let teacher: string;
  let workspaceId: string;
  let teacherProfileId: string;
  let studentId: string;
  let enrollmentId: string;
  let packageId: string;

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

    const registration = await server()
      .post('/api/auth/register')
      .send({
        name: 'Authorization Owner',
        workspaceName: `Authorization E2E ${runId}`,
        email: emailFor('owner'),
        password: 'correct horse battery staple',
      })
      .expect(201);
    owner = registration.body.tokens.accessToken;
    workspaceId = registration.body.workspace.id;

    const teacherPassword = 'teacher passphrase long enough';
    const teacherUser = await prisma.user.create({
      data: {
        email: emailFor('legacy-teacher'),
        name: 'Legacy Teacher',
        passwordHash: await hash(teacherPassword, {
          algorithm: 2,
          memoryCost: 19_456,
          timeCost: 2,
          parallelism: 1,
        }),
      },
    });
    await prisma.workspaceMember.create({
      data: {
        userId: teacherUser.id,
        workspaceId,
        role: 'TEACHER',
      },
    });
    const teacherLogin = await server()
      .post('/api/auth/login')
      .send({ email: teacherUser.email, password: teacherPassword })
      .expect(200);
    teacher = teacherLogin.body.tokens.accessToken;
    expect(teacherLogin.body.role).toBe('TEACHER');

    const teachers = await server()
      .get('/api/teachers')
      .set('Authorization', auth(owner))
      .expect(200);
    teacherProfileId = teachers.body.items[0].id;

    const student = await server()
      .post('/api/students')
      .set('Authorization', auth(owner))
      .send({ fullName: 'Authorization Student', timezone: 'Europe/Kyiv' })
      .expect(201);
    studentId = student.body.id;

    const enrollment = await server()
      .post('/api/enrollments')
      .set('Authorization', auth(owner))
      .send({
        studentId,
        teacherId: teacherProfileId,
        priceMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);
    enrollmentId = enrollment.body.id;

    const lessonPackage = await server()
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
    packageId = lessonPackage.body.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { workspaceId } });
    await prisma.lessonCreditEntry.deleteMany({ where: { workspaceId } });
    await prisma.payment.deleteMany({ where: { workspaceId } });
    await prisma.packageParticipantShare.deleteMany({ where: { workspaceId } });
    await prisma.lesson.deleteMany({ where: { workspaceId } });
    await prisma.lessonSeries.deleteMany({ where: { workspaceId } });
    await prisma.lessonPackage.deleteMany({ where: { workspaceId } });
    await prisma.enrollment.deleteMany({ where: { workspaceId } });
    await prisma.teacher.deleteMany({ where: { workspaceId } });
    await prisma.student.deleteMany({ where: { workspaceId } });
    const users = await prisma.user.findMany({
      where: { email: { startsWith: `e2e-${runId}-` } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
    await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  async function businessState() {
    const where = { workspaceId };
    const [
      students,
      parents,
      enrollments,
      lessons,
      lessonSeries,
      packages,
      payments,
      creditEntries,
      audits,
      workspaceSettings,
    ] = await Promise.all([
      prisma.student.count({ where }),
      prisma.parent.count({ where }),
      prisma.enrollment.count({ where }),
      prisma.lesson.count({ where }),
      prisma.lessonSeries.count({ where }),
      prisma.lessonPackage.count({ where }),
      prisma.payment.count({ where }),
      prisma.lessonCreditEntry.count({ where }),
      prisma.auditLog.count({ where }),
      prisma.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: {
          cancellationDeadlineHours: true,
          defaultCurrency: true,
          mode: true,
          primaryColor: true,
          secondaryColor: true,
        },
      }),
    ]);
    return {
      students,
      parents,
      enrollments,
      lessons,
      lessonSeries,
      packages,
      payments,
      creditEntries,
      audits,
      workspaceSettings,
    };
  }

  async function expectForbidden(test: request.Test): Promise<void> {
    const response = await test.expect(403);
    expect(response.body).toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  }

  it('keeps all pilot business surfaces owner-only without writes or audit entries', async () => {
    const before = await businessState();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Reads are denied alongside writes: the pilot has no staff data scope.
    await expectForbidden(
      server().get('/api/students').set('Authorization', auth(teacher)),
    );
    await expectForbidden(
      server()
        .post('/api/students')
        .set('Authorization', auth(teacher))
        .send({ fullName: 'Forbidden Student', timezone: 'Europe/Kyiv' }),
    );
    await expectForbidden(
      server().get('/api/parents').set('Authorization', auth(teacher)),
    );
    await expectForbidden(
      server()
        .post('/api/parents')
        .set('Authorization', auth(teacher))
        .send({ fullName: 'Forbidden Parent' }),
    );
    await expectForbidden(
      server().get('/api/teachers').set('Authorization', auth(teacher)),
    );
    await expectForbidden(
      server().get('/api/groups').set('Authorization', auth(teacher)),
    );
    await expectForbidden(
      server().get('/api/enrollments').set('Authorization', auth(teacher)),
    );

    await expectForbidden(
      server().get('/api/lessons').set('Authorization', auth(teacher)),
    );
    await expectForbidden(
      server()
        .post('/api/lessons')
        .set('Authorization', auth(teacher))
        .send({
          enrollmentId,
          teacherId: teacherProfileId,
          startsAt: [tomorrow],
          durationMin: 60,
          priceMinor: 50000,
          currency: 'UAH',
        }),
    );

    await expectForbidden(
      server().get('/api/packages').set('Authorization', auth(teacher)),
    );
    await expectForbidden(
      server().post('/api/packages').set('Authorization', auth(teacher)).send({
        studentId,
        sizingMode: 'FIXED_COUNT',
        lessonsTotal: 2,
        pricePerLessonMinor: 50000,
        currency: 'UAH',
      }),
    );

    await expectForbidden(
      server().get('/api/payments').set('Authorization', auth(teacher)),
    );
    await expectForbidden(
      server().post('/api/payments').set('Authorization', auth(teacher)).send({
        enrollmentId,
        packageId,
        amountMinor: 1000,
        currency: 'UAH',
        method: 'CASH',
      }),
    );

    await expectForbidden(
      server()
        .get('/api/workspaces/current/members')
        .set('Authorization', auth(teacher)),
    );
    await expectForbidden(
      server()
        .patch('/api/workspaces/current/settings')
        .set('Authorization', auth(teacher))
        .send({ defaultCurrency: 'EUR' }),
    );
    await expectForbidden(
      server().get('/api/audit-logs').set('Authorization', auth(teacher)),
    );

    expect(await businessState()).toEqual(before);
  });

  it('keeps only the teacher session context available', async () => {
    const me = await server()
      .get('/api/auth/me')
      .set('Authorization', auth(teacher))
      .expect(200);
    expect(me.body).toMatchObject({
      role: 'TEACHER',
      workspace: { id: workspaceId },
    });

    const current = await server()
      .get('/api/workspaces/current')
      .set('Authorization', auth(teacher))
      .expect(200);
    expect(current.body).toMatchObject({
      role: 'TEACHER',
      workspace: { id: workspaceId },
    });
  });

  it('continues to allow the owner to read the seeded pilot records', async () => {
    await server()
      .get('/api/students')
      .set('Authorization', auth(owner))
      .expect(200);
    await server()
      .get('/api/lessons')
      .query({
        from: '2020-01-01T00:00:00.000Z',
        to: '2030-01-01T00:00:00.000Z',
      })
      .set('Authorization', auth(owner))
      .expect(200);
    await server()
      .get('/api/packages')
      .set('Authorization', auth(owner))
      .expect(200);
    await server()
      .get('/api/payments')
      .set('Authorization', auth(owner))
      .expect(200);
    await server()
      .get('/api/workspaces/current/members')
      .set('Authorization', auth(owner))
      .expect(200);
    await server()
      .get('/api/audit-logs')
      .set('Authorization', auth(owner))
      .expect(200);
  });
});
