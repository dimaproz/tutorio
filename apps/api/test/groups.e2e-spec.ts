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
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

describe('Work Packet 6.3: groups — teacher, schedule, filters, attendance (e2e)', () => {
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
  const put = (path: string) =>
    server().put(`/api${path}`).set('Authorization', bearer());
  const del = (path: string) =>
    server().delete(`/api${path}`).set('Authorization', bearer());

  const groupLessons = async (groupId: string) => {
    const response = await get('/lessons')
      .query({
        from: new Date(Date.now() - 30 * DAY_MS).toISOString(),
        to: new Date(Date.now() + 30 * DAY_MS).toISOString(),
        groupId,
      })
      .expect(200);
    return response.body.items as {
      id: string;
      teacherId: string;
      status: string;
      startsAtUtc: string;
      attendance: { present: number; marked: number } | null;
    }[];
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
        name: 'Owner G',
        workspaceName: `E2E WS G ${runId}`,
        email: emailFor('owner'),
        password: 'correct horse battery staple',
        mode: 'SCHOOL',
      })
      .expect(201);
    owner = register.body.tokens.accessToken;
    workspaceId = register.body.workspace.id;

    const teachers = await get('/teachers').expect(200);
    teacherA = teachers.body.items[0].id;
    const second = await post('/teachers')
      .send({ fullName: 'Teacher B' })
      .expect(201);
    teacherB = second.body.id;

    for (const name of ['Anna', 'Bohdan', 'Clara', 'Denys']) {
      const created = await post('/students')
        .send({ fullName: `${name} G`, timezone: 'Europe/Kyiv' })
        .expect(201);
      students[name] = created.body.id;
    }
  });

  afterAll(async () => {
    await prisma.lessonAttendance.deleteMany({ where: { workspaceId } });
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

  let evening: string;
  let morning: string;

  it('creates a group with its teacher, seats, roster and schedule in one request', async () => {
    const created = await post('/groups')
      .send({
        name: 'B2 evening',
        teacherId: teacherA,
        capacity: 8,
        pricePerLesson: 40000,
        currency: 'UAH',
        students: { studentIds: [students.Anna, students.Bohdan] },
        schedule: { weekdays: EVERY_DAY, localTime: '17:00', durationMin: 60 },
      })
      .expect(201);
    evening = created.body.id;
    expect(created.body).toMatchObject({ teacherId: teacherA, capacity: 8 });

    // Students and a schedule together generate the lessons immediately.
    const lessons = await groupLessons(evening);
    expect(lessons.length).toBeGreaterThan(0);
    expect(lessons.every((lesson) => lesson.teacherId === teacherA)).toBe(true);

    const detail = await get(`/groups/${evening}`).expect(200);
    expect(detail.body).toMatchObject({
      status: 'ACTIVE',
      capacity: 8,
      teacher: { id: teacherA },
      teacherMismatch: false,
      schedules: [{ weekdays: EVERY_DAY, localTime: '17:00', durationMin: 60 }],
      lessonCounts: { completed: 0 },
    });
    expect(detail.body.nextLesson).not.toBeNull();
    expect(detail.body.enrollments).toHaveLength(2);
    expect(detail.body.enrollments[0].student).toHaveProperty(
      'status',
      'ACTIVE',
    );
  });

  it('keeps a schedule on an empty group dormant until the first student joins', async () => {
    const created = await post('/groups')
      .send({ name: 'A2 morning', teacherId: teacherB })
      .expect(201);
    morning = created.body.id;

    await patch(`/groups/${morning}`)
      .send({
        schedule: { weekdays: EVERY_DAY, localTime: '09:00', durationMin: 45 },
      })
      .expect(200);
    expect(await groupLessons(morning)).toHaveLength(0);
    // Dormant, not gone: the page and the list still show the schedule.
    const dormant = await get(`/groups/${morning}`).expect(200);
    expect(dormant.body.schedules).toHaveLength(1);

    // The first student makes the schedule live right away, not overnight.
    await patch(`/groups/${morning}`)
      .send({ students: { studentIds: [students.Clara] } })
      .expect(200);
    expect((await groupLessons(morning)).length).toBeGreaterThan(0);

    // The form never replaces a schedule; the patterns screen does.
    const again = await patch(`/groups/${morning}`)
      .send({
        schedule: { weekdays: [1], localTime: '12:00', durationMin: 45 },
      })
      .expect(409);
    expect(again.body.code).toBe('GROUP_SCHEDULE_EXISTS');
  });

  it('answers every list filter on the server, together', async () => {
    const ids = async (query: Record<string, string | number>) =>
      (
        (await get('/groups').query(query).expect(200)).body.items as {
          id: string;
        }[]
      ).map((row) => row.id);

    expect(await ids({ teacherId: teacherA })).toEqual([evening]);
    expect(await ids({ teacherId: teacherB })).toEqual([morning]);
    expect(await ids({ weekday: 3 })).toEqual(
      expect.arrayContaining([evening, morning]),
    );
    expect(await ids({ payment: 'unpaid' })).toEqual([]);
    // Two relation filters narrow together instead of overwriting each other.
    expect(await ids({ studentId: students.Anna, status: 'EMPTY' })).toEqual(
      [],
    );
    expect(await ids({ studentId: students.Anna, status: 'ACTIVE' })).toEqual([
      evening,
    ]);

    const rows = (
      await get('/groups').query({ sort: 'activeStudentCount', order: 'desc' })
    ).body.items;
    expect(rows[0]).toMatchObject({
      id: evening,
      activeStudentCount: 2,
      capacity: 8,
      teacher: { id: teacherA },
      paymentDue: false,
    });
    expect(rows[0].nextLesson).not.toBeNull();

    const options = await get('/groups/options').expect(200);
    expect(options.body.items.map((row: { name: string }) => row.name)).toEqual(
      ['A2 morning', 'B2 evening'],
    );
  });

  it('summarizes the collection in one read', async () => {
    const summary = await get('/groups/summary').expect(200);
    expect(summary.body).toMatchObject({
      total: 2,
      active: 2,
      empty: 0,
      archived: 0,
      studentsInGroups: 3,
      studioStudents: 4,
      freeSeats: 6,
      unpaidGroups: 0,
    });
    expect(summary.body.lessonsThisWeek).toBeGreaterThan(0);
  });

  it('hands a group to another teacher only when the new calendar is free', async () => {
    await patch(`/groups/${evening}`).send({ teacherId: teacherB }).expect(200);
    expect(
      (await groupLessons(evening)).every(
        (lesson) => lesson.teacherId === teacherB,
      ),
    ).toBe(true);
    const detail = await get(`/groups/${evening}`).expect(200);
    expect(
      detail.body.enrollments.every(
        (row: { teacherId: string }) => row.teacherId === teacherB,
      ),
    ).toBe(true);

    // A third group at the same hour with teacher A cannot move to teacher B.
    const clash = await post('/groups')
      .send({
        name: 'Clash',
        teacherId: teacherA,
        students: { studentIds: [students.Denys] },
        schedule: { weekdays: EVERY_DAY, localTime: '17:00', durationMin: 60 },
      })
      .expect(201);
    const refused = await patch(`/groups/${clash.body.id}`)
      .send({ teacherId: teacherB })
      .expect(409);
    expect(refused.body.code).toBe('SCHEDULE_CONFLICT');
    expect(
      (await groupLessons(clash.body.id)).every(
        (lesson) => lesson.teacherId === teacherA,
      ),
    ).toBe(true);
    await del(`/groups/${clash.body.id}`).expect(204);
  });

  it('marks attendance on held lessons and summarizes it worst first', async () => {
    const enrollments = (await get(`/groups/${evening}`)).body.enrollments as {
      id: string;
      studentId: string;
    }[];
    const anna = enrollments.find((row) => row.studentId === students.Anna)!.id;
    const bohdan = enrollments.find(
      (row) => row.studentId === students.Bohdan,
    )!.id;

    const past = (days: number, status: 'COMPLETED' | 'CANCELLED_CHARGED') =>
      prisma.lesson.create({
        data: {
          workspaceId,
          groupId: evening,
          teacherId: teacherB,
          startsAtUtc: new Date(Date.now() - days * DAY_MS),
          durationMin: 60,
          priceMinor: 40000,
          currency: 'UAH',
          status,
        },
      });
    const l1 = await past(10, 'COMPLETED');
    const cancelled = await past(8, 'CANCELLED_CHARGED');
    const l2 = await past(6, 'COMPLETED');
    const l3 = await past(4, 'COMPLETED');

    for (const [lesson, bohdanMark] of [
      [l1, 'PRESENT'],
      [l2, 'ABSENT'],
      [l3, 'ABSENT'],
    ] as const) {
      await put(`/lessons/${lesson.id}/attendance`)
        .send({
          marks: [
            { enrollmentId: anna, status: 'PRESENT' },
            { enrollmentId: bohdan, status: bohdanMark },
          ],
        })
        .expect(200);
    }

    const sheet = await get(`/lessons/${l3.id}/attendance`).expect(200);
    expect(sheet.body.markable).toBe(true);
    expect(sheet.body.participants).toEqual([
      expect.objectContaining({ enrollmentId: anna, status: 'PRESENT' }),
      expect.objectContaining({ enrollmentId: bohdan, status: 'ABSENT' }),
    ]);

    const refused = await put(`/lessons/${cancelled.id}/attendance`)
      .send({ marks: [{ enrollmentId: anna, status: 'PRESENT' }] })
      .expect(409);
    expect(refused.body.code).toBe('ATTENDANCE_NOT_MARKABLE');

    const summary = await get(`/groups/${evening}/attendance`).expect(200);
    expect(summary.body.stats).toMatchObject({
      lessons: 4,
      held: 3,
      cancelled: 1,
      cancelledCharged: 1,
      misses: 2,
      expected: 6,
    });
    expect(summary.body.rows[0]).toMatchObject({
      enrollmentId: bohdan,
      risk: true,
      trailingMisses: 2,
      cells: ['present', 'cancelled', 'absent', 'absent'],
    });
    expect(summary.body.rows[1]).toMatchObject({ enrollmentId: anna, rate: 1 });

    const withMarks = (await groupLessons(evening)).find(
      (lesson) => lesson.id === l3.id,
    );
    expect(withMarks?.attendance).toEqual({ present: 1, marked: 2 });
  });

  it('keeps a started lesson with marks when the rule changes from it on', async () => {
    const series = await prisma.lessonSeries.findFirstOrThrow({
      where: { workspaceId, groupId: evening, deletedAt: null },
    });
    const enrollments = (await get(`/groups/${evening}`)).body.enrollments as {
      id: string;
    }[];
    const started = await prisma.lesson.create({
      data: {
        workspaceId,
        groupId: evening,
        seriesId: series.id,
        teacherId: series.teacherId,
        startsAtUtc: new Date(Date.now() - 20 * 60 * 1000),
        durationMin: 60,
        priceMinor: 40000,
        currency: 'UAH',
        status: 'SCHEDULED',
      },
    });
    await put(`/lessons/${started.id}/attendance`)
      .send({ marks: [{ enrollmentId: enrollments[0].id, status: 'PRESENT' }] })
      .expect(200);

    const tomorrow = new Date(Date.now() + DAY_MS);
    tomorrow.setUTCHours(18, 0, 0, 0);
    await patch(`/lessons/${started.id}/reschedule`)
      .send({
        startsAtUtc: tomorrow.toISOString(),
        scope: 'this_and_following',
      })
      .expect(200);

    // The held lesson and its marks stay; the new rule starts tomorrow.
    const kept = await prisma.lesson.findUnique({
      where: { id: started.id },
      include: { attendance: true },
    });
    expect(kept?.deletedAt).toBeNull();
    expect(kept?.attendance).toHaveLength(1);
  });

  it('keeps a student-archived membership through a roster save and restores it', async () => {
    await del(`/students/${students.Clara}`).expect(204);
    const emptied = await get(`/groups/${morning}`).expect(200);
    expect(emptied.body.enrollments).toHaveLength(0);
    // The schedule the empty roster suspended is still the group's schedule.
    expect(emptied.body.schedules).toHaveLength(1);

    // Handed to another teacher meanwhile: Clara comes back to that teacher.
    await patch(`/groups/${morning}`).send({ teacherId: teacherA }).expect(200);

    // Saving the (now empty) roster must not destroy Clara's suspended row.
    await patch(`/groups/${morning}`)
      .send({ students: { studentIds: [] } })
      .expect(200);
    await post(`/students/${students.Clara}/restore`).expect(200);

    const restored = await get(`/groups/${morning}`).expect(200);
    expect(
      restored.body.enrollments.map(
        (row: { studentId: string; teacherId: string }) => [
          row.studentId,
          row.teacherId,
        ],
      ),
    ).toEqual([[students.Clara, teacherA]]);
    expect(restored.body.teacherMismatch).toBe(false);
  });

  it('restores a group whose roster emptied while it was archived', async () => {
    const empties = await post('/groups')
      .send({
        name: 'Empties later',
        teacherId: teacherA,
        students: { studentIds: [students.Denys] },
        schedule: { weekdays: EVERY_DAY, localTime: '07:00', durationMin: 30 },
      })
      .expect(201);
    const groupId = empties.body.id;
    await del(`/groups/${groupId}`).expect(204);
    await del(`/students/${students.Denys}`).expect(204);
    // Teacher A's calendar takes the slot while the group is archived.
    const taken = await post('/groups')
      .send({
        name: 'Takes the slot',
        teacherId: teacherA,
        students: { studentIds: [students.Bohdan] },
        schedule: { weekdays: EVERY_DAY, localTime: '07:00', durationMin: 30 },
      })
      .expect(201);

    // Nobody would attend the old slot, so the clash does not block restore.
    await post(`/groups/${groupId}/restore`).expect(200);
    expect(await groupLessons(groupId)).toHaveLength(0);

    await del(`/groups/${taken.body.id}`).expect(204);
    await del(`/groups/${groupId}`).expect(204);
    await post(`/students/${students.Denys}/restore`).expect(200);
  });

  it('archives a group that stays readable and comes back on restore', async () => {
    await del(`/groups/${morning}`).expect(204);
    const archived = await get(`/groups/${morning}`).expect(200);
    expect(archived.body.deletedAt).not.toBeNull();
    expect(archived.body.enrollments).toHaveLength(1);

    const list = await get('/groups').query({ state: 'deleted' }).expect(200);
    expect(list.body.items.map((row: { id: string }) => row.id)).toContain(
      morning,
    );
    expect((await get('/groups/summary')).body.archived).toBeGreaterThanOrEqual(
      1,
    );

    await post(`/groups/${morning}/restore`).expect(200);
    expect((await get(`/groups/${morning}`)).body.deletedAt).toBeNull();
  });
});
