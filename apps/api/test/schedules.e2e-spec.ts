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
const WEEK_MS = 7 * DAY_MS;

/** The next Monday 00:00 UTC strictly after today: week 0 of every schedule. */
const base = (() => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const daysToMonday = (8 - today.getUTCDay()) % 7 || 7;
  return new Date(today.getTime() + daysToMonday * DAY_MS);
})();

/** A UTC instant in week `week` on `weekday` (1 = Monday) at `hour`:`minute`. */
const slotAt = (week: number, weekday: number, hour: number, minute = 0) =>
  new Date(
    base.getTime() +
      week * WEEK_MS +
      (weekday - 1) * DAY_MS +
      (hour * 60 + minute) * 60_000,
  ).toISOString();

interface LessonItem {
  id: string;
  startsAtUtc: string;
  status: string;
  topic: string | null;
}

describe('Work Packet 6.4 phase 2: schedules (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: string;
  let workspaceId: string;
  let teacherA: string;
  let teacherB: string;
  const students: Record<string, string> = {};
  const schedules: Record<string, string> = {};

  const server = () => request(app.getHttpServer());
  const bearer = () => `Bearer ${owner}`;
  const get = (path: string) =>
    server().get(`/api${path}`).set('Authorization', bearer());
  const post = (path: string) =>
    server().post(`/api${path}`).set('Authorization', bearer());
  const patch = (path: string) =>
    server().patch(`/api${path}`).set('Authorization', bearer());

  const createSchedule = (body: Record<string, unknown>, force = false) =>
    post(`/schedules${force ? '?force=true' : ''}`).send({
      durationMin: 60,
      timezone: 'UTC',
      startDate: base.toISOString(),
      ...body,
    });

  /** The live lessons of a student over the next ten weeks, in time order. */
  const lessonsOf = async (studentId: string): Promise<LessonItem[]> => {
    const response = await get('/lessons')
      .query({
        from: base.toISOString(),
        to: new Date(base.getTime() + 10 * WEEK_MS).toISOString(),
        studentId,
      })
      .expect(200);
    return (response.body.items as LessonItem[]).sort((a, b) =>
      a.startsAtUtc.localeCompare(b.startsAtUtc),
    );
  };

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
        name: 'Owner S',
        workspaceName: `E2E WS S ${runId}`,
        email: emailFor('owner'),
        password: 'correct horse battery staple',
        mode: 'SCHOOL',
      })
      .expect(201);
    owner = register.body.tokens.accessToken;
    workspaceId = register.body.workspace.id;

    teacherA = (await get('/teachers').expect(200)).body.items[0].id;
    teacherB = (
      await post('/teachers').send({ fullName: 'Teacher SB' }).expect(201)
    ).body.id;

    for (const name of ['Anna', 'Bohdan', 'Clara', 'Dana']) {
      students[name] = (
        await post('/students')
          .send({ fullName: `${name} S`, timezone: 'UTC' })
          .expect(201)
      ).body.id;
    }
  });

  afterAll(async () => {
    await prisma.lessonAttendance.deleteMany({ where: { workspaceId } });
    await prisma.lessonCharge.deleteMany({ where: { workspaceId } });
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

  it('creates one schedule per student and teacher with the studio horizon (L-20, L-22)', async () => {
    const created = await createSchedule({
      studentId: students.Anna,
      teacherId: teacherA,
      slots: [
        { weekday: 4, localTime: '10:00' },
        { weekday: 2, localTime: '10:00' },
      ],
    }).expect(201);
    schedules.Anna = created.body.id;
    expect(created.body).toMatchObject({
      horizonWeeks: 4,
      state: 'ACTIVE',
      student: { id: students.Anna },
      teacher: { id: teacherA },
      nextChange: null,
      nextLessonAt: slotAt(0, 2, 10),
    });
    expect(
      created.body.slots.map((slot: { weekday: number; localTime: string }) => [
        slot.weekday,
        slot.localTime,
      ]),
    ).toEqual([
      [2, '10:00'],
      [4, '10:00'],
    ]);

    const lessons = await lessonsOf(students.Anna);
    expect(lessons.length).toBeGreaterThanOrEqual(4);
    for (const lesson of lessons) {
      const start = new Date(lesson.startsAtUtc);
      expect([2, 4]).toContain(start.getUTCDay());
      expect(start.getUTCHours()).toBe(10);
      // Generated four weeks ahead of now, not further.
      expect(start.getTime()).toBeLessThan(Date.now() + 4 * WEEK_MS);
    }

    const second = await createSchedule({
      studentId: students.Anna,
      teacherId: teacherA,
      slots: [{ weekday: 5, localTime: '12:00' }],
    }).expect(409);
    expect(second.body).toMatchObject({
      code: 'SCHEDULE_EXISTS',
      details: { scheduleId: schedules.Anna },
    });
    const again = await post('/schedules/preview')
      .send({
        durationMin: 60,
        timezone: 'UTC',
        startDate: base.toISOString(),
        studentId: students.Anna,
        teacherId: teacherA,
        slots: [{ weekday: 5, localTime: '12:00' }],
      })
      .expect(200);
    expect(again.body.existingScheduleId).toBe(schedules.Anna);

    const listed = await get('/schedules')
      .query({ studentId: students.Anna })
      .expect(200);
    expect(listed.body.items.map((item: { id: string }) => item.id)).toEqual([
      schedules.Anna,
    ]);
  });

  it('previews exactly what a time change does and keeps the topic of moved lessons (L-25, L-26)', async () => {
    const before = await lessonsOf(students.Anna);
    const thursday = before.find(
      (lesson) => lesson.startsAtUtc === slotAt(0, 4, 10),
    )!;
    await patch(`/lessons/${thursday.id}`)
      .send({ topic: 'Articles' })
      .expect(200);

    const change = {
      effectiveFrom: base.toISOString(),
      slots: [
        { weekday: 2, localTime: '10:00' },
        { weekday: 4, localTime: '12:00' },
      ],
      durationMin: 60,
    };
    // The horizon ends four weeks from now: a Thursday moved two hours later
    // past that edge is removed, not moved (it depends on the time of day).
    const horizonEnd = Date.now() + 4 * WEEK_MS;
    const preview = await post(`/schedules/${schedules.Anna}/changes/preview`)
      .send(change)
      .expect(200);
    const thursdays = before.filter(
      (lesson) => new Date(lesson.startsAtUtc).getUTCDay() === 4,
    );
    const pastEdge = thursdays.filter(
      (lesson) =>
        new Date(lesson.startsAtUtc).getTime() + 2 * 60 * 60_000 >= horizonEnd,
    );
    expect(preview.body).toMatchObject({
      moved: thursdays.length - pastEdge.length,
      unchanged: before.length - thursdays.length,
      created: 0,
      removed: pastEdge.length,
      kept: 0,
      notesLost: [],
      conflicts: [],
    });

    const applied = await post(`/schedules/${schedules.Anna}/changes`)
      .send(change)
      .expect(201);
    expect(applied.body.summary).toEqual(preview.body);

    const after = await lessonsOf(students.Anna);
    expect(after.map((lesson) => lesson.id).sort()).toEqual(
      before
        .filter((lesson) => !pastEdge.includes(lesson))
        .map((lesson) => lesson.id)
        .sort(),
    );
    expect(after.find((lesson) => lesson.id === thursday.id)).toMatchObject({
      startsAtUtc: slotAt(0, 4, 12),
      topic: 'Articles',
    });
  });

  it('adds a day without touching the lessons already booked (L-23)', async () => {
    const before = await lessonsOf(students.Anna);
    const change = {
      slots: [
        { weekday: 2, localTime: '10:00' },
        { weekday: 4, localTime: '12:00' },
        { weekday: 5, localTime: '10:00' },
      ],
      durationMin: 60,
    };
    const preview = await post(`/schedules/${schedules.Anna}/changes/preview`)
      .send(change)
      .expect(200);
    expect(preview.body).toMatchObject({
      moved: 0,
      unchanged: before.length,
      removed: 0,
    });
    expect(preview.body.created).toBeGreaterThan(0);

    const applied = await post(`/schedules/${schedules.Anna}/changes`)
      .send(change)
      .expect(201);
    expect(applied.body.summary.created).toBe(preview.body.created);

    const after = await lessonsOf(students.Anna);
    expect(after).toHaveLength(before.length + preview.body.created);
    expect(
      after.some((lesson) => lesson.startsAtUtc === slotAt(0, 5, 10)),
    ).toBe(true);
  });

  it('moves one weekday from a lesson on and keeps the other days (L-41)', async () => {
    const before = await lessonsOf(students.Anna);
    const tuesday = before.find(
      (lesson) => lesson.startsAtUtc === slotAt(1, 2, 10),
    )!;

    const moved = await patch(`/lessons/${tuesday.id}/reschedule`)
      .send({ startsAtUtc: slotAt(1, 2, 15), scope: 'this_and_following' })
      .expect(200);
    // The lesson keeps its id: the change moved it instead of replacing it.
    expect(moved.body).toMatchObject({
      id: tuesday.id,
      startsAtUtc: slotAt(1, 2, 15),
    });

    const schedule = await get(`/schedules/${schedules.Anna}`).expect(200);
    expect(schedule.body.nextChange).toEqual({
      effectiveFrom: slotAt(1, 2, 10),
      slots: [
        { weekday: 2, localTime: '15:00' },
        { weekday: 4, localTime: '12:00' },
        { weekday: 5, localTime: '10:00' },
      ],
    });

    const after = await lessonsOf(students.Anna);
    const starts = after.map((lesson) => lesson.startsAtUtc);
    expect(starts).toContain(slotAt(0, 2, 10)); // Before the change.
    expect(starts).toContain(slotAt(2, 2, 15));
    expect(starts).not.toContain(slotAt(2, 2, 10));
    expect(starts).toContain(slotAt(2, 4, 12));
    expect(starts).toContain(slotAt(2, 5, 10));
    expect(after).toHaveLength(before.length);
  });

  it('stops a schedule and keeps the lessons moved by hand (L-24, L-27)', async () => {
    const created = await createSchedule({
      studentId: students.Bohdan,
      teacherId: teacherB,
      slots: [
        { weekday: 1, localTime: '09:00' },
        { weekday: 3, localTime: '09:00' },
      ],
    }).expect(201);
    const scheduleId = created.body.id;
    const lessons = await lessonsOf(students.Bohdan);
    const handMoved = lessons.find(
      (lesson) => lesson.startsAtUtc === slotAt(1, 3, 9),
    )!;
    await patch(`/lessons/${handMoved.id}/reschedule`)
      .send({ startsAtUtc: slotAt(1, 3, 14), scope: 'this' })
      .expect(200);

    const preview = await post(`/schedules/${scheduleId}/stop/preview`)
      .send({})
      .expect(200);
    expect(preview.body).toMatchObject({
      removed: lessons.length - 1,
      kept: 1,
      moved: 0,
      created: 0,
    });

    const stopped = await post(`/schedules/${scheduleId}/stop`)
      .send({})
      .expect(201);
    expect(stopped.body.summary.removed).toBe(preview.body.removed);
    expect(stopped.body.schedule).toMatchObject({
      state: 'ENDED',
      nextLessonAt: expect.any(String),
    });
    expect(
      (await lessonsOf(students.Bohdan)).map((lesson) => lesson.id),
    ).toEqual([handMoved.id]);

    const refused = await post(`/schedules/${scheduleId}/changes`)
      .send({ slots: [{ weekday: 1, localTime: '09:00' }], durationMin: 60 })
      .expect(409);
    expect(refused.body.code).toBe('SCHEDULE_ENDED');

    // The direction is free again for a new schedule.
    await createSchedule({
      studentId: students.Bohdan,
      teacherId: teacherB,
      slots: [{ weekday: 2, localTime: '09:00' }],
    }).expect(201);
  });

  it('generates the extra weeks when the horizon grows', async () => {
    const created = await createSchedule({
      studentId: students.Clara,
      teacherId: teacherA,
      slots: [{ weekday: 1, localTime: '08:00' }],
      horizonWeeks: 2,
    }).expect(201);
    const short = (await lessonsOf(students.Clara)).length;

    const updated = await patch(`/schedules/${created.body.id}`)
      .send({ horizonWeeks: 6 })
      .expect(200);
    expect(updated.body.horizonWeeks).toBe(6);
    expect((await lessonsOf(students.Clara)).length).toBe(short + 4);
  });

  it("refuses a schedule that overlaps the student's other lessons unless forced (L-110, L-111)", async () => {
    await post('/lessons')
      .send({
        studentId: students.Dana,
        teacherId: teacherB,
        durationMin: 60,
        startsAt: [slotAt(0, 3, 16)],
      })
      .expect(201);

    const body = {
      studentId: students.Dana,
      teacherId: teacherA,
      slots: [{ weekday: 3, localTime: '16:00' }],
    };

    // The preview finds the same overlap before anything is written, and
    // opens no direction with the new teacher.
    const preview = await post('/schedules/preview')
      .send({
        durationMin: 60,
        timezone: 'UTC',
        startDate: base.toISOString(),
        ...body,
      })
      .expect(200);
    expect(preview.body.created).toBeGreaterThanOrEqual(3);
    expect(preview.body.firstLessonAt).toBe(slotAt(0, 3, 16));
    expect(preview.body.existingScheduleId).toBeNull();
    expect(preview.body.conflicts[0]).toMatchObject({
      reason: 'STUDENT',
      teacher: { id: teacherB },
    });
    const directions = await get('/enrollments')
      .query({ studentId: students.Dana })
      .expect(200);
    expect(
      directions.body.items.map(
        (item: { teacherId: string }) => item.teacherId,
      ),
    ).toEqual([teacherB]);

    const refused = await createSchedule(body).expect(409);
    expect(refused.body.code).toBe('SCHEDULE_CONFLICT');
    expect(refused.body.details.conflicts[0]).toMatchObject({
      reason: 'STUDENT',
      teacher: { id: teacherB },
    });

    await createSchedule(body, true).expect(201);
  });

  it("gives a group schedule to the group's teacher", async () => {
    const group = await post('/groups')
      .send({
        name: 'Schedules B2',
        teacherId: teacherB,
        pricePerLesson: 20000,
        currency: 'UAH',
      })
      .expect(201);
    const created = await createSchedule({
      groupId: group.body.id,
      slots: [{ weekday: 6, localTime: '11:00' }],
    }).expect(201);
    expect(created.body).toMatchObject({
      group: { id: group.body.id },
      teacher: { id: teacherB },
      student: null,
    });
    const listed = await get('/schedules')
      .query({ teacherId: teacherB })
      .expect(200);
    expect(listed.body.items.map((item: { id: string }) => item.id)).toContain(
      created.body.id,
    );
  });
});
