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

type Lesson = {
  id: string;
  enrollmentId: string;
  charges: { id: string; source: string; paid: boolean }[];
};

describe('Work Packet 6.4 phase 7: read APIs (e2e)', () => {
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
  const del = (path: string) =>
    server().delete(`/api${path}`).set('Authorization', bearer());

  const newStudent = async (name: string): Promise<string> =>
    (
      await post('/students')
        .send({ fullName: `${name} ${runId}`, timezone: 'UTC' })
        .expect(201)
    ).body.id;

  const book = async (
    studentId: string,
    startsAt: string,
    status?: string,
  ): Promise<Lesson> =>
    (
      await post('/lessons?force=true')
        .send({
          studentId,
          teacherId,
          durationMin: 60,
          priceMinor: 40000,
          currency: 'UAH',
          startsAt: [startsAt],
          ...(status ? { status } : {}),
        })
        .expect(201)
    ).body.items[0];

  const sell = async (studentId: string, lessonsTotal: number) =>
    (
      await post('/packages')
        .send({
          studentId,
          sizingMode: 'FIXED_COUNT',
          lessonsTotal,
          pricePerLessonMinor: 40000,
          currency: 'UAH',
        })
        .expect(201)
    ).body;

  const page = (query: Record<string, string>) =>
    get('/lessons/list').query(query).expect(200);

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
        name: 'Owner R',
        workspaceName: `E2E WS R ${runId}`,
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
    await prisma.lessonCharge.deleteMany({ where });
    await prisma.lessonCreditEntry.deleteMany({ where });
    await prisma.payment.deleteMany({ where });
    await prisma.lessonAttendance.deleteMany({ where });
    await prisma.lesson.updateMany({
      where,
      data: { originalLessonId: null },
    });
    await prisma.lesson.deleteMany({ where });
    await prisma.lessonSeries.deleteMany({ where });
    await prisma.schedule.deleteMany({ where });
    await prisma.lessonPackage.deleteMany({ where });
    await prisma.enrollment.deleteMany({ where });
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

  it('says which charges are paid and lists the unpaid lessons (L-82, L-90)', async () => {
    // Pay-per-lesson: one payment settles the older of two lessons.
    const payer = await newStudent('Payer');
    const older = await book(payer, at(-3, 6), 'COMPLETED');
    const newer = await book(payer, at(-2, 6), 'COMPLETED');
    await post('/payments')
      .send({
        enrollmentId: older.enrollmentId,
        amountMinor: 40000,
        currency: 'UAH',
      })
      .expect(201);

    // Packages: one credit, two lessons — the second goes on debt.
    const packaged = await newStudent('Packaged');
    await sell(packaged, 1);
    const credited = await book(packaged, at(-3, 7), 'COMPLETED');
    const onDebt = await book(packaged, at(-2, 7), 'COMPLETED');

    const paidOf = async (lesson: Lesson) =>
      (await get(`/lessons/${lesson.id}`).expect(200)).body.charges.map(
        (charge: Lesson['charges'][number]) => [charge.source, charge.paid],
      );
    expect(await paidOf(older)).toEqual([['BALANCE', true]]);
    expect(await paidOf(newer)).toEqual([['BALANCE', false]]);
    expect(await paidOf(credited)).toEqual([['PACKAGE', true]]);
    expect(await paidOf(onDebt)).toEqual([['DEBT', false]]);

    for (const [studentId, unpaid] of [
      [payer, newer],
      [packaged, onDebt],
    ] as const) {
      const listed = await page({ studentId, filter: 'unpaid' });
      expect(listed.body.items.map((lesson: Lesson) => lesson.id)).toEqual([
        unpaid.id,
      ]);
      expect(listed.body).toMatchObject({ total: 1, counts: { unpaid: 1 } });
    }

    // The page names the package each package-paid direction uses now: the
    // used-up one here (0 of 1); pay-per-lesson directions are left out.
    const all = await page({ studentId: packaged });
    expect(all.body.packages).toEqual([
      {
        enrollmentId: credited.enrollmentId,
        packageId: expect.any(String),
        left: 0,
        total: 1,
      },
    ]);
    expect((await page({ studentId: payer })).body.packages).toEqual([]);

    // A new package pays first for the lesson on debt (L-82), then shows
    // what is left of it: 2 of 3.
    await sell(packaged, 3);
    await book(packaged, at(3, 7));
    expect((await page({ studentId: packaged })).body.packages).toMatchObject([
      { enrollmentId: credited.enrollmentId, left: 2, total: 3 },
    ]);
  });

  it('filters cancelled, no-show and lessons that need a makeup, with counts', async () => {
    const studentId = await newStudent('Filters');
    const held = await book(studentId, at(-4, 8), 'COMPLETED');
    const missed = await book(studentId, at(-3, 8), 'COMPLETED');
    await patch(`/lessons/${missed.id}/status`)
      .send({ targetStatus: 'NO_SHOW' })
      .expect(200);
    const cancelled = await book(studentId, at(5, 8));
    await patch(`/lessons/${cancelled.id}/status`)
      .send({ targetStatus: 'CANCELLED_UNCHARGED', cancelledBy: 'TEACHER' })
      .expect(200);

    const ids = async (query: Record<string, string>) =>
      (await page({ studentId, ...query })).body.items.map(
        (lesson: Lesson) => lesson.id,
      );
    const all = await page({ studentId });
    expect(all.body).toMatchObject({
      total: 3,
      counts: { cancelled: 1, noShow: 1, needsMakeup: 2 },
    });
    // Newest first by default; `order=asc` flips it.
    expect(all.body.items.map((lesson: Lesson) => lesson.id)).toEqual([
      cancelled.id,
      missed.id,
      held.id,
    ]);
    expect(await ids({ order: 'asc' })).toEqual([
      held.id,
      missed.id,
      cancelled.id,
    ]);
    expect(await ids({ filter: 'cancelled' })).toEqual([cancelled.id]);
    expect(await ids({ filter: 'no_show' })).toEqual([missed.id]);
    // "All" keeps counting every lesson while a quick filter narrows the page.
    expect((await page({ studentId, filter: 'cancelled' })).body).toMatchObject(
      { total: 1, counts: { all: 3, cancelled: 1 } },
    );
    // Several statuses at once, as a list or a repeated parameter.
    expect(await ids({ status: 'NO_SHOW,CANCELLED_UNCHARGED' })).toEqual([
      cancelled.id,
      missed.id,
    ]);
    expect(
      (
        await get(
          `/lessons/list?studentId=${studentId}&status=COMPLETED&status=NO_SHOW`,
        ).expect(200)
      ).body.items.map((lesson: Lesson) => lesson.id),
    ).toEqual([missed.id, held.id]);
    await get('/lessons/list?status=HELD').expect(400);
    // Search by the student's name, in any case.
    expect(
      (await page({ search: `filters ${runId}` })).body.items.map(
        (lesson: Lesson) => lesson.id,
      ),
    ).toEqual([cancelled.id, missed.id, held.id]);
    expect(await ids({ filter: 'needs_makeup' })).toEqual([
      cancelled.id,
      missed.id,
    ]);

    // A makeup takes the no-show off the list; deleting the makeup puts it
    // back and lets the tutor assign a new one.
    const makeup = await post(`/lessons/${missed.id}/makeup`)
      .send({ startsAtUtc: at(6, 8) })
      .expect(201);
    expect(await ids({ filter: 'needs_makeup' })).toEqual([cancelled.id]);
    await del(`/lessons/${makeup.body.id}`).expect(204);
    expect(await ids({ filter: 'needs_makeup' })).toEqual([
      cancelled.id,
      missed.id,
    ]);
    await post(`/lessons/${missed.id}/makeup`)
      .send({ startsAtUtc: at(7, 8) })
      .expect(201);

    // Pages carry the paging fields.
    const first = await page({ studentId, pageSize: '2' });
    expect(first.body).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 4,
      totalPages: 2,
    });
  });

  it('opens one lesson with its makeup, schedule and history', async () => {
    const studentId = await newStudent('Detail');
    const missed = await book(studentId, at(-2, 9), 'COMPLETED');
    await patch(`/lessons/${missed.id}/status`)
      .send({ targetStatus: 'NO_SHOW' })
      .expect(200);
    const makeup = (
      await post(`/lessons/${missed.id}/makeup`)
        .send({ startsAtUtc: at(4, 9) })
        .expect(201)
    ).body;

    const original = (await get(`/lessons/${missed.id}`).expect(200)).body;
    expect(original).toMatchObject({
      id: missed.id,
      status: 'NO_SHOW',
      original: null,
      makeup: { id: makeup.id, startsAtUtc: at(4, 9), status: 'SCHEDULED' },
      schedule: null,
    });
    // Newest first: the no-show, then the booking (its CREATE and the charge
    // written in the same transaction, in either order).
    const history = original.history as {
      action: string;
      changes: { fields: Record<string, unknown> } | null;
      actor: { name: string };
    }[];
    expect(history[0]).toMatchObject({
      action: 'UPDATE',
      actor: { name: 'Owner R' },
    });
    expect(history[0].changes?.fields).toHaveProperty('status');
    expect(history.map((entry) => entry.action).sort()).toEqual([
      'CREATE',
      'UPDATE',
      'UPDATE',
    ]);

    const replacement = (await get(`/lessons/${makeup.id}`).expect(200)).body;
    expect(replacement).toMatchObject({
      kind: 'MAKEUP',
      original: { id: missed.id, status: 'NO_SHOW' },
      makeup: null,
    });

    const scheduled = await newStudent('Scheduled');
    const schedule = (
      await post('/schedules?force=true')
        .send({
          studentId: scheduled,
          teacherId,
          slots: [{ weekday: 1, localTime: '12:00' }],
          durationMin: 60,
          timezone: 'UTC',
          startDate: nextMonday.toISOString(),
        })
        .expect(201)
    ).body;
    const [first] = (
      await page({ studentId: scheduled, order: 'asc', pageSize: '1' })
    ).body.items;
    expect(
      (await get(`/lessons/${first.id}`).expect(200)).body.schedule,
    ).toEqual({ id: schedule.id, state: 'ACTIVE' });

    await get(`/lessons/${randomUUID()}`).expect(404, /LESSON_NOT_FOUND/);
  });

  it('sums up a student billing and lists credit warnings by the studio threshold (L-82, L-120)', async () => {
    const low = await newStudent('Low');
    await sell(low, 3);
    await book(low, at(-5, 11), 'COMPLETED');
    const debtor = await newStudent('Debtor');
    await sell(debtor, 1);
    await book(debtor, at(-5, 12), 'COMPLETED');
    await book(debtor, at(-4, 12), 'COMPLETED');

    const billing = (await get(`/students/${debtor}/billing`).expect(200)).body;
    expect(billing).toMatchObject({
      studentId: debtor,
      lowCreditThreshold: 2,
      directions: [
        {
          billingType: 'PACKAGE',
          status: 'ACTIVE',
          creditsLeft: 0,
          debtLessons: 1,
          warning: 'ON_DEBT',
          teacher: { id: teacherId },
          group: null,
        },
      ],
      totals: [{ currency: 'UAH', debtLessons: 1, creditsLeft: 0 }],
    });

    const warned = async () =>
      (await get('/billing/warnings').expect(200)).body as {
        lowCreditThreshold: number;
        items: { student: { id: string }; warning: string }[];
      };
    const before = await warned();
    const mine = before.items.filter((item) =>
      [low, debtor].includes(item.student.id),
    );
    // Debt first, then the ones nearly used up.
    expect(mine.map((item) => [item.student.id, item.warning])).toEqual([
      [debtor, 'ON_DEBT'],
      [low, 'LOW_CREDITS'],
    ]);

    const settings = await patch('/workspaces/current/settings')
      .send({ lowCreditThreshold: 1 })
      .expect(200);
    expect(settings.body.workspace.lowCreditThreshold).toBe(1);
    const after = await warned();
    expect(after.lowCreditThreshold).toBe(1);
    expect(after.items.map((item) => item.student.id)).not.toContain(low);
    expect(
      (await get(`/students/${low}/billing`).expect(200)).body.directions[0]
        .warning,
    ).toBeNull();
    await patch('/workspaces/current/settings')
      .send({ lowCreditThreshold: -1 })
      .expect(400);
  });

  it('shows package money, unpaid lessons oldest first and the cancellation windows (S06)', async () => {
    // A package paid in part.
    const buyer = await newStudent('Buyer');
    const pkg = await sell(buyer, 3);
    await post('/payments')
      .send({
        enrollmentId: pkg.enrollmentId,
        packageId: pkg.id,
        amountMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);
    const teacher = await prisma.teacher.findUniqueOrThrow({
      where: { id: teacherId },
      select: { avatarKey: true, subjects: true },
    });
    const bought = (await get(`/students/${buyer}/billing`).expect(200)).body;
    expect(bought).toMatchObject({
      cancellationDeadlineHours: 24,
      directions: [
        {
          teacher: {
            id: teacherId,
            avatarKey: teacher.avatarKey,
            subjects: teacher.subjects,
          },
          cancellationDeadlineHours: null,
          packages: [
            {
              id: pkg.id,
              validFrom: pkg.validFrom,
              lessonsTotal: 3,
              totalPriceMinor: 120000,
              paidMinor: 50000,
              paymentStatus: 'PARTIAL',
            },
          ],
        },
      ],
    });

    // Pay per lesson: a payment settles the oldest lessons first (L-90).
    const payer = await newStudent('Per lesson');
    const lessons = [
      await book(payer, at(-3, 13), 'COMPLETED'),
      await book(payer, at(-2, 13), 'COMPLETED'),
      await book(payer, at(-1, 13), 'COMPLETED'),
    ];
    const enrollmentId = lessons[0].enrollmentId;
    await post('/payments')
      .send({ enrollmentId, amountMinor: 60000, currency: 'UAH' })
      .expect(201);
    const owing = (await get(`/students/${payer}/billing`).expect(200)).body;
    expect(owing.directions[0].balance).toMatchObject({
      debtMinor: 60000,
      unpaidLessons: 2,
      unpaid: [
        {
          lessonId: lessons[1].id,
          startsAt: at(-2, 13),
          outstandingMinor: 20000,
        },
        {
          lessonId: lessons[2].id,
          startsAt: at(-1, 13),
          outstandingMinor: 40000,
        },
      ],
    });
    // The direction read carries the same list.
    expect(
      (await get(`/enrollments/${enrollmentId}/billing`).expect(200)).body
        .balance.unpaid,
    ).toEqual(owing.directions[0].balance.unpaid);

    await post('/payments')
      .send({ enrollmentId, amountMinor: 100000, currency: 'UAH' })
      .expect(201);
    const ahead = (await get(`/students/${payer}/billing`).expect(200)).body;
    expect(ahead.directions[0].balance).toMatchObject({
      debtMinor: 0,
      advanceMinor: 40000,
      unpaidLessons: 0,
      unpaid: [],
    });
  });
});
