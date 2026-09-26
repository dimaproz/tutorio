import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const runId = randomUUID().slice(0, 8);
const emailFor = (label: string) => `e2e-${runId}-${label}@example.com`;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** An instant `hours` from now, whole minutes. */
const inHours = (hours: number) => {
  const date = new Date(Date.now() + hours * HOUR_MS);
  date.setUTCSeconds(0, 0);
  return date.toISOString();
};

type Category = {
  kind: string;
  count: number;
  items: {
    student: { id: string } | null;
    group: { id: string } | null;
    lesson: { id: string } | null;
    debt: { amountMinor: number; lessons: number } | null;
    package: { id: string; paidMinor: number; totalMinor: number } | null;
    credits: { left: number; warning: string } | null;
    pause: { reason: string } | null;
  }[];
  names: string[];
};

describe('S11: the Today dashboard reads (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
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

  const sell = async (studentId: string, body: Record<string, unknown> = {}) =>
    (
      await post('/packages')
        .send({
          studentId,
          sizingMode: 'FIXED_COUNT',
          lessonsTotal: 4,
          pricePerLessonMinor: 40000,
          currency: 'UAH',
          ...body,
        })
        .expect(201)
    ).body as { id: string; enrollmentId: string };

  const attention = async (query = '') => {
    const body = (await get(`/dashboard/attention${query}`).expect(200))
      .body as { total: number; categories: Category[] };
    const of = (kind: string) =>
      body.categories.find((category) => category.kind === kind)!;
    return { ...body, of };
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
        name: 'Owner D',
        workspaceName: `E2E WS D ${runId}`,
        email: emailFor('owner'),
        password: 'correct horse battery staple',
      })
      .expect(201);
    owner = register.body.tokens.accessToken;
    workspaceId = register.body.workspace.id;
    teacherId = (await get('/teachers').expect(200)).body.items[0].id;
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { defaultCurrency: 'UAH', timezone: 'UTC' },
    });
  });

  afterAll(async () => {
    const where = { workspaceId };
    await prisma.lessonCharge.deleteMany({ where });
    await prisma.lessonCreditEntry.deleteMany({ where });
    await prisma.payment.deleteMany({ where });
    await prisma.lessonAttendance.deleteMany({ where });
    await prisma.pausePackageExtension.deleteMany({
      where: { pause: { workspaceId } },
    });
    await prisma.pause.deleteMany({ where });
    await prisma.lesson.updateMany({ where, data: { originalLessonId: null } });
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

  it('starts empty: the checklist, no exceptions, zero money in the studio currency', async () => {
    expect((await get('/dashboard/setup').expect(200)).body).toEqual({
      teacher: null,
      student: false,
      schedule: false,
      sale: false,
    });
    const empty = await attention();
    expect(empty.total).toBe(0);
    expect(empty.categories.map((category) => category.kind)).toEqual([
      'attendance',
      'makeups',
      'debtors',
      'unpaidPackages',
      'endingPackages',
      'expiringPackages',
      'pauses',
    ]);
    expect((await get('/dashboard/money').expect(200)).body.currencies).toEqual(
      [
        {
          currency: 'UAH',
          receivedMonthMinor: 0,
          receivedTodayMinor: 0,
          debtMinor: 0,
          debtors: 0,
          dueMinor: 0,
          duePackages: 0,
        },
      ],
    );
  });

  it('lists every kind of exception and sums the money per currency', async () => {
    // Debt: two pay-per-lesson lessons held, one paid today.
    const payer = await newStudent('Payer');
    const held = await book({
      studentId: payer,
      startsAt: [inHours(-50)],
      status: 'COMPLETED',
    });
    await book({
      studentId: payer,
      startsAt: [inHours(-26)],
      status: 'COMPLETED',
    });
    await post('/payments')
      .send({
        enrollmentId: held.enrollmentId,
        amountMinor: 40000,
        currency: 'UAH',
      })
      .expect(201);

    // A no-show needs a makeup.
    const missed = await book({
      studentId: payer,
      startsAt: [inHours(-6)],
      status: 'COMPLETED',
    });
    await patch(`/lessons/${missed.id}/status`)
      .send({ targetStatus: 'NO_SHOW' })
      .expect(200);

    // A package sold and not paid, with one credit left and a lesson this
    // week: it runs out (L-82) and a renewal is expected.
    const buyer = await newStudent('Buyer');
    const sold = await sell(buyer, { lessonsTotal: 2 });
    await book({
      studentId: buyer,
      startsAt: [inHours(-30)],
      status: 'COMPLETED',
    });
    await book({ studentId: buyer, startsAt: [inHours(30)] });

    // A package paid in full whose window closes in two days with credits left.
    const leaving = await newStudent('Leaving');
    const expiring = await sell(leaving, {
      lessonsTotal: 3,
      pricePerLessonMinor: 10000,
      expiresAt: new Date(Date.now() + 2 * DAY_MS).toISOString(),
    });
    await post('/payments')
      .send({
        enrollmentId: expiring.enrollmentId,
        packageId: expiring.id,
        amountMinor: 30000,
        currency: 'UAH',
      })
      .expect(201);

    // A group lesson held with nobody's marks.
    const member = await newStudent('Member');
    const group = (
      await post('/groups')
        .send({
          name: `Beginners ${runId}`,
          teacherId,
          pricePerLesson: 30000,
          currency: 'UAH',
          students: { studentIds: [member] },
        })
        .expect(201)
    ).body.id as string;
    const groupLesson = await book({
      groupId: group,
      startsAt: [inHours(-4)],
      status: 'COMPLETED',
    });

    // A pause that ends tomorrow.
    const away = await newStudent('Away');
    await prisma.pause.create({
      data: {
        workspaceId,
        studentId: away,
        startsAt: new Date(Date.now() - 5 * DAY_MS),
        endsAt: new Date(Date.now() + DAY_MS),
        suspensionToken: randomUUID(),
      },
    });

    const listed = await attention();
    expect(listed.of('attendance')).toMatchObject({
      count: 1,
      items: [{ lesson: { id: groupLesson.id }, group: { id: group } }],
      names: [`Beginners ${runId}`],
    });
    expect(listed.of('makeups')).toMatchObject({
      count: 1,
      items: [{ lesson: { id: missed.id }, student: { id: payer } }],
    });
    // The no-show is charged too: two lessons of 400 ₴ owed; the group
    // member pays per lesson and owes the held group lesson.
    expect(listed.of('debtors')).toMatchObject({
      count: 2,
      items: [
        { student: { id: payer }, debt: { amountMinor: 80000, lessons: 2 } },
        { student: { id: member }, debt: { amountMinor: 30000, lessons: 1 } },
      ],
    });
    expect(listed.of('unpaidPackages')).toMatchObject({
      count: 1,
      items: [{ package: { id: sold.id, paidMinor: 0, totalMinor: 80000 } }],
    });
    expect(listed.of('endingPackages')).toMatchObject({
      count: 1,
      items: [
        {
          student: { id: buyer },
          credits: { left: 1, warning: 'LOW_CREDITS' },
        },
      ],
    });
    expect(listed.of('expiringPackages')).toMatchObject({
      count: 1,
      items: [{ package: { id: expiring.id } }],
    });
    expect(listed.of('pauses')).toMatchObject({
      count: 1,
      items: [{ student: { id: away }, pause: { reason: 'RETURNING' } }],
    });
    expect(listed.total).toBe(8);

    // «Усі N →» of the attendance card: the lessons list's new filter.
    const unconfirmed = (
      await get('/lessons/list').query({ filter: 'unconfirmed' }).expect(200)
    ).body;
    expect(
      unconfirmed.items.map((lesson: { id: string }) => lesson.id),
    ).toEqual([groupLesson.id]);
    expect(unconfirmed.counts.unconfirmed).toBe(1);

    // Confirming the attendance takes the lesson off.
    const roster = await prisma.enrollment.findFirstOrThrow({
      where: { groupId: group, studentId: member },
      select: { id: true },
    });
    await server()
      .put(`/api/lessons/${groupLesson.id}/attendance`)
      .set('Authorization', bearer())
      .send({ marks: [{ enrollmentId: roster.id, status: 'PRESENT' }] })
      .expect(200);
    expect((await attention()).of('attendance').count).toBe(0);

    // Another teacher's scope sees none of this.
    // (Tutor mode refuses a second teacher through the API.)
    const other = (
      await prisma.teacher.create({
        data: { workspaceId, fullName: `Colleague ${runId}` },
      })
    ).id;
    expect((await attention(`?teacherId=${other}`)).total).toBe(0);

    const money = (await get('/dashboard/money').expect(200)).body;
    expect(money.currencies).toEqual([
      {
        currency: 'UAH',
        receivedMonthMinor: 70000,
        receivedTodayMinor: 70000,
        debtMinor: 110000,
        debtors: 2,
        // The unpaid package's 800 ₴ plus its expected renewal of 800 ₴.
        dueMinor: 160000,
        duePackages: 1,
      },
    ]);

    expect((await get('/dashboard/setup').expect(200)).body).toEqual({
      teacher: null,
      student: true,
      schedule: true,
      sale: true,
    });
  });
});
