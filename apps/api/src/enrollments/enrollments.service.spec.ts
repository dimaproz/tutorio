import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BusinessApiException } from '../common/business.errors';
import type { PrismaService } from '../prisma/prisma.service';
import { EnrollmentsService } from './enrollments.service';

const WORKSPACE_ID = '22222222-2222-4222-8222-222222222222';
const STUDENT_ID = '44444444-4444-4444-8444-444444444444';
const GROUP_ID = '55555555-5555-4555-8555-555555555555';
const TEACHER_ID = '66666666-6666-4666-8666-666666666666';
const ENROLLMENT_ID = '77777777-7777-4777-8777-777777777777';
const NOW = new Date('2026-07-20T10:00:00.000Z');

const owner: AuthenticatedUser = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 's1',
  workspaceId: WORKSPACE_ID,
  role: 'OWNER',
};

const enrollmentRow = {
  id: ENROLLMENT_ID,
  workspaceId: WORKSPACE_ID,
  studentId: STUDENT_ID,
  groupId: null,
  teacherId: TEACHER_ID,
  status: 'ACTIVE' as const,
  billingType: 'PACKAGE' as const,
  priceMinor: 2550,
  currency: 'EUR',
  cancellationDeadlineHours: null,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  student: { id: STUDENT_ID, fullName: 'Alice Example' },
  group: null,
  teacher: {
    id: TEACHER_ID,
    userId: owner.userId,
    user: { name: 'Olena' },
  },
};

const createDto = {
  studentId: STUDENT_ID,
  teacherId: TEACHER_ID,
  billingType: 'PACKAGE' as const,
  priceMinor: 2550,
  currency: 'EUR' as const,
};

function buildPrismaMock() {
  const prisma = {
    enrollment: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
    },
    student: { findFirst: jest.fn().mockResolvedValue({ id: STUDENT_ID }) },
    group: { findFirst: jest.fn().mockResolvedValue({ id: GROUP_ID }) },
    workspaceMember: {
      findFirst: jest.fn().mockResolvedValue({ id: TEACHER_ID }),
    },
    workspace: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ cancellationDeadlineHours: 24 }),
    },
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
  const service = new EnrollmentsService(
    prisma as unknown as PrismaService,
    audit,
  );
  return { prisma, service };
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

describe('EnrollmentsService.create', () => {
  it('validates that the student is a live same-workspace record', async () => {
    const { prisma, service } = buildService();
    prisma.student.findFirst.mockResolvedValue(null);

    await expectBusinessError(
      service.create(owner, createDto),
      'STUDENT_NOT_FOUND',
      404,
    );
    expect(prisma.student.findFirst.mock.calls[0][0].where).toMatchObject({
      id: STUDENT_ID,
      workspaceId: WORKSPACE_ID,
      deletedAt: null,
    });
    expect(prisma.enrollment.create).not.toHaveBeenCalled();
  });

  it('validates the teacher against the same workspace', async () => {
    const { prisma, service } = buildService();
    prisma.workspaceMember.findFirst.mockResolvedValue(null);

    await expectBusinessError(
      service.create(owner, createDto),
      'WORKSPACE_MEMBER_NOT_FOUND',
      404,
    );
    expect(
      prisma.workspaceMember.findFirst.mock.calls[0][0].where,
    ).toMatchObject({ id: TEACHER_ID, workspaceId: WORKSPACE_ID });
  });

  it('validates the group when provided', async () => {
    const { prisma, service } = buildService();
    prisma.group.findFirst.mockResolvedValue(null);

    await expectBusinessError(
      service.create(owner, { ...createDto, groupId: GROUP_ID }),
      'GROUP_NOT_FOUND',
      404,
    );
  });

  it('rejects a live duplicate individual enrollment with 409', async () => {
    const { prisma, service } = buildService();
    prisma.enrollment.findFirst.mockResolvedValue({ id: 'existing' });

    await expectBusinessError(
      service.create(owner, createDto),
      'DUPLICATE_ENROLLMENT',
      409,
    );
    expect(prisma.enrollment.findFirst.mock.calls[0][0].where).toMatchObject({
      workspaceId: WORKSPACE_ID,
      studentId: STUDENT_ID,
      deletedAt: null,
      groupId: null,
      teacherId: TEACHER_ID,
    });
  });

  it('checks group duplicates per student+group, ignoring the teacher', async () => {
    const { prisma, service } = buildService();
    prisma.enrollment.findFirst.mockResolvedValue(null);
    prisma.enrollment.create.mockResolvedValue({
      ...enrollmentRow,
      groupId: GROUP_ID,
      group: { id: GROUP_ID, name: 'B1' },
    });

    await service.create(owner, { ...createDto, groupId: GROUP_ID });

    const where = prisma.enrollment.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ groupId: GROUP_ID });
    expect(where.teacherId).toBeUndefined();
  });

  it('creates with the workspace id from auth and audits CREATE', async () => {
    const { prisma, service } = buildService();
    prisma.enrollment.findFirst.mockResolvedValue(null);
    prisma.enrollment.create.mockResolvedValue(enrollmentRow);

    const result = await service.create(owner, createDto);

    expect(prisma.enrollment.create.mock.calls[0][0].data.workspaceId).toBe(
      WORKSPACE_ID,
    );
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'CREATE',
      entity: 'ENROLLMENT',
      entityId: ENROLLMENT_ID,
    });
    // No override → inherits the current workspace default.
    expect(result.effectiveCancellationDeadlineHours).toBe(24);
  });
});

describe('EnrollmentsService effective deadline', () => {
  it('prefers the enrollment override over the workspace default', async () => {
    const { prisma, service } = buildService();
    prisma.enrollment.findFirst.mockResolvedValue({
      ...enrollmentRow,
      cancellationDeadlineHours: 48,
    });

    const result = await service.getDetail(owner, ENROLLMENT_ID);

    expect(result.cancellationDeadlineHours).toBe(48);
    expect(result.effectiveCancellationDeadlineHours).toBe(48);
  });

  it('falls back to the workspace default when no override is set', async () => {
    const { prisma, service } = buildService();
    prisma.enrollment.findFirst.mockResolvedValue(enrollmentRow);

    const result = await service.getDetail(owner, ENROLLMENT_ID);

    expect(result.cancellationDeadlineHours).toBeNull();
    expect(result.effectiveCancellationDeadlineHours).toBe(24);
  });
});

describe('EnrollmentsService.update', () => {
  it('skips persistence and audit for a no-op PATCH', async () => {
    const { prisma, service } = buildService();
    prisma.enrollment.findFirst.mockResolvedValue(enrollmentRow);

    await service.update(owner, ENROLLMENT_ID, { priceMinor: 2550 });

    expect(prisma.enrollment.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('audits the billing diff on a real change', async () => {
    const { prisma, service } = buildService();
    prisma.enrollment.findFirst.mockResolvedValue(enrollmentRow);
    prisma.enrollment.update.mockResolvedValue({
      ...enrollmentRow,
      priceMinor: 3000,
    });

    await service.update(owner, ENROLLMENT_ID, { priceMinor: 3000 });

    expect(prisma.auditLog.create.mock.calls[0][0].data.diff).toEqual({
      fields: { priceMinor: { before: 2550, after: 3000 } },
    });
  });
});

describe('EnrollmentsService.restore', () => {
  it('rejects restoring next to an equivalent live enrollment', async () => {
    const { prisma, service } = buildService();
    prisma.enrollment.findFirst
      .mockResolvedValueOnce({ ...enrollmentRow, deletedAt: NOW })
      .mockResolvedValueOnce({ id: 'live-duplicate' });

    await expectBusinessError(
      service.restore(owner, ENROLLMENT_ID),
      'DUPLICATE_ENROLLMENT',
      409,
    );
    expect(prisma.enrollment.update).not.toHaveBeenCalled();
  });

  it('restores and audits when no duplicate exists', async () => {
    const { prisma, service } = buildService();
    prisma.enrollment.findFirst
      .mockResolvedValueOnce({ ...enrollmentRow, deletedAt: NOW })
      .mockResolvedValueOnce(null);
    prisma.enrollment.update.mockResolvedValue(enrollmentRow);

    const result = await service.restore(owner, ENROLLMENT_ID);

    expect(prisma.enrollment.update.mock.calls[0][0].data).toEqual({
      deletedAt: null,
    });
    expect(prisma.auditLog.create.mock.calls[0][0].data.action).toBe('RESTORE');
    expect(result.deletedAt).toBeNull();
  });
});
