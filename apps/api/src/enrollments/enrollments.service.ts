import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateEnrollmentDto,
  EnrollmentListResponse,
  EnrollmentResponse,
  ListEnrollmentsQueryDto,
  UpdateEnrollmentDto,
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import { forbidden } from '../auth/auth.errors';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  duplicateEnrollment,
  enrollmentNotFound,
  groupNotFound,
  studentNotFound,
  teacherNotFound,
} from '../common/business.errors';
import {
  buildPaginatedResponse,
  deletedAtFilter,
  toSkipTake,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

// Row shape shared by every enrollment query in this service.
const enrollmentInclude = {
  student: { select: { id: true, fullName: true } },
  group: { select: { id: true, name: true } },
  teacher: { select: { id: true, fullName: true, color: true } },
} satisfies Prisma.EnrollmentInclude;

type EnrollmentRow = Prisma.EnrollmentGetPayload<{
  include: typeof enrollmentInclude;
}>;

function toResponse(
  row: EnrollmentRow,
  workspaceDefaultDeadlineHours: number,
): EnrollmentResponse {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    studentId: row.studentId,
    groupId: row.groupId,
    teacherId: row.teacherId,
    student: row.student,
    group: row.group,
    teacher: {
      id: row.teacher.id,
      name: row.teacher.fullName,
      color: row.teacher.color,
    },
    status: row.status,
    billingType: row.billingType,
    priceMinor: row.priceMinor,
    currency: row.currency as EnrollmentResponse['currency'],
    cancellationDeadlineHours: row.cancellationDeadlineHours,
    effectiveCancellationDeadlineHours:
      row.cancellationDeadlineHours ?? workspaceDefaultDeadlineHours,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async getWorkspaceDefaultDeadline(
    tx: Prisma.TransactionClient,
    workspaceId: string,
  ): Promise<number> {
    const workspace = await tx.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { cancellationDeadlineHours: true },
    });
    return workspace.cancellationDeadlineHours;
  }

  /**
   * Throws DUPLICATE_ENROLLMENT when another live enrollment would be
   * indistinguishable: same student+group, or same student+teacher for
   * individual enrollments. Backed by partial unique indexes in the DB.
   */
  private async assertNoLiveDuplicate(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    studentId: string,
    groupId: string | null,
    teacherId: string,
    excludeId?: string,
  ): Promise<void> {
    const duplicate = await tx.enrollment.findFirst({
      where: {
        workspaceId,
        studentId,
        deletedAt: null,
        ...(groupId ? { groupId } : { groupId: null, teacherId }),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw duplicateEnrollment();
    }
  }

  async list(
    auth: AuthenticatedUser,
    query: ListEnrollmentsQueryDto,
  ): Promise<EnrollmentListResponse> {
    if (query.state !== 'active' && auth.role !== 'OWNER') {
      throw forbidden();
    }

    const where: Prisma.EnrollmentWhereInput = {
      workspaceId: auth.workspaceId,
      ...deletedAtFilter(query.state),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [rows, total, workspace] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...toSkipTake(query),
        include: enrollmentInclude,
      }),
      this.prisma.enrollment.count({ where }),
      this.prisma.workspace.findUniqueOrThrow({
        where: { id: auth.workspaceId },
        select: { cancellationDeadlineHours: true },
      }),
    ]);

    return buildPaginatedResponse(
      rows.map((row) => toResponse(row, workspace.cancellationDeadlineHours)),
      total,
      query,
    );
  }

  async create(
    auth: AuthenticatedUser,
    dto: CreateEnrollmentDto,
  ): Promise<EnrollmentResponse> {
    const groupId = dto.groupId ?? null;

    const { row, defaultDeadline } = await this.prisma
      .$transaction(async (tx) => {
        // Related records must be live and belong to the authenticated
        // workspace; cross-workspace IDs get the same 404 as missing ones.
        const student = await tx.student.findFirst({
          where: {
            id: dto.studentId,
            workspaceId: auth.workspaceId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!student) {
          throw studentNotFound();
        }

        if (groupId) {
          const group = await tx.group.findFirst({
            where: {
              id: groupId,
              workspaceId: auth.workspaceId,
              deletedAt: null,
            },
            select: { id: true },
          });
          if (!group) {
            throw groupNotFound();
          }
        }

        const teacher = await tx.teacher.findFirst({
          where: {
            id: dto.teacherId,
            workspaceId: auth.workspaceId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!teacher) {
          throw teacherNotFound();
        }

        await this.assertNoLiveDuplicate(
          tx,
          auth.workspaceId,
          dto.studentId,
          groupId,
          dto.teacherId,
        );

        const created = await tx.enrollment.create({
          data: {
            workspaceId: auth.workspaceId,
            studentId: dto.studentId,
            groupId,
            teacherId: dto.teacherId,
            billingType: dto.billingType,
            priceMinor: dto.priceMinor,
            currency: dto.currency,
            cancellationDeadlineHours: dto.cancellationDeadlineHours ?? null,
          },
          include: enrollmentInclude,
        });

        await this.audit.record(tx, {
          workspaceId: auth.workspaceId,
          actorId: auth.userId,
          action: 'CREATE',
          entity: 'ENROLLMENT',
          entityId: created.id,
          changes: this.audit.buildChanges(
            {},
            {
              studentId: dto.studentId,
              groupId,
              teacherId: dto.teacherId,
              billingType: dto.billingType,
              priceMinor: dto.priceMinor,
              currency: dto.currency,
              cancellationDeadlineHours: dto.cancellationDeadlineHours ?? null,
            },
          ),
        });

        return {
          row: created,
          defaultDeadline: await this.getWorkspaceDefaultDeadline(
            tx,
            auth.workspaceId,
          ),
        };
      })
      .catch((error: unknown) => {
        // The partial unique indexes are the last line of defense on races.
        if (isUniqueViolation(error)) {
          throw duplicateEnrollment();
        }
        throw error;
      });

    return toResponse(row, defaultDeadline);
  }

  async getDetail(
    auth: AuthenticatedUser,
    enrollmentId: string,
  ): Promise<EnrollmentResponse> {
    const [row, workspace] = await this.prisma.$transaction([
      this.prisma.enrollment.findFirst({
        where: {
          id: enrollmentId,
          workspaceId: auth.workspaceId,
          deletedAt: null,
        },
        include: enrollmentInclude,
      }),
      this.prisma.workspace.findUniqueOrThrow({
        where: { id: auth.workspaceId },
        select: { cancellationDeadlineHours: true },
      }),
    ]);
    if (!row) {
      throw enrollmentNotFound();
    }
    return toResponse(row, workspace.cancellationDeadlineHours);
  }

  async update(
    auth: AuthenticatedUser,
    enrollmentId: string,
    dto: UpdateEnrollmentDto,
  ): Promise<EnrollmentResponse> {
    const { row, defaultDeadline } = await this.prisma.$transaction(
      async (tx) => {
        const before = await tx.enrollment.findFirst({
          where: {
            id: enrollmentId,
            workspaceId: auth.workspaceId,
            deletedAt: null,
          },
          include: enrollmentInclude,
        });
        if (!before) {
          throw enrollmentNotFound();
        }

        const defaultDeadline = await this.getWorkspaceDefaultDeadline(
          tx,
          auth.workspaceId,
        );

        const changes = this.audit.buildChanges(before, { ...dto });
        if (!changes) {
          // No-op PATCH: nothing to persist, no audit row.
          return { row: before, defaultDeadline };
        }

        const updated = await tx.enrollment.update({
          where: { id: before.id },
          data: dto,
          include: enrollmentInclude,
        });
        await this.audit.record(tx, {
          workspaceId: auth.workspaceId,
          actorId: auth.userId,
          action: 'UPDATE',
          entity: 'ENROLLMENT',
          entityId: before.id,
          changes,
        });
        return { row: updated, defaultDeadline };
      },
    );
    return toResponse(row, defaultDeadline);
  }

  async softDelete(
    auth: AuthenticatedUser,
    enrollmentId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.findFirst({
        where: { id: enrollmentId, workspaceId: auth.workspaceId },
      });
      if (!enrollment) {
        throw enrollmentNotFound();
      }
      if (enrollment.deletedAt) {
        // Idempotent: deleting an already deleted enrollment is a no-op.
        return;
      }

      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { deletedAt: new Date() },
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'DELETE',
        entity: 'ENROLLMENT',
        entityId: enrollment.id,
      });
    });
  }

  async restore(
    auth: AuthenticatedUser,
    enrollmentId: string,
  ): Promise<EnrollmentResponse> {
    const { row, defaultDeadline } = await this.prisma
      .$transaction(async (tx) => {
        const existing = await tx.enrollment.findFirst({
          where: { id: enrollmentId, workspaceId: auth.workspaceId },
          include: enrollmentInclude,
        });
        if (!existing) {
          throw enrollmentNotFound();
        }

        const defaultDeadline = await this.getWorkspaceDefaultDeadline(
          tx,
          auth.workspaceId,
        );

        if (!existing.deletedAt) {
          // Idempotent: restoring a live enrollment is a no-op.
          return { row: existing, defaultDeadline };
        }

        // Restoring must not resurrect a duplicate of a now-live enrollment.
        await this.assertNoLiveDuplicate(
          tx,
          auth.workspaceId,
          existing.studentId,
          existing.groupId,
          existing.teacherId,
          existing.id,
        );

        const restored = await tx.enrollment.update({
          where: { id: existing.id },
          data: { deletedAt: null },
          include: enrollmentInclude,
        });
        await this.audit.record(tx, {
          workspaceId: auth.workspaceId,
          actorId: auth.userId,
          action: 'RESTORE',
          entity: 'ENROLLMENT',
          entityId: existing.id,
        });
        return { row: restored, defaultDeadline };
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) {
          throw duplicateEnrollment();
        }
        throw error;
      });
    return toResponse(row, defaultDeadline);
  }
}
