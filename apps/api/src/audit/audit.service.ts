import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AuditActionDto,
  AuditChanges,
  AuditEntityDto,
  AuditLogListResponse,
  AuditLogResponse,
  ListAuditLogsQueryDto,
} from '@tutorio/validation';
import type { AuthenticatedUser } from '../auth/auth.types';
import { buildPaginatedResponse, toSkipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  workspaceId: string;
  actorId: string | null;
  action: AuditActionDto;
  entity: AuditEntityDto;
  entityId: string;
  changes?: AuditChanges | null;
}

// Values persisted into the JSONB diff. Dates are stored as ISO strings so the
// log stays readable and JSON-serializable.
type AuditValue = Prisma.InputJsonValue | null;

function normalizeValue(value: unknown): AuditValue {
  if (value === undefined || value === null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  // Nested objects/arrays are stored as-is; they must already be JSON-safe.
  return value;
}

function isEqual(a: AuditValue, b: AuditValue): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a === 'object' || typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return a === b;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Field-level before/after diff for UPDATE entries. `fields` defaults to the
   * keys of `after`, so passing the applied PATCH payload as `after` audits
   * exactly the fields the client tried to change. Returns null when nothing
   * actually changed (no-op PATCH → no audit row).
   */
  buildChanges(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    fields: readonly string[] = Object.keys(after),
  ): AuditChanges | null {
    const changed: AuditChanges['fields'] = {};
    for (const field of fields) {
      const beforeValue = normalizeValue(before[field]);
      const afterValue = normalizeValue(after[field]);
      if (!isEqual(beforeValue, afterValue)) {
        changed[field] = { before: beforeValue, after: afterValue };
      }
    }
    return Object.keys(changed).length > 0 ? { fields: changed } : null;
  }

  /**
   * Writes an immutable audit row through the SAME transaction client as the
   * business mutation — callers must pass the `tx` from `prisma.$transaction`
   * so the mutation and its audit entry commit or roll back together.
   * UPDATE entries without effective changes are skipped (no-op PATCH).
   */
  async record(tx: Prisma.TransactionClient, entry: AuditEntry): Promise<void> {
    const changes = entry.changes ?? null;
    if (entry.action === 'UPDATE' && changes === null) {
      return;
    }
    await tx.auditLog.create({
      data: {
        workspaceId: entry.workspaceId,
        actorId: entry.actorId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        // AuditChanges values are `unknown` in the shared contract but always
        // JSON-safe here (normalized by buildChanges), hence the cast.
        diff:
          changes === null ? Prisma.DbNull : (changes as Prisma.InputJsonValue),
      },
    });
  }

  /** Owner-only, workspace-scoped, newest-first audit trail with filters. */
  async list(
    auth: AuthenticatedUser,
    query: ListAuditLogsQueryDto,
  ): Promise<AuditLogListResponse> {
    const where: Prisma.AuditLogWhereInput = {
      workspaceId: auth.workspaceId,
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        // `id` as a tiebreaker keeps pagination stable for same-instant rows.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...toSkipTake(query),
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return buildPaginatedResponse(
      rows.map((row): AuditLogResponse => {
        return {
          id: row.id,
          workspaceId: row.workspaceId,
          actorId: row.actorId,
          actor: row.actor,
          entity: row.entity as AuditLogResponse['entity'],
          entityId: row.entityId,
          action: row.action,
          changes: (row.diff as AuditChanges | null) ?? null,
          createdAt: row.createdAt.toISOString(),
        };
      }),
      total,
      query,
    );
  }
}
