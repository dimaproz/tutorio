import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BusinessApiException } from '../common/business.errors';
import type { PrismaService } from '../prisma/prisma.service';
import { GroupsService } from './groups.service';

const WORKSPACE_ID = '22222222-2222-4222-8222-222222222222';
const GROUP_ID = '55555555-5555-4555-8555-555555555555';
const TEACHER_ID = '66666666-6666-4666-8666-666666666666';
const ALICE_ID = '44444444-4444-4444-8444-444444444444';
const BOB_ID = '88888888-8888-4888-8888-888888888888';
const CAROL_ID = '99999999-9999-4999-8999-999999999999';
const NOW = new Date('2026-07-20T10:00:00.000Z');

const owner: AuthenticatedUser = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 's1',
  workspaceId: WORKSPACE_ID,
  role: 'OWNER',
};

const groupRow = {
  id: GROUP_ID,
  workspaceId: WORKSPACE_ID,
  name: 'B1 English',
  pricePerLesson: 2500,
  currency: 'EUR',
  notes: null,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
};

function buildPrismaMock() {
  const prisma = {
    group: {
      findFirst: jest.fn().mockResolvedValue(groupRow),
      create: jest.fn().mockResolvedValue(groupRow),
      update: jest.fn().mockResolvedValue(groupRow),
    },
    student: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    teacher: {
      findFirst: jest.fn().mockResolvedValue({ id: TEACHER_ID }),
    },
    enrollment: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }: { data: unknown }) => ({
        id: `enrollment-${(data as { studentId: string }).studentId}`,
        ...(data as object),
      })),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    lesson: { updateMany: jest.fn() },
    lessonSeries: { updateMany: jest.fn() },
    lessonPackage: { updateMany: jest.fn() },
    payment: { updateMany: jest.fn() },
    workspace: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        defaultCurrency: 'EUR',
      }),
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
  const service = new GroupsService(prisma as unknown as PrismaService, audit);
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

describe('GroupsService roster reconciliation', () => {
  it('enrolls the initial roster inside the create transaction', async () => {
    const { prisma, service } = buildService();
    prisma.student.findMany.mockResolvedValue([
      { id: ALICE_ID, hourlyRateMinor: null, currency: null },
      { id: BOB_ID, hourlyRateMinor: null, currency: null },
    ]);

    await service.create(owner, {
      name: 'B1 English',
      students: { studentIds: [ALICE_ID, BOB_ID], teacherId: TEACHER_ID },
    });

    // One transaction, no per-student round trip from the caller.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.enrollment.create).toHaveBeenCalledTimes(2);
    expect(prisma.group.create.mock.calls[0][0].data).not.toHaveProperty(
      'students',
    );
  });

  it('adds only the newcomers and archives only the dropped students', async () => {
    const { prisma, service } = buildService();
    prisma.enrollment.findMany.mockResolvedValue([
      { id: 'enrollment-alice', studentId: ALICE_ID },
      { id: 'enrollment-bob', studentId: BOB_ID },
    ]);
    prisma.student.findMany.mockResolvedValue([
      { id: ALICE_ID, hourlyRateMinor: null, currency: null },
      { id: CAROL_ID, hourlyRateMinor: null, currency: null },
    ]);

    await service.update(owner, GROUP_ID, {
      students: { studentIds: [ALICE_ID, CAROL_ID], teacherId: TEACHER_ID },
    });

    // Alice is untouched, Bob is archived, Carol is enrolled.
    expect(prisma.enrollment.update).toHaveBeenCalledTimes(1);
    expect(prisma.enrollment.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'enrollment-bob' },
    });
    expect(prisma.enrollment.create).toHaveBeenCalledTimes(1);
    expect(prisma.enrollment.create.mock.calls[0][0].data).toMatchObject({
      studentId: CAROL_ID,
      groupId: GROUP_ID,
      teacherId: TEACHER_ID,
    });
  });

  it('reconciles the roster even when no group field changed', async () => {
    const { prisma, service } = buildService();
    prisma.student.findMany.mockResolvedValue([
      { id: ALICE_ID, hourlyRateMinor: null, currency: null },
    ]);

    await service.update(owner, GROUP_ID, {
      name: groupRow.name,
      students: { studentIds: [ALICE_ID], teacherId: TEACHER_ID },
    });

    // A no-op PATCH still writes no group audit row, but the roster applies.
    expect(prisma.group.update).not.toHaveBeenCalled();
    expect(prisma.enrollment.create).toHaveBeenCalledTimes(1);
  });

  it('prices a newcomer from the group, falling back to the student rate', async () => {
    const { prisma, service } = buildService();
    prisma.group.findFirst.mockResolvedValue({
      ...groupRow,
      pricePerLesson: null,
      currency: null,
    });
    prisma.student.findMany.mockResolvedValue([
      { id: ALICE_ID, hourlyRateMinor: 3000, currency: 'UAH' },
      { id: BOB_ID, hourlyRateMinor: null, currency: null },
    ]);

    await service.update(owner, GROUP_ID, {
      students: { studentIds: [ALICE_ID, BOB_ID], teacherId: TEACHER_ID },
    });

    expect(prisma.enrollment.create.mock.calls[0][0].data).toMatchObject({
      priceMinor: 3000,
      currency: 'UAH',
    });
    // No rate anywhere: free, in the workspace currency.
    expect(prisma.enrollment.create.mock.calls[1][0].data).toMatchObject({
      priceMinor: 0,
      currency: 'EUR',
    });
  });

  it('rejects a roster holding a student from another workspace', async () => {
    const { prisma, service } = buildService();
    prisma.student.findMany.mockResolvedValue([
      { id: ALICE_ID, hourlyRateMinor: null, currency: null },
    ]);

    await expectBusinessError(
      service.update(owner, GROUP_ID, {
        students: { studentIds: [ALICE_ID, BOB_ID], teacherId: TEACHER_ID },
      }),
      'STUDENT_NOT_FOUND',
      404,
    );
    expect(prisma.enrollment.create).not.toHaveBeenCalled();
  });

  it('rejects a roster pointing at a teacher from another workspace', async () => {
    const { prisma, service } = buildService();
    prisma.teacher.findFirst.mockResolvedValue(null);

    await expectBusinessError(
      service.update(owner, GROUP_ID, {
        students: { studentIds: [ALICE_ID], teacherId: TEACHER_ID },
      }),
      'TEACHER_NOT_FOUND',
      404,
    );
    expect(prisma.enrollment.create).not.toHaveBeenCalled();
  });

  it('removes the group graph and detaches enrolled students', async () => {
    const { prisma, service } = buildService();

    await service.softDelete(owner, GROUP_ID);

    expect(prisma.lesson.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ groupId: GROUP_ID, deletedAt: null }),
      }),
    );
    expect(prisma.lessonSeries.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ groupId: GROUP_ID, deletedAt: null }),
      }),
    );
    expect(prisma.lessonPackage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ groupId: GROUP_ID, deletedAt: null }),
      }),
    );
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { package: { is: { groupId: GROUP_ID } } },
            { enrollment: { is: { groupId: GROUP_ID } } },
          ],
        }),
      }),
    );
    expect(prisma.enrollment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ groupId: null }),
      }),
    );
    expect(prisma.group.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });
});
