import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MaterializerService } from '../src/scheduling/materializer.service';

const runId = randomUUID().slice(0, 8);
const emailFor = (label: string) => `e2e-${runId}-${label}@example.com`;

// A whole-day window starting "tomorrow" so lessons are unambiguously in the
// future and inside the 12-week materialization horizon.
const DAY_MS = 24 * 60 * 60 * 1000;

describe('Stage 3: scheduling — series, lessons, reschedule, cancel (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let owner: string;
  let workspaceId: string;
  let ownerTeacherId: string;
  let enrollmentId: string;
  let materializer: MaterializerService;

  const server = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);
    materializer = app.get(MaterializerService);

    const register = await server()
      .post('/api/auth/register')
      .send({
        name: 'Owner S3',
        workspaceName: `E2E WS S3 ${runId}`,
        email: emailFor('owner'),
        password: 'correct horse battery staple',
      })
      .expect(201);
    owner = register.body.tokens.accessToken;
    workspaceId = register.body.workspace.id;

    const teachers = await server()
      .get('/api/teachers')
      .set('Authorization', auth(owner))
      .expect(200);
    ownerTeacherId = teachers.body.items[0].id;

    const student = await server()
      .post('/api/students')
      .set('Authorization', auth(owner))
      .send({ fullName: 'Sched Student', timezone: 'Europe/Kyiv' })
      .expect(201);

    const enrollment = await server()
      .post('/api/enrollments')
      .set('Authorization', auth(owner))
      .send({
        studentId: student.body.id,
        teacherId: ownerTeacherId,
        priceMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);
    enrollmentId = enrollment.body.id;
  });

  afterAll(async () => {
    await prisma.lesson.deleteMany({ where: { workspaceId } });
    await prisma.lessonSeries.deleteMany({ where: { workspaceId } });
    await prisma.enrollment.deleteMany({ where: { workspaceId } });
    await prisma.teacher.deleteMany({ where: { workspaceId } });
    await prisma.student.deleteMany({ where: { workspaceId } });
    await prisma.group.deleteMany({ where: { workspaceId } });
    await prisma.auditLog.deleteMany({ where: { workspaceId } });
    const users = await prisma.user.findMany({
      where: { email: { startsWith: `e2e-${runId}-` } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
    await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('materializes lessons from a weekly series, then reschedules and cancels one', async () => {
    const startDate = new Date(Date.now() + DAY_MS);
    // Cover the next four weeks so at least one weekday occurrence is generated.
    const from = new Date(Date.now()).toISOString();
    const to = new Date(Date.now() + 28 * DAY_MS).toISOString();

    // Recur on every weekday so a lesson is guaranteed inside the window.
    const series = await server()
      .post('/api/lesson-series')
      .set('Authorization', auth(owner))
      .send({
        enrollmentId,
        teacherId: ownerTeacherId,
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        localTime: '10:00',
        timezone: 'Europe/Kyiv',
        durationMin: 60,
        priceMinor: 50000,
        currency: 'UAH',
        startDate: startDate.toISOString(),
      })
      .expect(201);
    expect(series.body.weekdays).toHaveLength(7);

    const listed = await server()
      .get('/api/lessons')
      .query({ from, to })
      .set('Authorization', auth(owner))
      .expect(200);
    expect(listed.body.items.length).toBeGreaterThan(0);
    const lesson = listed.body.items[0];
    expect(lesson.status).toBe('SCHEDULED');
    expect(lesson.seriesId).toBe(series.body.id);
    expect(lesson.isDetached).toBe(false);

    // Reschedule this single occurrence — it detaches from the series.
    const newStart = new Date(
      new Date(lesson.startsAtUtc).getTime() + 90 * 60_000,
    );
    const moved = await server()
      .patch(`/api/lessons/${lesson.id}/reschedule`)
      .set('Authorization', auth(owner))
      .send({ startsAtUtc: newStart.toISOString(), scope: 'this' })
      .expect(200);
    expect(moved.body.isDetached).toBe(true);
    expect(new Date(moved.body.startsAtUtc).getTime()).toBe(newStart.getTime());
    // The move is counted: no status expresses "rescheduled", so Stage 5
    // analytics reads this instead of reconstructing it from audit rows.
    expect(moved.body.rescheduledCount).toBe(1);
    expect(moved.body.rescheduledAt).not.toBeNull();

    // Cancel it with a charge, attributed to the student.
    const cancelled = await server()
      .patch(`/api/lessons/${lesson.id}/status`)
      .set('Authorization', auth(owner))
      .send({
        targetStatus: 'CANCELLED_CHARGED',
        cancelledBy: 'STUDENT',
        cancelledReason: 'Late notice',
      })
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED_CHARGED');
    expect(cancelled.body.cancelledBy).toBe('STUDENT');
    expect(cancelled.body.cancelledAt).not.toBeNull();

    // An illegal transition (completed → charged) is rejected.
    await server()
      .patch(`/api/lessons/${lesson.id}/status`)
      .set('Authorization', auth(owner))
      .send({ targetStatus: 'COMPLETED' })
      .expect(409);
  });

  it('shifts the pattern on "this and following" and counts the move', async () => {
    const startDate = new Date(Date.now() + DAY_MS);
    const series = await server()
      .post('/api/lesson-series')
      .set('Authorization', auth(owner))
      .send({
        enrollmentId,
        teacherId: ownerTeacherId,
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        // Clear of the 10:00 series above so the conflict check stays quiet.
        localTime: '16:00',
        timezone: 'Europe/Kyiv',
        durationMin: 60,
        priceMinor: 50000,
        currency: 'UAH',
        startDate: startDate.toISOString(),
      })
      .expect(201);

    const listed = await server()
      .get('/api/lessons')
      .query({
        from: new Date().toISOString(),
        to: new Date(Date.now() + 28 * DAY_MS).toISOString(),
        enrollmentId,
      })
      .set('Authorization', auth(owner))
      .expect(200);
    const lesson = listed.body.items.find(
      (item: { seriesId: string | null }) => item.seriesId === series.body.id,
    );
    expect(lesson).toBeDefined();

    // Move this occurrence and every later one by an hour: the series pattern
    // shifts and the lesson now occupying the slot carries the move.
    const newStart = new Date(
      new Date(lesson.startsAtUtc).getTime() + 60 * 60_000,
    );
    const moved = await server()
      .patch(`/api/lessons/${lesson.id}/reschedule`)
      .set('Authorization', auth(owner))
      .send({
        startsAtUtc: newStart.toISOString(),
        scope: 'this_and_following',
      })
      .expect(200);
    expect(new Date(moved.body.startsAtUtc).getTime()).toBe(newStart.getTime());
    expect(moved.body.rescheduledCount).toBe(1);
    expect(moved.body.rescheduledAt).not.toBeNull();

    const reloaded = await server()
      .get(`/api/lesson-series/${series.body.id}`)
      .set('Authorization', auth(owner))
      .expect(200);
    expect(reloaded.body.localTime).toBe('16:00');
    expect(reloaded.body.endsAt).toBe(lesson.startsAtUtc);
    const following = await server()
      .get('/api/lesson-series')
      .query({ enrollmentId })
      .set('Authorization', auth(owner))
      .expect(200);
    expect(
      following.body.items.some(
        (item: { localTime: string; weekdays: number[] }) =>
          item.localTime === '17:00' &&
          item.weekdays.includes(newStart.getUTCDay()),
      ),
    ).toBe(true);
  });

  it('books by studentId alone, creating the enrollment behind the scenes', async () => {
    // A brand-new student with no enrollment — the tutor-facing path.
    const student = await server()
      .post('/api/students')
      .set('Authorization', auth(owner))
      .send({
        fullName: 'Walk-in Student',
        timezone: 'Europe/Kyiv',
        hourlyRateMinor: 42000,
        currency: 'UAH',
      })
      .expect(201);

    // Early morning UTC, clear of the 10:00 Kyiv series materialized above.
    const start = new Date(Date.now() + 5 * DAY_MS);
    start.setUTCHours(3, 0, 0, 0);

    const created = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        studentId: student.body.id,
        startsAt: [start.toISOString()],
        durationMin: 60,
      })
      .expect(201);

    const lesson = created.body.items[0];
    expect(lesson.student.id).toBe(student.body.id);
    // Teacher auto-resolved (the workspace has exactly one) and the price came
    // from the student's own hourly rate.
    expect(lesson.teacherId).toBe(ownerTeacherId);
    expect(lesson.priceMinor).toBe(42000);
    expect(lesson.currency).toBe('UAH');
    expect(lesson.enrollmentId).not.toBeNull();

    // Booking the same student again reuses that enrollment instead of piling
    // up duplicates.
    const second = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        studentId: student.body.id,
        startsAt: [new Date(start.getTime() + 2 * 60 * 60_000).toISOString()],
        durationMin: 60,
      })
      .expect(201);
    expect(second.body.items[0].enrollmentId).toBe(lesson.enrollmentId);

    // Per-lesson notes round-trip.
    const noted = await server()
      .patch(`/api/lessons/${lesson.id}`)
      .set('Authorization', auth(owner))
      .send({ notes: 'Covered Past Simple; homework p.42' })
      .expect(200);
    expect(noted.body.notes).toBe('Covered Past Simple; homework p.42');
  });

  it('records a lesson that already happened, with its payment date', async () => {
    const student = await server()
      .post('/api/students')
      .set('Authorization', auth(owner))
      .send({
        fullName: 'Retroactive Student',
        timezone: 'Europe/Kyiv',
        hourlyRateMinor: 30000,
        currency: 'UAH',
      })
      .expect(201);

    // Yesterday: tutors write lessons down after teaching them.
    const start = new Date(Date.now() - DAY_MS);
    start.setUTCHours(6, 0, 0, 0);
    const paidAt = new Date(start.getTime() + 3 * 60 * 60_000);

    const created = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        studentId: student.body.id,
        startsAt: [start.toISOString()],
        durationMin: 60,
        status: 'COMPLETED',
        paidAt: paidAt.toISOString(),
      })
      .expect(201);

    const lesson = created.body.items[0];
    expect(lesson.status).toBe('COMPLETED');
    expect(lesson.completedAt).not.toBeNull();
    expect(lesson.paidAt).toBe(paidAt.toISOString());

    // The payment date is editable afterwards, and clearable.
    const cleared = await server()
      .patch(`/api/lessons/${lesson.id}`)
      .set('Authorization', auth(owner))
      .send({ paidAt: null })
      .expect(200);
    expect(cleared.body.paidAt).toBeNull();
  });

  it('rejects a cancelled booking that does not say who cancelled', async () => {
    const student = await server()
      .post('/api/students')
      .set('Authorization', auth(owner))
      .send({ fullName: 'No-show Student', timezone: 'Europe/Kyiv' })
      .expect(201);

    const start = new Date(Date.now() - 2 * DAY_MS);
    start.setUTCHours(7, 0, 0, 0);

    await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        studentId: student.body.id,
        startsAt: [start.toISOString()],
        durationMin: 60,
        status: 'CANCELLED_CHARGED',
      })
      .expect(400);

    const created = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        studentId: student.body.id,
        startsAt: [start.toISOString()],
        durationMin: 60,
        status: 'CANCELLED_CHARGED',
        cancelledBy: 'STUDENT',
      })
      .expect(201);
    expect(created.body.items[0].status).toBe('CANCELLED_CHARGED');
    expect(created.body.items[0].cancelledBy).toBe('STUDENT');
    expect(created.body.items[0].cancelledAt).not.toBeNull();
  });

  it('corrects a booked lesson and deletes it', async () => {
    const student = await server()
      .post('/api/students')
      .set('Authorization', auth(owner))
      .send({ fullName: 'Correctable Student', timezone: 'Europe/Kyiv' })
      .expect(201);

    const start = new Date(Date.now() + 6 * DAY_MS);
    start.setUTCHours(2, 0, 0, 0);
    const created = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        studentId: student.body.id,
        startsAt: [start.toISOString()],
        durationMin: 60,
        priceMinor: 30000,
        currency: 'UAH',
      })
      .expect(201);
    const lesson = created.body.items[0];

    // The cancellation deadline travels with the lesson so the cancel dialog can
    // tell the tutor whether cancelling now is late.
    expect(lesson.cancellationDeadlineHours).toBe(24);

    const fixed = await server()
      .patch(`/api/lessons/${lesson.id}`)
      .set('Authorization', auth(owner))
      .send({ priceMinor: 55000, currency: 'UAH', notes: 'Rate corrected' })
      .expect(200);
    expect(fixed.body.priceMinor).toBe(55000);
    expect(fixed.body.notes).toBe('Rate corrected');

    await server()
      .delete(`/api/lessons/${lesson.id}`)
      .set('Authorization', auth(owner))
      .expect(204);

    // Idempotent: deleting again is still a no-op.
    await server()
      .delete(`/api/lessons/${lesson.id}`)
      .set('Authorization', auth(owner))
      .expect(204);

    const remaining = await server()
      .get('/api/lessons')
      .query({
        from: new Date(Date.now() + 5 * DAY_MS).toISOString(),
        to: new Date(Date.now() + 7 * DAY_MS).toISOString(),
      })
      .set('Authorization', auth(owner))
      .expect(200);
    expect(
      remaining.body.items.some(
        (item: { id: string }) => item.id === lesson.id,
      ),
    ).toBe(false);
  });

  it('rejects a double-booking with 409 unless forced', async () => {
    const start = new Date(Date.now() + 3 * DAY_MS);
    start.setUTCHours(8, 0, 0, 0);

    await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        enrollmentId,
        teacherId: ownerTeacherId,
        startsAt: [start.toISOString()],
        durationMin: 60,
        priceMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);

    // Overlapping the same teacher → conflict.
    const conflict = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        enrollmentId,
        teacherId: ownerTeacherId,
        startsAt: [new Date(start.getTime() + 30 * 60_000).toISOString()],
        durationMin: 60,
        priceMinor: 50000,
        currency: 'UAH',
      })
      .expect(409);
    expect(conflict.body.code).toBe('SCHEDULE_CONFLICT');

    // force=true books it anyway.
    await server()
      .post('/api/lessons')
      .query({ force: true })
      .set('Authorization', auth(owner))
      .send({
        enrollmentId,
        teacherId: ownerTeacherId,
        startsAt: [new Date(start.getTime() + 30 * 60_000).toISOString()],
        durationMin: 60,
        priceMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);
  });

  it('treats force=false as false and only bypasses conflicts for force=true', async () => {
    const start = new Date(Date.now() + 40 * DAY_MS);
    start.setUTCHours(4, 0, 0, 0);
    const body = {
      enrollmentId,
      teacherId: ownerTeacherId,
      startsAt: [start.toISOString()],
      durationMin: 60,
      priceMinor: 50000,
      currency: 'UAH',
    };

    await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send(body)
      .expect(201);

    await server()
      .post('/api/lessons')
      .query({ force: 'false' })
      .set('Authorization', auth(owner))
      .send(body)
      .expect(409);

    await server()
      .post('/api/lessons')
      .query({ force: 'true' })
      .set('Authorization', auth(owner))
      .send(body)
      .expect(201);
  });

  it('validates every series candidate and rolls back a conflicting create unless forced', async () => {
    const start = new Date(Date.now() + 50 * DAY_MS);
    start.setUTCHours(22, 0, 0, 0);
    await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        enrollmentId,
        teacherId: ownerTeacherId,
        startsAt: [start.toISOString()],
        durationMin: 60,
        priceMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);

    const body = {
      enrollmentId,
      teacherId: ownerTeacherId,
      weekdays: [start.getUTCDay()],
      localTime: '22:00',
      timezone: 'UTC',
      durationMin: 60,
      priceMinor: 50000,
      currency: 'UAH',
      startDate: start.toISOString(),
    };
    const rejected = await server()
      .post('/api/lesson-series')
      .set('Authorization', auth(owner))
      .send(body)
      .expect(409);
    expect(rejected.body.code).toBe('SCHEDULE_CONFLICT');
    expect(
      await prisma.lessonSeries.count({
        where: { workspaceId, localTime: '22:00', timezone: 'UTC' },
      }),
    ).toBe(0);

    await server()
      .post('/api/lesson-series')
      .query({ force: 'true' })
      .set('Authorization', auth(owner))
      .send(body)
      .expect(201);
  });

  it('keeps a past scheduled lesson scheduled and filters by the stored status', async () => {
    const start = new Date(Date.now() - 3 * DAY_MS);
    start.setUTCHours(23, 0, 0, 0);
    const created = await server()
      .post('/api/lessons')
      .set('Authorization', auth(owner))
      .send({
        enrollmentId,
        teacherId: ownerTeacherId,
        startsAt: [start.toISOString()],
        durationMin: 30,
        priceMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);
    const listed = await server()
      .get('/api/lessons')
      .query({
        from: new Date(start.getTime() - DAY_MS).toISOString(),
        to: new Date(start.getTime() + DAY_MS).toISOString(),
        status: 'SCHEDULED',
      })
      .set('Authorization', auth(owner))
      .expect(200);
    expect(listed.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.items[0].id,
          status: 'SCHEDULED',
        }),
      ]),
    );
  });

  it('suspends only future individual work, restores it conflict-safely, and remains idempotent', async () => {
    const student = await server()
      .post('/api/students')
      .set('Authorization', auth(owner))
      .send({ fullName: 'Pause lifecycle student', timezone: 'UTC' })
      .expect(201);
    const enrollment = await server()
      .post('/api/enrollments')
      .set('Authorization', auth(owner))
      .send({
        studentId: student.body.id,
        teacherId: ownerTeacherId,
        priceMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);
    const start = new Date(Date.now() + 55 * DAY_MS);
    start.setUTCHours(23, 0, 0, 0);
    const series = await server()
      .post('/api/lesson-series')
      .set('Authorization', auth(owner))
      .send({
        enrollmentId: enrollment.body.id,
        teacherId: ownerTeacherId,
        weekdays: [start.getUTCDay()],
        localTime: '23:00',
        timezone: 'UTC',
        durationMin: 60,
        priceMinor: 50000,
        currency: 'UAH',
        startDate: start.toISOString(),
      })
      .expect(201);
    const suspended = await prisma.lesson.findFirstOrThrow({
      where: { seriesId: series.body.id, startsAtUtc: { gte: start } },
    });
    await Promise.all([
      server()
        .patch(`/api/enrollments/${enrollment.body.id}`)
        .set('Authorization', auth(owner))
        .send({ status: 'PAUSED' })
        .expect(200),
      server()
        .patch(`/api/enrollments/${enrollment.body.id}`)
        .set('Authorization', auth(owner))
        .send({ status: 'PAUSED' })
        .expect(200),
    ]);
    const paused = await prisma.lesson.findUniqueOrThrow({
      where: { id: suspended.id },
      select: { deletedAt: true, scheduleSuspensionToken: true },
    });
    expect(paused.deletedAt).not.toBeNull();
    expect(paused.scheduleSuspensionToken).toEqual(expect.any(String));
    await server()
      .delete(`/api/enrollments/${enrollment.body.id}`)
      .set('Authorization', auth(owner))
      .expect(204);
    await server()
      .post(`/api/enrollments/${enrollment.body.id}/restore`)
      .set('Authorization', auth(owner))
      .expect(201);
    expect(
      await prisma.enrollment.findUniqueOrThrow({
        where: { id: enrollment.body.id },
        select: { status: true, scheduleSuspensionToken: true },
      }),
    ).toEqual({
      status: 'PAUSED',
      scheduleSuspensionToken: paused.scheduleSuspensionToken,
    });
    await materializer.materializeAll();
    expect(
      await prisma.lesson.count({
        where: { seriesId: series.body.id, deletedAt: null },
      }),
    ).toBe(0);

    const blocker = await prisma.lesson.create({
      data: {
        workspaceId,
        enrollmentId,
        teacherId: ownerTeacherId,
        startsAtUtc: suspended.startsAtUtc,
        durationMin: suspended.durationMin,
        priceMinor: 50000,
        currency: 'UAH',
      },
    });
    await server()
      .patch(`/api/enrollments/${enrollment.body.id}`)
      .set('Authorization', auth(owner))
      .send({ status: 'ACTIVE' })
      .expect(409);
    expect(
      await prisma.enrollment.findUniqueOrThrow({
        where: { id: enrollment.body.id },
        select: { status: true },
      }),
    ).toEqual({ status: 'PAUSED' });
    await prisma.lesson.delete({ where: { id: blocker.id } });
    await server()
      .patch(`/api/enrollments/${enrollment.body.id}`)
      .set('Authorization', auth(owner))
      .send({ status: 'ACTIVE' })
      .expect(200);
    await server()
      .patch(`/api/enrollments/${enrollment.body.id}`)
      .set('Authorization', auth(owner))
      .send({ status: 'ACTIVE' })
      .expect(200);
    expect(
      await prisma.lesson.findUniqueOrThrow({
        where: { id: suspended.id },
        select: { deletedAt: true, scheduleSuspensionToken: true },
      }),
    ).toEqual({ deletedAt: null, scheduleSuspensionToken: null });
  });

  it('keeps a group running with one active member and suspends/restores only on roster-empty', async () => {
    const [first, second] = await Promise.all(
      ['First group member', 'Second group member'].map((fullName) =>
        server()
          .post('/api/students')
          .set('Authorization', auth(owner))
          .send({ fullName, timezone: 'UTC' })
          .expect(201),
      ),
    );
    const group = await server()
      .post('/api/groups')
      .set('Authorization', auth(owner))
      .send({ name: `Pause roster ${runId}` })
      .expect(201);
    const enrollments = await Promise.all(
      [first, second].map((student) =>
        server()
          .post('/api/enrollments')
          .set('Authorization', auth(owner))
          .send({
            studentId: student.body.id,
            groupId: group.body.id,
            teacherId: ownerTeacherId,
            priceMinor: 50000,
            currency: 'UAH',
          })
          .expect(201),
      ),
    );
    const start = new Date(Date.now() + 58 * DAY_MS);
    start.setUTCHours(0, 30, 0, 0);
    const series = await server()
      .post('/api/lesson-series')
      .set('Authorization', auth(owner))
      .send({
        groupId: group.body.id,
        teacherId: ownerTeacherId,
        weekdays: [start.getUTCDay()],
        localTime: '00:30',
        timezone: 'UTC',
        durationMin: 60,
        priceMinor: 50000,
        currency: 'UAH',
        startDate: start.toISOString(),
      })
      .expect(201);
    const lesson = await prisma.lesson.findFirstOrThrow({
      where: { seriesId: series.body.id, startsAtUtc: { gte: start } },
    });
    await server()
      .patch(`/api/enrollments/${enrollments[0].body.id}`)
      .set('Authorization', auth(owner))
      .send({ status: 'PAUSED' })
      .expect(200);
    expect(
      await prisma.lesson.findUniqueOrThrow({
        where: { id: lesson.id },
        select: { deletedAt: true },
      }),
    ).toEqual({ deletedAt: null });
    await server()
      .patch(`/api/enrollments/${enrollments[1].body.id}`)
      .set('Authorization', auth(owner))
      .send({ status: 'PAUSED' })
      .expect(200);
    expect(
      (
        await prisma.lesson.findUniqueOrThrow({
          where: { id: lesson.id },
          select: { deletedAt: true, scheduleSuspensionToken: true },
        })
      ).scheduleSuspensionToken,
    ).toEqual(expect.any(String));
    await server()
      .patch(`/api/enrollments/${enrollments[0].body.id}`)
      .set('Authorization', auth(owner))
      .send({ status: 'ACTIVE' })
      .expect(200);
    expect(
      await prisma.lesson.findUniqueOrThrow({
        where: { id: lesson.id },
        select: { deletedAt: true, scheduleSuspensionToken: true },
      }),
    ).toEqual({ deletedAt: null, scheduleSuspensionToken: null });
  });

  it('serializes concurrent materialization for one series without duplicate occurrences', async () => {
    const student = await server()
      .post('/api/students')
      .set('Authorization', auth(owner))
      .send({ fullName: 'Concurrent materialization student', timezone: 'UTC' })
      .expect(201);
    const enrollment = await server()
      .post('/api/enrollments')
      .set('Authorization', auth(owner))
      .send({
        studentId: student.body.id,
        teacherId: ownerTeacherId,
        priceMinor: 50000,
        currency: 'UAH',
      })
      .expect(201);
    const start = new Date(Date.now() + 65 * DAY_MS);
    start.setUTCHours(20, 0, 0, 0);
    const series = await prisma.lessonSeries.create({
      data: {
        workspaceId,
        enrollmentId: enrollment.body.id,
        teacherId: ownerTeacherId,
        weekdays: [start.getUTCDay()],
        localTime: '20:00',
        timezone: 'UTC',
        durationMin: 60,
        priceMinor: 50000,
        currency: 'UAH',
        startDate: start,
        horizonMaterializedUntil: start,
      },
    });
    const until = new Date(start.getTime() + 15 * DAY_MS);
    await Promise.all([
      prisma.$transaction((tx) =>
        materializer.materializeSeries(tx, series, until, start),
      ),
      prisma.$transaction((tx) =>
        materializer.materializeSeries(tx, series, until, start),
      ),
    ]);
    const occurrences = await prisma.lesson.findMany({
      where: { seriesId: series.id },
      select: { startsAtUtc: true },
    });
    expect(occurrences).toHaveLength(3);
    expect(
      new Set(occurrences.map((row) => row.startsAtUtc.getTime())).size,
    ).toBe(3);
  });
});
