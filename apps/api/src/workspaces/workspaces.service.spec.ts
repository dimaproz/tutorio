import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from './workspaces.service';

const WORKSPACE_ID = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-07-20T10:00:00.000Z');

const owner: AuthenticatedUser = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: 's1',
  workspaceId: WORKSPACE_ID,
  role: 'OWNER',
};

const workspaceRow = {
  id: WORKSPACE_ID,
  name: 'SpeakWise',
  plan: 'FREE' as const,
  defaultCurrency: 'EUR',
  cancellationDeadlineHours: 24,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
};

const membershipRow = {
  id: '33333333-3333-4333-8333-333333333333',
  workspaceId: WORKSPACE_ID,
  userId: owner.userId,
  role: 'OWNER' as const,
  workspace: workspaceRow,
};

function buildPrismaMock() {
  const prisma = {
    workspace: { findFirst: jest.fn(), update: jest.fn() },
    workspaceMember: {
      findUnique: jest.fn().mockResolvedValue(membershipRow),
      findMany: jest.fn().mockResolvedValue([]),
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
  const service = new WorkspacesService(
    prisma as unknown as PrismaService,
    audit,
  );
  return { prisma, service };
}

describe('WorkspacesService.updateSettings', () => {
  it('updates only the authenticated workspace and audits WORKSPACE UPDATE', async () => {
    const { prisma, service } = buildService();
    prisma.workspace.findFirst.mockResolvedValue(workspaceRow);

    await service.updateSettings(owner, {
      defaultCurrency: 'UAH',
      cancellationDeadlineHours: 48,
    });

    expect(prisma.workspace.findFirst.mock.calls[0][0].where).toMatchObject({
      id: WORKSPACE_ID,
      deletedAt: null,
    });
    expect(prisma.workspace.update.mock.calls[0][0]).toMatchObject({
      where: { id: WORKSPACE_ID },
      data: { defaultCurrency: 'UAH', cancellationDeadlineHours: 48 },
    });
    expect(prisma.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'UPDATE',
      entity: 'WORKSPACE',
      entityId: WORKSPACE_ID,
      diff: {
        fields: {
          defaultCurrency: { before: 'EUR', after: 'UAH' },
          cancellationDeadlineHours: { before: 24, after: 48 },
        },
      },
    });
  });

  it('does not persist or audit a no-op settings PATCH', async () => {
    const { prisma, service } = buildService();
    prisma.workspace.findFirst.mockResolvedValue(workspaceRow);

    await service.updateSettings(owner, { defaultCurrency: 'EUR' });

    expect(prisma.workspace.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('WorkspacesService.listMembers', () => {
  it('returns the workspace-scoped roster with compact user info', async () => {
    const { prisma, service } = buildService();
    prisma.workspaceMember.findMany.mockResolvedValue([
      {
        ...membershipRow,
        user: { name: 'Olena', email: 'olena@example.com' },
      },
    ]);

    const result = await service.listMembers(owner);

    expect(prisma.workspaceMember.findMany.mock.calls[0][0].where).toEqual({
      workspaceId: WORKSPACE_ID,
    });
    expect(result.items).toEqual([
      {
        id: membershipRow.id,
        userId: owner.userId,
        name: 'Olena',
        email: 'olena@example.com',
        role: 'OWNER',
      },
    ]);
  });
});
