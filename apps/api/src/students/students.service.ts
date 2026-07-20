import { Injectable } from '@nestjs/common';
import type { Prisma, Student } from '@prisma/client';
import type {
  CreateStudentDto,
  ListStudentsQueryDto,
  StudentDetail,
  StudentListResponse,
  StudentResponse,
  UpdateStudentDto,
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import { forbidden } from '../auth/auth.errors';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  activeEnrollmentsExist,
  studentNotFound,
} from '../common/business.errors';
import {
  buildPaginatedResponse,
  deletedAtFilter,
  toSkipTake,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

function toResponse(row: Student): StudentResponse {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    timezone: row.timezone,
    parentName: row.parentName,
    parentEmail: row.parentEmail,
    parentPhone: row.parentPhone,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    auth: AuthenticatedUser,
    query: ListStudentsQueryDto,
  ): Promise<StudentListResponse> {
    if (query.state !== 'active' && auth.role !== 'OWNER') {
      throw forbidden();
    }

    const search = query.search
      ? {
          OR: [
            'fullName',
            'email',
            'phone',
            'parentName',
            'parentEmail',
            'parentPhone',
          ].map((field) => ({
            [field]: {
              contains: query.search,
              mode: 'insensitive' as const,
            },
          })),
        }
      : {};

    const where: Prisma.StudentWhereInput = {
      workspaceId: auth.workspaceId,
      ...deletedAtFilter(query.state),
      ...search,
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.student.findMany({
        where,
        orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
        ...toSkipTake(query),
        include: {
          enrollments: {
            where: { deletedAt: null },
            select: {
              status: true,
              group: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.student.count({ where }),
    ]);

    return buildPaginatedResponse(
      rows.map((row) => ({
        id: row.id,
        fullName: row.fullName,
        email: row.email,
        phone: row.phone,
        timezone: row.timezone,
        deletedAt: row.deletedAt?.toISOString() ?? null,
        activeEnrollmentCount: row.enrollments.filter(
          (enrollment) => enrollment.status === 'ACTIVE',
        ).length,
        groupNames: [
          ...new Set(
            row.enrollments
              .map((enrollment) => enrollment.group?.name)
              .filter((name): name is string => Boolean(name)),
          ),
        ],
      })),
      total,
      query,
    );
  }

  async create(
    auth: AuthenticatedUser,
    dto: CreateStudentDto,
  ): Promise<StudentResponse> {
    const student = await this.prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: { workspaceId: auth.workspaceId, ...dto },
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'CREATE',
        entity: 'STUDENT',
        entityId: created.id,
        changes: this.audit.buildChanges({}, { ...dto }),
      });
      return created;
    });
    return toResponse(student);
  }

  async getDetail(
    auth: AuthenticatedUser,
    studentId: string,
  ): Promise<StudentDetail> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, workspaceId: auth.workspaceId, deletedAt: null },
      include: {
        workspace: { select: { cancellationDeadlineHours: true } },
        enrollments: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: {
            group: { select: { id: true, name: true } },
            teacher: {
              select: { id: true, user: { select: { name: true } } },
            },
          },
        },
      },
    });
    if (!student) {
      throw studentNotFound();
    }

    return {
      ...toResponse(student),
      enrollments: student.enrollments.map((enrollment) => ({
        id: enrollment.id,
        status: enrollment.status,
        billingType: enrollment.billingType,
        priceMinor: enrollment.priceMinor,
        currency: enrollment.currency,
        cancellationDeadlineHours: enrollment.cancellationDeadlineHours,
        effectiveCancellationDeadlineHours:
          enrollment.cancellationDeadlineHours ??
          student.workspace.cancellationDeadlineHours,
        group: enrollment.group,
        teacher: {
          id: enrollment.teacher.id,
          name: enrollment.teacher.user.name,
        },
      })),
    };
  }

  async update(
    auth: AuthenticatedUser,
    studentId: string,
    dto: UpdateStudentDto,
  ): Promise<StudentResponse> {
    const student = await this.prisma.$transaction(async (tx) => {
      const before = await tx.student.findFirst({
        where: {
          id: studentId,
          workspaceId: auth.workspaceId,
          deletedAt: null,
        },
      });
      if (!before) {
        throw studentNotFound();
      }

      const changes = this.audit.buildChanges(before, { ...dto });
      if (!changes) {
        // No-op PATCH: nothing to persist, no audit row.
        return before;
      }

      const updated = await tx.student.update({
        where: { id: before.id },
        data: dto,
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'UPDATE',
        entity: 'STUDENT',
        entityId: before.id,
        changes,
      });
      return updated;
    });
    return toResponse(student);
  }

  async softDelete(auth: AuthenticatedUser, studentId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId, workspaceId: auth.workspaceId },
      });
      if (!student) {
        throw studentNotFound();
      }
      if (student.deletedAt) {
        // Idempotent: deleting an already deleted student is a no-op.
        return;
      }

      const blockers = await tx.enrollment.count({
        where: {
          studentId: student.id,
          workspaceId: auth.workspaceId,
          deletedAt: null,
          status: { in: ['ACTIVE', 'PAUSED'] },
        },
      });
      if (blockers > 0) {
        throw activeEnrollmentsExist();
      }

      await tx.student.update({
        where: { id: student.id },
        data: { deletedAt: new Date() },
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'DELETE',
        entity: 'STUDENT',
        entityId: student.id,
      });
    });
  }

  async restore(
    auth: AuthenticatedUser,
    studentId: string,
  ): Promise<StudentResponse> {
    const student = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.student.findFirst({
        where: { id: studentId, workspaceId: auth.workspaceId },
      });
      if (!existing) {
        throw studentNotFound();
      }
      if (!existing.deletedAt) {
        // Idempotent: restoring a live student is a no-op.
        return existing;
      }

      const restored = await tx.student.update({
        where: { id: existing.id },
        data: { deletedAt: null },
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'RESTORE',
        entity: 'STUDENT',
        entityId: existing.id,
      });
      return restored;
    });
    return toResponse(student);
  }
}
