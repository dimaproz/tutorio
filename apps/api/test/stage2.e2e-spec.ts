import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const runId = randomUUID().slice(0, 8);
const emailFor = (label: string) => `e2e-${runId}-${label}@example.com`;

describe('Stage 2: students, groups, enrollments, settings, audit (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // Two fully isolated workspaces: A (owner + teacher) and B (owner only).
  let ownerA: string;
  let teacherA: string;
  let ownerB: string;
  let workspaceAId: string;
  let teacherAMemberId: string;
  // Teacher profiles (teacherId references Teacher, not the member).
  let ownerTeacherId: string;
  let secondTeacherId: string;

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

    // Workspace A runs two teachers below, so it registers as a school: SOLO
    // workspaces refuse a second teaching profile by design.
    const registerA = await server()
      .post('/api/auth/register')
      .send({
        name: 'Owner A',
        workspaceName: `E2E WS A ${runId}`,
        email: emailFor('owner-a'),
        password: 'correct horse battery staple',
        mode: 'SCHOOL',
      })
      .expect(201);
    ownerA = registerA.body.tokens.accessToken;
    workspaceAId = registerA.body.workspace.id;

    const registerB = await server()
      .post('/api/auth/register')
      .send({
        name: 'Owner B',
        workspaceName: `E2E WS B ${runId}`,
        email: emailFor('owner-b'),
        password: 'correct horse battery staple',
      })
      .expect(201);
    ownerB = registerB.body.tokens.accessToken;

    // Teacher membership in workspace A, seeded directly (invitations are
    // out of Stage 2 scope).
    const teacherPassword = 'teacher passphrase long enough';
    const teacherUser = await prisma.user.create({
      data: {
        email: emailFor('teacher-a'),
        name: 'Teacher A',
        passwordHash: await hash(teacherPassword, {
          algorithm: 2,
          memoryCost: 19_456,
          timeCost: 2,
          parallelism: 1,
        }),
      },
    });
    await prisma.workspaceMember.create({
      data: {
        userId: teacherUser.id,
        workspaceId: workspaceAId,
        role: 'TEACHER',
      },
    });
    const teacherLogin = await server()
      .post('/api/auth/login')
      .send({ email: teacherUser.email, password: teacherPassword })
      .expect(200);
    teacherA = teacherLogin.body.tokens.accessToken;

    const members = await server()
      .get('/api/workspaces/current/members')
      .set('Authorization', auth(ownerA))
      .expect(200);
    teacherAMemberId = members.body.items.find(
      (m: { role: string }) => m.role === 'TEACHER',
    ).id;

    // Registration auto-creates a teaching profile for the owner; a second one
    // is created explicitly. Enrollments reference these Teacher ids.
    const teachers = await server()
      .get('/api/teachers')
      .set('Authorization', auth(ownerA))
      .expect(200);
    ownerTeacherId = teachers.body.items[0].id;
    const secondTeacher = await server()
      .post('/api/teachers')
      .set('Authorization', auth(ownerA))
      .send({ fullName: 'Teacher A', workspaceMemberId: teacherAMemberId })
      .expect(201);
    secondTeacherId = secondTeacher.body.id;
  });

  afterAll(async () => {
    // Remove everything created by this run, FK-safe order, scoped strictly
    // to this run's users/workspaces.
    const users = await prisma.user.findMany({
      where: { email: { startsWith: `e2e-${runId}-` } },
      include: { memberships: true },
    });
    const userIds = users.map((user) => user.id);
    const workspaceIds = [
      ...new Set(
        users.flatMap((user) => user.memberships.map((m) => m.workspaceId)),
      ),
    ];
    await prisma.auditLog.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.lessonCreditEntry.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.payment.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.lessonCharge.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.pausePackageExtension.deleteMany({
      where: { pause: { workspaceId: { in: workspaceIds } } },
    });
    await prisma.pause.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.lesson.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.lessonSeries.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.schedule.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.lessonPackage.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.enrollment.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.teacher.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.studentParent.deleteMany({
      where: { student: { workspaceId: { in: workspaceIds } } },
    });
    await prisma.student.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.parent.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.group.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: { in: workspaceIds } },
    });
    await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  async function auditCount(entity: string, entityId: string, action: string) {
    const logs = await server()
      .get('/api/audit-logs')
      .query({ entity, entityId, action })
      .set('Authorization', auth(ownerA))
      .expect(200);
    return logs.body.total as number;
  }

  describe('students CRUD and tenant isolation', () => {
    let studentId: string;
    let parentId: string;

    it('creates a student linked to a parent and audits exactly one CREATE', async () => {
      const parent = await server()
        .post('/api/parents')
        .set('Authorization', auth(ownerA))
        .send({ fullName: 'Parent Learner', phone: '+380501112299' })
        .expect(201);
      parentId = parent.body.id;

      const created = await server()
        .post('/api/students')
        .set('Authorization', auth(ownerA))
        .send({
          fullName: 'Alice Learner',
          email: 'alice@example.com',
          phone: '+380501112233',
          timezone: 'Europe/Kyiv',
          telegramUsername: 'alice_e2e',
          hourlyRateMinor: 45000,
          currency: 'UAH',
          languageLevel: 'B1',
          knowledgeLevel: 'INTERMEDIATE',
          age: 16,
          grade: 10,
          parentIds: [parentId],
          notes: 'Prefers evening lessons',
        })
        .expect(201);
      studentId = created.body.id;

      expect(created.body).toMatchObject({
        fullName: 'Alice Learner',
        status: 'ACTIVE',
        parents: [{ id: parentId, fullName: 'Parent Learner' }],
        deletedAt: null,
      });
      expect(await auditCount('STUDENT', studentId, 'CREATE')).toBe(1);
    });

    it('does not leak internal fields in responses', async () => {
      const detail = await server()
        .get(`/api/students/${studentId}`)
        .set('Authorization', auth(ownerA))
        .expect(200);
      const keys = Object.keys(detail.body as Record<string, unknown>);
      expect(keys.sort()).toEqual(
        [
          'id',
          'workspaceId',
          'fullName',
          'email',
          'phone',
          'timezone',
          'telegramUsername',
          'hourlyRateMinor',
          'currency',
          'status',
          'languageLevel',
          'knowledgeLevel',
          'age',
          'grade',
          'avatarKey',
          'parents',
          'notes',
          'createdAt',
          'updatedAt',
          'deletedAt',
          'enrollments',
        ].sort(),
      );
    });

    it('searches by telegram username and paginates', async () => {
      const list = await server()
        .get('/api/students')
        .query({ search: 'alice_e2e' })
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(list.body.total).toBe(1);
      expect(list.body.totalPages).toBe(1);
      expect(list.body.items[0].fullName).toBe('Alice Learner');
      expect(list.body.items[0].createdAt).toEqual(expect.any(String));
    });

    it('owner updates with PATCH semantics and audits the diff; no-op adds nothing', async () => {
      await server()
        .patch(`/api/students/${studentId}`)
        .set('Authorization', auth(ownerA))
        .send({ notes: 'Moved to mornings', phone: null })
        .expect(200);
      expect(await auditCount('STUDENT', studentId, 'UPDATE')).toBe(1);

      // Identical payload → no new audit row.
      await server()
        .patch(`/api/students/${studentId}`)
        .set('Authorization', auth(ownerA))
        .send({ notes: 'Moved to mornings' })
        .expect(200);
      expect(await auditCount('STUDENT', studentId, 'UPDATE')).toBe(1);
    });

    it('rejects a parentId that belongs to another workspace', async () => {
      const parentB = await server()
        .post('/api/parents')
        .set('Authorization', auth(ownerB))
        .send({ fullName: 'Foreign Parent' })
        .expect(201);
      const before = await auditCount('STUDENT', studentId, 'UPDATE');

      const rejected = await server()
        .patch(`/api/students/${studentId}`)
        .set('Authorization', auth(ownerA))
        .send({ parentIds: [parentB.body.id] })
        .expect(404);
      expect(rejected.body.code).toBe('INVALID_WORKSPACE_RELATION');
      // Rejected mid-transaction: no partial write, no audit row.
      expect(await auditCount('STUDENT', studentId, 'UPDATE')).toBe(before);
    });

    it('relinks parents via PATCH parentIds and audits the diff', async () => {
      const before = await auditCount('STUDENT', studentId, 'UPDATE');

      await server()
        .patch(`/api/students/${studentId}`)
        .set('Authorization', auth(ownerA))
        .send({ parentIds: [] })
        .expect(200);
      const cleared = await server()
        .get(`/api/students/${studentId}`)
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(cleared.body.parents).toEqual([]);

      await server()
        .patch(`/api/students/${studentId}`)
        .set('Authorization', auth(ownerA))
        .send({ parentIds: [parentId] })
        .expect(200);
      const relinked = await server()
        .get(`/api/students/${studentId}`)
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(relinked.body.parents).toEqual([
        {
          id: parentId,
          fullName: 'Parent Learner',
          avatarKey: null,
          phone: '+380501112299',
          telegramUsername: null,
        },
      ]);
      expect(await auditCount('STUDENT', studentId, 'UPDATE')).toBe(before + 2);
    });

    it('puts a student on hold and restores active status', async () => {
      const onHold = await server()
        .patch(`/api/students/${studentId}`)
        .set('Authorization', auth(ownerA))
        .send({ status: 'ON_HOLD' })
        .expect(200);
      expect(onHold.body.status).toBe('ON_HOLD');
      expect(onHold.body.deletedAt).toBeNull();

      const active = await server()
        .patch(`/api/students/${studentId}`)
        .set('Authorization', auth(ownerA))
        .send({ status: 'ACTIVE' })
        .expect(200);
      expect(active.body.status).toBe('ACTIVE');
    });

    it('hides workspace A students from workspace B behind the same 404', async () => {
      const read = await server()
        .get(`/api/students/${studentId}`)
        .set('Authorization', auth(ownerB))
        .expect(404);
      expect(read.body.code).toBe('STUDENT_NOT_FOUND');

      await server()
        .patch(`/api/students/${studentId}`)
        .set('Authorization', auth(ownerB))
        .send({ fullName: 'Hijacked' })
        .expect(404);
      await server()
        .delete(`/api/students/${studentId}`)
        .set('Authorization', auth(ownerB))
        .expect(404);

      const listB = await server()
        .get('/api/students')
        .set('Authorization', auth(ownerB))
        .expect(200);
      expect(listB.body.total).toBe(0);
    });

    it('archives and restores a student; an unused student can be hard-deleted explicitly', async () => {
      await server()
        .delete(`/api/students/${studentId}`)
        .set('Authorization', auth(ownerA))
        .expect(204);
      expect(await auditCount('STUDENT', studentId, 'DELETE')).toBe(1);

      // Archive hides the student from operational lists but does not destroy
      // its identity. The explicit restore command is idempotent.
      const defaultList = await server()
        .get('/api/students')
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(defaultList.body.total).toBe(0);
      // The Archived tab asks state=deleted&status=ARCHIVED. Archive never sets
      // deletedAt, so for students `state` selects by status.
      for (const query of [
        { state: 'deleted', status: 'ARCHIVED' },
        { state: 'deleted' },
        { status: 'ARCHIVED' },
      ]) {
        const archivedList = await server()
          .get('/api/students')
          .query(query)
          .set('Authorization', auth(ownerA))
          .expect(200);
        expect(
          archivedList.body.items.map((row: { id: string }) => row.id),
        ).toEqual([studentId]);
      }
      const everyStatus = await server()
        .get('/api/students')
        .query({ state: 'all' })
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(everyStatus.body.total).toBe(1);
      const summary = await server()
        .get('/api/students/summary')
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(summary.body).toEqual({
        all: 0,
        ACTIVE: 0,
        ON_HOLD: 0,
        ARCHIVED: 1,
      });
      const restored = await server()
        .post(`/api/students/${studentId}/restore`)
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(restored.body).toMatchObject({
        id: studentId,
        status: 'ACTIVE',
        deletedAt: null,
      });
      expect(await auditCount('STUDENT', studentId, 'RESTORE')).toBe(1);
      await server()
        .post(`/api/students/${studentId}/restore`)
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(await auditCount('STUDENT', studentId, 'RESTORE')).toBe(1);

      await server()
        .delete(`/api/students/${studentId}/permanently`)
        .set('Authorization', auth(ownerA))
        .expect(204);

      // A removed draft is genuinely gone; the regular lifecycle endpoint has
      // no hidden restore behavior after a hard delete.
      await server()
        .delete(`/api/students/${studentId}/permanently`)
        .set('Authorization', auth(ownerA))
        .expect(404);
    });
  });

  describe('groups and enrollments', () => {
    let studentId: string;
    let groupId: string;
    let groupEnrollmentId: string;

    beforeAll(async () => {
      const student = await server()
        .post('/api/students')
        .set('Authorization', auth(ownerA))
        .send({ fullName: 'Bohdan Learner', timezone: 'Europe/Kyiv' })
        .expect(201);
      studentId = student.body.id;
    });

    it('creates and finds groups by search', async () => {
      const group = await server()
        .post('/api/groups')
        .set('Authorization', auth(ownerA))
        .send({ name: `B1 English ${runId}`, notes: 'Tue/Thu evenings' })
        .expect(201);
      groupId = group.body.id;
      expect(await auditCount('GROUP', groupId, 'CREATE')).toBe(1);

      const found = await server()
        .get('/api/groups')
        .query({ search: `b1 english ${runId}` })
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(found.body.total).toBe(1);
      expect(found.body.items[0].activeStudentCount).toBe(0);
    });

    it('creates an individual enrollment and resolves the effective deadline', async () => {
      const created = await server()
        .post('/api/enrollments')
        .set('Authorization', auth(ownerA))
        .send({
          studentId,
          teacherId: secondTeacherId,
          billingType: 'PACKAGE',
          priceMinor: 45000,
          currency: 'UAH',
        })
        .expect(201);
      expect(created.body.student.fullName).toBe('Bohdan Learner');
      expect(created.body.teacher.name).toBe('Teacher A');
      expect(created.body.group).toBeNull();
      expect(created.body.cancellationDeadlineHours).toBeNull();
      // No override → inherits the workspace default (registration default 24).
      expect(created.body.effectiveCancellationDeadlineHours).toBe(24);
    });

    it('rejects a duplicate individual enrollment with 409', async () => {
      const duplicate = await server()
        .post('/api/enrollments')
        .set('Authorization', auth(ownerA))
        .send({
          studentId,
          teacherId: secondTeacherId,
          priceMinor: 50000,
          currency: 'UAH',
        })
        .expect(409);
      expect(duplicate.body.code).toBe('DUPLICATE_ENROLLMENT');
    });

    it('adds the student to a group with separate billing (owner as teacher)', async () => {
      const created = await server()
        .post('/api/enrollments')
        .set('Authorization', auth(ownerA))
        .send({
          studentId,
          groupId,
          teacherId: ownerTeacherId,
          billingType: 'PER_LESSON',
          priceMinor: 120000,
          currency: 'EUR',
          cancellationDeadlineHours: 48,
        })
        .expect(201);
      groupEnrollmentId = created.body.id;
      expect(created.body.effectiveCancellationDeadlineHours).toBe(48);

      const groups = await server()
        .get('/api/groups')
        .query({ search: `B1 English ${runId}` })
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(groups.body.items[0].activeStudentCount).toBe(1);

      const duplicate = await server()
        .post('/api/enrollments')
        .set('Authorization', auth(ownerA))
        .send({
          studentId,
          groupId,
          teacherId: secondTeacherId,
          priceMinor: 1,
          currency: 'EUR',
        })
        .expect(409);
      expect(duplicate.body.code).toBe('DUPLICATE_ENROLLMENT');
    });

    it('refuses to connect cross-workspace records', async () => {
      const studentB = await server()
        .post('/api/students')
        .set('Authorization', auth(ownerB))
        .send({ fullName: 'Foreign Student', timezone: 'UTC' })
        .expect(201);

      const crossStudent = await server()
        .post('/api/enrollments')
        .set('Authorization', auth(ownerA))
        .send({
          studentId: studentB.body.id,
          teacherId: secondTeacherId,
          priceMinor: 100,
          currency: 'EUR',
        })
        .expect(404);
      expect(crossStudent.body.code).toBe('STUDENT_NOT_FOUND');

      const crossTeacher = await server()
        .post('/api/enrollments')
        .set('Authorization', auth(ownerB))
        .send({
          studentId: studentB.body.id,
          teacherId: secondTeacherId,
          priceMinor: 100,
          currency: 'EUR',
        })
        .expect(404);
      expect(crossTeacher.body.code).toBe('TEACHER_NOT_FOUND');
    });

    it('archives an active or paused group without disconnecting its roster', async () => {
      // A PAUSED enrollment is still historical membership and must stay linked
      // through archive and restore.
      await server()
        .patch(`/api/enrollments/${groupEnrollmentId}`)
        .set('Authorization', auth(ownerA))
        .send({ status: 'PAUSED' })
        .expect(200);

      await server()
        .delete(`/api/groups/${groupId}`)
        .set('Authorization', auth(ownerA))
        .expect(204);
      expect(await auditCount('GROUP', groupId, 'DELETE')).toBe(1);

      const archivedEnrollment = await prisma.enrollment.findUniqueOrThrow({
        where: { id: groupEnrollmentId },
        select: { groupId: true, status: true, deletedAt: true },
      });
      expect(archivedEnrollment).toEqual({
        groupId,
        status: 'PAUSED',
        deletedAt: null,
      });

      const restored = await server()
        .post(`/api/groups/${groupId}/restore`)
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(restored.body.deletedAt).toBeNull();
      expect(await auditCount('GROUP', groupId, 'RESTORE')).toBe(1);
      await server()
        .post(`/api/groups/${groupId}/restore`)
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(await auditCount('GROUP', groupId, 'RESTORE')).toBe(1);

      // Repeated archive/restore calls are safe no-ops after the first change.
      await server()
        .delete(`/api/groups/${groupId}`)
        .set('Authorization', auth(ownerA))
        .expect(204);
      expect(await auditCount('GROUP', groupId, 'DELETE')).toBe(2);
      await server()
        .delete(`/api/groups/${groupId}`)
        .set('Authorization', auth(ownerA))
        .expect(204);
      expect(await auditCount('GROUP', groupId, 'DELETE')).toBe(2);
    });
  });

  describe('history-preserving lifecycles', () => {
    let historyStudentId: string;
    let historyGroupId: string;
    let groupEnrollmentId: string;
    let groupPackageId: string;

    it('archives and restores an empty group', async () => {
      const group = await server()
        .post('/api/groups')
        .set('Authorization', auth(ownerA))
        .send({ name: `Empty lifecycle group ${runId}` })
        .expect(201);

      await server()
        .delete(`/api/groups/${group.body.id}`)
        .set('Authorization', auth(ownerA))
        .expect(204);
      const restored = await server()
        .post(`/api/groups/${group.body.id}/restore`)
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(restored.body.deletedAt).toBeNull();
      expect(await auditCount('GROUP', group.body.id, 'DELETE')).toBe(1);
      expect(await auditCount('GROUP', group.body.id, 'RESTORE')).toBe(1);
    });

    it('archives and restores a group without clearing completed lessons or finance history', async () => {
      const student = await server()
        .post('/api/students')
        .set('Authorization', auth(ownerA))
        .send({ fullName: 'Lifecycle Learner', timezone: 'UTC' })
        .expect(201);
      historyStudentId = student.body.id;
      const group = await server()
        .post('/api/groups')
        .set('Authorization', auth(ownerA))
        .send({ name: `Lifecycle Group ${runId}` })
        .expect(201);
      historyGroupId = group.body.id;
      const enrollment = await server()
        .post('/api/enrollments')
        .set('Authorization', auth(ownerA))
        .send({
          studentId: historyStudentId,
          groupId: historyGroupId,
          teacherId: ownerTeacherId,
          priceMinor: 2500,
          currency: 'EUR',
        })
        .expect(201);
      groupEnrollmentId = enrollment.body.id;

      const now = new Date();
      const completedAt = new Date(now.getTime() - 2 * 86_400_000);
      const futureAt = new Date(now.getTime() + 2 * 86_400_000);
      // The member's package for the group (ADR 0007).
      const pkg = await prisma.lessonPackage.create({
        data: {
          workspaceId: workspaceAId,
          enrollmentId: groupEnrollmentId,
          studentId: historyStudentId,
          sizingMode: 'FIXED_COUNT',
          lessonsTotal: 2,
          pricePerLessonMinorSnapshot: 2500,
          totalPriceMinorSnapshot: 5000,
          currency: 'EUR',
        },
      });
      groupPackageId = pkg.id;
      const seriesSchedule = await prisma.schedule.create({
        data: {
          workspaceId: workspaceAId,
          groupId: historyGroupId,
          teacherId: ownerTeacherId,
          timezone: 'UTC',
          durationMin: 60,
          horizonWeeks: 12,
        },
      });
      const series = await prisma.lessonSeries.create({
        data: {
          scheduleId: seriesSchedule.id,
          workspaceId: workspaceAId,
          groupId: historyGroupId,
          teacherId: ownerTeacherId,
          weekdays: [futureAt.getUTCDay()],
          localTime: '10:00',
          timezone: 'UTC',
          durationMin: 60,
          priceMinor: 2500,
          currency: 'EUR',
          startDate: now,
          horizonMaterializedUntil: futureAt,
        },
      });
      const completed = await prisma.lesson.create({
        data: {
          workspaceId: workspaceAId,
          groupId: historyGroupId,
          seriesId: series.id,
          teacherId: ownerTeacherId,
          startsAtUtc: completedAt,
          durationMin: 60,
          priceMinor: 2500,
          currency: 'EUR',
          status: 'COMPLETED',
          completedAt,
        },
      });
      const future = await prisma.lesson.create({
        data: {
          workspaceId: workspaceAId,
          groupId: historyGroupId,
          seriesId: series.id,
          teacherId: ownerTeacherId,
          startsAtUtc: futureAt,
          durationMin: 60,
          priceMinor: 2500,
          currency: 'EUR',
        },
      });
      await prisma.lessonCreditEntry.create({
        data: {
          workspaceId: workspaceAId,
          packageId: pkg.id,
          delta: 2,
          type: 'purchase',
          idempotencyKey: `lifecycle-credit-${runId}`,
        },
      });
      await prisma.lessonCharge.create({
        data: {
          workspaceId: workspaceAId,
          lessonId: completed.id,
          enrollmentId: groupEnrollmentId,
          source: 'PACKAGE',
          packageId: pkg.id,
          amountMinor: 2500,
          currency: 'EUR',
        },
      });
      await prisma.payment.create({
        data: {
          workspaceId: workspaceAId,
          packageId: pkg.id,
          enrollmentId: groupEnrollmentId,
          amountMinor: 5000,
          currency: 'EUR',
          method: 'CASH',
        },
      });

      await server()
        .delete(`/api/groups/${historyGroupId}`)
        .set('Authorization', auth(teacherA))
        .expect(403);
      await server()
        .delete(`/api/groups/${historyGroupId}`)
        .set('Authorization', auth(ownerB))
        .expect(404);
      await server()
        .delete(`/api/groups/${historyGroupId}`)
        .set('Authorization', auth(ownerA))
        .expect(204);

      expect(
        await prisma.enrollment.findUniqueOrThrow({
          where: { id: groupEnrollmentId },
          select: { groupId: true, deletedAt: true },
        }),
      ).toEqual({ groupId: historyGroupId, deletedAt: null });
      expect(
        await prisma.lesson.findUniqueOrThrow({
          where: { id: completed.id },
          select: { groupId: true, status: true, deletedAt: true },
        }),
      ).toEqual({
        groupId: historyGroupId,
        status: 'COMPLETED',
        deletedAt: null,
      });
      expect(
        (
          await prisma.lesson.findUniqueOrThrow({
            where: { id: future.id },
            select: { deletedAt: true },
          })
        ).deletedAt,
      ).not.toBeNull();
      expect(
        (
          await prisma.lessonSeries.findUniqueOrThrow({
            where: { id: series.id },
            select: { deletedAt: true },
          })
        ).deletedAt,
      ).not.toBeNull();
      expect(
        await prisma.lessonPackage.findUniqueOrThrow({
          where: { id: pkg.id },
          select: { enrollmentId: true, deletedAt: true },
        }),
      ).toEqual({ enrollmentId: groupEnrollmentId, deletedAt: null });
      expect(
        await prisma.payment.count({
          where: { packageId: pkg.id, deletedAt: null },
        }),
      ).toBe(1);
      expect(
        await prisma.lessonCharge.count({
          where: { packageId: pkg.id, voidedAt: null },
        }),
      ).toBe(1);
      expect(
        await prisma.lessonCreditEntry.count({ where: { packageId: pkg.id } }),
      ).toBe(1);

      await server()
        .post(`/api/groups/${historyGroupId}/restore`)
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(
        (
          await prisma.lesson.findUniqueOrThrow({
            where: { id: future.id },
            select: { deletedAt: true },
          })
        ).deletedAt,
      ).toBeNull();
      expect(
        (
          await prisma.lessonSeries.findUniqueOrThrow({
            where: { id: series.id },
            select: { deletedAt: true },
          })
        ).deletedAt,
      ).toBeNull();
      expect(await auditCount('GROUP', historyGroupId, 'DELETE')).toBe(1);
      expect(await auditCount('GROUP', historyGroupId, 'RESTORE')).toBe(1);
    });

    it('rolls back a group restore when an external schedule conflict appeared', async () => {
      const group = await server()
        .post('/api/groups')
        .set('Authorization', auth(ownerA))
        .send({ name: `Conflicting lifecycle group ${runId}` })
        .expect(201);
      // An active member: restoring an empty group does not check the
      // calendar, because its lessons are suspended again at once.
      const member = await server()
        .post('/api/students')
        .set('Authorization', auth(ownerA))
        .send({ fullName: `Conflict member ${runId}`, timezone: 'UTC' })
        .expect(201);
      await prisma.enrollment.create({
        data: {
          workspaceId: workspaceAId,
          studentId: member.body.id,
          groupId: group.body.id,
          teacherId: ownerTeacherId,
          billingType: 'PACKAGE',
          priceMinor: 0,
          currency: 'EUR',
        },
      });
      const startsAtUtc = new Date(Date.now() + 3 * 86_400_000);
      const seriesSchedule = await prisma.schedule.create({
        data: {
          workspaceId: workspaceAId,
          groupId: group.body.id,
          teacherId: ownerTeacherId,
          timezone: 'UTC',
          durationMin: 60,
          horizonWeeks: 12,
        },
      });
      const series = await prisma.lessonSeries.create({
        data: {
          scheduleId: seriesSchedule.id,
          workspaceId: workspaceAId,
          groupId: group.body.id,
          teacherId: ownerTeacherId,
          weekdays: [startsAtUtc.getUTCDay()],
          localTime: '11:00',
          timezone: 'UTC',
          durationMin: 60,
          priceMinor: 0,
          currency: 'EUR',
          startDate: new Date(),
          horizonMaterializedUntil: startsAtUtc,
        },
      });
      const suspended = await prisma.lesson.create({
        data: {
          workspaceId: workspaceAId,
          groupId: group.body.id,
          seriesId: series.id,
          teacherId: ownerTeacherId,
          startsAtUtc,
          durationMin: 60,
          priceMinor: 0,
          currency: 'EUR',
        },
      });
      await server()
        .delete(`/api/groups/${group.body.id}`)
        .set('Authorization', auth(ownerA))
        .expect(204);
      await prisma.lesson.create({
        data: {
          workspaceId: workspaceAId,
          teacherId: ownerTeacherId,
          startsAtUtc,
          durationMin: 60,
          priceMinor: 0,
          currency: 'EUR',
        },
      });

      const rejected = await server()
        .post(`/api/groups/${group.body.id}/restore`)
        .set('Authorization', auth(ownerA))
        .expect(409);
      expect(rejected.body.code).toBe('SCHEDULE_CONFLICT');
      expect(
        (
          await prisma.group.findUniqueOrThrow({
            where: { id: group.body.id },
            select: { deletedAt: true },
          })
        ).deletedAt,
      ).not.toBeNull();
      expect(
        (
          await prisma.lesson.findUniqueOrThrow({
            where: { id: suspended.id },
            select: { deletedAt: true },
          })
        ).deletedAt,
      ).not.toBeNull();
      expect(await auditCount('GROUP', group.body.id, 'RESTORE')).toBe(0);
    });

    it('archives a student with every kind of business history and blocks hard delete', async () => {
      const individual = await server()
        .post('/api/enrollments')
        .set('Authorization', auth(ownerA))
        .send({
          studentId: historyStudentId,
          teacherId: secondTeacherId,
          priceMinor: 2500,
          currency: 'EUR',
        })
        .expect(201);
      const startsAtUtc = new Date(Date.now() + 4 * 86_400_000);
      const seriesSchedule = await prisma.schedule.create({
        data: {
          workspaceId: workspaceAId,
          enrollmentId: individual.body.id,
          teacherId: secondTeacherId,
          timezone: 'UTC',
          durationMin: 60,
          horizonWeeks: 12,
        },
      });
      const series = await prisma.lessonSeries.create({
        data: {
          scheduleId: seriesSchedule.id,
          workspaceId: workspaceAId,
          enrollmentId: individual.body.id,
          teacherId: secondTeacherId,
          weekdays: [startsAtUtc.getUTCDay()],
          localTime: '12:00',
          timezone: 'UTC',
          durationMin: 60,
          priceMinor: 2500,
          currency: 'EUR',
          startDate: new Date(),
          horizonMaterializedUntil: startsAtUtc,
        },
      });
      const scheduled = await prisma.lesson.create({
        data: {
          workspaceId: workspaceAId,
          enrollmentId: individual.body.id,
          seriesId: series.id,
          teacherId: secondTeacherId,
          startsAtUtc,
          durationMin: 60,
          priceMinor: 2500,
          currency: 'EUR',
        },
      });

      await server()
        .delete(`/api/students/${historyStudentId}`)
        .set('Authorization', auth(teacherA))
        .expect(403);
      await server()
        .delete(`/api/students/${historyStudentId}`)
        .set('Authorization', auth(ownerB))
        .expect(404);
      await server()
        .delete(`/api/students/${historyStudentId}`)
        .set('Authorization', auth(ownerA))
        .expect(204);

      expect(
        await prisma.student.findUniqueOrThrow({
          where: { id: historyStudentId },
          select: { status: true, archivedAt: true },
        }),
      ).toMatchObject({ status: 'ARCHIVED', archivedAt: expect.any(Date) });
      const archivedEnrollment = await prisma.enrollment.findUniqueOrThrow({
        where: { id: groupEnrollmentId },
        select: {
          groupId: true,
          status: true,
          studentArchivedAt: true,
          statusBeforeStudentArchive: true,
        },
      });
      expect(archivedEnrollment).toMatchObject({
        groupId: historyGroupId,
        status: 'ARCHIVED',
        studentArchivedAt: expect.any(Date),
        statusBeforeStudentArchive: 'ACTIVE',
      });
      const archivedRoster = await server()
        .get(`/api/groups/${historyGroupId}`)
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(archivedRoster.body.enrollments).toEqual([]);
      const directPatch = await server()
        .patch(`/api/students/${historyStudentId}`)
        .set('Authorization', auth(ownerA))
        .send({ fullName: 'Unsafe archive bypass' })
        .expect(409);
      expect(directPatch.body.code).toBe('STUDENT_ARCHIVED_REQUIRES_RESTORE');
      expect(
        (
          await prisma.lesson.findUniqueOrThrow({
            where: { id: scheduled.id },
            select: { deletedAt: true },
          })
        ).deletedAt,
      ).not.toBeNull();
      expect(
        (
          await prisma.lessonSeries.findUniqueOrThrow({
            where: { id: series.id },
            select: { deletedAt: true },
          })
        ).deletedAt,
      ).not.toBeNull();
      expect(
        await prisma.payment.count({ where: { packageId: groupPackageId } }),
      ).toBe(1);
      expect(
        await prisma.lessonCharge.count({
          where: { packageId: groupPackageId, voidedAt: null },
        }),
      ).toBe(1);
      expect(
        await prisma.lessonCreditEntry.count({
          where: { packageId: groupPackageId },
        }),
      ).toBe(1);

      // An archived student is sold nothing.
      const blockedCharge = await server()
        .post('/api/packages')
        .set('Authorization', auth(ownerA))
        .send({
          studentId: historyStudentId,
          groupId: historyGroupId,
          sizingMode: 'FIXED_COUNT',
          lessonsTotal: 1,
          pricePerLessonMinor: 2500,
          currency: 'EUR',
        })
        .expect(404);
      expect(blockedCharge.body.code).toBe('STUDENT_NOT_FOUND');

      const blocked = await server()
        .delete(`/api/students/${historyStudentId}/permanently`)
        .set('Authorization', auth(ownerA))
        .expect(409);
      expect(blocked.body.code).toBe('STUDENT_HAS_BUSINESS_HISTORY');
      expect(blocked.body.details.dependencies).toMatchObject({
        enrollments: expect.any(Number),
        packages: expect.any(Number),
        payments: expect.any(Number),
        charges: expect.any(Number),
        credits: expect.any(Number),
      });
      expect(await auditCount('STUDENT', historyStudentId, 'DELETE')).toBe(1);

      await server()
        .post(`/api/students/${historyStudentId}/restore`)
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(
        await prisma.enrollment.findUniqueOrThrow({
          where: { id: groupEnrollmentId },
          select: {
            groupId: true,
            status: true,
            studentArchivedAt: true,
            statusBeforeStudentArchive: true,
          },
        }),
      ).toEqual({
        groupId: historyGroupId,
        status: 'ACTIVE',
        studentArchivedAt: null,
        statusBeforeStudentArchive: null,
      });
      expect(
        (
          await prisma.lesson.findUniqueOrThrow({
            where: { id: scheduled.id },
            select: { deletedAt: true },
          })
        ).deletedAt,
      ).toBeNull();
      expect(await auditCount('STUDENT', historyStudentId, 'RESTORE')).toBe(1);
    });

    it('restores a paused group enrollment to PAUSED without removing its group link', async () => {
      const student = await server()
        .post('/api/students')
        .set('Authorization', auth(ownerA))
        .send({ fullName: 'Paused lifecycle learner', timezone: 'UTC' })
        .expect(201);
      const group = await server()
        .post('/api/groups')
        .set('Authorization', auth(ownerA))
        .send({ name: `Paused lifecycle group ${runId}` })
        .expect(201);
      const enrollment = await server()
        .post('/api/enrollments')
        .set('Authorization', auth(ownerA))
        .send({
          studentId: student.body.id,
          groupId: group.body.id,
          teacherId: ownerTeacherId,
          priceMinor: 2500,
          currency: 'EUR',
        })
        .expect(201);
      await prisma.enrollment.update({
        where: { id: enrollment.body.id },
        data: { status: 'PAUSED' },
      });

      await server()
        .delete(`/api/students/${student.body.id}`)
        .set('Authorization', auth(ownerA))
        .expect(204);
      expect(
        await prisma.enrollment.findUniqueOrThrow({
          where: { id: enrollment.body.id },
          select: {
            groupId: true,
            status: true,
            statusBeforeStudentArchive: true,
          },
        }),
      ).toEqual({
        groupId: group.body.id,
        status: 'ARCHIVED',
        statusBeforeStudentArchive: 'PAUSED',
      });

      await server()
        .post(`/api/students/${student.body.id}/restore`)
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(
        await prisma.enrollment.findUniqueOrThrow({
          where: { id: enrollment.body.id },
          select: {
            groupId: true,
            status: true,
            statusBeforeStudentArchive: true,
          },
        }),
      ).toEqual({
        groupId: group.body.id,
        status: 'PAUSED',
        statusBeforeStudentArchive: null,
      });
    });

    it('keeps an archived student enrollment suspended until the student is restored', async () => {
      const student = await server()
        .post('/api/students')
        .set('Authorization', auth(ownerA))
        .send({ fullName: 'Archived enrollment learner', timezone: 'UTC' })
        .expect(201);
      const enrollment = await server()
        .post('/api/enrollments')
        .set('Authorization', auth(ownerA))
        .send({
          studentId: student.body.id,
          teacherId: secondTeacherId,
          priceMinor: 2500,
          currency: 'EUR',
        })
        .expect(201);
      const lesson = await prisma.lesson.create({
        data: {
          workspaceId: workspaceAId,
          enrollmentId: enrollment.body.id,
          teacherId: secondTeacherId,
          startsAtUtc: new Date(Date.now() + 200 * 86_400_000),
          durationMin: 60,
          priceMinor: 2500,
          currency: 'EUR',
        },
      });
      // Pausing token-suspends the future lesson; archiving keeps it hidden.
      await server()
        .patch(`/api/enrollments/${enrollment.body.id}`)
        .set('Authorization', auth(ownerA))
        .send({ status: 'PAUSED' })
        .expect(200);
      await server()
        .delete(`/api/students/${student.body.id}`)
        .set('Authorization', auth(ownerA))
        .expect(204);

      // Resuming the enrollment would revive the lesson of an archived
      // student, so it is refused until the student is restored.
      const resumed = await server()
        .patch(`/api/enrollments/${enrollment.body.id}`)
        .set('Authorization', auth(ownerA))
        .send({ status: 'ACTIVE' })
        .expect(409);
      expect(resumed.body.code).toBe('STUDENT_ARCHIVED_REQUIRES_RESTORE');
      expect(
        (
          await prisma.lesson.findUniqueOrThrow({
            where: { id: lesson.id },
            select: { deletedAt: true },
          })
        ).deletedAt,
      ).not.toBeNull();

      await server()
        .delete(`/api/enrollments/${enrollment.body.id}`)
        .set('Authorization', auth(ownerA))
        .expect(204);
      const restoredEnrollment = await server()
        .post(`/api/enrollments/${enrollment.body.id}/restore`)
        .set('Authorization', auth(ownerA))
        .expect(409);
      expect(restoredEnrollment.body.code).toBe(
        'STUDENT_ARCHIVED_REQUIRES_RESTORE',
      );

      // Once the student is back, the enrollment can be restored.
      await server()
        .post(`/api/students/${student.body.id}/restore`)
        .set('Authorization', auth(ownerA))
        .expect(200);
      await server()
        .post(`/api/enrollments/${enrollment.body.id}/restore`)
        .set('Authorization', auth(ownerA))
        .expect(201);
    });

    it('refuses to restore an enrollment into an archived group', async () => {
      const student = await server()
        .post('/api/students')
        .set('Authorization', auth(ownerA))
        .send({ fullName: 'Archived group learner', timezone: 'UTC' })
        .expect(201);
      const group = await server()
        .post('/api/groups')
        .set('Authorization', auth(ownerA))
        .send({ name: `Archived restore group ${runId}` })
        .expect(201);
      const enrollment = await server()
        .post('/api/enrollments')
        .set('Authorization', auth(ownerA))
        .send({
          studentId: student.body.id,
          groupId: group.body.id,
          teacherId: ownerTeacherId,
          priceMinor: 2500,
          currency: 'EUR',
        })
        .expect(201);
      await server()
        .delete(`/api/enrollments/${enrollment.body.id}`)
        .set('Authorization', auth(ownerA))
        .expect(204);
      await server()
        .delete(`/api/groups/${group.body.id}`)
        .set('Authorization', auth(ownerA))
        .expect(204);

      const restored = await server()
        .post(`/api/enrollments/${enrollment.body.id}/restore`)
        .set('Authorization', auth(ownerA))
        .expect(404);
      expect(restored.body.code).toBe('GROUP_NOT_FOUND');
    });
  });

  describe('parents CRUD and links', () => {
    let parentId: string;
    let studentId: string;

    it('creates a parent and audits exactly one CREATE', async () => {
      const created = await server()
        .post('/api/parents')
        .set('Authorization', auth(ownerA))
        .send({
          fullName: 'Standalone Parent',
          phone: '+380671112233',
          email: ' Standalone.Parent@Example.TEST ',
        })
        .expect(201);
      parentId = created.body.id;

      expect(created.body).toMatchObject({
        fullName: 'Standalone Parent',
        email: 'standalone.parent@example.test',
        deletedAt: null,
      });
      expect(await auditCount('PARENT', parentId, 'CREATE')).toBe(1);
    });

    it('shows an empty roster until linked, then the linked student', async () => {
      const empty = await server()
        .get(`/api/parents/${parentId}`)
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(empty.body.students).toEqual([]);

      const student = await server()
        .post('/api/students')
        .set('Authorization', auth(ownerA))
        .send({
          fullName: 'Roster Learner',
          timezone: 'UTC',
          parentIds: [parentId],
        })
        .expect(201);
      studentId = student.body.id;

      const withRoster = await server()
        .get(`/api/parents/${parentId}`)
        .set('Authorization', auth(ownerA))
        .expect(200);
      // The roster ref carries the badge fields the parent list renders.
      expect(withRoster.body.students).toEqual([
        {
          id: studentId,
          fullName: 'Roster Learner',
          avatarKey: null,
          status: 'ACTIVE',
          languageLevel: null,
        },
      ]);
    });

    it('filters to parents with no linked student and sorts on the server', async () => {
      const lonely = await server()
        .post('/api/parents')
        .set('Authorization', auth(ownerA))
        .send({ fullName: 'Aaa Unlinked Parent' })
        .expect(201);
      try {
        const unlinked = await server()
          .get('/api/parents')
          .query({ linked: 'none', pageSize: 100 })
          .set('Authorization', auth(ownerA))
          .expect(200);
        const unlinkedIds = unlinked.body.items.map(
          (item: { id: string }) => item.id,
        );
        expect(unlinkedIds).toContain(lonely.body.id);
        expect(unlinkedIds).not.toContain(parentId);
        expect(
          unlinked.body.items.every(
            (item: { students: unknown[] }) => item.students.length === 0,
          ),
        ).toBe(true);

        const newest = await server()
          .get('/api/parents')
          .query({ sort: 'createdAt', order: 'desc', pageSize: 1 })
          .set('Authorization', auth(ownerA))
          .expect(200);
        expect(newest.body.items[0].id).toBe(lonely.body.id);

        await server()
          .get('/api/parents')
          .query({ sort: 'phone' })
          .set('Authorization', auth(ownerA))
          .expect(400);
      } finally {
        await server()
          .delete(`/api/parents/${lonely.body.id}`)
          .set('Authorization', auth(ownerA));
      }
    });

    it('counts a link to an archived student as linked and audits the email diff', async () => {
      const guardian = await server()
        .post('/api/parents')
        .set('Authorization', auth(ownerA))
        .send({
          fullName: 'Archive Link Parent',
          email: 'guardian@example.test',
        })
        .expect(201);
      const pupil = await server()
        .post('/api/students')
        .set('Authorization', auth(ownerA))
        .send({
          fullName: 'Archived Pupil',
          timezone: 'UTC',
          parentIds: [guardian.body.id],
        })
        .expect(201);

      try {
        // Archiving keeps the link: the parent is still someone's parent.
        await server()
          .delete(`/api/students/${pupil.body.id}`)
          .set('Authorization', auth(ownerA))
          .expect(204);
        const unlinked = await server()
          .get('/api/parents')
          .query({ linked: 'none', pageSize: 100 })
          .set('Authorization', auth(ownerA))
          .expect(200);
        expect(
          unlinked.body.items.map((item: { id: string }) => item.id),
        ).not.toContain(guardian.body.id);

        // The default order is by name, with the id as the tie-breaker.
        const byName = await server()
          .get('/api/parents')
          .query({ pageSize: 100 })
          .set('Authorization', auth(ownerA))
          .expect(200);
        const names = byName.body.items.map(
          (item: { fullName: string }) => item.fullName,
        );
        expect(names.indexOf('Archive Link Parent')).toBeLessThan(
          names.indexOf('Standalone Parent'),
        );

        await server()
          .patch(`/api/parents/${guardian.body.id}`)
          .set('Authorization', auth(ownerA))
          .send({ email: 'Guardian.New@Example.TEST' })
          .expect(200);
        const logs = await server()
          .get('/api/audit-logs')
          .query({
            entity: 'PARENT',
            entityId: guardian.body.id,
            action: 'UPDATE',
          })
          .set('Authorization', auth(ownerA))
          .expect(200);
        expect(logs.body.items[0].changes).toEqual({
          fields: {
            email: {
              before: 'guardian@example.test',
              after: 'guardian.new@example.test',
            },
          },
        });
      } finally {
        await server()
          .delete(`/api/parents/${guardian.body.id}`)
          .set('Authorization', auth(ownerA));
      }
    });

    it('updates with PATCH semantics and audits the diff; no-op adds nothing', async () => {
      const saved = await server()
        .patch(`/api/parents/${parentId}`)
        .set('Authorization', auth(ownerA))
        .send({ phone: null, email: null, notes: 'Prefers Telegram' })
        .expect(200);
      expect(await auditCount('PARENT', parentId, 'UPDATE')).toBe(1);
      const cleared = await server()
        .get(`/api/parents/${parentId}`)
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(cleared.body).toMatchObject({ phone: null, email: null });
      // PATCH answers with the same detail, roster included.
      expect(saved.body).toEqual(cleared.body);

      const unchanged = await server()
        .patch(`/api/parents/${parentId}`)
        .set('Authorization', auth(ownerA))
        .send({ notes: 'Prefers Telegram' })
        .expect(200);
      expect(unchanged.body.students).toEqual(cleared.body.students);
      expect(await auditCount('PARENT', parentId, 'UPDATE')).toBe(1);
    });

    it('hides workspace A parents from workspace B behind the same 404', async () => {
      const read = await server()
        .get(`/api/parents/${parentId}`)
        .set('Authorization', auth(ownerB))
        .expect(404);
      expect(read.body.code).toBe('PARENT_NOT_FOUND');

      const listB = await server()
        .get('/api/parents')
        .set('Authorization', auth(ownerB))
        .expect(200);
      expect(
        listB.body.items.every((item: { id: string }) => item.id !== parentId),
      ).toBe(true);
    });

    it('finds parents by search, including their email', async () => {
      const found = await server()
        .get('/api/parents')
        .query({ search: 'Standalone Parent' })
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(found.body.total).toBe(1);
      expect(found.body.items[0].id).toBe(parentId);

      await server()
        .patch(`/api/parents/${parentId}`)
        .set('Authorization', auth(ownerA))
        .send({ email: 'family.contact@example.test' })
        .expect(200);
      const byEmail = await server()
        .get('/api/parents')
        .query({ search: 'family.contact@' })
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(byEmail.body.items.map((item: { id: string }) => item.id)).toEqual(
        [parentId],
      );
      expect(byEmail.body.items[0].email).toBe('family.contact@example.test');
    });

    it('permanently deletes a parent and unlinks it from students (no restore)', async () => {
      await server()
        .delete(`/api/parents/${parentId}`)
        .set('Authorization', auth(ownerA))
        .expect(204);
      expect(await auditCount('PARENT', parentId, 'DELETE')).toBe(1);

      // Gone from detail, and the link is removed from the student it was on.
      await server()
        .get(`/api/parents/${parentId}`)
        .set('Authorization', auth(ownerA))
        .expect(404);
      const student = await server()
        .get(`/api/students/${studentId}`)
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(student.body.parents).toEqual([]);

      // No trash: deleting again is a plain not-found and there is no restore.
      await server()
        .delete(`/api/parents/${parentId}`)
        .set('Authorization', auth(ownerA))
        .expect(404);
      await server()
        .post(`/api/parents/${parentId}/restore`)
        .set('Authorization', auth(ownerA))
        .expect(404);
    });
  });

  describe('workspace settings and audit access', () => {
    it('teacher gets 403 for settings and audit log', async () => {
      await server()
        .patch('/api/workspaces/current/settings')
        .set('Authorization', auth(teacherA))
        .send({ defaultCurrency: 'USD' })
        .expect(403);
      await server()
        .get('/api/audit-logs')
        .set('Authorization', auth(teacherA))
        .expect(403);
    });

    it('updates only the current workspace and audits WORKSPACE UPDATE', async () => {
      const updated = await server()
        .patch('/api/workspaces/current/settings')
        .set('Authorization', auth(ownerA))
        .send({ defaultCurrency: 'UAH', cancellationDeadlineHours: 72 })
        .expect(200);
      expect(updated.body.workspace).toMatchObject({
        defaultCurrency: 'UAH',
        cancellationDeadlineHours: 72,
      });
      expect(await auditCount('WORKSPACE', workspaceAId, 'UPDATE')).toBe(1);

      // The name is a setting too; a blank or one-letter name is refused.
      await server()
        .patch('/api/workspaces/current/settings')
        .set('Authorization', auth(ownerA))
        .send({ name: ' ' })
        .expect(400);
      const renamed = await server()
        .patch('/api/workspaces/current/settings')
        .set('Authorization', auth(ownerA))
        .send({ name: `  E2E WS A ${runId} renamed ` })
        .expect(200);
      expect(renamed.body.workspace.name).toBe(`E2E WS A ${runId} renamed`);
      expect(await auditCount('WORKSPACE', workspaceAId, 'UPDATE')).toBe(2);
      await server()
        .patch('/api/workspaces/current/settings')
        .set('Authorization', auth(ownerA))
        .send({ name: `E2E WS A ${runId}` })
        .expect(200);

      // Workspace B keeps its registration defaults.
      const currentB = await server()
        .get('/api/workspaces/current')
        .set('Authorization', auth(ownerB))
        .expect(200);
      expect(currentB.body.workspace).toMatchObject({
        defaultCurrency: 'EUR',
        cancellationDeadlineHours: 24,
      });
    });

    it('audit trail is workspace-scoped, newest first, with actor info', async () => {
      const logsA = await server()
        .get('/api/audit-logs')
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(logsA.body.total).toBeGreaterThan(0);
      const timestamps = logsA.body.items.map(
        (item: { createdAt: string }) => item.createdAt,
      );
      expect([...timestamps].sort().reverse()).toEqual(timestamps);
      expect(logsA.body.items[0].actor).toMatchObject({
        name: expect.any(String),
        email: expect.any(String),
      });

      // Each row names its record; ids in a diff come with their names.
      const settings = await server()
        .get('/api/audit-logs')
        .query({ entity: 'WORKSPACE' })
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(settings.body.items[0].record).toMatchObject({
        label: `E2E WS A ${runId}`,
        currency: 'UAH',
      });
      const students = await server()
        .get('/api/audit-logs')
        .query({ entity: 'STUDENT', action: 'CREATE' })
        .set('Authorization', auth(ownerA))
        .expect(200);
      type StudentCreate = {
        record: { label: string | null };
        changes: { fields: { parentIds?: { after: string[] } } };
      };
      const items = students.body.items as StudentCreate[];
      expect(items.every((item) => typeof item.record.label === 'string')).toBe(
        true,
      );
      // Parents deleted since are left out; the one linked first still exists.
      const parentIds = items.flatMap(
        (item) => item.changes.fields.parentIds?.after ?? [],
      );
      const names = students.body.names as Record<string, string>;
      expect(Object.keys(names).every((id) => parentIds.includes(id))).toBe(
        true,
      );
      expect(Object.values(names)).toContain('Parent Learner');

      // Workspace B sees only its own single entry (student create above).
      const logsB = await server()
        .get('/api/audit-logs')
        .set('Authorization', auth(ownerB))
        .expect(200);
      expect(
        logsB.body.items.every(
          (item: { workspaceId: string }) => item.workspaceId !== workspaceAId,
        ),
      ).toBe(true);
    });
  });
});
