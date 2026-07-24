import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  CreateTeacherDto,
  ListTeachersQueryDto,
  TeacherListResponse,
  TeacherResponse,
  UpdateTeacherDto,
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import { forbidden } from '../auth/auth.errors';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  invalidWorkspaceRelation,
  teacherNotFound,
} from '../common/business.errors';
import {
  buildPaginatedResponse,
  deletedAtFilter,
  toSkipTake,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

type TeacherRow = Prisma.TeacherGetPayload<true>;

function toResponse(row: TeacherRow): TeacherResponse {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    telegramUsername: row.telegramUsername,
    subjects: row.subjects as TeacherResponse['subjects'],
    bio: row.bio,
    defaultRateMinor: row.defaultRateMinor,
    currency: row.currency as TeacherResponse['currency'],
    color: row.color,
    avatarKey: row.avatarKey as TeacherResponse['avatarKey'],
    status: row.status,
    workspaceMemberId: row.workspaceMemberId,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class TeachersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    auth: AuthenticatedUser,
    query: ListTeachersQueryDto,
  ): Promise<TeacherListResponse> {
    if (query.state !== 'active' && auth.role !== 'OWNER') {
      throw forbidden();
    }

    const search = query.search
      ? {
          OR: ['fullName', 'email', 'phone', 'telegramUsername'].map((field) => ({
            [field]: { contains: query.search, mode: 'insensitive' as const },
          })),
        }
      : {};

    const where: Prisma.TeacherWhereInput = {
      workspaceId: auth.workspaceId,
      ...deletedAtFilter(query.state),
      ...search,
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.teacher.findMany({
        where,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        ...toSkipTake(query),
        include: {
          _count: {
            select: {
              enrollments: { where: { deletedAt: null, status: 'ACTIVE' } },
            },
          },
        },
      }),
      this.prisma.teacher.count({ where }),
    ]);

    return buildPaginatedResponse(
      rows.map((row) => ({
        ...toResponse(row),
        activeEnrollmentCount: row._count.enrollments,
      })),
      total,
      query,
    );
  }

  async getDetail(
    auth: AuthenticatedUser,
    teacherId: string,
  ): Promise<TeacherResponse> {
    const row = await this.prisma.teacher.findFirst({
      where: { id: teacherId, workspaceId: auth.workspaceId, deletedAt: null },
    });
    if (!row) {
      throw teacherNotFound();
    }
    return toResponse(row);
  }

  /** Throws if the linked member is missing/foreign or already linked. */
  private async assertMemberLinkable(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    memberId: string,
    excludeTeacherId?: string,
  ): Promise<void> {
    const member = await tx.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
      select: { id: true },
    });
    if (!member) {
      throw invalidWorkspaceRelation();
    }
    const linked = await tx.teacher.findFirst({
      where: {
        workspaceMemberId: memberId,
        ...(excludeTeacherId ? { id: { not: excludeTeacherId } } : {}),
      },
      select: { id: true },
    });
    if (linked) {
      throw invalidWorkspaceRelation();
    }
  }

  async create(
    auth: AuthenticatedUser,
    dto: CreateTeacherDto,
  ): Promise<TeacherResponse> {
    const teacher = await this.prisma.$transaction(async (tx) => {
      if (dto.workspaceMemberId) {
        await this.assertMemberLinkable(tx, auth.workspaceId, dto.workspaceMemberId);
      }
      const created = await tx.teacher.create({
        data: { workspaceId: auth.workspaceId, ...dto },
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'CREATE',
        entity: 'TEACHER',
        entityId: created.id,
        changes: this.audit.buildChanges({}, dto),
      });
      return created;
    });
    return toResponse(teacher);
  }

  async update(
    auth: AuthenticatedUser,
    teacherId: string,
    dto: UpdateTeacherDto,
  ): Promise<TeacherResponse> {
    const teacher = await this.prisma.$transaction(async (tx) => {
      const before = await tx.teacher.findFirst({
        where: { id: teacherId, workspaceId: auth.workspaceId, deletedAt: null },
      });
      if (!before) {
        throw teacherNotFound();
      }
      const changes = this.audit.buildChanges(before, dto);
      if (!changes) {
        return before;
      }
      if (dto.workspaceMemberId) {
        await this.assertMemberLinkable(
          tx,
          auth.workspaceId,
          dto.workspaceMemberId,
          before.id,
        );
      }
      const updated = await tx.teacher.update({
        where: { id: before.id },
        data: dto,
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'UPDATE',
        entity: 'TEACHER',
        entityId: before.id,
        changes,
      });
      return updated;
    });
    return toResponse(teacher);
  }

  /** Soft-delete; the teacher is hidden from pickers but keeps its history. */
  async softDelete(auth: AuthenticatedUser, teacherId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const teacher = await tx.teacher.findFirst({
        where: { id: teacherId, workspaceId: auth.workspaceId },
      });
      if (!teacher) {
        throw teacherNotFound();
      }
      if (teacher.deletedAt) {
        return;
      }
      await tx.teacher.update({
        where: { id: teacher.id },
        data: { deletedAt: new Date() },
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'DELETE',
        entity: 'TEACHER',
        entityId: teacher.id,
      });
    });
  }

  async restore(
    auth: AuthenticatedUser,
    teacherId: string,
  ): Promise<TeacherResponse> {
    const teacher = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.teacher.findFirst({
        where: { id: teacherId, workspaceId: auth.workspaceId },
      });
      if (!existing) {
        throw teacherNotFound();
      }
      if (!existing.deletedAt) {
        return existing;
      }
      const restored = await tx.teacher.update({
        where: { id: existing.id },
        data: { deletedAt: null },
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'RESTORE',
        entity: 'TEACHER',
        entityId: existing.id,
      });
      return restored;
    });
    return toResponse(teacher);
  }
}
