import { Prisma } from '@prisma/client';
import type { ListAuditLogsQueryDto } from '@tutorio/validation';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { PrismaService } from '../prisma/prisma.service';
import { AuditService } from './audit.service';

const WORKSPACE_ID = '22222222-2222-4222-8222-222222222222';
const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const ENTITY_ID = '44444444-4444-4444-8444-444444444444';

const owner: AuthenticatedUser = {
  userId: ACTOR_ID,
  sessionId: 's1',
  workspaceId: WORKSPACE_ID,
  role: 'OWNER',
};

function buildPrismaMock() {
  const prisma = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };
  return prisma;
}

function buildService(prisma = buildPrismaMock()) {
  return {
    prisma,
    service: new AuditService(prisma as unknown as PrismaService),
  };
}

const baseQuery: ListAuditLogsQueryDto = { page: 1, pageSize: 20 };

describe('AuditService.buildChanges', () => {
  const { service } = buildService();

  it('produces field-level before/after pairs for changed fields only', () => {
    const changes = service.buildChanges(
      { name: 'Old', notes: 'same', timezone: 'UTC' },
      { name: 'New', notes: 'same' },
    );
    expect(changes).toEqual({
      fields: { name: { before: 'Old', after: 'New' } },
    });
  });

  it('returns null when nothing changed (no-op PATCH)', () => {
    expect(service.buildChanges({ name: 'Same' }, { name: 'Same' })).toBeNull();
    expect(service.buildChanges({}, {})).toBeNull();
  });

  it('normalizes dates to ISO strings and undefined to null', () => {
    const changes = service.buildChanges(
      { deletedAt: null, email: undefined },
      { deletedAt: new Date('2026-07-20T10:00:00.000Z'), email: undefined },
    );
    expect(changes).toEqual({
      fields: {
        deletedAt: { before: null, after: '2026-07-20T10:00:00.000Z' },
      },
    });
  });

  it('treats equal dates as unchanged', () => {
    expect(
      service.buildChanges(
        { at: new Date('2026-07-20T10:00:00.000Z') },
        { at: new Date('2026-07-20T10:00:00.000Z') },
      ),
    ).toBeNull();
  });

  it('audits only the requested field list when provided', () => {
    const changes = service.buildChanges(
      { name: 'Old', notes: 'old-notes' },
      { name: 'New', notes: 'new-notes' },
      ['name'],
    );
    expect(changes).toEqual({
      fields: { name: { before: 'Old', after: 'New' } },
    });
  });
});

describe('AuditService.record', () => {
  it('writes through the provided transaction client, not the base client', async () => {
    const { prisma, service } = buildService();
    const tx = { auditLog: { create: jest.fn() } };

    await service.record(tx as unknown as Prisma.TransactionClient, {
      workspaceId: WORKSPACE_ID,
      actorId: ACTOR_ID,
      action: 'CREATE',
      entity: 'STUDENT',
      entityId: ENTITY_ID,
      changes: { fields: { name: { before: null, after: 'Alice' } } },
    });

    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        workspaceId: WORKSPACE_ID,
        actorId: ACTOR_ID,
        action: 'CREATE',
        entity: 'STUDENT',
        entityId: ENTITY_ID,
        diff: { fields: { name: { before: null, after: 'Alice' } } },
      },
    });
  });

  it('skips the audit row for an UPDATE without effective changes', async () => {
    const { service } = buildService();
    const tx = { auditLog: { create: jest.fn() } };

    await service.record(tx as unknown as Prisma.TransactionClient, {
      workspaceId: WORKSPACE_ID,
      actorId: ACTOR_ID,
      action: 'UPDATE',
      entity: 'STUDENT',
      entityId: ENTITY_ID,
      changes: null,
    });

    expect(tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('stores DELETE/RESTORE entries even without a diff', async () => {
    const { service } = buildService();
    const tx = { auditLog: { create: jest.fn() } };

    await service.record(tx as unknown as Prisma.TransactionClient, {
      workspaceId: WORKSPACE_ID,
      actorId: ACTOR_ID,
      action: 'DELETE',
      entity: 'GROUP',
      entityId: ENTITY_ID,
    });

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'DELETE', diff: Prisma.DbNull }),
    });
  });
});

describe('AuditService.list', () => {
  it('always scopes the query and the count to the authenticated workspace', async () => {
    const { prisma, service } = buildService();

    await service.list(owner, baseQuery);

    const findArgs = prisma.auditLog.findMany.mock.calls[0][0];
    const countArgs = prisma.auditLog.count.mock.calls[0][0];
    expect(findArgs.where).toEqual({ workspaceId: WORKSPACE_ID });
    expect(countArgs.where).toEqual({ workspaceId: WORKSPACE_ID });
  });

  it('applies filters on top of the workspace scope', async () => {
    const { prisma, service } = buildService();

    await service.list(owner, {
      ...baseQuery,
      entity: 'STUDENT',
      action: 'DELETE',
      actorId: ACTOR_ID,
      entityId: ENTITY_ID,
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-20T00:00:00.000Z',
    });

    expect(prisma.auditLog.findMany.mock.calls[0][0].where).toEqual({
      workspaceId: WORKSPACE_ID,
      entity: 'STUDENT',
      action: 'DELETE',
      actorId: ACTOR_ID,
      entityId: ENTITY_ID,
      createdAt: {
        gte: new Date('2026-07-01T00:00:00.000Z'),
        lte: new Date('2026-07-20T00:00:00.000Z'),
      },
    });
  });

  it('paginates newest-first with a stable id tiebreaker', async () => {
    const { prisma, service } = buildService();

    await service.list(owner, { page: 3, pageSize: 10 });

    const args = prisma.auditLog.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(args.skip).toBe(20);
    expect(args.take).toBe(10);
  });

  it('maps rows to the response contract with totalPages', async () => {
    const { prisma, service } = buildService();
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: '55555555-5555-4555-8555-555555555555',
        workspaceId: WORKSPACE_ID,
        actorId: ACTOR_ID,
        actor: { id: ACTOR_ID, name: 'Olena', email: 'olena@example.com' },
        entity: 'STUDENT',
        entityId: ENTITY_ID,
        action: 'UPDATE',
        diff: { fields: { name: { before: 'Old', after: 'New' } } },
        createdAt: new Date('2026-07-20T10:00:00.000Z'),
      },
    ]);
    prisma.auditLog.count.mockResolvedValue(41);

    const result = await service.list(owner, baseQuery);

    expect(result).toEqual({
      items: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          workspaceId: WORKSPACE_ID,
          actorId: ACTOR_ID,
          actor: { id: ACTOR_ID, name: 'Olena', email: 'olena@example.com' },
          entity: 'STUDENT',
          entityId: ENTITY_ID,
          action: 'UPDATE',
          changes: { fields: { name: { before: 'Old', after: 'New' } } },
          createdAt: '2026-07-20T10:00:00.000Z',
        },
      ],
      page: 1,
      pageSize: 20,
      total: 41,
      totalPages: 3,
    });
  });
});
