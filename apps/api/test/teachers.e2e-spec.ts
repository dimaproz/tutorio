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
const slots = (localTime: string) =>
  EVERY_DAY.map((weekday) => ({ weekday, localTime }));

describe('Work Packet 6.2: teachers — list figures, profile reads, archive with a hand-over (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: string;
  let workspaceId: string;
  let me: string;
  let iryna: string;
  let dmytro: string;
  let kids: string;
  const students: Record<string, string> = {};
  // Tomorrow at midnight UTC: every generated lesson is in the future.
  const start = new Date(Math.ceil(Date.now() / DAY_MS) * DAY_MS + DAY_MS);

  const server = () => request(app.getHttpServer());
  const bearer = () => `Bearer ${owner}`;
  const get = (path: string) =>
    server().get(`/api${path}`).set('Authorization', bearer());
  const post = (path: string) =>
    server().post(`/api${path}`).set('Authorization', bearer());
  const patch = (path: string) =>
    server().patch(`/api${path}`).set('Authorization', bearer());

  const lessonsOf = async (query: Record<string, string>) => {
    const response = await get('/lessons')
      .query({
        from: start.toISOString(),
        to: new Date(start.getTime() + 21 * DAY_MS).toISOString(),
        ...query,
      })
      .expect(200);
    return response.body.items as { id: string; teacherId: string }[];
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
        name: 'Olena T',
        workspaceName: `E2E WS T ${runId}`,
        email: emailFor('owner'),
        password: 'correct horse battery staple',
        mode: 'SCHOOL',
      })
      .expect(201);
    owner = register.body.tokens.accessToken;
    workspaceId = register.body.workspace.id;
    me = (await get('/teachers').expect(200)).body.items[0].id;

    iryna = (
      await post('/teachers')
        .send({ fullName: 'Iryna T', subjects: ['English', 'Kids', 'english'] })
        .expect(201)
    ).body.id;
    dmytro = (
      await post('/teachers')
        .send({ fullName: 'Dmytro T', subjects: ['English', 'IELTS'] })
        .expect(201)
    ).body.id;
    for (const name of ['Anna', 'Bohdan', 'Clara']) {
      students[name] = (
        await post('/students')
          .send({ fullName: `${name} T`, timezone: 'Europe/Kyiv' })
          .expect(201)
      ).body.id;
    }

    // Iryna: Anna one to one at 10:00 and the Kids group at 15:00.
    await post('/schedules')
      .send({
        studentId: students.Anna,
        teacherId: iryna,
        slots: slots('10:00'),
        durationMin: 60,
        timezone: 'UTC',
        startDate: start.toISOString(),
        priceMinor: 40000,
        currency: 'UAH',
      })
      .expect(201);
    kids = (
      await post('/groups')
        .send({
          name: 'Kids T',
          teacherId: iryna,
          pricePerLesson: 30000,
          currency: 'UAH',
          students: { studentIds: [students.Bohdan, students.Clara] },
        })
        .expect(201)
    ).body.id;
    await post('/schedules')
      .send({
        groupId: kids,
        slots: slots('15:00'),
        durationMin: 60,
        timezone: 'UTC',
        startDate: start.toISOString(),
      })
      .expect(201);
    // Clara studies one to one with both: her direction with Iryna stays.
    await post('/schedules')
      .send({
        studentId: students.Clara,
        teacherId: iryna,
        slots: slots('12:00'),
        durationMin: 60,
        timezone: 'UTC',
        startDate: start.toISOString(),
        priceMinor: 40000,
        currency: 'UAH',
      })
      .expect(201);
    // Dmytro teaches Clara at Iryna's 10:00: the hand-over clashes.
    await post('/schedules')
      .send({
        studentId: students.Clara,
        teacherId: dmytro,
        slots: slots('10:00'),
        durationMin: 60,
        timezone: 'UTC',
        startDate: start.toISOString(),
        priceMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);
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

  it('lists the owner first with each teacher’s students, groups and week', async () => {
    const list = await get('/teachers').expect(200);
    expect(list.body.items.map((item: { id: string }) => item.id)).toEqual([
      me,
      dmytro,
      iryna,
    ]);
    expect(list.body.counts).toEqual({ active: 3, archived: 0, all: 3 });
    expect(list.body.me).toMatchObject({ id: me, isMe: true });

    const irynaItem = list.body.items[2];
    expect(irynaItem).toMatchObject({
      subjects: ['English', 'Kids'],
      studentCount: 3,
      groupCount: 1,
      archivedAt: null,
    });
    const days = irynaItem.week.days as number[];
    expect(days).toHaveLength(7);
    expect(days.reduce((sum, day) => sum + day, 0)).toBe(
      irynaItem.week.lessonCount,
    );

    const bySubject = await get('/teachers')
      .query({ subject: 'kids' })
      .expect(200);
    expect(bySubject.body.items.map((item: { id: string }) => item.id)).toEqual(
      [iryna],
    );
    const bySearch = await get('/teachers')
      .query({ search: 'ielts' })
      .expect(200);
    expect(bySearch.body.items.map((item: { id: string }) => item.id)).toEqual([
      dmytro,
    ]);
  });

  it('keeps the subjects on an unrelated edit and clears them on request', async () => {
    const renamed = await patch(`/teachers/${dmytro}`)
      .send({ fullName: 'Dmytro Tutor T' })
      .expect(200);
    expect(renamed.body.subjects).toEqual(['English', 'IELTS']);
    const cleared = await patch(`/teachers/${dmytro}`)
      .send({ subjects: [] })
      .expect(200);
    expect(cleared.body.subjects).toEqual([]);
  });

  it('reads the profile metrics and the students with how they study', async () => {
    const summary = await get(`/teachers/${iryna}/summary`).expect(200);
    expect(summary.body).toMatchObject({
      students: { total: 3, individual: 2, inGroups: 2 },
      groupCount: 1,
      month: { held: 0, noShows: 0, cancelledByStudents: 0 },
    });
    expect(summary.body.weeks).toHaveLength(6);

    const page = await get(`/teachers/${iryna}/students`)
      .query({ pageSize: 2 })
      .expect(200);
    expect(page.body.total).toBe(3);
    expect(page.body.items).toEqual([
      expect.objectContaining({
        id: students.Anna,
        individual: true,
        groups: [],
      }),
      expect.objectContaining({
        id: students.Bohdan,
        individual: false,
        groups: [{ id: kids, name: 'Kids T' }],
      }),
    ]);
  });

  it('previews an archive with its hand-over and the new teacher’s overlaps', async () => {
    const plain = await post(`/teachers/${iryna}/archive/preview`)
      .send({})
      .expect(200);
    expect(plain.body).toMatchObject({
      scheduleCount: 3,
      studentCount: 3,
      groups: [{ id: kids, name: 'Kids T' }],
      directionCount: 2,
      keptDirectionCount: 0,
      conflicts: [],
    });
    expect(plain.body.futureLessonCount).toBeGreaterThan(0);

    const handed = await post(`/teachers/${iryna}/archive/preview`)
      .send({ transferTo: dmytro })
      .expect(200);
    expect(handed.body).toMatchObject({
      directionCount: 2,
      keptDirectionCount: 1,
    });
    expect(handed.body.conflicts.length).toBeGreaterThan(0);
    expect(
      handed.body.conflicts.every(
        (conflict: { reason: string; teacher: { id: string } }) =>
          conflict.reason === 'TEACHER' && conflict.teacher.id === dmytro,
      ),
    ).toBe(true);

    await post(`/teachers/${iryna}/archive/preview`)
      .send({ transferTo: iryna })
      .expect(404);
  });

  it('archives with a hand-over only when the clash is accepted, then restores', async () => {
    const refused = await post(`/teachers/${iryna}/archive`)
      .send({ transferTo: dmytro })
      .expect(409);
    expect(refused.body.code).toBe('SCHEDULE_CONFLICT');
    expect((await lessonsOf({ teacherId: iryna })).length).toBeGreaterThan(0);

    const archived = await post(`/teachers/${iryna}/archive?force=true`)
      .send({ transferTo: dmytro })
      .expect(200);
    expect(archived.body).toMatchObject({ status: 'ARCHIVED' });
    expect(archived.body.archivedAt).not.toBeNull();

    expect(await lessonsOf({ teacherId: iryna })).toEqual([]);
    const group = await get(`/groups/${kids}`).expect(200);
    expect(group.body.teacherId).toBe(dmytro);
    const schedules = await get('/schedules')
      .query({ teacherId: dmytro })
      .expect(200);
    expect(schedules.body.total).toBe(4);
    // Anna's direction moved with its billing; Clara already had one with Dmytro.
    const directions = await prisma.enrollment.findMany({
      where: { workspaceId, groupId: null, deletedAt: null },
      select: { studentId: true, teacherId: true },
    });
    expect(directions).toEqual(
      expect.arrayContaining([
        { studentId: students.Anna, teacherId: dmytro },
        { studentId: students.Clara, teacherId: iryna },
        { studentId: students.Clara, teacherId: dmytro },
      ]),
    );
    expect(directions).toHaveLength(3);
    const list = await get('/teachers').expect(200);
    expect(list.body.counts).toEqual({ active: 2, archived: 1, all: 3 });

    const restored = await post(`/teachers/${iryna}/restore`).expect(201);
    expect(restored.body).toMatchObject({ status: 'ACTIVE', archivedAt: null });

    // The log reads «Архівовано» with the hand-over, then «Відновлено» (S10).
    const log = await get('/audit-logs')
      .query({ entity: 'TEACHER', entityId: iryna })
      .expect(200);
    const entries = log.body.items as {
      action: string;
      changes: { fields: Record<string, { after: unknown }> } | null;
      record: { label: string };
    }[];
    expect(entries.map((entry) => entry.action).slice(0, 2)).toEqual([
      'RESTORE',
      'DELETE',
    ]);
    expect(entries[1].changes?.fields.transferredTo.after).toBe(dmytro);
    expect(entries[1].record.label).toBe('Iryna T');
    expect(log.body.names[dmytro]).toEqual(expect.any(String));
  });

  it('turns the owner’s own teaching off without listing her as archived', async () => {
    await post(`/teachers/${me}/archive`)
      .send({ transferTo: null })
      .expect(200);

    const active = await get('/teachers').expect(200);
    expect(
      active.body.items.map((item: { id: string }) => item.id),
    ).not.toContain(me);
    expect(active.body.me).toMatchObject({ id: me, status: 'ARCHIVED' });
    expect(active.body.counts).toEqual({ active: 2, archived: 0, all: 2 });
    const archived = await get('/teachers')
      .query({ status: 'ARCHIVED' })
      .expect(200);
    expect(archived.body.items).toEqual([]);

    await post(`/teachers/${me}/restore`).expect(201);
    const back = await get('/teachers').expect(200);
    expect(back.body.items[0]).toMatchObject({ id: me, status: 'ACTIVE' });
  });

  it('keeps a solo tutor teaching', async () => {
    const settings = (mode: 'SOLO' | 'SCHOOL') =>
      patch('/workspaces/current/settings').send({ mode });
    await post(`/teachers/${me}/archive`).send({}).expect(200);
    await post(`/teachers/${iryna}/archive`).send({}).expect(200);
    await post(`/teachers/${dmytro}/archive`).send({}).expect(200);

    // Nobody else teaches, but neither does the owner: no tutor mode yet.
    const refused = await settings('SOLO').expect(409);
    expect(refused.body.code).toBe('SOLO_OWNER_MUST_TEACH');

    await post(`/teachers/${me}/restore`).expect(201);
    await settings('SOLO').expect(200);
    const archive = await post(`/teachers/${me}/archive`).send({}).expect(409);
    expect(archive.body.code).toBe('SOLO_OWNER_MUST_TEACH');
    const edit = await patch(`/teachers/${me}`)
      .send({ status: 'ARCHIVED' })
      .expect(409);
    expect(edit.body.code).toBe('SOLO_OWNER_MUST_TEACH');
    await settings('SCHOOL').expect(200);
  });
});
