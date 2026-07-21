import { Injectable } from '@nestjs/common';
import type { Group, Prisma } from '@prisma/client';
import type {
  CreateGroupDto,
  GroupDetail,
  GroupListResponse,
  GroupResponse,
  ListGroupsQueryDto,
  UpdateGroupDto,
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import { forbidden } from '../auth/auth.errors';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  activeEnrollmentsExist,
  groupNotFound,
} from '../common/business.errors';
import {
  buildPaginatedResponse,
  deletedAtFilter,
  toSkipTake,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

function toResponse(row: Group): GroupResponse {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    auth: AuthenticatedUser,
    query: ListGroupsQueryDto,
  ): Promise<GroupListResponse> {
    if (query.state !== 'active' && auth.role !== 'OWNER') {
      throw forbidden();
    }

    const where: Prisma.GroupWhereInput = {
      workspaceId: auth.workspaceId,
      ...deletedAtFilter(query.state),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.group.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        ...toSkipTake(query),
        include: {
          enrollments: {
            where: { deletedAt: null, status: { in: ['ACTIVE', 'PAUSED'] } },
            select: { student: { select: { id: true, fullName: true } } },
            orderBy: { student: { fullName: 'asc' } },
          },
        },
      }),
      this.prisma.group.count({ where }),
    ]);

    return buildPaginatedResponse(
      rows.map((row) => {
        // Dedupe: a student can only hold one live enrollment per group, but
        // this stays defensive rather than assuming it.
        const students = [
          ...new Map(
            row.enrollments.map((enrollment) => [
              enrollment.student.id,
              enrollment.student,
            ]),
          ).values(),
        ];
        return {
          id: row.id,
          name: row.name,
          notes: row.notes,
          deletedAt: row.deletedAt?.toISOString() ?? null,
          activeStudentCount: students.length,
          students,
        };
      }),
      total,
      query,
    );
  }

  async create(
    auth: AuthenticatedUser,
    dto: CreateGroupDto,
  ): Promise<GroupResponse> {
    const group = await this.prisma.$transaction(async (tx) => {
      const created = await tx.group.create({
        data: { workspaceId: auth.workspaceId, ...dto },
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'CREATE',
        entity: 'GROUP',
        entityId: created.id,
        changes: this.audit.buildChanges({}, { ...dto }),
      });
      return created;
    });
    return toResponse(group);
  }

  async getDetail(
    auth: AuthenticatedUser,
    groupId: string,
  ): Promise<GroupDetail> {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, workspaceId: auth.workspaceId, deletedAt: null },
      include: {
        enrollments: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: {
            student: { select: { id: true, fullName: true } },
            teacher: {
              select: { id: true, user: { select: { name: true } } },
            },
          },
        },
      },
    });
    if (!group) {
      throw groupNotFound();
    }

    return {
      ...toResponse(group),
      enrollments: group.enrollments.map((enrollment) => ({
        id: enrollment.id,
        status: enrollment.status,
        billingType: enrollment.billingType,
        priceMinor: enrollment.priceMinor,
        currency: enrollment.currency,
        student: enrollment.student,
        teacher: {
          id: enrollment.teacher.id,
          name: enrollment.teacher.user.name,
        },
      })),
    };
  }

  async update(
    auth: AuthenticatedUser,
    groupId: string,
    dto: UpdateGroupDto,
  ): Promise<GroupResponse> {
    const group = await this.prisma.$transaction(async (tx) => {
      const before = await tx.group.findFirst({
        where: { id: groupId, workspaceId: auth.workspaceId, deletedAt: null },
      });
      if (!before) {
        throw groupNotFound();
      }

      const changes = this.audit.buildChanges(before, { ...dto });
      if (!changes) {
        // No-op PATCH: nothing to persist, no audit row.
        return before;
      }

      const updated = await tx.group.update({
        where: { id: before.id },
        data: dto,
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'UPDATE',
        entity: 'GROUP',
        entityId: before.id,
        changes,
      });
      return updated;
    });
    return toResponse(group);
  }

  async softDelete(auth: AuthenticatedUser, groupId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const group = await tx.group.findFirst({
        where: { id: groupId, workspaceId: auth.workspaceId },
      });
      if (!group) {
        throw groupNotFound();
      }
      if (group.deletedAt) {
        // Idempotent: deleting an already deleted group is a no-op.
        return;
      }

      const blockers = await tx.enrollment.count({
        where: {
          groupId: group.id,
          workspaceId: auth.workspaceId,
          deletedAt: null,
          status: { in: ['ACTIVE', 'PAUSED'] },
        },
      });
      if (blockers > 0) {
        throw activeEnrollmentsExist();
      }

      await tx.group.update({
        where: { id: group.id },
        data: { deletedAt: new Date() },
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'DELETE',
        entity: 'GROUP',
        entityId: group.id,
      });
    });
  }

  async restore(
    auth: AuthenticatedUser,
    groupId: string,
  ): Promise<GroupResponse> {
    const group = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.group.findFirst({
        where: { id: groupId, workspaceId: auth.workspaceId },
      });
      if (!existing) {
        throw groupNotFound();
      }
      if (!existing.deletedAt) {
        // Idempotent: restoring a live group is a no-op.
        return existing;
      }

      const restored = await tx.group.update({
        where: { id: existing.id },
        data: { deletedAt: null },
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'RESTORE',
        entity: 'GROUP',
        entityId: existing.id,
      });
      return restored;
    });
    return toResponse(group);
  }
}
