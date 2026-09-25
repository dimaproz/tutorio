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

interface Charge {
  enrollmentId: string;
  source: 'PACKAGE' | 'DEBT' | 'BALANCE';
  packageId: string | null;
  amountMinor: number;
}

describe('Work Packet 6.4 phase 3: billing core (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let owner: string;
  let workspaceId: string;
  let teacherId: string;
  const workspaceIds: string[] = [];

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
          teacherId,
          durationMin: 60,
          priceMinor: 40000,
          currency: 'UAH',
          ...body,
        })
        .expect(201)
    ).body.items[0];

  const held = (studentId: string, days: number, hour = 10) =>
    book({ studentId, startsAt: [at(days, hour)], status: 'COMPLETED' });

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

  const billing = async (enrollmentId: string) =>
    (await get(`/enrollments/${enrollmentId}/billing`).expect(200)).body;

  const chargesOf = async (lessonId: string): Promise<Charge[]> =>
    prisma.lessonCharge.findMany({
      where: { lessonId, voidedAt: null },
      select: {
        enrollmentId: true,
        source: true,
        packageId: true,
        amountMinor: true,
      },
      orderBy: { enrollmentId: 'asc' },
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
        name: 'Owner B',
        workspaceName: `E2E WS B ${runId}`,
        email: emailFor('owner'),
        password: 'correct horse battery staple',
      })
      .expect(201);
    owner = register.body.tokens.accessToken;
    workspaceId = register.body.workspace.id;
    workspaceIds.push(workspaceId);
    teacherId = (await get('/teachers').expect(200)).body.items[0].id;
  });

  afterAll(async () => {
    const where = { workspaceId: { in: workspaceIds } };
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
    await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('starts a direction pay-per-lesson and settles the oldest lessons first (L-10, L-12, L-90)', async () => {
    const studentId = await newStudent('Balance');
    const oldest = await held(studentId, -3);
    const middle = await held(studentId, -2);
    const newest = await held(studentId, -1);
    const enrollmentId = oldest.enrollmentId;
    expect(oldest.charges).toEqual([
      expect.objectContaining({
        enrollmentId,
        source: 'BALANCE',
        packageId: null,
        amountMinor: 40000,
      }),
    ]);
    expect(await billing(enrollmentId)).toMatchObject({
      billingType: 'PER_LESSON',
      debtLessons: 0,
      balance: { chargedMinor: 120000, debtMinor: 120000, unpaidLessons: 3 },
    });

    await post('/payments')
      .send({ enrollmentId, amountMinor: 60000, currency: 'UAH' })
      .expect(201);
    expect((await billing(enrollmentId)).balance).toMatchObject({
      paidMinor: 60000,
      debtMinor: 60000,
      unpaidLessons: 2,
    });

    // A lesson payments already reach keeps its price; an unpaid one not.
    for (const lesson of [oldest, middle]) {
      const refused = await patch(`/lessons/${lesson.id}`)
        .send({ priceMinor: 45000, currency: 'UAH' })
        .expect(409);
      expect(refused.body.code).toBe('LESSON_PAID');
    }
    await patch(`/lessons/${newest.id}`)
      .send({ priceMinor: 45000, currency: 'UAH' })
      .expect(200);
    expect((await billing(enrollmentId)).balance.chargedMinor).toBe(125000);

    // Money paid ahead of the lessons stays as an advance.
    await post('/payments')
      .send({ enrollmentId, amountMinor: 100000, currency: 'UAH' })
      .expect(201);
    expect((await billing(enrollmentId)).balance).toMatchObject({
      debtMinor: 0,
      advanceMinor: 35000,
      unpaidLessons: 0,
    });
  });

  it('switches to packages on the first sale and uses the oldest valid package (L-10, L-81, L-84)', async () => {
    const studentId = await newStudent('Fifo');
    const expired = await sell({
      studentId,
      lessonsTotal: 1,
      purchasedAt: at(-10),
      expiresAt: at(-5),
    });
    const older = await sell({
      studentId,
      lessonsTotal: 2,
      purchasedAt: at(-9),
    });
    const newer = await sell({
      studentId,
      lessonsTotal: 5,
      purchasedAt: at(-8),
    });
    const enrollmentId = expired.enrollmentId;
    expect(newer.enrollmentId).toBe(enrollmentId);
    expect((await billing(enrollmentId)).billingType).toBe('PACKAGE');

    // Before it expired, the oldest package pays; after, the next one.
    const early = await held(studentId, -7);
    expect(early.charges[0]).toMatchObject({
      source: 'PACKAGE',
      packageId: expired.id,
    });
    const lessons = [
      await held(studentId, -1, 8),
      await held(studentId, -1, 10),
      await held(studentId, -1, 12),
    ];
    expect(lessons.map((lesson) => lesson.charges[0].packageId)).toEqual([
      older.id,
      older.id,
      newer.id,
    ]);

    const summary = await billing(enrollmentId);
    expect(summary.packages).toEqual([
      expect.objectContaining({
        id: expired.id,
        remainingCredits: 0,
        usable: false,
      }),
      expect.objectContaining({
        id: older.id,
        remainingCredits: 0,
        usable: true,
      }),
      expect.objectContaining({
        id: newer.id,
        remainingCredits: 4,
        usable: true,
      }),
    ]);
    expect(summary.creditsLeft).toBe(4);

    const ledger = await get(`/packages/${older.id}/ledger`).expect(200);
    expect(ledger.body.balance).toBe(0);
    expect(
      ledger.body.items.map((item: { type: string; delta: number }) => [
        item.type,
        item.delta,
      ]),
    ).toEqual(
      expect.arrayContaining([
        ['purchase', 2],
        ['lesson', -1],
        ['lesson', -1],
      ]),
    );
  });

  it('charges a lesson once and gives the credit back when it stops being charged', async () => {
    const studentId = await newStudent('Once');
    const pkg = await sell({ studentId, lessonsTotal: 3 });
    const lesson = await book({ studentId, startsAt: [at(5)] });

    const [first, second] = await Promise.all([
      patch(`/lessons/${lesson.id}/status`).send({ targetStatus: 'COMPLETED' }),
      patch(`/lessons/${lesson.id}/status`).send({ targetStatus: 'COMPLETED' }),
    ]);
    expect([first.status, second.status]).toEqual([200, 200]);
    // A correction that stays charged keeps the one charge.
    await patch(`/lessons/${lesson.id}/status`)
      .send({ targetStatus: 'NO_SHOW' })
      .expect(200);
    expect(await chargesOf(lesson.id)).toHaveLength(1);
    expect(
      await prisma.lessonCharge.count({ where: { lessonId: lesson.id } }),
    ).toBe(1);

    const refused = await server()
      .delete(`/api/lessons/${lesson.id}`)
      .set('Authorization', bearer())
      .expect(409);
    expect(refused.body.code).toBe('LESSON_CHARGED');

    await patch(`/lessons/${lesson.id}/status`)
      .send({ targetStatus: 'CANCELLED_UNCHARGED', cancelledBy: 'TEACHER' })
      .expect(200);
    expect(await chargesOf(lesson.id)).toEqual([]);
    expect(
      (await get(`/packages/${pkg.id}`).expect(200)).body.remainingCredits,
    ).toBe(3);
    await server()
      .delete(`/api/lessons/${lesson.id}`)
      .set('Authorization', bearer())
      .expect(204);
  });

  it('holds lessons on debt and covers them with the next credits, oldest first (L-82)', async () => {
    const studentId = await newStudent('Debt');
    const first = await sell({ studentId, lessonsTotal: 1 });
    const lessons = [
      await held(studentId, -3),
      await held(studentId, -2),
      await held(studentId, -1),
    ];
    expect(lessons.map((lesson) => lesson.charges[0].source)).toEqual([
      'PACKAGE',
      'DEBT',
      'DEBT',
    ]);
    expect(await billing(first.enrollmentId)).toMatchObject({
      debtLessons: 2,
      creditsLeft: 0,
    });

    // A correction adding a credit pays the oldest debt.
    await post(`/packages/${first.id}/adjust`)
      .send({ delta: 1, note: 'One lesson given for free' })
      .expect(201);
    expect(await chargesOf(lessons[1].id)).toEqual([
      expect.objectContaining({ source: 'PACKAGE', packageId: first.id }),
    ]);

    const next = await sell({ studentId, lessonsTotal: 5 });
    expect(next.remainingCredits).toBe(4);
    expect(await chargesOf(lessons[2].id)).toEqual([
      expect.objectContaining({ source: 'PACKAGE', packageId: next.id }),
    ]);
    expect(await billing(first.enrollmentId)).toMatchObject({
      debtLessons: 0,
      creditsLeft: 4,
    });
  });

  it('closes unpaid pay-per-lesson lessons with the first package, oldest first (L-91)', async () => {
    const studentId = await newStudent('Switch');
    const first = await held(studentId, -3);
    const second = await held(studentId, -2);
    const enrollmentId = first.enrollmentId;
    // Half of the first lesson is paid.
    await post('/payments')
      .send({ enrollmentId, amountMinor: 20000, currency: 'UAH' })
      .expect(201);

    const preview = await post('/packages/preview')
      .send({
        studentId,
        teacherId,
        sizingMode: 'FIXED_COUNT',
        lessonsTotal: 3,
        pricePerLessonMinor: 40000,
        currency: 'UAH',
      })
      .expect(200);
    expect(preview.body.debtLessons).toBe(2);

    const pkg = await sell({ studentId, teacherId, lessonsTotal: 3 });
    for (const lesson of [first, second]) {
      expect(await chargesOf(lesson.id)).toEqual([
        expect.objectContaining({ source: 'PACKAGE', packageId: pkg.id }),
      ]);
    }
    // Nothing is owed any more; the money paid stays money, paid ahead.
    expect(await billing(enrollmentId)).toMatchObject({
      billingType: 'PACKAGE',
      creditsLeft: 1,
      debtLessons: 0,
      balance: { debtMinor: 0, advanceMinor: 20000, unpaidLessons: 0 },
    });
    const after = await held(studentId, -1);
    expect(after.charges[0]).toMatchObject({
      source: 'PACKAGE',
      packageId: pkg.id,
    });
  });

  it('charges each group member from their own direction by attendance (L-70…L-72)', async () => {
    const [ann, bob, cat] = await Promise.all([
      newStudent('Group Ann'),
      newStudent('Group Bob'),
      newStudent('Group Cat'),
    ]);
    const group = await post('/groups')
      .send({
        name: `Billing B2 ${runId}`,
        teacherId,
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

    const outsider = await newStudent('Not a member');
    const refused = await post('/packages')
      .send({
        studentId: outsider,
        groupId: group.body.id,
        sizingMode: 'FIXED_COUNT',
        lessonsTotal: 4,
        pricePerLessonMinor: 30000,
        currency: 'UAH',
      })
      .expect(404);
    expect(refused.body.code).toBe('ENROLLMENT_NOT_FOUND');
    const bobPackage = await sell({
      studentId: bob,
      groupId: group.body.id,
      lessonsTotal: 4,
      pricePerLessonMinor: 30000,
    });
    expect(bobPackage.enrollmentId).toBe(member(bob));

    // Held with no marks: every member counts as present.
    const lesson = await book({
      groupId: group.body.id,
      priceMinor: 30000,
      startsAt: [at(-1, 16)],
      status: 'COMPLETED',
    });
    expect(await chargesOf(lesson.id)).toEqual(
      [
        {
          enrollmentId: member(ann),
          source: 'BALANCE',
          packageId: null,
          amountMinor: 30000,
        },
        {
          enrollmentId: member(bob),
          source: 'PACKAGE',
          packageId: bobPackage.id,
          amountMinor: 30000,
        },
        {
          enrollmentId: member(cat),
          source: 'BALANCE',
          packageId: null,
          amountMinor: 30000,
        },
      ].sort((a, b) => a.enrollmentId.localeCompare(b.enrollmentId)),
    );

    // Excused is free; absent is charged again.
    await put(`/lessons/${lesson.id}/attendance`)
      .send({ marks: [{ enrollmentId: member(cat), status: 'EXCUSED' }] })
      .expect(200);
    expect(
      (await chargesOf(lesson.id)).map((charge) => charge.enrollmentId),
    ).not.toContain(member(cat));
    await put(`/lessons/${lesson.id}/attendance`)
      .send({ marks: [{ enrollmentId: member(cat), status: 'ABSENT' }] })
      .expect(200);
    expect(await chargesOf(lesson.id)).toHaveLength(3);
  });

  it("keeps a member's own price and reprices only the others' future lessons (L-11, L-12)", async () => {
    const [ann, bob] = await Promise.all([
      newStudent('Price Ann'),
      newStudent('Price Bob'),
    ]);
    const group = await post('/groups')
      .send({
        name: `Billing prices ${runId}`,
        teacherId,
        pricePerLesson: 40000,
        currency: 'UAH',
        students: { studentIds: [ann, bob] },
      })
      .expect(201);
    const roster = async () =>
      (await get(`/groups/${group.body.id}`).expect(200)).body.enrollments as {
        id: string;
        studentId: string;
        priceMinor: number;
        ownPrice: boolean;
      }[];
    const row = async (studentId: string) =>
      (await roster()).find((item) => item.studentId === studentId)!;
    const annId = (await row(ann)).id;
    const bobId = (await row(bob)).id;
    expect(await row(ann)).toMatchObject({
      priceMinor: 40000,
      ownPrice: false,
    });

    // Bob's own price; saving the group price turns it back into the group's.
    const own = await patch(`/enrollments/${bobId}`)
      .send({ priceMinor: 35000 })
      .expect(200);
    expect(own.body).toMatchObject({ priceMinor: 35000, ownPrice: true });
    await patch(`/enrollments/${bobId}`)
      .send({ priceMinor: 40000 })
      .expect(200);
    expect(await row(bob)).toMatchObject({
      priceMinor: 40000,
      ownPrice: false,
    });
    await patch(`/enrollments/${bobId}`)
      .send({ priceMinor: 35000 })
      .expect(200);

    const before = await book({
      groupId: group.body.id,
      priceMinor: 40000,
      startsAt: [at(-2, 16)],
      status: 'COMPLETED',
    });
    const amounts = async (lessonId: string) =>
      Object.fromEntries(
        (await chargesOf(lessonId)).map((charge) => [
          charge.enrollmentId,
          charge.amountMinor,
        ]),
      );
    expect(await amounts(before.id)).toEqual({
      [annId]: 40000,
      [bobId]: 35000,
    });

    // A new group price moves Ann, not Bob, and no charge already made.
    await patch(`/groups/${group.body.id}`)
      .send({ pricePerLesson: 45000 })
      .expect(200);
    expect(await row(ann)).toMatchObject({
      priceMinor: 45000,
      ownPrice: false,
    });
    expect(await row(bob)).toMatchObject({ priceMinor: 35000, ownPrice: true });
    expect(await amounts(before.id)).toEqual({
      [annId]: 40000,
      [bobId]: 35000,
    });

    const after = await book({
      groupId: group.body.id,
      priceMinor: 45000,
      startsAt: [at(-1, 16)],
      status: 'COMPLETED',
    });
    expect(await amounts(after.id)).toEqual({ [annId]: 45000, [bobId]: 35000 });
  });

  it('caps a package payment at what it still costs and ties it to its direction', async () => {
    const studentId = await newStudent('Payer');
    const pkg = await sell({ studentId, lessonsTotal: 2 });
    const otherDirection = (await held(await newStudent('Other'), -1))
      .enrollmentId;
    const pay = (body: Record<string, unknown>) =>
      post('/payments').send({
        enrollmentId: pkg.enrollmentId,
        packageId: pkg.id,
        currency: 'UAH',
        ...body,
      });

    await pay({ amountMinor: 50000 }).expect(201);
    expect((await get(`/packages/${pkg.id}`).expect(200)).body).toMatchObject({
      paidMinor: 50000,
      paymentStatus: 'PARTIAL',
    });
    expect((await pay({ amountMinor: 30001 }).expect(409)).body.code).toBe(
      'OVERPAYMENT',
    );
    expect(
      (await pay({ amountMinor: 1000, currency: 'EUR' }).expect(409)).body.code,
    ).toBe('CURRENCY_MISMATCH');
    expect(
      (
        await pay({ amountMinor: 1000, enrollmentId: otherDirection }).expect(
          409,
        )
      ).body.code,
    ).toBe('INVALID_PACKAGE_PAYMENT_RELATION');

    const key = `settle-${runId}`;
    const settled = await pay({
      amountMinor: 30000,
      idempotencyKey: key,
    }).expect(201);
    const replay = await pay({
      amountMinor: 30000,
      idempotencyKey: key,
    }).expect(201);
    expect(replay.body.id).toBe(settled.body.id);
    expect(
      (await pay({ amountMinor: 20000, idempotencyKey: key }).expect(409)).body
        .code,
    ).toBe('IDEMPOTENCY_CONFLICT');
    expect(
      (await get(`/packages/${pkg.id}`).expect(200)).body.paymentStatus,
    ).toBe('PAID');
  });

  it('deletes only an unused package; the deleted one pays for nothing (S07)', async () => {
    const studentId = await newStudent('Archive');
    const pkg = await sell({ studentId, lessonsTotal: 2 });
    const paid = await held(studentId, -2);
    // A package that paid for a lesson is history: it is refunded, not deleted.
    const refused = await server()
      .delete(`/api/packages/${pkg.id}`)
      .set('Authorization', bearer())
      .expect(409);
    expect(refused.body.code).toBe('PACKAGE_IN_USE');
    expect(await chargesOf(paid.id)).toEqual([
      expect.objectContaining({ source: 'PACKAGE', packageId: pkg.id }),
    ]);

    const other = await newStudent('Archive unused');
    const unused = await sell({ studentId: other, lessonsTotal: 2 });
    await server()
      .delete(`/api/packages/${unused.id}`)
      .set('Authorization', bearer())
      .expect(204);
    const later = await held(other, -1);
    expect(later.charges[0]).toMatchObject({ source: 'DEBT', packageId: null });
    const archived = await server()
      .get(`/api/packages?state=deleted&studentId=${other}`)
      .set('Authorization', bearer())
      .expect(200);
    expect(archived.body.items[0]).toMatchObject({
      id: unused.id,
      consumedCredits: 0,
      remainingCredits: 2,
    });
  });

  it('appends a manual adjustment instead of editing history', async () => {
    const pkg = await sell({
      studentId: await newStudent('Adjust'),
      lessonsTotal: 4,
    });
    const adjusted = await post(`/packages/${pkg.id}/adjust`)
      .send({ delta: 2, note: 'Goodwill lessons after a scheduling mistake' })
      .expect(201);
    expect(adjusted.body.remainingCredits).toBe(6);
    const ledger = await get(`/packages/${pkg.id}/ledger`).expect(200);
    // Both rows survive — the correction is an addition, not an edit.
    expect(ledger.body.items).toHaveLength(2);
    expect(ledger.body.items[0]).toMatchObject({
      type: 'manual_adjustment',
      note: expect.stringContaining('Goodwill'),
    });
  });

  it('does not reveal or accept a direction from another workspace', async () => {
    const studentId = await newStudent('Hidden');
    const lesson = await held(studentId, -1);
    const outsider = await server()
      .post('/api/auth/register')
      .send({
        name: 'Outsider B',
        workspaceName: `E2E outsider B ${runId}`,
        email: emailFor('outsider'),
        password: 'correct horse battery staple',
      })
      .expect(201);
    workspaceIds.push(outsider.body.workspace.id);
    const token = `Bearer ${outsider.body.tokens.accessToken}`;

    const rejected = await server()
      .post('/api/payments')
      .set('Authorization', token)
      .send({
        enrollmentId: lesson.enrollmentId,
        amountMinor: 10000,
        currency: 'UAH',
      })
      .expect(404);
    expect(rejected.body.code).toBe('ENROLLMENT_NOT_FOUND');
    await server()
      .get(`/api/enrollments/${lesson.enrollmentId}/billing`)
      .set('Authorization', token)
      .expect(404);
  });
});
