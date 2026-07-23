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

const studentRow = {
  id: STUDENT_ID,
  workspaceId: WORKSPACE_ID,
  fullName: 'Alice Example',
  email: null,
  phone: null,
  timezone: 'Europe/Kyiv',
  telegramUsername: null,
  subject: null,
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
  parents: [] as { parent: { id: string; fullName: string; avatarKey: string | null } }[],
};

function buildPrismaMock() {
  const prisma = {
    student: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    studentParent: { deleteMany: jest.fn() },
    enrollment: { count: jest.fn().mockResolvedValue(0), deleteMany: jest.fn() },
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

    await service.list(owner, { page: 1, pageSize: 20, state: 'active' });

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
      service.list(teacher, { page: 1, pageSize: 20, state: 'deleted' }),
    ).rejects.toBeInstanceOf(AuthApiException);
    await expect(
      service.list(teacher, { page: 1, pageSize: 20, state: 'all' }),
    ).rejects.toBeInstanceOf(AuthApiException);
  });

  it('searches across student contact fields', async () => {
    const { prisma, service } = buildService();

    await service.list(owner, {
      page: 1,
      pageSize: 20,
      state: 'active',
      search: 'alice',
    });

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

  it('summarizes active enrollments and group names', async () => {
    const { prisma, service } = buildService();
    prisma.student.findMany.mockResolvedValue([
      {
        ...studentRow,
        enrollments: [
          { status: 'ACTIVE', group: { name: 'B1 English' } },
          { status: 'ACTIVE', group: null },
          { status: 'PAUSED', group: { name: 'B1 English' } },
          { status: 'ARCHIVED', group: { name: 'Old group' } },
        ],
      },
    ]);
    prisma.student.count.mockResolvedValue(1);

    const result = await service.list(owner, {
      page: 1,
      pageSize: 20,
      state: 'active',
    });

    expect(result.items[0]).toMatchObject({
      activeEnrollmentCount: 2,
      groupNames: ['B1 English', 'Old group'],
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

  it('resolves the effective cancellation deadline from the workspace', async () => {
    const { prisma, service } = buildService();
    prisma.student.findFirst.mockResolvedValue({
      ...studentRow,
      workspace: { cancellationDeadlineHours: 24 },
      enrollments: [
        {
          id: 'e1',
          status: 'ACTIVE',
          billingType: 'PACKAGE',
          priceMinor: 2500,
          currency: 'EUR',
          cancellationDeadlineHours: 48,
          group: null,
          teacher: { id: 't1', user: { name: 'Olena' } },
        },
        {
          id: 'e2',
          status: 'ACTIVE',
          billingType: 'MONTHLY',
          priceMinor: 10000,
          currency: 'EUR',
          cancellationDeadlineHours: null,
          group: { id: 'g1', name: 'B1' },
          teacher: { id: 't1', user: { name: 'Olena' } },
        },
      ],
    });

    const detail = await service.getDetail(owner, STUDENT_ID);

    expect(detail.enrollments[0].effectiveCancellationDeadlineHours).toBe(48);
    expect(detail.enrollments[1].effectiveCancellationDeadlineHours).toBe(24);
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
});

describe('StudentsService.remove', () => {
  it('permanently deletes the student with its links and enrollments, audits DELETE', async () => {
    const { prisma, service } = buildService();
    prisma.student.findFirst.mockResolvedValue(studentRow);

    await service.remove(owner, STUDENT_ID);

    expect(prisma.studentParent.deleteMany.mock.calls[0][0].where).toEqual({
      studentId: STUDENT_ID,
    });
    expect(prisma.enrollment.deleteMany.mock.calls[0][0].where).toMatchObject({
      studentId: STUDENT_ID,
      workspaceId: WORKSPACE_ID,
    });
    expect(prisma.student.delete.mock.calls[0][0].where).toEqual({ id: STUDENT_ID });
    expect(prisma.auditLog.create.mock.calls[0][0].data.action).toBe('DELETE');
  });

  it('throws STUDENT_NOT_FOUND for a missing student', async () => {
    const { prisma, service } = buildService();
    prisma.student.findFirst.mockResolvedValue(null);

    await expectBusinessError(service.remove(owner, STUDENT_ID), 'STUDENT_NOT_FOUND', 404);
    expect(prisma.student.delete).not.toHaveBeenCalled();
  });
});
