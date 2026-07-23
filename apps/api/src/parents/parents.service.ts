import { Injectable } from '@nestjs/common';
import type { Parent, Prisma } from '@prisma/client';
import type {
  CreateParentDto,
  ListParentsQueryDto,
  ParentDetail,
  ParentListResponse,
  ParentResponse,
  UpdateParentDto,
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import { forbidden } from '../auth/auth.errors';
import type { AuthenticatedUser } from '../auth/auth.types';
import { parentNotFound } from '../common/business.errors';
import {
  buildPaginatedResponse,
  deletedAtFilter,
  toSkipTake,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

function toResponse(row: Parent): ParentResponse {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    fullName: row.fullName,
    phone: row.phone,
    telegramUsername: row.telegramUsername,
    avatarKey: row.avatarKey as ParentResponse['avatarKey'],
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

// Live (non-deleted) linked students, deduped, alphabetical — mirrors how
// GroupsService rolls up its student roster.
const studentRosterInclude = {
  students: {
    where: { student: { deletedAt: null } },
    include: { student: { select: { id: true, fullName: true, avatarKey: true } } },
    orderBy: { student: { fullName: 'asc' as const } },
  },
} satisfies Prisma.ParentInclude;

function toRoster(
  row: Prisma.ParentGetPayload<{ include: typeof studentRosterInclude }>,
): ParentDetail['students'] {
  return row.students.map((link) => ({
    id: link.student.id,
    fullName: link.student.fullName,
    avatarKey: link.student.avatarKey as ParentDetail['students'][number]['avatarKey'],
  }));
}

@Injectable()
export class ParentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    auth: AuthenticatedUser,
    query: ListParentsQueryDto,
  ): Promise<ParentListResponse> {
    if (query.state !== 'active' && auth.role !== 'OWNER') {
      throw forbidden();
    }

    const search = query.search
      ? {
          OR: ['fullName', 'phone', 'telegramUsername'].map((field) => ({
            [field]: {
              contains: query.search,
              mode: 'insensitive' as const,
            },
          })),
        }
      : {};

    const where: Prisma.ParentWhereInput = {
      workspaceId: auth.workspaceId,
      ...deletedAtFilter(query.state),
      ...search,
      ...(query.studentId
        ? { students: { some: { studentId: query.studentId } } }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.parent.findMany({
        where,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        ...toSkipTake(query),
        include: studentRosterInclude,
      }),
      this.prisma.parent.count({ where }),
    ]);

    return buildPaginatedResponse(
      rows.map((row) => ({
        id: row.id,
        fullName: row.fullName,
        phone: row.phone,
        telegramUsername: row.telegramUsername,
        avatarKey: row.avatarKey as ParentListResponse['items'][number]['avatarKey'],
        deletedAt: row.deletedAt?.toISOString() ?? null,
        students: toRoster(row),
      })),
      total,
      query,
    );
  }

  async create(
    auth: AuthenticatedUser,
    dto: CreateParentDto,
  ): Promise<ParentResponse> {
    const parent = await this.prisma.$transaction(async (tx) => {
      const created = await tx.parent.create({
        data: { workspaceId: auth.workspaceId, ...dto },
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'CREATE',
        entity: 'PARENT',
        entityId: created.id,
        changes: this.audit.buildChanges({}, { ...dto }),
      });
      return created;
    });
    return toResponse(parent);
  }

  async getDetail(
    auth: AuthenticatedUser,
    parentId: string,
  ): Promise<ParentDetail> {
    const parent = await this.prisma.parent.findFirst({
      where: { id: parentId, workspaceId: auth.workspaceId, deletedAt: null },
      include: studentRosterInclude,
    });
    if (!parent) {
      throw parentNotFound();
    }

    return { ...toResponse(parent), students: toRoster(parent) };
  }

  async update(
    auth: AuthenticatedUser,
    parentId: string,
    dto: UpdateParentDto,
  ): Promise<ParentResponse> {
    const parent = await this.prisma.$transaction(async (tx) => {
      const before = await tx.parent.findFirst({
        where: {
          id: parentId,
          workspaceId: auth.workspaceId,
          deletedAt: null,
        },
      });
      if (!before) {
        throw parentNotFound();
      }

      const changes = this.audit.buildChanges(before, { ...dto });
      if (!changes) {
        // No-op PATCH: nothing to persist, no audit row.
        return before;
      }

      const updated = await tx.parent.update({
        where: { id: before.id },
        data: dto,
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'UPDATE',
        entity: 'PARENT',
        entityId: before.id,
        changes,
      });
      return updated;
    });
    return toResponse(parent);
  }

  /**
   * Permanently delete a parent and its student links (no FK cascade in the
   * schema). Irreversible — there is no trash and no restore.
   */
  async remove(auth: AuthenticatedUser, parentId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const parent = await tx.parent.findFirst({
        where: { id: parentId, workspaceId: auth.workspaceId },
      });
      if (!parent) {
        throw parentNotFound();
      }

      await tx.studentParent.deleteMany({ where: { parentId: parent.id } });
      await tx.parent.delete({ where: { id: parent.id } });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'DELETE',
        entity: 'PARENT',
        entityId: parent.id,
      });
    });
  }
}
