import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PausesService } from '../src/pauses/pauses.service';
import { PrismaService } from '../src/prisma/prisma.service';

const runId = randomUUID().slice(0, 8);
const emailFor = (label: string) => `e2e-${runId}-${label}@example.com`;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** A UTC instant `days` from today at `hour`:00. */
const at = (days: number, hour = 10) => {
  const date = new Date(Date.now() + days * DAY_MS);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
};

/** The next Monday 00:00 UTC strictly after today. */
const nextMonday = (() => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return new Date(
    today.getTime() + ((8 - today.getUTCDay()) % 7 || 7) * DAY_MS,
  );
})();

describe('Work Packet 6.4 phase 6: pauses (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let pauses: PausesService;
  let owner: string;
  let workspaceId: string;
  let teacherId: string;

  const server = () => request(app.getHttpServer());
  const bearer = () => `Bearer ${owner}`;
  const get = (path: string) =>
    server().get(`/api${path}`).set('Authorization', bearer());
  const post = (path: string) =>
    server().post(`/api${path}`).set('Authorization', bearer());
  const patch = (path: string) =>
    server().patch(`/api${path}`).set('Authorization', bearer());

  const newStudent = async (name: string): Promise<string> =>
    (
      await post('/students')
        .send({ fullName: `${name} ${runId}`, timezone: 'UTC' })
        .expect(201)
    ).body.id;

  const book = async (body: Record<string, unknown>) =>
    (
      await post('/lessons?force=true')
        .send({
          teacherId,
          durationMin: 60,
          priceMinor: 40000,
          currency: 'UAH',
          ...body,
        })
        .expect(201)
    ).body.items[0] as { id: string; enrollmentId: string };

  const pause = async (body: Record<string, unknown>) =>
    (await post('/pauses').send(body).expect(201)).body;

  const liveLessonIds = async (ids: string[]) =>
    (
      await prisma.lesson.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true },
      })
    )
      .map((row) => row.id)
      .sort();

  /** Moves a pause's start into the past, as if it began `days` ago. */
  const backdate = (pauseId: string, days: number) =>
    prisma.pause.update({
      where: { id: pauseId },
      data: { startsAt: new Date(Date.now() - days * DAY_MS) },
    });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    pauses = app.get(PausesService);

    const register = await server()
      .post('/api/auth/register')
      .send({
        name: 'Owner F',
        workspaceName: `E2E WS F ${runId}`,
        email: emailFor('owner'),
        password: 'correct horse battery staple',
      })
      .expect(201);
    owner = register.body.tokens.accessToken;
    workspaceId = register.body.workspace.id;
    teacherId = (await get('/teachers').expect(200)).body.items[0].id;
  });

  afterAll(async () => {
    const where = { workspaceId };
    await prisma.pausePackageExtension.deleteMany({ where: { pause: where } });
    await prisma.pause.deleteMany({ where });
    await prisma.lessonCharge.deleteMany({ where });
    await prisma.lessonCreditEntry.deleteMany({ where });
    await prisma.payment.deleteMany({ where });
    await prisma.lessonAttendance.deleteMany({ where });
    await prisma.lesson.deleteMany({ where });
    await prisma.lessonSeries.deleteMany({ where });
    await prisma.schedule.deleteMany({ where });
    await prisma.lessonPackage.deleteMany({ where });
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

  it('takes the lessons in its window out and extends the packages (L-101, L-102)', async () => {
    const studentId = await newStudent('Bounded');
    const inside = [
      await book({ studentId, startsAt: [at(3)] }),
      await book({ studentId, startsAt: [at(5)] }),
    ];
    const after = await book({ studentId, startsAt: [at(12)] });
    const pkg = (
      await post('/packages')
        .send({
          studentId,
          sizingMode: 'FIXED_COUNT',
          lessonsTotal: 8,
          pricePerLessonMinor: 40000,
          currency: 'UAH',
          expiresAt: at(30, 0),
        })
        .expect(201)
    ).body;

    const created = await pause({
      studentId,
      endsAt: at(10, 0),
      reason: 'Holiday',
    });
    const length = Math.round(
      (Date.parse(created.endsAt) - Date.parse(created.startsAt)) / 1000,
    );
    expect(created).toMatchObject({
      studentId,
      enrollmentId: null,
      state: 'ACTIVE',
      reason: 'Holiday',
      removedLessons: 2,
      extensions: [{ packageId: pkg.id, extendedBySeconds: length }],
    });
    expect(
      await liveLessonIds([...inside, after].map((lesson) => lesson.id)),
    ).toEqual([after.id]);
    const extended = await prisma.lessonPackage.findUniqueOrThrow({
      where: { id: pkg.id },
      select: { expiresAt: true },
    });
    expect(extended.expiresAt!.getTime()).toBe(
      Date.parse(at(30, 0)) + length * 1000,
    );
    // Running whole-student pause: the student is on hold (L-104).
    expect((await get(`/students/${studentId}`).expect(200)).body.status).toBe(
      'ON_HOLD',
    );

    const listed = await get(`/pauses?studentId=${studentId}`).expect(200);
    expect(listed.body.items.map((row: { id: string }) => row.id)).toEqual([
      created.id,
    ]);

    // Ending it now brings the lessons back and takes the unused extension
    // back (L-103).
    const ended = await post(`/pauses/${created.id}/end`).expect(200);
    expect(ended.body.state).toBe('ENDED');
    expect(ended.body.extensions[0].extendedBySeconds).toBeLessThan(5);
    expect(
      await liveLessonIds([...inside, after].map((lesson) => lesson.id)),
    ).toEqual([...inside, after].map((lesson) => lesson.id).sort());
    const restored = await prisma.lessonPackage.findUniqueOrThrow({
      where: { id: pkg.id },
      select: { expiresAt: true },
    });
    expect(restored.expiresAt!.getTime() - Date.parse(at(30, 0))).toBeLessThan(
      5000,
    );
    expect((await get(`/students/${studentId}`).expect(200)).body.status).toBe(
      'ACTIVE',
    );
    await post(`/pauses/${created.id}/end`).expect(409, /PAUSE_ENDED/);
  });

  it('skips the window when generating a schedule, and fills it back when cancelled (L-101)', async () => {
    const studentId = await newStudent('Scheduled');
    const windowStart = new Date(nextMonday.getTime() + WEEK_MS);
    const future = await pause({
      studentId,
      startsAt: windowStart.toISOString(),
      endsAt: new Date(windowStart.getTime() + WEEK_MS).toISOString(),
    });
    expect(future.state).toBe('SCHEDULED');
    await post('/schedules')
      .send({
        studentId,
        teacherId,
        slots: [{ weekday: 1, localTime: '10:00' }],
        durationMin: 60,
        timezone: 'UTC',
        startDate: nextMonday.toISOString(),
      })
      .expect(201);

    const mondays = async () =>
      (
        await prisma.lesson.findMany({
          where: {
            workspaceId,
            deletedAt: null,
            enrollment: { studentId },
          },
          select: { startsAtUtc: true },
          orderBy: { startsAtUtc: 'asc' },
        })
      ).map((row) => row.startsAtUtc.getTime());
    const pausedMonday = windowStart.getTime() + 10 * 60 * 60 * 1000;
    const generated = await mondays();
    expect(generated).toContain(nextMonday.getTime() + 10 * 60 * 60 * 1000);
    expect(generated).toContain(pausedMonday + WEEK_MS);
    expect(generated).not.toContain(pausedMonday);

    // Cancelling a pause that has not begun brings its Monday back.
    const cancelled = await post(`/pauses/${future.id}/end`).expect(200);
    expect(cancelled.body.state).toBe('CANCELLED');
    expect(await mondays()).toContain(pausedMonday);
  });

  it('keeps a paused member out of group lessons and their charges (L-73, R12.5)', async () => {
    const [ann, bob] = await Promise.all([
      newStudent('Group Ann'),
      newStudent('Group Bob'),
    ]);
    const group = await post('/groups')
      .send({
        name: `Pauses G ${runId}`,
        teacherId,
        pricePerLesson: 30000,
        currency: 'UAH',
        students: { studentIds: [ann, bob] },
      })
      .expect(201);
    const members = await prisma.enrollment.findMany({
      where: { groupId: group.body.id },
      select: { id: true, studentId: true },
    });
    const member = (studentId: string) =>
      members.find((row) => row.studentId === studentId)!.id;

    const paused = await pause({
      studentId: bob,
      enrollmentId: member(bob),
      endsAt: at(10, 0),
    });
    expect(paused.enrollmentId).toBe(member(bob));
    // Only this direction is paused: Bob stays active.
    expect((await get(`/students/${bob}`).expect(200)).body.status).toBe(
      'ACTIVE',
    );
    await backdate(paused.id, 3);

    const lesson = await book({
      groupId: group.body.id,
      priceMinor: 30000,
      startsAt: [at(-1, 16)],
      status: 'COMPLETED',
    });
    const marks = await prisma.lessonAttendance.findMany({
      where: { lessonId: lesson.id },
      select: { enrollmentId: true },
    });
    expect(marks.map((mark) => mark.enrollmentId)).toEqual([member(ann)]);
    const charges = await prisma.lessonCharge.findMany({
      where: { lessonId: lesson.id, voidedAt: null },
      select: { enrollmentId: true },
    });
    expect(charges.map((charge) => charge.enrollmentId)).toEqual([member(ann)]);
  });

  it('extends packages by the length an open pause actually ran (L-102)', async () => {
    const studentId = await newStudent('Open');
    const pkg = (
      await post('/packages')
        .send({
          studentId,
          sizingMode: 'FIXED_COUNT',
          lessonsTotal: 4,
          pricePerLessonMinor: 40000,
          currency: 'UAH',
          purchasedAt: at(-10),
          expiresAt: at(20, 0),
        })
        .expect(201)
    ).body;
    const open = await pause({ studentId });
    expect(open).toMatchObject({ endsAt: null, extensions: [] });
    await backdate(open.id, 3);

    const ended = (await post(`/pauses/${open.id}/end`).expect(200)).body;
    const ran = Math.round(
      (Date.parse(ended.endedAt) - Date.parse(ended.startsAt)) / 1000,
    );
    expect(ran).toBeGreaterThanOrEqual(3 * 86_400);
    expect(ended.extensions).toEqual([
      { packageId: pkg.id, extendedBySeconds: ran },
    ]);
    const extended = await prisma.lessonPackage.findUniqueOrThrow({
      where: { id: pkg.id },
      select: { expiresAt: true },
    });
    expect(extended.expiresAt!.getTime()).toBe(
      Date.parse(at(20, 0)) + ran * 1000,
    );
  });

  it('refuses overlapping pauses for the same lessons (L-100)', async () => {
    const studentId = await newStudent('Overlap');
    const first = await book({ studentId, startsAt: [at(2)] });
    const group = await post('/groups')
      .send({
        name: `Pauses O ${runId}`,
        teacherId,
        pricePerLesson: 30000,
        currency: 'UAH',
        students: { studentIds: [studentId] },
      })
      .expect(201);
    const second = await prisma.enrollment.findFirstOrThrow({
      where: { groupId: group.body.id, studentId },
      select: { id: true },
    });
    await pause({
      studentId,
      enrollmentId: first.enrollmentId,
      startsAt: at(5, 0),
      endsAt: at(9, 0),
    });
    const same = await post('/pauses')
      .send({
        studentId,
        enrollmentId: first.enrollmentId,
        startsAt: at(8, 0),
        endsAt: at(12, 0),
      })
      .expect(409);
    expect(same.body.code).toBe('PAUSE_OVERLAP');
    await post('/pauses')
      .send({ studentId, startsAt: at(6, 0), endsAt: at(7, 0) })
      .expect(409, /PAUSE_OVERLAP/);
    // Another direction, or back to back, is fine.
    await pause({
      studentId,
      enrollmentId: second.id,
      startsAt: at(5, 0),
      endsAt: at(9, 0),
    });
    await pause({
      studentId,
      enrollmentId: first.enrollmentId,
      startsAt: at(9, 0),
      endsAt: at(11, 0),
    });
  });

  it('puts a student on hold through a pause and back (L-104)', async () => {
    const studentId = await newStudent('Hold');
    const lesson = await book({ studentId, startsAt: [at(4, 7)] });

    await patch(`/students/${studentId}`)
      .send({ status: 'ON_HOLD' })
      .expect(200);
    const running = (await get(`/pauses?studentId=${studentId}`).expect(200))
      .body.items;
    expect(running).toHaveLength(1);
    expect(running[0]).toMatchObject({
      enrollmentId: null,
      endsAt: null,
      state: 'ACTIVE',
      removedLessons: 1,
    });
    expect(await liveLessonIds([lesson.id])).toEqual([]);

    await patch(`/students/${studentId}`)
      .send({ status: 'ACTIVE' })
      .expect(200);
    expect(await liveLessonIds([lesson.id])).toEqual([lesson.id]);
    const all = (
      await get(`/pauses?studentId=${studentId}&state=all`).expect(200)
    ).body.items;
    expect(all[0].state).toBe('ENDED');
    expect(
      (await get(`/pauses?studentId=${studentId}`).expect(200)).body.items,
    ).toEqual([]);
  });

  it('syncs the on-hold status when a scheduled pause begins (L-103)', async () => {
    const studentId = await newStudent('Cron');
    const later = await pause({
      studentId,
      startsAt: at(2, 0),
      endsAt: at(6, 0),
    });
    expect((await get(`/students/${studentId}`).expect(200)).body.status).toBe(
      'ACTIVE',
    );
    await backdate(later.id, 0);
    await pauses.run();
    expect((await get(`/students/${studentId}`).expect(200)).body.status).toBe(
      'ON_HOLD',
    );
  });
});
