import type { ListStudentsQueryDto } from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import { AuthApiException } from '../auth/auth.errors';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BusinessApiException } from '../common/business.errors';
import type { PrismaService } from '../prisma/prisma.service';
import { StudentsService } from './students.service';

const WORKSPACE_ID = '22222222-2222-4222-8222-222222222222';
const STUDENT_ID = '44444444-4444-4444-8444-444444444444';
const NOW = new Date('2026-07-20T10:00:00.000Z');

const owner: AuthenticatedUser = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 's1',
  workspaceId: WORKSPACE_ID,
  role: 'OWNER',
};

const teacher: AuthenticatedUser = { ...owner, role: 'TEACHER' };

// The service always receives a query the Zod schema has already defaulted.
const listQuery = (
  overrides: Partial<ListStudentsQueryDto> = {},
): ListStudentsQueryDto => ({
  page: 1,
  pageSize: 20,
  state: 'active',
  sort: 'fullName',
  order: 'asc',
  ...overrides,
});

const studentRow = {
  id: STUDENT_ID,
  workspaceId: WORKSPACE_ID,
  fullName: 'Alice Example',
  email: null,
  phone: null,
  timezone: 'Europe/Kyiv',
  telegramUsername: null,
  hourlyRateMinor: null,
  currency: null,
  status: 'ACTIVE' as const,
  languageLevel: null,
  knowledgeLevel: null,
  age: null,
  grade: null,
  avatarKey: null,
  notes: null,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  archivedAt: null,
  parents: [] as {
    parent: { id: string; fullName: string; avatarKey: string | null };
  }[],
};

function buildPrismaMock() {
  const prisma = {
    student: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    studentParent: { deleteMany: jest.fn() },
    enrollment: {
      count: jest.fn().mockResolvedValue(0),
      deleteMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    lesson: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    lessonSeries: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    lessonPackage: { count: jest.fn().mockResolvedValue(0) },
    payment: { count: jest.fn().mockResolvedValue(0) },
    packageParticipantShare: { count: jest.fn().mockResolvedValue(0) },
    lessonCreditEntry: { count: jest.fn().mockResolvedValue(0) },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (arg: Promise<unknown>[] | ((tx: unknown) => unknown)) =>
      Array.isArray(arg) ? Promise.all(arg) : arg(prisma),
  );
  return prisma;
}

function buildService() {
  const prisma = buildPrismaMock();
  const audit = new AuditService(prisma as unknown as PrismaService);
  const recordSpy = jest.spyOn(audit, 'record');
  const service = new StudentsService(
    prisma as unknown as PrismaService,
    audit,
  );
  return { prisma, audit, recordSpy, service };
}

async function expectBusinessError(
  promise: Promise<unknown>,
  code: string,
  status: number,
): Promise<void> {
  try {
    await promise;
    throw new Error(`expected ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(BusinessApiException);
    expect((error as BusinessApiException).code).toBe(code);
    expect((error as BusinessApiException).getStatus()).toBe(status);
  }
}

describe('StudentsService.list', () => {
  it('scopes both the page query and the count to the workspace', async () => {
    const { prisma, service } = buildService();

    await service.list(owner, listQuery());

    expect(prisma.student.findMany.mock.calls[0][0].where).toMatchObject({
      workspaceId: WORKSPACE_ID,
      deletedAt: null,
    });
    expect(prisma.student.count.mock.calls[0][0].where).toMatchObject({
      workspaceId: WORKSPACE_ID,
      deletedAt: null,
    });
  });

  it('rejects non-owner access to deleted/all states', async () => {
    const { service } = buildService();
    await expect(
      service.list(teacher, listQuery({ state: 'deleted' })),
    ).rejects.toBeInstanceOf(AuthApiException);
    await expect(
      service.list(teacher, listQuery({ state: 'all' })),
    ).rejects.toBeInstanceOf(AuthApiException);
  });

  it('searches across student contact fields', async () => {
    const { prisma, service } = buildService();

    await service.list(owner, listQuery({ search: 'alice' }));

    const where = prisma.student.findMany.mock.calls[0][0].where;
    const searchedFields = (where.OR as Record<string, unknown>[]).map(
      (clause) => Object.keys(clause)[0],
    );
    expect(searchedFields).toEqual([
      'fullName',
      'email',
      'phone',
      'telegramUsername',
    ]);
  });

  it('orders by the requested column with a stable id tiebreaker', async () => {
    const { prisma, service } = buildService();

    await service.list(owner, listQuery({ sort: 'status', order: 'desc' }));

    expect(prisma.student.findMany.mock.calls[0][0].orderBy).toEqual([
      { status: 'desc' },
      { id: 'asc' },
    ]);
  });

  it('sorts by creation time with a stable id tiebreaker', async () => {
    const { prisma, service } = buildService();

    await service.list(owner, listQuery({ sort: 'createdAt', order: 'desc' }));

    expect(prisma.student.findMany.mock.calls[0][0].orderBy).toEqual([
      { createdAt: 'desc' },
      { id: 'asc' },
    ]);
  });

  it('summarizes active enrollments and live group names', async () => {
    const { prisma, service } = buildService();
    prisma.student.findMany.mockResolvedValue([
      {
        ...studentRow,
        enrollments: [
          { status: 'ACTIVE', group: { name: 'B1 English' } },
          { status: 'ACTIVE', group: null },
          { status: 'PAUSED', group: { name: 'B1 English' } },
        ],
      },
    ]);
    prisma.student.count.mockResolvedValue(1);

    const result = await service.list(owner, listQuery());

    expect(result.items[0]).toMatchObject({
      activeEnrollmentCount: 2,
      groupNames: ['B1 English'],
      createdAt: NOW.toISOString(),
    });
    // Only live memberships feed the row: ACTIVE/PAUSED, not deleted, and
    // never in an archived group.
    expect(
      prisma.student.findMany.mock.calls[0][0].include.enrollments.where,
    ).toEqual({
      deletedAt: null,
      status: { in: ['ACTIVE', 'PAUSED'] },
      OR: [{ groupId: null }, { group: { deletedAt: null } }],
    });
  });

  it.each([
    ['active', { status: { not: 'ARCHIVED' } }],
    ['deleted', { status: 'ARCHIVED' }],
  ] as const)(
    'maps state=%s to a status filter on live rows',
    async (state, filter) => {
      const { prisma, service } = buildService();

      await service.list(owner, listQuery({ state }));

      const where = prisma.student.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ deletedAt: null, ...filter });
      expect(prisma.student.count.mock.calls[0][0].where).toEqual(where);
    },
  );

  it('lists every status for state=all and lets an explicit status win', async () => {
    const { prisma, service } = buildService();

    await service.list(owner, listQuery({ state: 'all' }));
    await service.list(
      owner,
      listQuery({ state: 'active', status: 'ARCHIVED' }),
    );

    const [all, explicit] = prisma.student.findMany.mock.calls.map(
      (call: [{ where: Record<string, unknown> }]) => call[0].where,
    );
    expect(all).toMatchObject({ deletedAt: null });
    expect(all).not.toHaveProperty('status');
    expect(explicit).toMatchObject({ deletedAt: null, status: 'ARCHIVED' });
  });

  it('filters by group through live memberships only', async () => {
    const { prisma, service } = buildService();
    const groupId = '66666666-6666-4666-8666-666666666666';

    await service.list(owner, listQuery({ groupId }));

    expect(prisma.student.findMany.mock.calls[0][0].where.enrollments).toEqual({
      some: {
        deletedAt: null,
        status: { in: ['ACTIVE', 'PAUSED'] },
        group: { deletedAt: null },
        groupId,
      },
    });
  });
});

describe('StudentsService.summary', () => {
  it('counts every status with one grouped query', async () => {
    const { prisma, service } = buildService();
    prisma.student.groupBy.mockResolvedValue([
      { status: 'ACTIVE', _count: { _all: 5 } },
      { status: 'ARCHIVED', _count: { _all: 2 } },
    ]);

    await expect(service.summary(owner)).resolves.toEqual({
      all: 5,
      ACTIVE: 5,
      ON_HOLD: 0,
      ARCHIVED: 2,
    });
    expect(prisma.student.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.student.groupBy.mock.calls[0][0]).toMatchObject({
      by: ['status'],
      where: { workspaceId: WORKSPACE_ID, deletedAt: null },
    });
  });
});

describe('StudentsService.getDetail', () => {
  it('returns the same 404 for missing and cross-workspace students', async () => {
    const { prisma, service } = buildService();
    prisma.student.findFirst.mockResolvedValue(null);

    await expectBusinessError(
      service.getDetail(owner, STUDENT_ID),
      'STUDENT_NOT_FOUND',
      404,
    );
    expect(prisma.student.findFirst.mock.calls[0][0].where).toMatchObject({
      id: STUDENT_ID,
      workspaceId: WORKSPACE_ID,
      deletedAt: null,
    });
  });

  it('returns full enrollment responses with the effective deadline', async () => {
    const { prisma, service } = buildService();
    const created = new Date('2026-09-01T10:00:00.000Z');
    const enrollmentRow = (overrides: Record<string, unknown>) => ({
      workspaceId: WORKSPACE_ID,
      studentId: STUDENT_ID,
      teacherId: 't1',
      student: { id: STUDENT_ID, fullName: 'Alice Example' },
      teacher: { id: 't1', fullName: 'Olena', color: null },
      createdAt: created,
      updatedAt: created,
      deletedAt: null,
      ...overrides,
    });
    prisma.student.findFirst.mockResolvedValue({
      ...studentRow,
      workspace: { cancellationDeadlineHours: 24 },
      enrollments: [
        enrollmentRow({
          id: 'e1',
          groupId: null,
          status: 'ACTIVE',
          billingType: 'PACKAGE',
          priceMinor: 2500,
          currency: 'EUR',
          cancellationDeadlineHours: 48,
          group: null,
        }),
        enrollmentRow({
          id: 'e2',
          groupId: 'g1',
          status: 'ACTIVE',
          billingType: 'MONTHLY',
          priceMinor: 10000,
          currency: 'EUR',
          cancellationDeadlineHours: null,
          group: { id: 'g1', name: 'B1' },
        }),
      ],
    });

    const detail = await service.getDetail(owner, STUDENT_ID);

    expect(detail.enrollments[0].effectiveCancellationDeadlineHours).toBe(48);
    expect(detail.enrollments[1].effectiveCancellationDeadlineHours).toBe(24);
    // The profile edits enrollments without refetching each one.
    expect(detail.enrollments[1]).toMatchObject({
      workspaceId: WORKSPACE_ID,
      studentId: STUDENT_ID,
      groupId: 'g1',
      teacherId: 't1',
      student: { id: STUDENT_ID, fullName: 'Alice Example' },
      teacher: { id: 't1', name: 'Olena', color: null },
      createdAt: created.toISOString(),
      deletedAt: null,
    });
  });
});

describe('StudentsService.create', () => {
  it('creates in the workspace and writes the audit row in the same tx', async () => {
    const { prisma, recordSpy, service } = buildService();
    prisma.student.create.mockResolvedValue(studentRow);

    await service.create(owner, {
      fullName: 'Alice Example',
      timezone: 'Europe/Kyiv',
      status: 'ACTIVE',
    });

    expect(prisma.student.create.mock.calls[0][0].data.workspaceId).toBe(
      WORKSPACE_ID,
    );
    expect(recordSpy).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        action: 'CREATE',
        entity: 'STUDENT',
        entityId: STUDENT_ID,
        actorId: owner.userId,
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });
});

describe('StudentsService.update', () => {
  it('does not persist or audit a no-op PATCH', async () => {
    const { prisma, service } = buildService();
    prisma.student.findFirst.mockResolvedValue(studentRow);

    const result = await service.update(owner, STUDENT_ID, {
      fullName: 'Alice Example',
    });

    expect(prisma.student.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(result.fullName).toBe('Alice Example');
  });

  it('persists real changes and audits the diff', async () => {
    const { prisma, service } = buildService();
    prisma.student.findFirst.mockResolvedValue(studentRow);
    prisma.student.update.mockResolvedValue({
      ...studentRow,
      fullName: 'Alice Renamed',
    });

    await service.update(owner, STUDENT_ID, { fullName: 'Alice Renamed' });

    expect(prisma.student.update).toHaveBeenCalled();
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'UPDATE',
      entity: 'STUDENT',
      diff: {
        fields: {
          fullName: { before: 'Alice Example', after: 'Alice Renamed' },
        },
      },
    });
  });

  it('404s on cross-workspace updates without touching anything', async () => {
    const { prisma, service } = buildService();
    prisma.student.findFirst.mockResolvedValue(null);

    await expectBusinessError(
      service.update(owner, STUDENT_ID, { fullName: 'X' }),
      'STUDENT_NOT_FOUND',
      404,
    );
    expect(prisma.student.update).not.toHaveBeenCalled();
  });

  it('rejects PATCH for an archived student until the dedicated restore runs', async () => {
    const { prisma, service } = buildService();
    prisma.student.findFirst.mockResolvedValue({
      ...studentRow,
      status: 'ARCHIVED',
      archivedAt: NOW,
    });

    await expectBusinessError(
      service.update(owner, STUDENT_ID, { fullName: 'Cannot update archived' }),
      'STUDENT_ARCHIVED_REQUIRES_RESTORE',
      409,
    );
    expect(prisma.student.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('StudentsService.restore', () => {
  it('revives marked work with one read each and one update per prior status', async () => {
    const { prisma, service } = buildService();
    const archivedAt = new Date('2026-07-19T10:00:00.000Z');
    prisma.student.findFirst.mockResolvedValue({
      ...studentRow,
      status: 'ARCHIVED',
      archivedAt,
    });
    prisma.student.update.mockResolvedValue(studentRow);
    prisma.enrollment.findMany.mockResolvedValue([
      { id: 'e1', groupId: null, statusBeforeStudentArchive: 'ACTIVE' },
      { id: 'e2', groupId: null, statusBeforeStudentArchive: 'PAUSED' },
      { id: 'e3', groupId: null, statusBeforeStudentArchive: 'ACTIVE' },
    ]);
    prisma.lesson.findMany
      // The suspended lessons to revive…
      .mockResolvedValueOnce([
        {
          id: 'l1',
          teacherId: 't1',
          startsAtUtc: new Date(Date.now() + 86_400_000),
          durationMin: 60,
        },
      ])
      // …and the teacher's busy lessons, read once for the whole batch.
      .mockResolvedValueOnce([]);

    await service.restore(owner, STUDENT_ID);

    expect(prisma.enrollment.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.lesson.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.lesson.updateMany.mock.calls[0][0].where).toEqual({
      id: { in: ['l1'] },
    });
    expect(
      prisma.enrollment.updateMany.mock.calls.map(
        (call: [{ where: unknown; data: { status: string } }]) => [
          call[0].where,
          call[0].data.status,
        ],
      ),
    ).toEqual([
      [{ id: { in: ['e1', 'e3'] } }, 'ACTIVE'],
      [{ id: { in: ['e2'] } }, 'PAUSED'],
    ]);
    expect(prisma.enrollment.update).not.toHaveBeenCalled();
  });

  it('refuses to revive a lesson that now overlaps the teacher calendar', async () => {
    const { prisma, service } = buildService();
    const start = new Date(Date.now() + 86_400_000);
    prisma.student.findFirst.mockResolvedValue({
      ...studentRow,
      status: 'ARCHIVED',
      archivedAt: new Date('2026-07-19T10:00:00.000Z'),
    });
    prisma.lesson.findMany
      .mockResolvedValueOnce([
        { id: 'l1', teacherId: 't1', startsAtUtc: start, durationMin: 60 },
      ])
      .mockResolvedValueOnce([
        { id: 'busy', teacherId: 't1', startsAtUtc: start, durationMin: 30 },
      ]);

    await expectBusinessError(
      service.restore(owner, STUDENT_ID),
      'SCHEDULE_CONFLICT',
      409,
    );
    expect(prisma.student.update).not.toHaveBeenCalled();
  });
});

describe('StudentsService.remove', () => {
  it('hard-deletes an unused student but never cascades enrollments', async () => {
    const { prisma, service } = buildService();
    prisma.student.findFirst.mockResolvedValue(studentRow);

    await service.remove(owner, STUDENT_ID);

    expect(prisma.studentParent.deleteMany.mock.calls[0][0].where).toEqual({
      studentId: STUDENT_ID,
    });
    expect(prisma.enrollment.deleteMany).not.toHaveBeenCalled();
    expect(prisma.student.delete.mock.calls[0][0].where).toEqual({
      id: STUDENT_ID,
    });
    expect(prisma.auditLog.create.mock.calls[0][0].data.action).toBe('DELETE');
  });

  it('returns a typed dependency summary when business history exists', async () => {
    const { prisma, service } = buildService();
    prisma.student.findFirst.mockResolvedValue(studentRow);
    prisma.enrollment.count.mockResolvedValue(1);
    prisma.lesson.count.mockResolvedValue(2);

    await expectBusinessError(
      service.remove(owner, STUDENT_ID),
      'STUDENT_HAS_BUSINESS_HISTORY',
      409,
    );
    expect(prisma.student.delete).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('takes the student lifecycle lock before counting history', async () => {
    const { prisma, service } = buildService();
    const executeRaw = jest.fn().mockResolvedValue(1);
    Object.assign(prisma, { $executeRaw: executeRaw });
    prisma.student.findFirst.mockResolvedValue(studentRow);

    await service.remove(owner, STUDENT_ID);

    expect(executeRaw.mock.calls[0][1]).toBe(
      `${WORKSPACE_ID}:student:${STUDENT_ID}`,
    );
    expect(executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.student.findFirst.mock.invocationCallOrder[0],
    );
  });

  it('throws STUDENT_NOT_FOUND for a missing student', async () => {
    const { prisma, service } = buildService();
    prisma.student.findFirst.mockResolvedValue(null);

    await expectBusinessError(
      service.remove(owner, STUDENT_ID),
      'STUDENT_NOT_FOUND',
      404,
    );
    expect(prisma.student.delete).not.toHaveBeenCalled();
  });
});
