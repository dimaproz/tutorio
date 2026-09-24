import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  CreateStudentDto,
  ListStudentsQueryDto,
  StudentDetail,
  StudentListResponse,
  StudentResponse,
  StudentsSummary,
  UpdateStudentDto,
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import { forbidden } from '../auth/auth.errors';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  invalidWorkspaceRelation,
  studentArchivedRequiresRestore,
  studentHasBusinessHistory,
  studentNotFound,
} from '../common/business.errors';
import { buildPaginatedResponse, toSkipTake } from '../common/pagination';
import {
  enrollmentInclude,
  toEnrollmentResponse,
} from '../enrollments/enrollment-response';
import { PausesService } from '../pauses/pauses.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertLessonsAreFree,
  lockGroupSchedules,
  lockStudentLifecycles,
  lockTeacherSchedules,
  reconcileGroupSchedule,
} from '../scheduling/lifecycle-suspension';

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

function toParentRefs(
  student: StudentWithParentLinks,
): StudentResponse['parents'] {
  return student.parents.map((link) => ({
    id: link.parent.id,
    fullName: link.parent.fullName,
    avatarKey: link.parent
      .avatarKey as StudentResponse['parents'][number]['avatarKey'],
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

/** `id` is the tiebreaker, so paging never repeats or drops a row. */
function buildStudentOrderBy(
  query: ListStudentsQueryDto,
): Prisma.StudentOrderByWithRelationInput[] {
  const { sort, order } = query;
  return [{ [sort]: order }, { id: 'asc' }];
}

// A live membership: an ACTIVE or PAUSED enrollment in a group that is not
// archived. This is the roster definition the list filter and group names use.
const LIVE_ENROLLMENT_STATUSES = ['ACTIVE', 'PAUSED'] as const;
const liveGroupMembershipWhere = {
  deletedAt: null,
  status: { in: [...LIVE_ENROLLMENT_STATUSES] },
  group: { deletedAt: null },
} satisfies Prisma.EnrollmentWhereInput;

/** For students, `state` selects by status: archived students keep deletedAt null. */
function studentStateStatusFilter(
  state: ListStudentsQueryDto['state'],
): Prisma.StudentWhereInput {
  switch (state) {
    case 'active':
      return { status: { not: 'ARCHIVED' } };
    case 'deleted':
      return { status: 'ARCHIVED' };
    case 'all':
      return {};
  }
}

function uniqueSorted(ids: readonly (string | null)[]): string[] {
  return [
    ...new Set(ids.filter((id): id is string => typeof id === 'string')),
  ].sort();
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
    private readonly pauses: PausesService,
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
      // Archiving sets status ARCHIVED and never deletedAt, so `state` selects
      // by status for students; an explicit status filter wins.
      deletedAt: null,
      ...(query.status
        ? { status: query.status }
        : studentStateStatusFilter(query.state)),
      ...search,
      ...(query.groupId
        ? {
            enrollments: {
              some: { ...liveGroupMembershipWhere, groupId: query.groupId },
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        orderBy: buildStudentOrderBy(query),
        ...toSkipTake(query),
        include: {
          enrollments: {
            where: {
              deletedAt: null,
              status: { in: [...LIVE_ENROLLMENT_STATUSES] },
              OR: [{ groupId: null }, { group: { deletedAt: null } }],
            },
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
        status: row.status,
        hourlyRateMinor: row.hourlyRateMinor,
        currency:
          row.currency as StudentListResponse['items'][number]['currency'],
        avatarKey:
          row.avatarKey as StudentListResponse['items'][number]['avatarKey'],
        createdAt: row.createdAt.toISOString(),
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

  /** Tab and header counts for the collection from one grouped query. */
  async summary(auth: AuthenticatedUser): Promise<StudentsSummary> {
    const rows = await this.prisma.student.groupBy({
      by: ['status'],
      where: { workspaceId: auth.workspaceId, deletedAt: null },
      _count: { _all: true },
    });
    const counts = { ACTIVE: 0, ON_HOLD: 0, ARCHIVED: 0 };
    for (const row of rows) {
      counts[row.status] = row._count._all;
    }
    return { all: counts.ACTIVE + counts.ON_HOLD, ...counts };
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
          include: enrollmentInclude,
        },
      },
    });
    if (!student) {
      throw studentNotFound();
    }

    return {
      ...toResponse(student),
      enrollments: student.enrollments.map((enrollment) =>
        toEnrollmentResponse(
          enrollment,
          student.workspace.cancellationDeadlineHours,
        ),
      ),
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
      await lockStudentLifecycles(tx, auth.workspaceId, [studentId]);
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
      if (before.status === 'ARCHIVED') {
        throw studentArchivedRequiresRestore();
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

      // "On hold" is a whole-student pause from now until the student is set
      // active again (L-104): it takes their lessons out and freezes their
      // packages, not just the label.
      if (scalarDto.status === 'ON_HOLD' && before.status !== 'ON_HOLD') {
        await this.pauses.createInTx(tx, auth, { studentId: before.id });
      }
      if (scalarDto.status === 'ACTIVE' && before.status === 'ON_HOLD') {
        const pauseId = await this.pauses.activeWholePause(tx, before.id);
        if (pauseId) await this.pauses.endInTx(tx, auth, pauseId, false);
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

  /** Archive a student and pause only their explicitly-owned future work. */
  async archive(auth: AuthenticatedUser, studentId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockStudentLifecycles(tx, auth.workspaceId, [studentId]);
      const student = await tx.student.findFirst({
        where: {
          id: studentId,
          workspaceId: auth.workspaceId,
          deletedAt: null,
        },
        select: { id: true, status: true },
      });
      if (!student) {
        throw studentNotFound();
      }
      if (student.status === 'ARCHIVED') {
        return;
      }

      // A student archive can change both individual target eligibility and a
      // group's active roster. Acquire the same group-then-teacher locks used
      // by materialization before changing either condition. The student lock
      // keeps this membership read stable: every enrollment writer takes it.
      const memberships = await tx.enrollment.findMany({
        where: {
          workspaceId: auth.workspaceId,
          studentId: student.id,
          groupId: { not: null },
          deletedAt: null,
        },
        select: { groupId: true, status: true, studentArchivedAt: true },
      });
      const groupIds = uniqueSorted(
        memberships.map((membership) => membership.groupId),
      );
      // Groups whose roster this archive changes: the memberships it marks.
      const affectedGroupIds = uniqueSorted(
        memberships
          .filter(
            (membership) =>
              (membership.status === 'ACTIVE' ||
                membership.status === 'PAUSED') &&
              membership.studentArchivedAt === null,
          )
          .map((membership) => membership.groupId),
      );
      await lockGroupSchedules(tx, auth.workspaceId, groupIds);
      const scheduledSeries = await tx.lessonSeries.findMany({
        where: {
          workspaceId: auth.workspaceId,
          deletedAt: null,
          OR: [
            { groupId: null, enrollment: { studentId: student.id } },
            ...(groupIds.length ? [{ groupId: { in: groupIds } }] : []),
          ],
        },
        select: { teacherId: true },
      });
      await lockTeacherSchedules(
        tx,
        auth.workspaceId,
        scheduledSeries.map((series) => series.teacherId),
      );

      const archivedAt = new Date();
      const archivedSeries = await tx.lessonSeries.updateMany({
        where: {
          workspaceId: auth.workspaceId,
          groupId: null,
          deletedAt: null,
          enrollment: { studentId: student.id },
        },
        data: { deletedAt: archivedAt, scheduleSuspensionToken: null },
      });
      const archivedLessons = await tx.lesson.updateMany({
        where: {
          workspaceId: auth.workspaceId,
          groupId: null,
          status: 'SCHEDULED',
          deletedAt: null,
          startsAtUtc: { gte: archivedAt },
          enrollment: { studentId: student.id },
        },
        data: { deletedAt: archivedAt, scheduleSuspensionToken: null },
      });
      const archivedActiveGroupEnrollments = await tx.enrollment.updateMany({
        where: {
          workspaceId: auth.workspaceId,
          studentId: student.id,
          groupId: { not: null },
          deletedAt: null,
          status: 'ACTIVE',
          studentArchivedAt: null,
        },
        data: {
          status: 'ARCHIVED',
          studentArchivedAt: archivedAt,
          statusBeforeStudentArchive: 'ACTIVE',
        },
      });
      const archivedPausedGroupEnrollments = await tx.enrollment.updateMany({
        where: {
          workspaceId: auth.workspaceId,
          studentId: student.id,
          groupId: { not: null },
          deletedAt: null,
          status: 'PAUSED',
          studentArchivedAt: null,
        },
        data: {
          status: 'ARCHIVED',
          studentArchivedAt: archivedAt,
          statusBeforeStudentArchive: 'PAUSED',
        },
      });

      await tx.student.update({
        where: { id: student.id },
        data: { status: 'ARCHIVED', archivedAt },
      });
      for (const groupId of affectedGroupIds) {
        await reconcileGroupSchedule(tx, auth.workspaceId, groupId, archivedAt);
      }
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'DELETE',
        entity: 'STUDENT',
        entityId: student.id,
        changes: this.audit.buildChanges(
          {},
          {
            archivedSeries: archivedSeries.count,
            archivedFutureScheduledLessons: archivedLessons.count,
            archivedGroupEnrollments:
              archivedActiveGroupEnrollments.count +
              archivedPausedGroupEnrollments.count,
          },
        ),
      });
    });
  }

  async restore(
    auth: AuthenticatedUser,
    studentId: string,
  ): Promise<StudentResponse> {
    const student = await this.prisma.$transaction(async (tx) => {
      await lockStudentLifecycles(tx, auth.workspaceId, [studentId]);
      const existing = await tx.student.findFirst({
        where: {
          id: studentId,
          workspaceId: auth.workspaceId,
          deletedAt: null,
        },
        include: parentLinksInclude,
      });
      if (!existing) {
        throw studentNotFound();
      }
      if (existing.status !== 'ARCHIVED' || !existing.archivedAt) {
        return existing;
      }
      const archivedAt = existing.archivedAt;
      // One clock for the whole restore: the lessons checked are exactly the
      // lessons revived, and group reconciliation sees the same instant.
      const now = new Date();

      // Only memberships marked by this archive come back, each to the
      // status it had before it.
      const suspendedGroupRows = await tx.enrollment.findMany({
        where: {
          workspaceId: auth.workspaceId,
          studentId: existing.id,
          groupId: { not: null },
          deletedAt: null,
          status: 'ARCHIVED',
          studentArchivedAt: archivedAt,
          statusBeforeStudentArchive: { in: ['ACTIVE', 'PAUSED'] },
        },
        select: { id: true, groupId: true, statusBeforeStudentArchive: true },
      });
      const groupIds = uniqueSorted(
        suspendedGroupRows.map((row) => row.groupId),
      );
      await lockGroupSchedules(tx, auth.workspaceId, groupIds);

      const suspendedLessons = await tx.lesson.findMany({
        where: {
          workspaceId: auth.workspaceId,
          groupId: null,
          status: 'SCHEDULED',
          deletedAt: archivedAt,
          startsAtUtc: { gte: now },
          enrollment: { studentId: existing.id },
        },
        select: {
          id: true,
          teacherId: true,
          startsAtUtc: true,
          durationMin: true,
        },
      });
      // The group reconciliation below may revive lessons an empty roster
      // suspended; take their teachers' locks now, in the same sorted call,
      // so a restore touching several groups never locks teachers out of
      // order against a concurrent teacher change.
      const groupLessonTeachers = groupIds.length
        ? await tx.lesson.findMany({
            where: {
              workspaceId: auth.workspaceId,
              groupId: { in: groupIds },
              status: 'SCHEDULED',
              scheduleSuspensionToken: { not: null },
              startsAtUtc: { gte: now },
            },
            select: { teacherId: true },
            distinct: ['teacherId'],
          })
        : [];
      await lockTeacherSchedules(tx, auth.workspaceId, [
        ...suspendedLessons.map((lesson) => lesson.teacherId),
        ...groupLessonTeachers.map((lesson) => lesson.teacherId),
      ]);
      await assertLessonsAreFree(tx, auth.workspaceId, suspendedLessons);

      await tx.lessonSeries.updateMany({
        where: {
          workspaceId: auth.workspaceId,
          groupId: null,
          deletedAt: archivedAt,
          enrollment: { studentId: existing.id },
        },
        data: { deletedAt: null },
      });
      if (suspendedLessons.length) {
        await tx.lesson.updateMany({
          where: { id: { in: suspendedLessons.map((lesson) => lesson.id) } },
          data: { deletedAt: null },
        });
      }
      for (const previous of ['ACTIVE', 'PAUSED'] as const) {
        const ids = suspendedGroupRows
          .filter((row) => row.statusBeforeStudentArchive === previous)
          .map((row) => row.id);
        if (ids.length) {
          await tx.enrollment.updateMany({
            where: { id: { in: ids } },
            data: {
              status: previous,
              studentArchivedAt: null,
              statusBeforeStudentArchive: null,
            },
          });
        }
      }
      await tx.student.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE', archivedAt: null },
      });
      for (const groupId of groupIds) {
        await reconcileGroupSchedule(tx, auth.workspaceId, groupId, now);
      }
      // Back on hold if a whole-student pause is still running.
      await this.pauses.syncStudentStatus(tx, existing.id, now);
      const restored = await tx.student.findUniqueOrThrow({
        where: { id: existing.id },
        include: parentLinksInclude,
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'RESTORE',
        entity: 'STUDENT',
        entityId: existing.id,
        changes: this.audit.buildChanges(
          {},
          {
            restoredFutureScheduledLessons: suspendedLessons.length,
            restoredGroupEnrollments: suspendedGroupRows.length,
          },
        ),
      });
      return restored;
    });
    return toResponse(student);
  }

  /** Hard deletion is limited to an unused draft and never cascades history. */
  async remove(auth: AuthenticatedUser, studentId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Enrollment creation takes the same lock, so a concurrent enrollment
      // either commits first (and is counted below) or waits and then finds
      // no student — never a foreign-key failure on delete.
      await lockStudentLifecycles(tx, auth.workspaceId, [studentId]);
      const student = await tx.student.findFirst({
        where: { id: studentId, workspaceId: auth.workspaceId },
        select: { id: true },
      });
      if (!student) {
        throw studentNotFound();
      }

      const [enrollments, lessons, packages, payments, charges, credits] =
        await Promise.all([
          tx.enrollment.count({ where: { studentId: student.id } }),
          tx.lesson.count({ where: { enrollment: { studentId: student.id } } }),
          tx.lessonPackage.count({ where: { studentId: student.id } }),
          tx.payment.count({
            where: {
              OR: [
                { enrollment: { studentId: student.id } },
                { package: { is: { studentId: student.id } } },
              ],
            },
          }),
          tx.lessonCharge.count({
            where: { enrollment: { studentId: student.id } },
          }),
          tx.lessonCreditEntry.count({
            where: { package: { studentId: student.id } },
          }),
        ]);
      const dependencies = {
        enrollments,
        lessons,
        packages,
        payments,
        charges,
        credits,
      };
      if (Object.values(dependencies).some((count) => count > 0)) {
        throw studentHasBusinessHistory(dependencies);
      }

      await tx.studentParent.deleteMany({ where: { studentId: student.id } });
      // Without directions or packages a pause took nothing out and pushed
      // nothing: it goes with the student.
      await tx.pause.deleteMany({ where: { studentId: student.id } });
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
