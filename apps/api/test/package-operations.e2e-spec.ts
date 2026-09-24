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

describe('Work Packet 6.4 phase 5: package kinds and operations (e2e)', () => {
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

  const newStudent = async (name: string): Promise<string> =>
    (
      await post('/students')
        .send({ fullName: `${name} ${runId}`, timezone: 'UTC' })
        .expect(201)
    ).body.id;

  const held = async (studentId: string, days: number, hour = 10) =>
    (
      await post('/lessons?force=true')
        .send({
          studentId,
          teacherId,
          durationMin: 60,
          priceMinor: 40000,
          currency: 'UAH',
          startsAt: [at(days, hour)],
          status: 'COMPLETED',
        })
        .expect(201)
    ).body.items[0] as {
      id: string;
      enrollmentId: string;
      charges: { source: string; packageId: string | null }[];
    };

  const sell = async (body: Record<string, unknown>) =>
    (
      await post('/packages')
        .send({
          sizingMode: 'FIXED_COUNT',
          pricePerLessonMinor: 40000,
          currency: 'UAH',
          ...body,
        })
        .expect(201)
    ).body;

  const chargeOf = (lessonId: string) =>
    prisma.lessonCharge.findFirstOrThrow({
      where: { lessonId, voidedAt: null },
      select: { source: true, packageId: true },
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
        name: 'Owner P',
        workspaceName: `E2E WS P ${runId}`,
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
    await prisma.lesson.deleteMany({ where });
    await prisma.lessonSeries.deleteMany({ where });
    await prisma.schedule.deleteMany({ where });
    await prisma.lessonPackage.updateMany({
      where,
      data: { transferredFromPackageId: null },
    });
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

  it("sizes a by-period package by the direction's schedule, editable (L-80)", async () => {
    const studentId = await newStudent('Period');
    await post('/schedules')
      .send({
        studentId,
        teacherId,
        slots: [
          { weekday: 1, localTime: '10:00' },
          { weekday: 4, localTime: '10:00' },
        ],
        durationMin: 60,
        timezone: 'UTC',
        startDate: nextMonday.toISOString(),
      })
      .expect(201);
    const window = {
      sizingMode: 'BY_PERIOD',
      validFrom: nextMonday.toISOString(),
      endDate: new Date(nextMonday.getTime() + 4 * WEEK_MS - 1).toISOString(),
    };

    const preview = await post('/packages/preview')
      .send({
        studentId,
        currency: 'UAH',
        pricePerLessonMinor: 40000,
        ...window,
      })
      .expect(200);
    expect(preview.body).toMatchObject({
      scheduleLessons: 8,
      lessonsTotal: 8,
      totalPriceMinor: 320000,
      validFrom: window.validFrom,
      expiresAt: new Date(nextMonday.getTime() + 4 * WEEK_MS).toISOString(),
    });

    // The tutor's count wins, and a total prices the whole period.
    const sold = await sell({
      studentId,
      ...window,
      pricePerLessonMinor: undefined,
      totalPriceMinor: 300000,
      lessonsTotal: 7,
    });
    expect(sold).toMatchObject({
      sizingMode: 'BY_PERIOD',
      lessonsTotal: 7,
      remainingCredits: 7,
      totalPriceMinorSnapshot: 300000,
      pricePerLessonMinorSnapshot: 42857,
      validFrom: window.validFrom,
    });
  });

  it('pays only for lessons inside a weekly package window (L-80)', async () => {
    const studentId = await newStudent('Weekly');
    const weekly = await sell({
      studentId,
      sizingMode: 'BY_PERIOD_WEEKLY',
      lessonsPerWeek: 2,
      validFrom: at(-14, 0),
      endDate: new Date(Date.parse(at(-14, 0)) + 4 * WEEK_MS - 1).toISOString(),
    });
    expect(weekly).toMatchObject({ lessonsTotal: 8, lessonsPerWeek: 2 });
    // A lesson before the window goes on debt; one inside is paid.
    const before = await held(studentId, -20);
    expect(await chargeOf(before.id)).toEqual({
      source: 'DEBT',
      packageId: null,
    });
    const inside = await held(studentId, -3);
    expect(inside.charges[0]).toMatchObject({
      source: 'PACKAGE',
      packageId: weekly.id,
    });
  });

  it('extends an expired package so it pays again (L-84)', async () => {
    const studentId = await newStudent('Extend');
    const pkg = await sell({
      studentId,
      lessonsTotal: 4,
      purchasedAt: at(-30),
      expiresAt: at(-5),
    });
    const late = await held(studentId, -2);
    expect(late.charges[0]).toMatchObject({ source: 'DEBT' });

    const earlier = await post(`/packages/${pkg.id}/extend`)
      .send({ expiresAt: at(-10) })
      .expect(400);
    expect(earlier.body.code).toBe('INVALID_PACKAGE_PLAN');
    const extended = await post(`/packages/${pkg.id}/extend`)
      .send({ expiresAt: at(30) })
      .expect(201);
    expect(extended.body).toMatchObject({
      expiresAt: at(30),
      remainingCredits: 3,
    });
    expect(await chargeOf(late.id)).toEqual({
      source: 'PACKAGE',
      packageId: pkg.id,
    });
  });

  it("moves unused credits to another of the student's directions by price (L-85)", async () => {
    const studentId = await newStudent('Transfer');
    const group = await post('/groups')
      .send({
        name: `Transfer B2 ${runId}`,
        teacherId,
        pricePerLesson: 50000,
        currency: 'UAH',
        students: { studentIds: [studentId] },
      })
      .expect(201);
    const membership = await prisma.enrollment.findFirstOrThrow({
      where: { groupId: group.body.id, studentId },
      select: { id: true },
    });
    const source = await sell({ studentId, lessonsTotal: 5 });
    await held(studentId, -1);

    const tooMany = await post(`/packages/${source.id}/transfer`)
      .send({ toEnrollmentId: membership.id, credits: 5 })
      .expect(409);
    expect(tooMany.body).toMatchObject({
      code: 'NOT_ENOUGH_CREDITS',
      details: { remaining: 4 },
    });
    const self = await post(`/packages/${source.id}/transfer`)
      .send({ toEnrollmentId: source.enrollmentId })
      .expect(409);
    expect(self.body.code).toBe('INVALID_TRANSFER_TARGET');

    // Three lessons at 400 are worth 1 200: two group lessons at 500, 200 left.
    const moved = await post(`/packages/${source.id}/transfer`)
      .send({ toEnrollmentId: membership.id, credits: 3 })
      .expect(201);
    expect(moved.body).toMatchObject({
      valueMinor: 120000,
      remainderMinor: 20000,
      source: { remainingCredits: 1 },
      target: {
        enrollmentId: membership.id,
        groupId: group.body.id,
        lessonsTotal: 2,
        remainingCredits: 2,
        paymentStatus: 'PAID',
        transferredFromPackageId: source.id,
      },
    });
    const ledger = await get(`/packages/${source.id}/ledger`).expect(200);
    expect(ledger.body.items[0]).toMatchObject({
      type: 'transfer_out',
      delta: -3,
    });
    expect(
      (await get(`/enrollments/${membership.id}/billing`).expect(200)).body
        .billingType,
    ).toBe('PACKAGE');
  });

  it('refunds unused credits and money without rewriting what was paid (L-85)', async () => {
    const studentId = await newStudent('Refund');
    const pkg = await sell({
      studentId,
      lessonsTotal: 4,
      initialPayment: { amountMinor: 160000, paidAt: at(-1) },
    });
    await held(studentId, -1);

    expect(
      (
        await post(`/packages/${pkg.id}/refund`)
          .send({ credits: 4, amountMinor: 0, note: 'Too many' })
          .expect(409)
      ).body.code,
    ).toBe('NOT_ENOUGH_CREDITS');
    expect(
      (
        await post(`/packages/${pkg.id}/refund`)
          .send({ credits: 1, amountMinor: 200000, note: 'Too much' })
          .expect(409)
      ).body.code,
    ).toBe('REFUND_TOO_LARGE');

    const refunded = await post(`/packages/${pkg.id}/refund`)
      .send({ credits: 2, amountMinor: 80000, note: 'Moved abroad' })
      .expect(201);
    expect(refunded.body).toMatchObject({
      remainingCredits: 1,
      paidMinor: 80000,
      refundedMinor: 80000,
      paymentStatus: 'PAID',
    });
    const payments = await get(`/payments?packageId=${pkg.id}`).expect(200);
    expect(
      payments.body.items.map(
        (row: { status: string; amountMinor: number }) => [
          row.status,
          row.amountMinor,
        ],
      ),
    ).toEqual(
      expect.arrayContaining([
        ['PAID', 160000],
        ['REFUNDED', 80000],
      ]),
    );
  });

  it('sells one package to each selected group member, or to none (L-86)', async () => {
    const [ann, bob, cat] = await Promise.all([
      newStudent('Member Ann'),
      newStudent('Member Bob'),
      newStudent('Member Cat'),
    ]);
    const outsider = await newStudent('Not a member');
    const group = await post('/groups')
      .send({
        name: `Members C1 ${runId}`,
        teacherId,
        pricePerLesson: 30000,
        currency: 'UAH',
        students: { studentIds: [ann, bob, cat] },
      })
      .expect(201);
    const spec = {
      groupId: group.body.id,
      sizingMode: 'FIXED_COUNT',
      lessonsTotal: 8,
      pricePerLessonMinor: 30000,
      currency: 'UAH',
    };

    const refused = await post('/packages/members')
      .send({ ...spec, studentIds: [ann, outsider] })
      .expect(404);
    expect(refused.body.code).toBe('ENROLLMENT_NOT_FOUND');
    expect(
      await prisma.lessonPackage.count({
        where: { enrollment: { groupId: group.body.id } },
      }),
    ).toBe(0);

    const sold = await post('/packages/members')
      .send({ ...spec, studentIds: [ann, bob] })
      .expect(201);
    expect(sold.body.items).toHaveLength(2);
    expect(
      sold.body.items.map((item: { studentId: string; groupId: string }) => [
        item.studentId,
        item.groupId,
      ]),
    ).toEqual([
      [ann, group.body.id],
      [bob, group.body.id],
    ]);
    const listed = await get(`/packages?groupId=${group.body.id}`).expect(200);
    expect(listed.body.total).toBe(2);
  });
});
