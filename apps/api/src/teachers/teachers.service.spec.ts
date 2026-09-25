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
  archivedAt: null,
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
    workspace: {
      findFirstOrThrow: jest
        .fn()
        .mockResolvedValue({ mode, timezone: 'Europe/Kyiv' }),
    },
    teacher: {
      count: jest.fn().mockResolvedValue(activeTeachers),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(teacherRow),
      update: jest.fn().mockResolvedValue(teacherRow),
    },
    enrollment: { findMany: jest.fn().mockResolvedValue([]) },
    group: { groupBy: jest.fn().mockResolvedValue([]) },
    lesson: { findMany: jest.fn().mockResolvedValue([]) },
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

describe('TeachersService archive state and the list', () => {
  it('activates a live archived profile on restore, behind the solo check', async () => {
    const { prisma, service } = buildService('SOLO', 1);
    prisma.teacher.findFirst.mockResolvedValue({
      ...teacherRow,
      status: 'ARCHIVED',
      archivedAt: NOW,
    });

    await expectSoloConflict(service.restore(owner, TEACHER_ID));

    const school = buildService('SCHOOL', 1);
    school.prisma.teacher.findFirst.mockResolvedValue({
      ...teacherRow,
      status: 'ARCHIVED',
      archivedAt: NOW,
    });
    await school.service.restore(owner, TEACHER_ID);
    expect(school.prisma.teacher.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'ACTIVE', archivedAt: null },
      }),
    );
  });

  it('keeps the subjects on an edit without them and stamps the archive', async () => {
    const { prisma, service } = buildService('SCHOOL', 1);
    prisma.teacher.findFirst.mockResolvedValue({
      ...teacherRow,
      subjects: ['English'],
    });

    await service.update(owner, TEACHER_ID, {
      fullName: 'Olena K',
      status: 'ARCHIVED',
    });

    const data = prisma.teacher.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('subjects');
    expect(data).toMatchObject({ fullName: 'Olena K', status: 'ARCHIVED' });
    expect(data.archivedAt).toBeInstanceOf(Date);
  });

  it('puts the caller first and keeps a non-teaching owner out of the lists', async () => {
    const { prisma, service } = buildService('SCHOOL', 3);
    const row = (id: string, fullName: string, extra = {}) => ({
      ...teacherRow,
      id,
      fullName,
      ...extra,
    });
    const mine = {
      workspaceMemberId: 'm1',
      workspaceMember: { userId: owner.userId },
    };
    prisma.teacher.findMany.mockResolvedValue([
      row('a', 'Anna'),
      row('b', 'Bohdan', { status: 'ARCHIVED', archivedAt: NOW }),
      row('z', 'Zoia', mine),
    ]);

    const teaching = await service.list(owner, {
      page: 1,
      pageSize: 20,
      state: 'active',
      sort: 'name',
    });
    expect(teaching.items.map((item) => item.id)).toEqual(['z', 'a', 'b']);
    expect(teaching.counts).toEqual({ active: 2, archived: 1, all: 3 });

    prisma.teacher.findMany.mockResolvedValue([
      row('a', 'Anna'),
      row('z', 'Zoia', { ...mine, status: 'ARCHIVED', archivedAt: NOW }),
    ]);
    const off = await service.list(owner, {
      page: 1,
      pageSize: 20,
      state: 'active',
      sort: 'name',
    });
    expect(off.items.map((item) => item.id)).toEqual(['a']);
    expect(off.counts).toEqual({ active: 1, archived: 0, all: 1 });
    expect(off.me).toMatchObject({ id: 'z', status: 'ARCHIVED', isMe: true });
  });
});
