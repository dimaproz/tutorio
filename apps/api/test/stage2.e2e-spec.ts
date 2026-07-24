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
  let ownerAMemberId: string;
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

    const registerA = await server()
      .post('/api/auth/register')
      .send({
        name: 'Owner A',
        workspaceName: `E2E WS A ${runId}`,
        email: emailFor('owner-a'),
        password: 'correct horse battery staple',
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
    ownerAMemberId = members.body.items.find(
      (m: { role: string }) => m.role === 'OWNER',
    ).id;
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
          subject: 'ENGLISH',
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
          'subject',
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
    });

    it('updates with PATCH semantics and audits the diff; no-op adds nothing', async () => {
      await server()
        .patch(`/api/students/${studentId}`)
        .set('Authorization', auth(teacherA))
        .send({ notes: 'Moved to mornings', phone: null })
        .expect(200);
      expect(await auditCount('STUDENT', studentId, 'UPDATE')).toBe(1);

      // Identical payload → no new audit row.
      await server()
        .patch(`/api/students/${studentId}`)
        .set('Authorization', auth(teacherA))
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

    it('permanently deletes a student and drops it from lists (no trash, no restore)', async () => {
      await server()
        .delete(`/api/students/${studentId}`)
        .set('Authorization', auth(ownerA))
        .expect(204);
      expect(await auditCount('STUDENT', studentId, 'DELETE')).toBe(1);

      // Gone from the default list and detail returns 404.
      const defaultList = await server()
        .get('/api/students')
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(defaultList.body.total).toBe(0);
      await server()
        .get(`/api/students/${studentId}`)
        .set('Authorization', auth(ownerA))
        .expect(404);

      // Deleting an already-gone student is a plain not-found; no restore route.
      await server()
        .delete(`/api/students/${studentId}`)
        .set('Authorization', auth(ownerA))
        .expect(404);
      await server()
        .post(`/api/students/${studentId}/restore`)
        .set('Authorization', auth(ownerA))
        .expect(404);
    });
  });

  describe('groups and enrollments', () => {
    let studentId: string;
    let groupId: string;
    let individualEnrollmentId: string;
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
      individualEnrollmentId = created.body.id;

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
          billingType: 'MONTHLY',
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

    it('blocks group deletion while ACTIVE or PAUSED enrollments exist', async () => {
      // A group with an active enrollment cannot be soft-deleted.
      const blockedGroup = await server()
        .delete(`/api/groups/${groupId}`)
        .set('Authorization', auth(ownerA))
        .expect(409);
      expect(blockedGroup.body.code).toBe('ACTIVE_ENROLLMENTS_EXIST');

      // PAUSED still blocks.
      await server()
        .patch(`/api/enrollments/${groupEnrollmentId}`)
        .set('Authorization', auth(ownerA))
        .send({ status: 'PAUSED' })
        .expect(200);
      await server()
        .delete(`/api/groups/${groupId}`)
        .set('Authorization', auth(ownerA))
        .expect(409);
    });

    it('archiving enrollments unblocks deletion; archive ≠ trash', async () => {
      await server()
        .patch(`/api/enrollments/${groupEnrollmentId}`)
        .set('Authorization', auth(ownerA))
        .send({ status: 'ARCHIVED' })
        .expect(200);

      // Archived enrollments remain visible in history…
      const archived = await server()
        .get('/api/enrollments')
        .query({ status: 'ARCHIVED' })
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(archived.body.items.map((e: { id: string }) => e.id)).toContain(
        groupEnrollmentId,
      );

      // …and no longer block deleting the group.
      await server()
        .delete(`/api/groups/${groupId}`)
        .set('Authorization', auth(ownerA))
        .expect(204);
      expect(await auditCount('GROUP', groupId, 'DELETE')).toBe(1);

      await server()
        .patch(`/api/enrollments/${individualEnrollmentId}`)
        .set('Authorization', auth(ownerA))
        .send({ status: 'ARCHIVED' })
        .expect(200);
      await server()
        .delete(`/api/students/${studentId}`)
        .set('Authorization', auth(ownerA))
        .expect(204);
    });
  });

  describe('parents CRUD and links', () => {
    let parentId: string;
    let studentId: string;

    it('creates a parent and audits exactly one CREATE', async () => {
      const created = await server()
        .post('/api/parents')
        .set('Authorization', auth(ownerA))
        .send({ fullName: 'Standalone Parent', phone: '+380671112233' })
        .expect(201);
      parentId = created.body.id;

      expect(created.body).toMatchObject({
        fullName: 'Standalone Parent',
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
      expect(withRoster.body.students).toEqual([
        { id: studentId, fullName: 'Roster Learner', avatarKey: null },
      ]);
    });

    it('updates with PATCH semantics and audits the diff; no-op adds nothing', async () => {
      await server()
        .patch(`/api/parents/${parentId}`)
        .set('Authorization', auth(ownerA))
        .send({ phone: null, notes: 'Prefers Telegram' })
        .expect(200);
      expect(await auditCount('PARENT', parentId, 'UPDATE')).toBe(1);

      await server()
        .patch(`/api/parents/${parentId}`)
        .set('Authorization', auth(ownerA))
        .send({ notes: 'Prefers Telegram' })
        .expect(200);
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

    it('finds parents by search', async () => {
      const found = await server()
        .get('/api/parents')
        .query({ search: 'Standalone Parent' })
        .set('Authorization', auth(ownerA))
        .expect(200);
      expect(found.body.total).toBe(1);
      expect(found.body.items[0].id).toBe(parentId);
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
