import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const runId = randomUUID().slice(0, 8);
const emailFor = (label: string) => `e2e-${runId}-${label}@example.com`;

// A whole-day window starting "tomorrow" so lessons are unambiguously in the
// future and inside the 12-week materialization horizon.
const DAY_MS = 24 * 60 * 60 * 1000;

describe('Stage 3: scheduling — series, lessons, reschedule, cancel (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let owner: string;
  let workspaceId: string;
  let ownerMemberId: string;
  let ownerTeacherId: string;
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
        name: 'Owner S3',
        workspaceName: `E2E WS S3 ${runId}`,
        email: emailFor('owner'),
        password: 'correct horse battery staple',
      })
      .expect(201);
    owner = register.body.tokens.accessToken;
    workspaceId = register.body.workspace.id;

    const members = await server()
      .get('/api/workspaces/current/members')
      .set('Authorization', auth(owner))
      .expect(200);
    ownerMemberId = members.body.items[0].id;

    const teachers = await server()
      .get('/api/teachers')
      .set('Authorization', auth(owner))
      .expect(200);
    ownerTeacherId = teachers.body.items[0].id;

    const student = await server()
      .post('/api/students')
      .set('Authorization', auth(owner))
      .send({ fullName: 'Sched Student', timezone: 'Europe/Kyiv' })
      .expect(201);

    const enrollment = await server()
      .post('/api/enrollments')
      .set('Authorization', auth(owner))
      .send({
        studentId: student.body.id,
        teacherId: ownerTeacherId,
        priceMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);
    enrollmentId = enrollment.body.id;
  });

  afterAll(async () => {
    await prisma.lesson.deleteMany({ where: { workspaceId } });
    await prisma.lessonSeries.deleteMany({ where: { workspaceId } });
    await prisma.enrollment.deleteMany({ where: { workspaceId } });
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

  it('materializes lessons from a weekly series, then reschedules and cancels one', async () => {
    const startDate = new Date(Date.now() + DAY_MS);
    // Cover the next four weeks so at least one weekday occurrence is generated.
    const from = new Date(Date.now()).toISOString();
    const to = new Date(Date.now() + 28 * DAY_MS).toISOString();

    // Recur on every weekday so a lesson is guaranteed inside the window.
    const series = await server()
      .post('/api/lesson-series')
      .set('Authorization', auth(owner))
      .send({
        enrollmentId,
        teacherId: ownerTeacherId,
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        localTime: '10:00',
        timezone: 'Europe/Kyiv',
        durationMin: 60,
        priceMinor: 50000,
        currency: 'UAH',
        startDate: startDate.toISOString(),
      })
      .expect(201);
    expect(series.body.weekdays).toHaveLength(7);

    const listed = await server()
      .get('/api/lessons')
      .query({ from, to })
      .set('Authorization', auth(owner))
      .expect(200);
    expect(listed.body.items.length).toBeGreaterThan(0);
    const lesson = listed.body.items[0];
    expect(lesson.status).toBe('SCHEDULED');
    expect(lesson.seriesId).toBe(series.body.id);
    expect(lesson.isDetached).toBe(false);

    // Reschedule this single occurrence — it detaches from the series.
    const newStart = new Date(new Date(lesson.startsAtUtc).getTime() + 90 * 60_000);
    const moved = await server()
      .patch(`/api/lessons/${lesson.id}/reschedule`)
      .set('Authorization', auth(owner))
      .send({ startsAtUtc: newStart.toISOString(), scope: 'this' })
      .expect(200);
    expect(moved.body.isDetached).toBe(true);
    expect(new Date(moved.body.startsAtUtc).getTime()).toBe(newStart.getTime());

    // Cancel it with a charge, attributed to the student.
    const cancelled = await server()
      .patch(`/api/lessons/${lesson.id}/status`)
      .set('Authorization', auth(owner))
      .send({
        targetStatus: 'CANCELLED_CHARGED',
        cancelledBy: 'STUDENT',
        cancelledReason: 'Late notice',
      })
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED_CHARGED');
    expect(cancelled.body.cancelledBy).toBe('STUDENT');
    expect(cancelled.body.cancelledAt).not.toBeNull();

    // An illegal transition (completed → charged) is rejected.
    await server()
      .patch(`/api/lessons/${lesson.id}/status`)
      .set('Authorization', auth(owner))
      .send({ targetStatus: 'COMPLETED' })
      .expect(409);
  });

  it('rejects a double-booking with 409 unless forced', async () => {
    const start = new Date(Date.now() + 3 * DAY_MS);
    start.setUTCHours(8, 0, 0, 0);

    await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        enrollmentId,
        teacherId: ownerTeacherId,
        startsAt: [start.toISOString()],
        durationMin: 60,
        priceMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);

    // Overlapping the same teacher → conflict.
    const conflict = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        enrollmentId,
        teacherId: ownerTeacherId,
        startsAt: [new Date(start.getTime() + 30 * 60_000).toISOString()],
        durationMin: 60,
        priceMinor: 50000,
        currency: 'UAH',
      })
      .expect(409);
    expect(conflict.body.code).toBe('SCHEDULE_CONFLICT');

    // force=true books it anyway.
    await server()
      .post('/api/lessons')
      .query({ force: true })
      .set('Authorization', auth(owner))
      .send({
        enrollmentId,
        teacherId: ownerTeacherId,
        startsAt: [new Date(start.getTime() + 30 * 60_000).toISOString()],
        durationMin: 60,
        priceMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);
  });
});
