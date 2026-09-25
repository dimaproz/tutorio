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
  studentArchivedRequiresRestore,
  studentNotFound,
  teacherNotFound,
} from '../common/business.errors';
import {
  buildPaginatedResponse,
  deletedAtFilter,
  toSkipTake,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import {
  enrollmentInclude,
  enrollmentWithDeadlineInclude,
  toEnrollmentResponse,
  type EnrollmentWithDeadlineRow,
} from './enrollment-response';
import {
  reconcileGroupSchedule,
  restoreEnrollmentSchedule,
  suspendEnrollmentSchedule,
  lockGroupSchedule,
  lockStudentLifecycles,
  lockTeacherSchedules,
} from '../scheduling/lifecycle-suspension';

// The row a mutation reads under its locks: the response shape plus what
// the lifecycle rules check (student status, group and teacher liveness).
const lockedEnrollmentInclude = {
  student: { select: { id: true, fullName: true, status: true } },
  group: {
    select: {
      id: true,
      name: true,
      deletedAt: true,
      pricePerLesson: true,
      currency: true,
    },
  },
  teacher: {
    select: { id: true, fullName: true, color: true, deletedAt: true },
  },
  workspace: { select: { cancellationDeadlineHours: true } },
} satisfies Prisma.EnrollmentInclude;

function toResponse(row: EnrollmentWithDeadlineRow): EnrollmentResponse {
  return toEnrollmentResponse(row, row.workspace.cancellationDeadlineHours);
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

    const [rows, total, workspace] = await Promise.all([
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
      rows.map((row) =>
        toEnrollmentResponse(row, workspace.cancellationDeadlineHours),
      ),
      total,
      query,
    );
  }

  async create(
    auth: AuthenticatedUser,
    dto: CreateEnrollmentDto,
  ): Promise<EnrollmentResponse> {
    const groupId = dto.groupId ?? null;

    const row = await this.prisma
      .$transaction(async (tx) => {
        await lockStudentLifecycles(tx, auth.workspaceId, [dto.studentId]);
        if (groupId) {
          await lockGroupSchedule(tx, auth.workspaceId, groupId);
        }
        // Related records must be live and belong to the authenticated
        // workspace; cross-workspace IDs get the same 404 as missing ones.
        const student = await tx.student.findFirst({
          where: {
            id: dto.studentId,
            workspaceId: auth.workspaceId,
            deletedAt: null,
            status: { not: 'ARCHIVED' },
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
          include: enrollmentWithDeadlineInclude,
        });
        if (groupId) {
          await reconcileGroupSchedule(
            tx,
            auth.workspaceId,
            groupId,
            new Date(),
          );
        }

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

        return created;
      })
      .catch((error: unknown) => {
        // The partial unique indexes are the last line of defense on races.
        if (isUniqueViolation(error)) {
          throw duplicateEnrollment();
        }
        throw error;
      });

    return toResponse(row);
  }

  async getDetail(
    auth: AuthenticatedUser,
    enrollmentId: string,
  ): Promise<EnrollmentResponse> {
    const row = await this.prisma.enrollment.findFirst({
      where: {
        id: enrollmentId,
        workspaceId: auth.workspaceId,
        deletedAt: null,
      },
      include: enrollmentWithDeadlineInclude,
    });
    if (!row) {
      throw enrollmentNotFound();
    }
    return toResponse(row);
  }

  /**
   * Takes the locks every enrollment mutation needs, in the global order:
   * student lifecycle, then the group or individual teacher schedule. The
   * unlocked read only locates the lock keys; callers re-read after it.
   */
  private async lockEnrollment(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    enrollmentId: string,
    where: Prisma.EnrollmentWhereInput,
  ): Promise<void> {
    const keys = await tx.enrollment.findFirst({
      where: { id: enrollmentId, workspaceId, ...where },
      select: { studentId: true, groupId: true, teacherId: true },
    });
    if (!keys) {
      throw enrollmentNotFound();
    }
    await lockStudentLifecycles(tx, workspaceId, [keys.studentId]);
    if (keys.groupId) {
      await lockGroupSchedule(tx, workspaceId, keys.groupId);
    } else {
      await lockTeacherSchedules(tx, workspaceId, [keys.teacherId]);
    }
  }

  async update(
    auth: AuthenticatedUser,
    enrollmentId: string,
    dto: UpdateEnrollmentDto,
  ): Promise<EnrollmentResponse> {
    const row = await this.prisma.$transaction(async (tx) => {
      await this.lockEnrollment(tx, auth.workspaceId, enrollmentId, {
        deletedAt: null,
      });
      const before = await tx.enrollment.findFirst({
        where: {
          id: enrollmentId,
          workspaceId: auth.workspaceId,
          deletedAt: null,
        },
        include: lockedEnrollmentInclude,
      });
      if (!before) {
        throw enrollmentNotFound();
      }
      // A group member's price is their own unless it is the group's
      // (L-11): saving the group price makes the member follow it again.
      const ownPrice =
        before.group &&
        (dto.priceMinor !== undefined || dto.currency !== undefined)
          ? before.group.pricePerLesson === null ||
            (dto.priceMinor ?? before.priceMinor) !==
              before.group.pricePerLesson ||
            (dto.currency ?? before.currency) !== before.group.currency
          : before.ownPrice;
      const changes = this.audit.buildChanges(before, { ...dto, ownPrice });
      if (!changes) {
        // No-op PATCH: nothing to persist, no audit row.
        return before;
      }

      const statusChanges =
        dto.status !== undefined && dto.status !== before.status;
      // An archived student's roster and schedule stay suspended until the
      // student itself is restored; reviving them here would bring back
      // future lessons the archive took away.
      if (
        statusChanges &&
        dto.status !== 'ARCHIVED' &&
        before.student.status === 'ARCHIVED'
      ) {
        throw studentArchivedRequiresRestore();
      }

      const now = new Date();
      const becomesInactive =
        before.groupId === null &&
        before.status === 'ACTIVE' &&
        dto.status !== undefined &&
        dto.status !== 'ACTIVE';
      const becomesActive =
        before.groupId === null &&
        before.status !== 'ACTIVE' &&
        dto.status === 'ACTIVE';
      const suspensionToken = becomesInactive
        ? await suspendEnrollmentSchedule(tx, before.id, now)
        : before.scheduleSuspensionToken;
      if (becomesActive && suspensionToken) {
        await restoreEnrollmentSchedule(
          tx,
          auth.workspaceId,
          before.id,
          suspensionToken,
          now,
        );
      }

      const updated = await tx.enrollment.update({
        where: { id: before.id },
        data: {
          ...dto,
          ownPrice,
          ...(becomesInactive
            ? { scheduleSuspensionToken: suspensionToken }
            : {}),
          ...(becomesActive ? { scheduleSuspensionToken: null } : {}),
          // A manual status change supersedes a marker left by an earlier
          // student archive; that archive must not revive this row later.
          ...(statusChanges
            ? { studentArchivedAt: null, statusBeforeStudentArchive: null }
            : {}),
        },
        include: enrollmentWithDeadlineInclude,
      });
      if (before.groupId) {
        await reconcileGroupSchedule(tx, auth.workspaceId, before.groupId, now);
      }
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'UPDATE',
        entity: 'ENROLLMENT',
        entityId: before.id,
        changes,
      });
      return updated;
    });
    return toResponse(row);
  }

  async softDelete(
    auth: AuthenticatedUser,
    enrollmentId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const keys = await tx.enrollment.findFirst({
        where: { id: enrollmentId, workspaceId: auth.workspaceId },
        select: { groupId: true, teacherId: true },
      });
      if (!keys) {
        throw enrollmentNotFound();
      }
      const now = new Date();
      if (keys.groupId) {
        await lockGroupSchedule(tx, auth.workspaceId, keys.groupId);
      } else {
        await lockTeacherSchedules(tx, auth.workspaceId, [keys.teacherId]);
      }
      const enrollment = await tx.enrollment.findFirst({
        where: { id: enrollmentId, workspaceId: auth.workspaceId },
      });
      if (!enrollment) {
        throw enrollmentNotFound();
      }
      if (enrollment.deletedAt) {
        // Recheck after the lock: a concurrent delete is an idempotent no-op.
        return;
      }
      const suspensionToken = enrollment.groupId
        ? null
        : (enrollment.scheduleSuspensionToken ??
          (await suspendEnrollmentSchedule(tx, enrollment.id, now)));
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { deletedAt: now, scheduleSuspensionToken: suspensionToken },
      });
      if (enrollment.groupId) {
        await reconcileGroupSchedule(
          tx,
          auth.workspaceId,
          enrollment.groupId,
          now,
        );
      }
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
    const row = await this.prisma
      .$transaction(async (tx) => {
        await this.lockEnrollment(tx, auth.workspaceId, enrollmentId, {});
        const existing = await tx.enrollment.findFirst({
          where: { id: enrollmentId, workspaceId: auth.workspaceId },
          include: lockedEnrollmentInclude,
        });
        if (!existing) {
          throw enrollmentNotFound();
        }
        if (!existing.deletedAt) {
          // Recheck after the lock: a concurrent restore is a no-op.
          return existing;
        }
        // A restored enrollment must point at live records only, and an
        // archived student's relationships return with the student.
        if (existing.student.status === 'ARCHIVED') {
          throw studentArchivedRequiresRestore();
        }
        if (existing.group?.deletedAt) {
          throw groupNotFound();
        }
        if (existing.teacher.deletedAt) {
          throw teacherNotFound();
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

        const now = new Date();
        if (
          existing.groupId === null &&
          existing.status === 'ACTIVE' &&
          existing.scheduleSuspensionToken
        ) {
          await restoreEnrollmentSchedule(
            tx,
            auth.workspaceId,
            existing.id,
            existing.scheduleSuspensionToken,
            now,
          );
        }
        const restored = await tx.enrollment.update({
          where: { id: existing.id },
          data: {
            deletedAt: null,
            ...(existing.groupId === null && existing.status === 'ACTIVE'
              ? { scheduleSuspensionToken: null }
              : {}),
            // The student is live, so a marker from an earlier student
            // archive is stale: no student restore will ever consume it.
            ...(existing.studentArchivedAt
              ? { studentArchivedAt: null, statusBeforeStudentArchive: null }
              : {}),
          },
          include: enrollmentWithDeadlineInclude,
        });
        if (existing.groupId) {
          await reconcileGroupSchedule(
            tx,
            auth.workspaceId,
            existing.groupId,
            now,
          );
        }
        await this.audit.record(tx, {
          workspaceId: auth.workspaceId,
          actorId: auth.userId,
          action: 'RESTORE',
          entity: 'ENROLLMENT',
          entityId: existing.id,
        });
        return restored;
      })
      .catch((error: unknown) => {
        if (isUniqueViolation(error)) {
          throw duplicateEnrollment();
        }
        throw error;
      });
    return toResponse(row);
  }
}
