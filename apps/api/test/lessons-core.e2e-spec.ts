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

/** A UTC instant `days` from today at `hour`:00 — far from other suites. */
const at = (days: number, hour: number) => {
  const date = new Date(Date.now() + days * DAY_MS);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
};

describe('Work Packet 6.4 phase 1: lesson core and conflicts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: string;
  let workspaceId: string;
  let teacherA: string;
  let teacherB: string;
  const students: Record<string, string> = {};

  const server = () => request(app.getHttpServer());
  const bearer = () => `Bearer ${owner}`;
  const get = (path: string) =>
    server().get(`/api${path}`).set('Authorization', bearer());
  const post = (path: string) =>
    server().post(`/api${path}`).set('Authorization', bearer());
  const patch = (path: string) =>
    server().patch(`/api${path}`).set('Authorization', bearer());

  const book = (body: Record<string, unknown>, force = false) =>
    post(`/lessons${force ? '?force=true' : ''}`).send({
      durationMin: 60,
      ...body,
    });

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
        name: 'Owner L',
        workspaceName: `E2E WS L ${runId}`,
        email: emailFor('owner'),
        password: 'correct horse battery staple',
        mode: 'SCHOOL',
      })
      .expect(201);
    owner = register.body.tokens.accessToken;
    workspaceId = register.body.workspace.id;

    teacherA = (await get('/teachers').expect(200)).body.items[0].id;
    teacherB = (
      await post('/teachers').send({ fullName: 'Teacher LB' }).expect(201)
    ).body.id;

    for (const name of ['Anna', 'Bohdan', 'Clara']) {
      students[name] = (
        await post('/students')
          .send({ fullName: `${name} L`, timezone: 'Europe/Kyiv' })
          .expect(201)
      ).body.id;
    }
  });

  afterAll(async () => {
    await prisma.lessonCreditEntry.deleteMany({ where: { workspaceId } });
    await prisma.payment.deleteMany({ where: { workspaceId } });
    await prisma.lessonPackage.deleteMany({ where: { workspaceId } });
    await prisma.lesson.updateMany({
      where: { workspaceId },
      data: { originalLessonId: null },
    });
    await prisma.lesson.deleteMany({ where: { workspaceId } });
    await prisma.lessonSeries.deleteMany({ where: { workspaceId } });
    await prisma.schedule.deleteMany({ where: { workspaceId } });
    await prisma.enrollment.deleteMany({ where: { workspaceId } });
    await prisma.group.deleteMany({ where: { workspaceId } });
    await prisma.teacher.deleteMany({ where: { workspaceId } });
    await prisma.student.deleteMany({ where: { workspaceId } });
    await prisma.auditLog.deleteMany({ where: { workspaceId } });
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

  it('refuses to double-book a student with another teacher unless forced (L-110, L-111)', async () => {
    await book({
      studentId: students.Anna,
      teacherId: teacherA,
      startsAt: [at(3, 6)],
    }).expect(201);

    const refused = await book({
      studentId: students.Anna,
      teacherId: teacherB,
      startsAt: [at(3, 6)],
    }).expect(409);
    expect(refused.body.code).toBe('SCHEDULE_CONFLICT');
    expect(refused.body.details.conflicts).toEqual([
      expect.objectContaining({
        reason: 'STUDENT',
        teacher: expect.objectContaining({ id: teacherA }),
        students: [expect.objectContaining({ id: students.Anna })],
      }),
    ]);

    // The teacher's own clash is reported as such.
    const teacherClash = await book({
      studentId: students.Bohdan,
      teacherId: teacherA,
      startsAt: [at(3, 6)],
    }).expect(409);
    expect(teacherClash.body.details.conflicts[0].reason).toBe('TEACHER');

    await book(
      { studentId: students.Anna, teacherId: teacherB, startsAt: [at(3, 6)] },
      true,
    ).expect(201);
  });

  it('counts a group lesson as the busy time of each active member', async () => {
    const group = await post('/groups')
      .send({
        name: 'Core B1',
        teacherId: teacherB,
        students: { studentIds: [students.Clara] },
      })
      .expect(201);
    await book({
      groupId: group.body.id,
      teacherId: teacherB,
      priceMinor: 30000,
      currency: 'UAH',
      startsAt: [at(4, 7)],
    }).expect(201);

    const refused = await book({
      studentId: students.Clara,
      teacherId: teacherA,
      startsAt: [at(4, 7)],
    }).expect(409);
    expect(refused.body.details.conflicts[0]).toMatchObject({
      reason: 'STUDENT',
      group: { id: group.body.id },
    });
  });

  it('changes the topic, the length and the teacher of one lesson (L-40)', async () => {
    const created = await book({
      studentId: students.Bohdan,
      teacherId: teacherB,
      startsAt: [at(5, 8)],
      topic: '  Past simple  ',
    }).expect(201);
    const lesson = created.body.items[0];
    expect(lesson).toMatchObject({ topic: 'Past simple', kind: 'REGULAR' });

    // Teacher A is busy right after: a longer lesson would overlap.
    await book({
      studentId: students.Anna,
      teacherId: teacherA,
      startsAt: [at(5, 9)],
    }).expect(201);
    const longer = await patch(`/lessons/${lesson.id}`)
      .send({ teacherId: teacherA, durationMin: 90 })
      .expect(409);
    expect(longer.body.details.conflicts[0].reason).toBe('TEACHER');

    const substituted = await patch(`/lessons/${lesson.id}?force=true`)
      .send({ teacherId: teacherA, durationMin: 90, topic: null })
      .expect(200);
    expect(substituted.body).toMatchObject({
      teacherId: teacherA,
      durationMin: 90,
      topic: null,
    });
  });

  it('records a no-show for an individual lesson only (L-52)', async () => {
    const group = await post('/groups')
      .send({ name: 'Core no-show', teacherId: teacherB })
      .expect(201);
    const groupLesson = await book({
      groupId: group.body.id,
      teacherId: teacherB,
      priceMinor: 0,
      currency: 'UAH',
      startsAt: [at(6, 6)],
    }).expect(201);
    const refused = await patch(
      `/lessons/${groupLesson.body.items[0].id}/status`,
    )
      .send({ targetStatus: 'NO_SHOW' })
      .expect(400);
    expect(refused.body.code).toBe('NO_SHOW_INDIVIDUAL_ONLY');
  });

  it('corrects an ended lesson between final statuses, never back to scheduled (L-31, L-53)', async () => {
    const held = await book({
      studentId: students.Bohdan,
      teacherId: teacherB,
      startsAt: [at(-2, 6)],
      status: 'COMPLETED',
    }).expect(201);
    const id = held.body.items[0].id;

    const refused = await patch(`/lessons/${id}/status`)
      .send({ targetStatus: 'SCHEDULED' })
      .expect(409);
    expect(refused.body.code).toBe('LESSON_ENDED');

    const corrected = await patch(`/lessons/${id}/status`)
      .send({ targetStatus: 'NO_SHOW' })
      .expect(200);
    expect(corrected.body.status).toBe('NO_SHOW');
  });

  it('assigns one makeup and charges exactly one of the pair (L-60, L-61)', async () => {
    // Booking first names Clara's teacher, which the package then follows.
    const lesson = (
      await book({
        studentId: students.Clara,
        teacherId: teacherA,
        priceMinor: 40000,
        currency: 'UAH',
        startsAt: [at(8, 6)],
      }).expect(201)
    ).body.items[0];
    const pkg = await post('/packages')
      .send({
        studentId: students.Clara,
        sizingMode: 'FIXED_COUNT',
        lessonsTotal: 4,
        pricePerLessonMinor: 40000,
        currency: 'UAH',
      })
      .expect(201);

    const tooEarly = await post(`/lessons/${lesson.id}/makeup`)
      .send({ startsAtUtc: at(9, 6) })
      .expect(409);
    expect(tooEarly.body.code).toBe('MAKEUP_NOT_ALLOWED');

    await patch(`/lessons/${lesson.id}/status`)
      .send({ targetStatus: 'NO_SHOW' })
      .expect(200);
    const makeup = await post(`/lessons/${lesson.id}/makeup`)
      .send({ startsAtUtc: at(9, 6), topic: 'Catch-up' })
      .expect(201);
    expect(makeup.body).toMatchObject({
      kind: 'MAKEUP',
      originalLessonId: lesson.id,
      teacherId: teacherA,
      durationMin: 60,
      topic: 'Catch-up',
    });
    const second = await post(`/lessons/${lesson.id}/makeup`)
      .send({ startsAtUtc: at(10, 6) })
      .expect(409);
    expect(second.body.code).toBe('MAKEUP_EXISTS');

    const original = await get('/lessons')
      .query({ from: at(8, 0), to: at(8, 23), studentId: students.Clara })
      .expect(200);
    expect(original.body.items[0].makeupLessonId).toBe(makeup.body.id);

    // The no-show was charged, so the makeup is free — and undoing it
    // refunds nothing.
    await patch(`/lessons/${makeup.body.id}/status`)
      .send({ targetStatus: 'COMPLETED' })
      .expect(200);
    await patch(`/lessons/${makeup.body.id}/status`)
      .send({ targetStatus: 'SCHEDULED' })
      .expect(200);
    const entries = await prisma.lessonCreditEntry.findMany({
      where: { packageId: pkg.body.id, type: { not: 'purchase' } },
      select: { lessonId: true, delta: true, type: true },
    });
    expect(entries).toEqual([
      { lessonId: lesson.id, delta: -1, type: 'no_show' },
    ]);
  });
});
