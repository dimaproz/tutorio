import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BusinessApiException } from '../common/business.errors';
import type { PrismaService } from '../prisma/prisma.service';
import { TeachersService } from './teachers.service';

const WORKSPACE_ID = '22222222-2222-4222-8222-222222222222';
const TEACHER_ID = '66666666-6666-4666-8666-666666666666';
const NOW = new Date('2026-07-20T10:00:00.000Z');

const owner: AuthenticatedUser = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 's1',
  workspaceId: WORKSPACE_ID,
  role: 'OWNER',
};

const teacherRow = {
  id: TEACHER_ID,
  workspaceId: WORKSPACE_ID,
  fullName: 'Olena',
  email: null,
  phone: null,
  telegramUsername: null,
  bio: null,
  defaultRateMinor: null,
  currency: null,
  color: null,
  avatarKey: null,
  status: 'ACTIVE' as const,
  workspaceMemberId: null,
  workspaceMember: null,
  notes: null,
  subjects: [],
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
};

function buildService(mode: 'SOLO' | 'SCHOOL', activeTeachers: number) {
  const executeRaw = jest.fn().mockResolvedValue(1);
  const prisma = {
    $executeRaw: executeRaw,
    workspace: { findFirstOrThrow: jest.fn().mockResolvedValue({ mode }) },
    teacher: {
      count: jest.fn().mockResolvedValue(activeTeachers),
      findFirst: jest.fn(),
      create: jest.fn().mockResolvedValue(teacherRow),
      update: jest.fn().mockResolvedValue(teacherRow),
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
  const service = new TeachersService(
    prisma as unknown as PrismaService,
    new AuditService(prisma as unknown as PrismaService),
  );
  return { prisma, service, executeRaw };
}

async function expectSoloConflict(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
    throw new Error('expected SOLO_MODE_SINGLE_TEACHER');
  } catch (error) {
    expect(error).toBeInstanceOf(BusinessApiException);
    expect((error as BusinessApiException).code).toBe(
      'SOLO_MODE_SINGLE_TEACHER',
    );
  }
}

const SOLO_LOCK = `${WORKSPACE_ID}:solo-teacher`;

describe('TeachersService SOLO single-active-teacher rule', () => {
  it('serializes create behind the workspace lock and rejects a second profile', async () => {
    const { prisma, service, executeRaw } = buildService('SOLO', 1);

    await expectSoloConflict(
      service.create(owner, { fullName: 'Second', status: 'ACTIVE' }),
    );

    expect(executeRaw.mock.calls[0][1]).toBe(SOLO_LOCK);
    expect(executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.teacher.count.mock.invocationCallOrder[0],
    );
    expect(prisma.teacher.create).not.toHaveBeenCalled();
  });

  it('rejects re-activating an archived profile while another is active', async () => {
    const { prisma, service } = buildService('SOLO', 1);
    prisma.teacher.findFirst.mockResolvedValue({
      ...teacherRow,
      status: 'ARCHIVED',
    });

    await expectSoloConflict(
      service.update(owner, TEACHER_ID, { status: 'ACTIVE' }),
    );
    expect(prisma.teacher.count.mock.calls[0][0].where).toMatchObject({
      workspaceId: WORKSPACE_ID,
      deletedAt: null,
      status: 'ACTIVE',
      id: { not: TEACHER_ID },
    });
    expect(prisma.teacher.update).not.toHaveBeenCalled();
  });

  it('rejects restoring an active profile while another is active', async () => {
    const { prisma, service } = buildService('SOLO', 1);
    prisma.teacher.findFirst.mockResolvedValue({
      ...teacherRow,
      deletedAt: NOW,
    });

    await expectSoloConflict(service.restore(owner, TEACHER_ID));
    expect(prisma.teacher.update).not.toHaveBeenCalled();
  });

  it('allows unrelated edits and archived restores without the check', async () => {
    const { prisma, service, executeRaw } = buildService('SOLO', 1);
    prisma.teacher.findFirst
      .mockResolvedValueOnce(teacherRow)
      .mockResolvedValueOnce({
        ...teacherRow,
        status: 'ARCHIVED',
        deletedAt: NOW,
      });

    await service.update(owner, TEACHER_ID, { fullName: 'Olena K' });
    await service.restore(owner, TEACHER_ID);

    expect(prisma.teacher.count).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('does not limit school workspaces', async () => {
    const { prisma, service, executeRaw } = buildService('SCHOOL', 3);

    await service.create(owner, { fullName: 'Second', status: 'ACTIVE' });

    expect(prisma.teacher.create).toHaveBeenCalledTimes(1);
    expect(executeRaw).not.toHaveBeenCalled();
  });
});
