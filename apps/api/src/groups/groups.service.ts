import { Injectable } from '@nestjs/common';
import type { Group, Prisma } from '@prisma/client';
import type {
  CreateGroupDto,
  GroupDetail,
  GroupListResponse,
  GroupResponse,
  GroupStudentsDto,
  ListGroupsQueryDto,
  UpdateGroupDto,
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import { forbidden } from '../auth/auth.errors';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
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

function toResponse(row: Group): GroupResponse {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    pricePerLesson: row.pricePerLesson,
    currency: row.currency as GroupResponse['currency'],
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

type GroupListItem = GroupListResponse['items'][number];

function firstScheduleKey(group: GroupListItem): string | null {
  const first = group.schedules[0];
  if (!first) {
    return null;
  }
  return `${first.localTime}:${first.weekdays.join(',')}:${first.timezone}`;
}

function compareNullable<T>(
  left: T | null,
  right: T | null,
  compare: (a: T, b: T) => number,
): number {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return compare(left, right);
}

function compareGroupRows(
  left: GroupListItem,
  right: GroupListItem,
  query: ListGroupsQueryDto,
): number {
  const direction = query.order === 'desc' ? -1 : 1;
  const byField =
    query.sort === 'activeStudentCount'
      ? left.activeStudentCount - right.activeStudentCount
      : query.sort === 'pricePerLesson'
        ? compareNullable(
            left.pricePerLesson,
            right.pricePerLesson,
            (a, b) => (a - b) * direction,
          )
        : query.sort === 'schedule'
          ? compareNullable(
              firstScheduleKey(left),
              firstScheduleKey(right),
              (a, b) => a.localeCompare(b) * direction,
            )
          : left.name.localeCompare(right.name);
  if (byField !== 0) {
    return query.sort === 'pricePerLesson' || query.sort === 'schedule'
      ? byField
      : byField * direction;
  }
  return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
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

    // "Live" membership — the same definition the roster and the status use.
    const liveEnrollment: Prisma.EnrollmentWhereInput = {
      deletedAt: null,
      status: { in: ['ACTIVE', 'PAUSED'] },
    };

    const where: Prisma.GroupWhereInput = {
      workspaceId: auth.workspaceId,
      ...deletedAtFilter(query.state),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
      ...(query.studentId
        ? {
            enrollments: {
              some: { ...liveEnrollment, studentId: query.studentId },
            },
          }
        : {}),
      ...(query.status === 'ACTIVE'
        ? { enrollments: { some: liveEnrollment } }
        : {}),
      ...(query.status === 'EMPTY'
        ? { enrollments: { none: liveEnrollment } }
        : {}),
    };

    const rows = await this.prisma.group.findMany({
      where,
      include: {
        enrollments: {
          where: liveEnrollment,
          select: {
            student: { select: { id: true, fullName: true, avatarKey: true } },
          },
          orderBy: { student: { fullName: 'asc' } },
        },
        lessonSeries: {
          where: { deletedAt: null },
          select: {
            weekdays: true,
            localTime: true,
            durationMin: true,
            timezone: true,
          },
          orderBy: [{ localTime: 'asc' }, { id: 'asc' }],
        },
      },
    });

    const items = rows.map((row) => {
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
        pricePerLesson: row.pricePerLesson,
        currency:
          row.currency as GroupListResponse['items'][number]['currency'],
        notes: row.notes,
        deletedAt: row.deletedAt?.toISOString() ?? null,
        // Derived, never stored: roster state and record deletion are
        // independent so the UI never mistakes the trash for a group status.
        status: students.length > 0 ? ('ACTIVE' as const) : ('EMPTY' as const),
        activeStudentCount: students.length,
        students: students.map((student) => ({
          ...student,
          avatarKey:
            student.avatarKey as GroupListResponse['items'][number]['students'][number]['avatarKey'],
        })),
        schedules: row.lessonSeries,
      };
    });

    const sorted = [...items].sort((a, b) => compareGroupRows(a, b, query));
    const { skip, take } = toSkipTake(query);

    return buildPaginatedResponse(
      sorted.slice(skip, skip + take),
      sorted.length,
      query,
    );
  }

  /**
   * Brings the group's live enrollments in line with `dto.studentIds`:
   * archives the ones that were dropped, enrolls the ones that were added and
   * leaves the rest untouched. Runs inside the caller's transaction so that a
   * roster edit is atomic — the client never has to issue one request per
   * student and can never leave a half-built group behind.
   */
  private async reconcileStudents(
    tx: Prisma.TransactionClient,
    auth: AuthenticatedUser,
    group: Pick<Group, 'id' | 'pricePerLesson' | 'currency'>,
    dto: GroupStudentsDto,
  ): Promise<void> {
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

    const wantedIds = [...new Set(dto.studentIds)];
    const students = await tx.student.findMany({
      where: {
        id: { in: wantedIds },
        workspaceId: auth.workspaceId,
        deletedAt: null,
      },
      select: { id: true, hourlyRateMinor: true, currency: true },
    });
    // Cross-workspace and missing ids get the same 404 as a truly missing one.
    if (students.length !== wantedIds.length) {
      throw studentNotFound();
    }

    const live = await tx.enrollment.findMany({
      where: {
        groupId: group.id,
        workspaceId: auth.workspaceId,
        deletedAt: null,
      },
      select: { id: true, studentId: true },
    });
    const wanted = new Set(wantedIds);
    const alreadyEnrolled = new Set(live.map((row) => row.studentId));

    const removedAt = new Date();
    for (const enrollment of live) {
      if (wanted.has(enrollment.studentId)) {
        continue;
      }
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { deletedAt: removedAt },
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'DELETE',
        entity: 'ENROLLMENT',
        entityId: enrollment.id,
      });
    }

    const newcomers = students.filter(
      (student) => !alreadyEnrolled.has(student.id),
    );
    if (newcomers.length === 0) {
      return;
    }

    const workspace = await tx.workspace.findUniqueOrThrow({
      where: { id: auth.workspaceId },
      select: { defaultCurrency: true },
    });

    for (const student of newcomers) {
      // The group price wins; a group without one falls back to the student's
      // own rate, and only then to "free". Currency follows whichever price
      // was used, never the other record's.
      const usesGroupPrice = group.pricePerLesson !== null;
      const priceMinor = usesGroupPrice
        ? group.pricePerLesson
        : (student.hourlyRateMinor ?? 0);
      const currency =
        (usesGroupPrice ? group.currency : student.currency) ??
        workspace.defaultCurrency;

      const data = {
        workspaceId: auth.workspaceId,
        studentId: student.id,
        groupId: group.id,
        teacherId: dto.teacherId,
        billingType: 'PACKAGE' as const,
        priceMinor: priceMinor ?? 0,
        currency,
      };
      const created = await tx.enrollment.create({ data });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'CREATE',
        entity: 'ENROLLMENT',
        entityId: created.id,
        changes: this.audit.buildChanges({}, { ...data }),
      });
    }
  }

  async create(
    auth: AuthenticatedUser,
    dto: CreateGroupDto,
  ): Promise<GroupResponse> {
    const { students, ...groupFields } = dto;
    const group = await this.prisma.$transaction(async (tx) => {
      const created = await tx.group.create({
        data: { workspaceId: auth.workspaceId, ...groupFields },
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'CREATE',
        entity: 'GROUP',
        entityId: created.id,
        changes: this.audit.buildChanges({}, { ...groupFields }),
      });
      if (students) {
        await this.reconcileStudents(tx, auth, created, students);
      }
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
            student: { select: { id: true, fullName: true, avatarKey: true } },
            teacher: { select: { id: true, fullName: true, color: true } },
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
        studentId: enrollment.studentId,
        groupId: enrollment.groupId!,
        teacherId: enrollment.teacherId,
        status: enrollment.status,
        billingType: enrollment.billingType,
        priceMinor: enrollment.priceMinor,
        currency:
          enrollment.currency as GroupDetail['enrollments'][number]['currency'],
        cancellationDeadlineHours: enrollment.cancellationDeadlineHours,
        student: {
          id: enrollment.student.id,
          fullName: enrollment.student.fullName,
          avatarKey: enrollment.student
            .avatarKey as GroupDetail['enrollments'][number]['student']['avatarKey'],
        },
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
    groupId: string,
    dto: UpdateGroupDto,
  ): Promise<GroupResponse> {
    const { students, ...scalarDto } = dto;
    const group = await this.prisma.$transaction(async (tx) => {
      const before = await tx.group.findFirst({
        where: { id: groupId, workspaceId: auth.workspaceId, deletedAt: null },
      });
      if (!before) {
        throw groupNotFound();
      }

      const changes = this.audit.buildChanges(before, { ...scalarDto });
      // No-op PATCH: nothing to persist, no audit row — but a roster payload
      // is still reconciled below, since it audits its own enrollment rows.
      let updated = before;
      if (changes) {
        updated = await tx.group.update({
          where: { id: before.id },
          data: scalarDto,
        });
        await this.audit.record(tx, {
          workspaceId: auth.workspaceId,
          actorId: auth.userId,
          action: 'UPDATE',
          entity: 'GROUP',
          entityId: before.id,
          changes,
        });
      }

      if (students) {
        // Against `updated`, so a price changed in the same request applies to
        // the students it enrols.
        await this.reconcileStudents(tx, auth, updated, students);
      }
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

      const deletedAt = new Date();
      const groupWhere = {
        workspaceId: auth.workspaceId,
        groupId: group.id,
        deletedAt: null,
      };

      // Payments must be hidden before enrollment.groupId is cleared below.
      // Ledger entries and audit history are append-only evidence, while the
      // package/enrollment tombstones make them unreachable in the product UI.
      await tx.payment.updateMany({
        where: {
          workspaceId: auth.workspaceId,
          deletedAt: null,
          OR: [
            { package: { is: { groupId: group.id } } },
            { enrollment: { is: { groupId: group.id } } },
          ],
        },
        data: { deletedAt },
      });

      await tx.lesson.updateMany({ where: groupWhere, data: { deletedAt } });
      await tx.lessonSeries.updateMany({
        where: groupWhere,
        data: { deletedAt },
      });
      await tx.lessonPackage.updateMany({
        where: groupWhere,
        data: { deletedAt },
      });

      // An enrollment is the student-to-group link. Keeping the student while
      // tombstoning this record and clearing groupId leaves no live membership.
      await tx.enrollment.updateMany({
        where: groupWhere,
        data: { deletedAt, groupId: null },
      });

      await tx.group.update({
        where: { id: group.id },
        data: { deletedAt },
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
