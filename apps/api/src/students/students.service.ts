import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
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
  invalidWorkspaceRelation,
  studentNotFound,
} from '../common/business.errors';
import {
  buildPaginatedResponse,
  deletedAtFilter,
  toSkipTake,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

// Live (non-deleted) linked parents, in a stable order — used both to build
// the response and to compute the "before" side of the parentIds audit diff.
const parentLinksInclude = {
  parents: {
    where: { parent: { deletedAt: null } },
    include: {
      parent: {
        select: {
          id: true,
          fullName: true,
          avatarKey: true,
          phone: true,
          telegramUsername: true,
        },
      },
    },
    orderBy: { parent: { fullName: 'asc' as const } },
  },
} satisfies Prisma.StudentInclude;

type StudentWithParentLinks = Prisma.StudentGetPayload<{
  include: typeof parentLinksInclude;
}>;

function toParentRefs(student: StudentWithParentLinks): StudentResponse['parents'] {
  return student.parents.map((link) => ({
    id: link.parent.id,
    fullName: link.parent.fullName,
    avatarKey: link.parent.avatarKey as StudentResponse['parents'][number]['avatarKey'],
    phone: link.parent.phone,
    telegramUsername: link.parent.telegramUsername,
  }));
}

function toResponse(student: StudentWithParentLinks): StudentResponse {
  return {
    id: student.id,
    workspaceId: student.workspaceId,
    fullName: student.fullName,
    email: student.email,
    phone: student.phone,
    timezone: student.timezone,
    telegramUsername: student.telegramUsername,
    subject: student.subject as StudentResponse['subject'],
    hourlyRateMinor: student.hourlyRateMinor,
    currency: student.currency as StudentResponse['currency'],
    status: student.status,
    languageLevel: student.languageLevel as StudentResponse['languageLevel'],
    knowledgeLevel: student.knowledgeLevel as StudentResponse['knowledgeLevel'],
    age: student.age,
    grade: student.grade,
    avatarKey: student.avatarKey as StudentResponse['avatarKey'],
    parents: toParentRefs(student),
    notes: student.notes,
    createdAt: student.createdAt.toISOString(),
    updatedAt: student.updatedAt.toISOString(),
    deletedAt: student.deletedAt?.toISOString() ?? null,
  };
}

/** Sorted, deduped copy — a stable shape for audit-diff comparison. */
function sortedIds(ids: readonly string[]): string[] {
  return [...new Set(ids)].sort();
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
          OR: ['fullName', 'email', 'phone', 'telegramUsername'].map(
            (field) => ({
              [field]: {
                contains: query.search,
                mode: 'insensitive' as const,
              },
            }),
          ),
        }
      : {};

    const where: Prisma.StudentWhereInput = {
      workspaceId: auth.workspaceId,
      ...deletedAtFilter(query.state),
      ...search,
      ...(query.status ? { status: query.status } : {}),
      ...(query.subject ? { subject: query.subject } : {}),
      ...(query.groupId
        ? { enrollments: { some: { groupId: query.groupId, deletedAt: null } } }
        : {}),
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
        telegramUsername: row.telegramUsername,
        timezone: row.timezone,
        subject: row.subject as StudentListResponse['items'][number]['subject'],
        status: row.status,
        hourlyRateMinor: row.hourlyRateMinor,
        currency: row.currency as StudentListResponse['items'][number]['currency'],
        avatarKey: row.avatarKey as StudentListResponse['items'][number]['avatarKey'],
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

  /** Throws INVALID_WORKSPACE_RELATION if any id is missing/foreign/deleted. */
  private async assertParentsBelongToWorkspace(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    parentIds: readonly string[],
  ): Promise<void> {
    if (parentIds.length === 0) {
      return;
    }
    const count = await tx.parent.count({
      where: { id: { in: [...parentIds] }, workspaceId, deletedAt: null },
    });
    if (count !== new Set(parentIds).size) {
      throw invalidWorkspaceRelation();
    }
  }

  async create(
    auth: AuthenticatedUser,
    dto: CreateStudentDto,
  ): Promise<StudentResponse> {
    const { parentIds: rawParentIds = [], ...scalarDto } = dto;
    const parentIds = [...new Set(rawParentIds)];
    const student = await this.prisma.$transaction(async (tx) => {
      await this.assertParentsBelongToWorkspace(
        tx,
        auth.workspaceId,
        parentIds,
      );
      const created = await tx.student.create({
        data: {
          workspaceId: auth.workspaceId,
          ...scalarDto,
          parents: { create: parentIds.map((parentId) => ({ parentId })) },
        },
        include: parentLinksInclude,
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'CREATE',
        entity: 'STUDENT',
        entityId: created.id,
        changes: this.audit.buildChanges(
          {},
          { ...scalarDto, parentIds: sortedIds(parentIds) },
        ),
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
        ...parentLinksInclude,
        workspace: { select: { cancellationDeadlineHours: true } },
        enrollments: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          include: {
            group: { select: { id: true, name: true } },
            teacher: { select: { id: true, fullName: true, color: true } },
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
          name: enrollment.teacher.fullName,
          color: enrollment.teacher.color,
        },
      })),
    };
  }

  async update(
    auth: AuthenticatedUser,
    studentId: string,
    dto: UpdateStudentDto,
  ): Promise<StudentResponse> {
    const { parentIds: rawParentIds, ...scalarDto } = dto;
    const parentIds =
      rawParentIds !== undefined ? [...new Set(rawParentIds)] : undefined;
    const student = await this.prisma.$transaction(async (tx) => {
      const before = await tx.student.findFirst({
        where: {
          id: studentId,
          workspaceId: auth.workspaceId,
          deletedAt: null,
        },
        include: parentLinksInclude,
      });
      if (!before) {
        throw studentNotFound();
      }
      const beforeParentIds = toParentRefs(before).map((parent) => parent.id);

      const changes = this.audit.buildChanges(
        { ...before, parentIds: sortedIds(beforeParentIds) },
        {
          ...scalarDto,
          ...(parentIds !== undefined
            ? { parentIds: sortedIds(parentIds) }
            : {}),
        },
      );
      if (!changes) {
        // No-op PATCH: nothing to persist, no audit row.
        return before;
      }

      if (parentIds !== undefined) {
        await this.assertParentsBelongToWorkspace(
          tx,
          auth.workspaceId,
          parentIds,
        );
        const nextIds = new Set(parentIds);
        const currentIds = new Set(beforeParentIds);
        const toRemove = beforeParentIds.filter((id) => !nextIds.has(id));
        const toAdd = parentIds.filter((id) => !currentIds.has(id));
        if (toRemove.length > 0) {
          await tx.studentParent.deleteMany({
            where: { studentId: before.id, parentId: { in: toRemove } },
          });
        }
        if (toAdd.length > 0) {
          await tx.studentParent.createMany({
            data: toAdd.map((parentId) => ({
              studentId: before.id,
              parentId,
            })),
          });
        }
      }

      const updated = await tx.student.update({
        where: { id: before.id },
        data: scalarDto,
        include: parentLinksInclude,
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

  /**
   * Permanently delete a student and every link to it: parent links and
   * enrollments go first (no FK cascade in the schema), then the record. There
   * is no trash — the removal is irreversible.
   */
  async remove(auth: AuthenticatedUser, studentId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId, workspaceId: auth.workspaceId },
      });
      if (!student) {
        throw studentNotFound();
      }

      await tx.studentParent.deleteMany({ where: { studentId: student.id } });
      await tx.enrollment.deleteMany({
        where: { studentId: student.id, workspaceId: auth.workspaceId },
      });
      await tx.student.delete({ where: { id: student.id } });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'DELETE',
        entity: 'STUDENT',
        entityId: student.id,
      });
    });
  }
}
