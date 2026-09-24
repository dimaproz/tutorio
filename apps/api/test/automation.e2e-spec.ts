import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { LessonCompletionService } from '../src/scheduling/lesson-completion.service';

const runId = randomUUID().slice(0, 8);
const emailFor = (label: string) => `e2e-${runId}-${label}@example.com`;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** An instant `hours` from now, rounded to the minute. */
const inHours = (hours: number) => {
  const date = new Date(Date.now() + hours * HOUR_MS);
  date.setUTCSeconds(0, 0);
  return date.toISOString();
};

/** A UTC instant `days` from today at `hour`:00. */
const at = (days: number, hour: number) => {
  const date = new Date(Date.now() + days * DAY_MS);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
};

describe('Work Packet 6.4 phase 4: automation and bulk cancel (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let completion: LessonCompletionService;
  let owner: string;
  let workspaceId: string;
  let teacherA: string;
  let teacherB: string;

  const server = () => request(app.getHttpServer());
  const bearer = () => `Bearer ${owner}`;
  const post = (path: string) =>
    server().post(`/api${path}`).set('Authorization', bearer());
  const put = (path: string) =>
    server().put(`/api${path}`).set('Authorization', bearer());

  const newStudent = async (name: string): Promise<string> =>
    (
      await post('/students')
        .send({ fullName: `${name} ${runId}`, timezone: 'UTC' })
        .expect(201)
    ).body.id;

  /** Books one lesson; conflicts are not what this suite is about. */
  const book = async (body: Record<string, unknown>) =>
    (
      await post('/lessons?force=true')
        .send({
          teacherId: teacherA,
          durationMin: 60,
          priceMinor: 40000,
          currency: 'UAH',
          ...body,
        })
        .expect(201)
    ).body.items[0] as { id: string; enrollmentId: string | null };

  const lessonRow = (id: string) =>
    prisma.lesson.findUniqueOrThrow({
      where: { id },
      select: {
        status: true,
        statusVersion: true,
        completedAt: true,
        cancelledBy: true,
        cancelledReason: true,
      },
    });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    completion = app.get(LessonCompletionService);

    const register = await server()
      .post('/api/auth/register')
      .send({
        name: 'Owner A',
        workspaceName: `E2E WS A ${runId}`,
        email: emailFor('owner'),
        password: 'correct horse battery staple',
        mode: 'SCHOOL',
      })
      .expect(201);
    owner = register.body.tokens.accessToken;
    workspaceId = register.body.workspace.id;
    teacherA = (
      await server()
        .get('/api/teachers')
        .set('Authorization', bearer())
        .expect(200)
    ).body.items[0].id;
    teacherB = (
      await post('/teachers').send({ fullName: 'Teacher AB' }).expect(201)
    ).body.id;
  });

  afterAll(async () => {
    const where = { workspaceId };
    await prisma.lessonCharge.deleteMany({ where });
    await prisma.lessonAttendance.deleteMany({ where });
    await prisma.lesson.deleteMany({ where });
    await prisma.lessonSeries.deleteMany({ where });
    await prisma.schedule.deleteMany({ where });
    await prisma.enrollment.deleteMany({ where });
    await prisma.group.deleteMany({ where });
    await prisma.teacher.deleteMany({ where });
    await prisma.student.deleteMany({ where });
    await prisma.auditLog.deleteMany({ where });
    const users = await prisma.user.findMany({
      where: { email: { startsWith: `e2e-${runId}-` } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.workspaceMember.deleteMany({ where });
    await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('holds an ended lesson on its own and charges it, once (L-50)', async () => {
    const studentId = await newStudent('Ended');
    const ended = await book({ studentId, startsAt: [inHours(-3)] });
    const running = await book({ studentId, startsAt: [inHours(-0.5)] });
    const upcoming = await book({ studentId, startsAt: [inHours(5)] });
    const cancelled = await book({
      studentId,
      startsAt: [inHours(-6)],
      status: 'CANCELLED_UNCHARGED',
      cancelledBy: 'TEACHER',
    });

    await completion.completeDue();

    const held = await lessonRow(ended.id);
    expect(held).toMatchObject({ status: 'COMPLETED', statusVersion: 1 });
    // Held at its end, not at the moment the job happened to run.
    expect(held.completedAt?.toISOString()).toBe(
      new Date(Date.parse(inHours(-3)) + HOUR_MS).toISOString(),
    );
    expect(
      await prisma.lessonCharge.findMany({
        where: { lessonId: ended.id, voidedAt: null },
        select: { source: true, amountMinor: true },
      }),
    ).toEqual([{ source: 'BALANCE', amountMinor: 40000 }]);
    expect((await lessonRow(running.id)).status).toBe('SCHEDULED');
    expect((await lessonRow(upcoming.id)).status).toBe('SCHEDULED');
    expect((await lessonRow(cancelled.id)).status).toBe('CANCELLED_UNCHARGED');

    // A second run changes nothing.
    await completion.completeDue();
    expect((await lessonRow(ended.id)).statusVersion).toBe(1);
    expect(
      await prisma.lessonCharge.count({ where: { lessonId: ended.id } }),
    ).toBe(1);
  });

  it('counts every unmarked group member present when a group lesson is held (L-72)', async () => {
    const [ann, bob, cat] = await Promise.all([
      newStudent('Ann'),
      newStudent('Bob'),
      newStudent('Cat'),
    ]);
    const group = await post('/groups')
      .send({
        name: `Automation B1 ${runId}`,
        teacherId: teacherB,
        pricePerLesson: 30000,
        currency: 'UAH',
        students: { studentIds: [ann, bob, cat] },
      })
      .expect(201);
    const members = await prisma.enrollment.findMany({
      where: { groupId: group.body.id },
      select: { id: true, studentId: true },
    });
    const member = (studentId: string) =>
      members.find((row) => row.studentId === studentId)!.id;

    const lesson = await book({
      groupId: group.body.id,
      teacherId: teacherB,
      priceMinor: 30000,
      startsAt: [inHours(-2)],
    });
    // The tutor marked the one exception before the lesson ended.
    await put(`/lessons/${lesson.id}/attendance`)
      .send({ marks: [{ enrollmentId: member(cat), status: 'EXCUSED' }] })
      .expect(200);

    await completion.completeDue();

    const marks = await prisma.lessonAttendance.findMany({
      where: { lessonId: lesson.id },
      select: { enrollmentId: true, status: true },
    });
    expect(
      Object.fromEntries(marks.map((m) => [m.enrollmentId, m.status])),
    ).toEqual({
      [member(ann)]: 'PRESENT',
      [member(bob)]: 'PRESENT',
      [member(cat)]: 'EXCUSED',
    });
    const charged = await prisma.lessonCharge.findMany({
      where: { lessonId: lesson.id, voidedAt: null },
      select: { enrollmentId: true },
    });
    expect(charged.map((row) => row.enrollmentId).sort()).toEqual(
      [member(ann), member(bob)].sort(),
    );
  });

  it("cancels one teacher's lessons in a period, free, with the reason (L-54)", async () => {
    const studentId = await newStudent('Holiday');
    const inWindow = [
      await book({ studentId, startsAt: [at(10, 8)] }),
      await book({ studentId, startsAt: [at(11, 8)] }),
      await book({ studentId, startsAt: [at(12, 8)] }),
    ];
    const held = await book({
      studentId,
      startsAt: [at(11, 12)],
      status: 'COMPLETED',
    });
    const outside = await book({ studentId, startsAt: [at(20, 8)] });
    const otherTeacher = await book({
      studentId: await newStudent('Other'),
      teacherId: teacherB,
      startsAt: [at(11, 14)],
    });
    const period = { from: at(10, 0), to: at(13, 0) };

    const preview = await post('/lessons/bulk-cancel/preview')
      .send({ ...period, teacherId: teacherA })
      .expect(200);
    expect(preview.body).toMatchObject({
      count: 3,
      byTeacher: [{ teacher: { id: teacherA }, count: 3 }],
      truncated: false,
    });
    expect(preview.body.lessons.map((row: { id: string }) => row.id)).toEqual(
      inWindow.map((lesson) => lesson.id),
    );

    const applied = await post('/lessons/bulk-cancel')
      .send({ ...period, teacherId: teacherA, reason: '  Autumn holiday  ' })
      .expect(201);
    expect(applied.body).toEqual({
      cancelled: 3,
      lessonIds: inWindow.map((lesson) => lesson.id),
    });
    for (const lesson of inWindow) {
      expect(await lessonRow(lesson.id)).toMatchObject({
        status: 'CANCELLED_UNCHARGED',
        cancelledBy: 'TEACHER',
        cancelledReason: 'Autumn holiday',
      });
    }
    expect((await lessonRow(held.id)).status).toBe('COMPLETED');
    expect((await lessonRow(outside.id)).status).toBe('SCHEDULED');
    expect((await lessonRow(otherTeacher.id)).status).toBe('SCHEDULED');

    // The whole studio: only the other teacher's lesson is left to cancel.
    const studio = await post('/lessons/bulk-cancel/preview')
      .send(period)
      .expect(200);
    expect(studio.body.count).toBe(1);
    expect(studio.body.lessons[0].id).toBe(otherTeacher.id);
    expect(
      (
        await post('/lessons/bulk-cancel')
          .send({ ...period, teacherId: teacherA })
          .expect(201)
      ).body.cancelled,
    ).toBe(0);
  });

  it('refuses an unknown teacher and an empty period', async () => {
    const unknown = await post('/lessons/bulk-cancel/preview')
      .send({ from: at(1, 0), to: at(2, 0), teacherId: randomUUID() })
      .expect(404);
    expect(unknown.body.code).toBe('TEACHER_NOT_FOUND');
    await post('/lessons/bulk-cancel')
      .send({ from: at(2, 0), to: at(1, 0) })
      .expect(400);
  });
});
