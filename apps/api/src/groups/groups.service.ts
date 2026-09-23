import { Injectable } from '@nestjs/common';
import {
  findConflicts,
  toInterval,
  zonedDayRange,
  zonedWeekRange,
} from '@tutorio/domain';
import type { Group, Prisma } from '@prisma/client';
import type {
  CreateGroupDto,
  GroupDetail,
  GroupListItem,
  GroupListResponse,
  GroupOptionsResponse,
  GroupResponse,
  GroupScheduleInputDto,
  GroupStudentsDto,
  GroupSummaryResponse,
  ListGroupsQueryDto,
  UpdateGroupDto,
} from '@tutorio/validation';
import { AuditService, type AuditEntry } from '../audit/audit.service';
import { forbidden } from '../auth/auth.errors';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  groupLegacyRepairRequired,
  groupNotFound,
  groupScheduleExists,
  groupTeacherRequired,
  scheduleConflict,
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
  lockGroupSchedule,
  lockStudentLifecycles,
  lockTeacherSchedules,
  reconcileGroupSchedule,
} from '../scheduling/lifecycle-suspension';
import { MaterializerService } from '../scheduling/materializer.service';
import {
  compareNullable,
  firstScheduleKey,
  liveEnrollmentWhere,
  resolveGroupTeacher,
  teacherRefSelect,
  toGroupResponse,
  toTeacherRef,
  unpaidPackageWhere,
} from './groups.shared';

// Longest allowed lesson: the lookback for "an earlier lesson that runs long".
const MAX_DURATION_MIN = 720;

const listInclude = {
  teacher: { select: teacherRefSelect },
  enrollments: {
    where: liveEnrollmentWhere,
    select: {
      teacher: { select: teacherRefSelect },
      student: { select: { id: true, fullName: true, avatarKey: true } },
    },
    orderBy: [{ student: { fullName: 'asc' } }, { id: 'asc' }],
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
} satisfies Prisma.GroupInclude;

type ListRow = Prisma.GroupGetPayload<{ include: typeof listInclude }>;

type LessonSlot = {
  id: string;
  startsAtUtc: Date;
  durationMin: number;
};

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly materializer: MaterializerService,
  ) {}

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  private listWhere(
    auth: AuthenticatedUser,
    query: ListGroupsQueryDto,
  ): Prisma.GroupWhereInput {
    // Each filter is its own AND clause: two filters on the same relation
    // must narrow together rather than overwrite each other.
    const and: Prisma.GroupWhereInput[] = [];
    if (query.studentId) {
      and.push({
        enrollments: {
          some: { ...liveEnrollmentWhere, studentId: query.studentId },
        },
      });
    }
    if (query.status === 'ACTIVE') {
      and.push({ enrollments: { some: liveEnrollmentWhere } });
    }
    if (query.status === 'EMPTY') {
      and.push({ enrollments: { none: liveEnrollmentWhere } });
    }
    if (query.teacherId) {
      and.push({ teacherId: query.teacherId });
    }
    if (query.weekday !== undefined) {
      and.push({
        lessonSeries: {
          some: { deletedAt: null, weekdays: { has: query.weekday } },
        },
      });
    }
    if (query.payment === 'unpaid') {
      and.push({ packages: { some: unpaidPackageWhere } });
    }
    return {
      workspaceId: auth.workspaceId,
      ...deletedAtFilter(query.state),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' as const } }
        : {}),
      ...(and.length > 0 ? { AND: and } : {}),
    };
  }

  /**
   * One page of ids and the total. Name, price and creation date sort in the
   * database; the two relation aggregates are sorted from a light projection
   * of the filtered groups, so the heavy roster read covers one page only.
   */
  private async pageIds(
    where: Prisma.GroupWhereInput,
    query: ListGroupsQueryDto,
  ): Promise<{ ids: string[]; total: number }> {
    const { skip, take } = toSkipTake(query);
    const order = query.order;

    if (query.sort === 'activeStudentCount' || query.sort === 'schedule') {
      const light = await this.prisma.group.findMany({
        where,
        select: {
          id: true,
          name: true,
          _count: { select: { enrollments: { where: liveEnrollmentWhere } } },
          lessonSeries: {
            where: { deletedAt: null },
            select: { weekdays: true, localTime: true, timezone: true },
            orderBy: [{ localTime: 'asc' }, { id: 'asc' }],
            take: 1,
          },
        },
      });
      const direction = order === 'desc' ? -1 : 1;
      const sorted = [...light].sort((left, right) => {
        const byField =
          query.sort === 'activeStudentCount'
            ? (left._count.enrollments - right._count.enrollments) * direction
            : compareNullable(
                firstScheduleKey({ schedules: left.lessonSeries }),
                firstScheduleKey({ schedules: right.lessonSeries }),
                (a, b) => a.localeCompare(b) * direction,
              );
        return (
          byField ||
          left.name.localeCompare(right.name) ||
          left.id.localeCompare(right.id)
        );
      });
      return {
        ids: sorted.slice(skip, skip + take).map((row) => row.id),
        total: sorted.length,
      };
    }

    const orderBy: Prisma.GroupOrderByWithRelationInput[] =
      query.sort === 'pricePerLesson'
        ? [
            { pricePerLesson: { sort: order, nulls: 'last' } },
            { name: 'asc' },
            { id: 'asc' },
          ]
        : query.sort === 'createdAt'
          ? [{ createdAt: order }, { id: order }]
          : [{ name: order }, { id: order }];
    const [rows, total] = await Promise.all([
      this.prisma.group.findMany({
        where,
        orderBy,
        skip,
        take,
        select: { id: true },
      }),
      this.prisma.group.count({ where }),
    ]);
    return { ids: rows.map((row) => row.id), total };
  }

  async list(
    auth: AuthenticatedUser,
    query: ListGroupsQueryDto,
  ): Promise<GroupListResponse> {
    if (query.state !== 'active' && auth.role !== 'OWNER') {
      throw forbidden();
    }

    const where = this.listWhere(auth, query);
    const { ids, total } = await this.pageIds(where, query);
    if (ids.length === 0) {
      return buildPaginatedResponse([], total, query);
    }

    const now = new Date();
    const [rows, nextLessons, unpaid] = await Promise.all([
      this.prisma.group.findMany({
        where: { id: { in: ids } },
        include: listInclude,
      }),
      this.prisma.lesson.findMany({
        where: {
          workspaceId: auth.workspaceId,
          groupId: { in: ids },
          deletedAt: null,
          status: 'SCHEDULED',
          startsAtUtc: { gte: now },
        },
        orderBy: [{ groupId: 'asc' }, { startsAtUtc: 'asc' }],
        distinct: ['groupId'],
        select: {
          id: true,
          groupId: true,
          startsAtUtc: true,
          durationMin: true,
        },
      }),
      this.prisma.lessonPackage.findMany({
        where: {
          workspaceId: auth.workspaceId,
          groupId: { in: ids },
          ...unpaidPackageWhere,
        },
        distinct: ['groupId'],
        select: { groupId: true },
      }),
    ]);

    const byId = new Map(rows.map((row) => [row.id, row]));
    const nextByGroup = new Map(
      nextLessons.map((lesson) => [lesson.groupId, lesson]),
    );
    const unpaidGroups = new Set(unpaid.map((row) => row.groupId));

    const items = ids
      .map((id) => byId.get(id))
      .filter((row): row is ListRow => Boolean(row))
      .map((row) =>
        this.toListItem(
          row,
          nextByGroup.get(row.id) ?? null,
          unpaidGroups.has(row.id),
        ),
      );
    return buildPaginatedResponse(items, total, query);
  }

  private toListItem(
    row: ListRow,
    next: LessonSlot | null,
    paymentDue: boolean,
  ): GroupListItem {
    // Dedupe: a student holds at most one live membership per group, but the
    // avatar stack stays defensive rather than assuming it.
    const students = [
      ...new Map(
        row.enrollments.map((enrollment) => [
          enrollment.student.id,
          enrollment.student,
        ]),
      ).values(),
    ];
    const teacher = resolveGroupTeacher(
      row.teacher,
      row.enrollments.map((enrollment) => enrollment.teacher),
    );
    return {
      id: row.id,
      name: row.name,
      teacher: teacher ? toTeacherRef(teacher) : null,
      capacity: row.capacity,
      pricePerLesson: row.pricePerLesson,
      currency: row.currency as GroupListItem['currency'],
      notes: row.notes,
      deletedAt: row.deletedAt?.toISOString() ?? null,
      // Derived, never stored: roster state and the archive are independent
      // so the UI never mistakes the archive for a group status.
      status: students.length > 0 ? 'ACTIVE' : 'EMPTY',
      activeStudentCount: students.length,
      students: students.map((student) => ({
        ...student,
        avatarKey:
          student.avatarKey as GroupListItem['students'][number]['avatarKey'],
      })),
      schedules: row.lessonSeries,
      nextLesson: next
        ? {
            id: next.id,
            startsAtUtc: next.startsAtUtc.toISOString(),
            durationMin: next.durationMin,
          }
        : null,
      paymentDue,
    };
  }

  /** Every live group by name: the options of a group filter or picker. */
  async options(auth: AuthenticatedUser): Promise<GroupOptionsResponse> {
    const items = await this.prisma.group.findMany({
      where: { workspaceId: auth.workspaceId, deletedAt: null },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true },
    });
    return { items };
  }

  /** The collection headline: tab counts and the four metrics, in one read. */
  async summary(auth: AuthenticatedUser): Promise<GroupSummaryResponse> {
    const workspaceId = auth.workspaceId;
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { timezone: true },
    });
    const now = new Date();
    const week = zonedWeekRange(now, workspace.timezone);
    const today = zonedDayRange(now, workspace.timezone);
    const liveGroup = { workspaceId, deletedAt: null };
    const groupLesson = {
      workspaceId,
      deletedAt: null,
      status: { in: ['SCHEDULED', 'COMPLETED'] },
      group: { is: { deletedAt: null } },
    } satisfies Prisma.LessonWhereInput;

    const [
      total,
      active,
      archived,
      studentsInGroups,
      studioStudents,
      capacities,
      lessonsThisWeek,
      lessonsToday,
      unpaidGroups,
    ] = await Promise.all([
      this.prisma.group.count({ where: liveGroup }),
      this.prisma.group.count({
        where: { ...liveGroup, enrollments: { some: liveEnrollmentWhere } },
      }),
      this.prisma.group.count({
        where: { workspaceId, deletedAt: { not: null } },
      }),
      this.prisma.student.count({
        where: {
          workspaceId,
          deletedAt: null,
          status: { not: 'ARCHIVED' },
          enrollments: {
            some: {
              ...liveEnrollmentWhere,
              group: { is: { deletedAt: null } },
            },
          },
        },
      }),
      this.prisma.student.count({
        where: { workspaceId, deletedAt: null, status: { not: 'ARCHIVED' } },
      }),
      this.prisma.group.findMany({
        where: { ...liveGroup, capacity: { not: null } },
        select: {
          capacity: true,
          _count: { select: { enrollments: { where: liveEnrollmentWhere } } },
        },
      }),
      this.prisma.lesson.count({
        where: {
          ...groupLesson,
          startsAtUtc: { gte: week.start, lt: week.end },
        },
      }),
      this.prisma.lesson.count({
        where: {
          ...groupLesson,
          startsAtUtc: { gte: today.start, lt: today.end },
        },
      }),
      this.prisma.group.count({
        where: { ...liveGroup, packages: { some: unpaidPackageWhere } },
      }),
    ]);

    return {
      total,
      active,
      empty: total - active,
      archived,
      studentsInGroups,
      studioStudents,
      freeSeats:
        capacities.length === 0
          ? null
          : capacities.reduce(
              (sum, row) =>
                sum + Math.max(0, (row.capacity ?? 0) - row._count.enrollments),
              0,
            ),
      lessonsThisWeek,
      lessonsToday,
      unpaidGroups,
      weekStart: week.start.toISOString(),
      weekEnd: week.end.toISOString(),
    };
  }

  /**
   * The group page. An archived group stays readable (its roster and history
   * are kept), which is what lets the owner open it and restore it.
   */
  async getDetail(
    auth: AuthenticatedUser,
    groupId: string,
  ): Promise<GroupDetail> {
    const now = new Date();
    const [group, nextLesson, completed, upcoming] = await Promise.all([
      this.prisma.group.findFirst({
        where: { id: groupId, workspaceId: auth.workspaceId },
        include: {
          teacher: { select: teacherRefSelect },
          enrollments: {
            where: liveEnrollmentWhere,
            orderBy: [{ student: { fullName: 'asc' } }, { id: 'asc' }],
            include: {
              student: {
                select: {
                  id: true,
                  fullName: true,
                  avatarKey: true,
                  status: true,
                  languageLevel: true,
                },
              },
              teacher: { select: teacherRefSelect },
            },
          },
          lessonSeries: {
            where: { deletedAt: null },
            select: {
              id: true,
              weekdays: true,
              localTime: true,
              durationMin: true,
              timezone: true,
            },
            orderBy: [{ localTime: 'asc' }, { id: 'asc' }],
          },
        },
      }),
      this.prisma.lesson.findFirst({
        where: {
          workspaceId: auth.workspaceId,
          groupId,
          deletedAt: null,
          status: 'SCHEDULED',
          startsAtUtc: { gte: now },
        },
        orderBy: { startsAtUtc: 'asc' },
        select: {
          id: true,
          startsAtUtc: true,
          durationMin: true,
          notes: true,
          status: true,
        },
      }),
      this.prisma.lesson.count({
        where: {
          workspaceId: auth.workspaceId,
          groupId,
          deletedAt: null,
          status: 'COMPLETED',
        },
      }),
      this.prisma.lesson.count({
        where: {
          workspaceId: auth.workspaceId,
          groupId,
          deletedAt: null,
          status: 'SCHEDULED',
          startsAtUtc: { gte: now },
        },
      }),
    ]);
    if (!group) {
      throw groupNotFound();
    }

    const teacher = resolveGroupTeacher(
      group.teacher,
      group.enrollments.map((enrollment) => enrollment.teacher),
    );
    type Enrollment = GroupDetail['enrollments'][number];
    return {
      ...toGroupResponse(group),
      status: group.enrollments.length > 0 ? 'ACTIVE' : 'EMPTY',
      teacher: teacher ? toTeacherRef(teacher) : null,
      teacherMismatch: teacher
        ? group.enrollments.some(
            (enrollment) => enrollment.teacherId !== teacher.id,
          )
        : false,
      enrollments: group.enrollments.map((enrollment) => ({
        id: enrollment.id,
        studentId: enrollment.studentId,
        groupId: enrollment.groupId!,
        teacherId: enrollment.teacherId,
        status: enrollment.status,
        billingType: enrollment.billingType,
        priceMinor: enrollment.priceMinor,
        currency: enrollment.currency as Enrollment['currency'],
        cancellationDeadlineHours: enrollment.cancellationDeadlineHours,
        student: {
          id: enrollment.student.id,
          fullName: enrollment.student.fullName,
          avatarKey: enrollment.student
            .avatarKey as Enrollment['student']['avatarKey'],
          status: enrollment.student.status,
          languageLevel: enrollment.student
            .languageLevel as Enrollment['student']['languageLevel'],
        },
        teacher: {
          id: enrollment.teacher.id,
          name: enrollment.teacher.fullName,
          color: enrollment.teacher.color,
        },
      })),
      schedules: group.lessonSeries,
      nextLesson: nextLesson
        ? {
            id: nextLesson.id,
            startsAtUtc: nextLesson.startsAtUtc.toISOString(),
            durationMin: nextLesson.durationMin,
            notes: nextLesson.notes,
            status: nextLesson.status,
          }
        : null,
      lessonCounts: { completed, upcoming },
    };
  }

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  private async assertTeacher(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    teacherId: string,
  ): Promise<void> {
    const teacher = await tx.teacher.findFirst({
      where: { id: teacherId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!teacher) {
      throw teacherNotFound();
    }
  }

  /**
   * The teacher a new group gets: the one named, else the roster's, else — a
   * solo tutor never picks a teacher — the workspace's only active teacher.
   */
  private async resolveCreateTeacher(
    tx: Prisma.TransactionClient,
    auth: AuthenticatedUser,
    dto: CreateGroupDto,
  ): Promise<string | null> {
    const named = dto.teacherId ?? dto.students?.teacherId;
    if (named) {
      await this.assertTeacher(tx, auth.workspaceId, named);
      return named;
    }
    const active = await tx.teacher.findMany({
      where: {
        workspaceId: auth.workspaceId,
        deletedAt: null,
        status: 'ACTIVE',
      },
      select: { id: true },
      take: 2,
    });
    return active.length === 1 ? active[0].id : null;
  }

  /**
   * Brings the group's live memberships in line with `dto.studentIds`:
   * removes the dropped ones, reactivates a membership that was archived by
   * hand, enrolls the rest and leaves everyone else untouched. A membership
   * suspended by a student archive is never touched here: that student's
   * restore brings it back exactly as it was. Runs inside the caller's
   * transaction, which has already locked the students and the group.
   */
  private async reconcileStudents(
    tx: Prisma.TransactionClient,
    auth: AuthenticatedUser,
    group: Pick<Group, 'id' | 'pricePerLesson' | 'currency' | 'teacherId'>,
    dto: GroupStudentsDto,
    now: Date,
  ): Promise<void> {
    const wantedIds = [...new Set(dto.studentIds)];
    const students = await tx.student.findMany({
      where: {
        id: { in: wantedIds },
        workspaceId: auth.workspaceId,
        deletedAt: null,
        status: { not: 'ARCHIVED' },
      },
      select: { id: true, hourlyRateMinor: true, currency: true },
    });
    // Cross-workspace and missing ids get the same 404 as a truly missing one.
    if (students.length !== wantedIds.length) {
      throw studentNotFound();
    }

    const memberships = await tx.enrollment.findMany({
      where: {
        groupId: group.id,
        workspaceId: auth.workspaceId,
        deletedAt: null,
        studentArchivedAt: null,
      },
      select: { id: true, studentId: true, status: true },
    });
    const live = memberships.filter((row) => row.status !== 'ARCHIVED');
    const archivedByHand = new Map(
      memberships
        .filter((row) => row.status === 'ARCHIVED')
        .map((row) => [row.studentId, row]),
    );
    const wanted = new Set(wantedIds);
    const liveStudents = new Set(live.map((row) => row.studentId));
    const entries: AuditEntry[] = [];
    const base = { workspaceId: auth.workspaceId, actorId: auth.userId };

    const removed = live.filter((row) => !wanted.has(row.studentId));
    if (removed.length > 0) {
      await tx.enrollment.updateMany({
        where: { id: { in: removed.map((row) => row.id) } },
        data: { deletedAt: now },
      });
      for (const row of removed) {
        entries.push({
          ...base,
          action: 'DELETE',
          entity: 'ENROLLMENT',
          entityId: row.id,
        });
      }
    }

    const newcomers = students.filter(
      (student) => !liveStudents.has(student.id),
    );
    const reactivated = newcomers
      .map((student) => archivedByHand.get(student.id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    if (reactivated.length > 0) {
      await tx.enrollment.updateMany({
        where: { id: { in: reactivated.map((row) => row.id) } },
        data: { status: 'ACTIVE' },
      });
      for (const row of reactivated) {
        entries.push({
          ...base,
          action: 'UPDATE',
          entity: 'ENROLLMENT',
          entityId: row.id,
          changes: this.audit.buildChanges(
            { status: 'ARCHIVED' },
            { status: 'ACTIVE' },
          ),
        });
      }
    }

    const toCreate = newcomers.filter(
      (student) => !archivedByHand.has(student.id),
    );
    if (toCreate.length > 0) {
      const teacherId = dto.teacherId ?? group.teacherId;
      if (!teacherId) {
        throw groupTeacherRequired();
      }
      if (dto.teacherId) {
        await this.assertTeacher(tx, auth.workspaceId, dto.teacherId);
      }
      const workspace = await tx.workspace.findUniqueOrThrow({
        where: { id: auth.workspaceId },
        select: { defaultCurrency: true },
      });
      const rows = toCreate.map((student) => {
        // The group price wins; a group without one falls back to the
        // student's own rate, and only then to "free". Currency follows
        // whichever price was used, never the other record's.
        const usesGroupPrice = group.pricePerLesson !== null;
        return {
          workspaceId: auth.workspaceId,
          studentId: student.id,
          groupId: group.id,
          teacherId,
          billingType: 'PACKAGE' as const,
          priceMinor:
            (usesGroupPrice ? group.pricePerLesson : student.hourlyRateMinor) ??
            0,
          currency:
            (usesGroupPrice ? group.currency : student.currency) ??
            workspace.defaultCurrency,
        };
      });
      const created = await tx.enrollment.createManyAndReturn({
        data: rows,
        select: { id: true, studentId: true },
      });
      const byStudent = new Map(rows.map((row) => [row.studentId, row]));
      for (const row of created) {
        entries.push({
          ...base,
          action: 'CREATE',
          entity: 'ENROLLMENT',
          entityId: row.id,
          changes: this.audit.buildChanges(
            {},
            { ...byStudent.get(row.studentId) },
          ),
        });
      }
    }

    await this.audit.recordMany(tx, entries);
  }

  /**
   * After the roster or the schedule changed: suspend or restore the group's
   * work for an empty or refilled roster, then generate whatever the live
   * schedule is missing — so the first student's lessons appear now, not at
   * the next nightly run.
   */
  private async syncGroupSchedule(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    groupId: string,
    now: Date,
  ): Promise<void> {
    await reconcileGroupSchedule(tx, workspaceId, groupId, now);
    const series = await tx.lessonSeries.findMany({
      where: { workspaceId, groupId, deletedAt: null },
    });
    const horizon = this.materializer.horizonUntil(now);
    for (const row of series) {
      await this.materializer.materializeSeries(tx, row, horizon, now);
    }
  }

  /** Creates the group's first recurring schedule. */
  private async createSchedule(
    tx: Prisma.TransactionClient,
    auth: AuthenticatedUser,
    group: Pick<Group, 'id' | 'pricePerLesson' | 'currency' | 'teacherId'>,
    schedule: GroupScheduleInputDto,
    now: Date,
  ): Promise<void> {
    if (!group.teacherId) {
      throw groupTeacherRequired();
    }
    // A schedule suspended by an empty roster still exists and comes back
    // with the first student; it is changed on the patterns screen too.
    const existing = await tx.lessonSeries.count({
      where: {
        workspaceId: auth.workspaceId,
        groupId: group.id,
        OR: [{ deletedAt: null }, { scheduleSuspensionToken: { not: null } }],
      },
    });
    if (existing > 0) {
      throw groupScheduleExists();
    }
    await lockTeacherSchedules(tx, auth.workspaceId, [group.teacherId]);
    const workspace = await tx.workspace.findUniqueOrThrow({
      where: { id: auth.workspaceId },
      select: { timezone: true, defaultCurrency: true },
    });
    const data = {
      workspaceId: auth.workspaceId,
      groupId: group.id,
      teacherId: group.teacherId,
      weekdays: schedule.weekdays,
      localTime: schedule.localTime,
      timezone: workspace.timezone,
      durationMin: schedule.durationMin,
      priceMinor: group.pricePerLesson ?? 0,
      currency: group.currency ?? workspace.defaultCurrency,
      startDate: now,
    };
    const created = await tx.lessonSeries.create({
      data: { ...data, horizonMaterializedUntil: now },
    });
    const slots = await this.materializer.materializeSeries(
      tx,
      created,
      this.materializer.horizonUntil(now),
      now,
    );
    if (slots.length === 0) {
      // Not generated yet (no active student): still refuse a double booking.
      await this.materializer.assertSeriesSlotsFree(tx, created, now);
    }
    await this.audit.record(tx, {
      workspaceId: auth.workspaceId,
      actorId: auth.userId,
      action: 'CREATE',
      entity: 'LESSON_SERIES',
      entityId: created.id,
      changes: this.audit.buildChanges({}, data),
    });
  }

  /**
   * Refuses when any of `lessons` would overlap work the teacher already has.
   * One read covers every candidate; `excludeIds` are the lessons being moved.
   */
  private async assertTeacherFree(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    teacherId: string,
    lessons: readonly LessonSlot[],
    excludeIds: readonly string[],
  ): Promise<void> {
    if (lessons.length === 0) return;
    const starts = lessons.map((lesson) => lesson.startsAtUtc.getTime());
    const ends = lessons.map(
      (lesson) => lesson.startsAtUtc.getTime() + lesson.durationMin * 60_000,
    );
    const busy = await tx.lesson.findMany({
      where: {
        workspaceId,
        teacherId,
        deletedAt: null,
        status: { in: ['SCHEDULED', 'COMPLETED'] },
        id: { notIn: [...excludeIds] },
        startsAtUtc: {
          gte: new Date(Math.min(...starts) - MAX_DURATION_MIN * 60_000),
          lt: new Date(Math.max(...ends)),
        },
      },
      select: { id: true, startsAtUtc: true, durationMin: true },
    });
    const intervals = busy.map((row) => ({
      ...toInterval(row.startsAtUtc, row.durationMin),
      id: row.id,
    }));
    const conflicts = new Set<string>();
    for (const lesson of lessons) {
      for (const hit of findConflicts(
        toInterval(lesson.startsAtUtc, lesson.durationMin),
        intervals,
      )) {
        conflicts.add(hit.id);
      }
    }
    if (conflicts.size > 0) {
      throw scheduleConflict([...conflicts]);
    }
  }

  /**
   * Hands the group to another teacher: its live memberships, its schedule
   * (live or suspended by an empty roster) and every upcoming scheduled lesson
   * move together, after a clash check against the new teacher's calendar.
   * Taught and cancelled lessons keep the teacher who had them.
   */
  private async reassignTeacher(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    groupId: string,
    teacherId: string,
    now: Date,
  ): Promise<{ enrollments: number; series: number; lessons: number }> {
    const suspendedOrLive: Prisma.LessonWhereInput = {
      OR: [{ deletedAt: null }, { scheduleSuspensionToken: { not: null } }],
    };
    const [lessons, series] = await Promise.all([
      tx.lesson.findMany({
        where: {
          workspaceId,
          groupId,
          status: 'SCHEDULED',
          startsAtUtc: { gte: now },
          ...suspendedOrLive,
        },
        select: {
          id: true,
          teacherId: true,
          startsAtUtc: true,
          durationMin: true,
          deletedAt: true,
        },
      }),
      tx.lessonSeries.findMany({
        where: {
          workspaceId,
          groupId,
          OR: [{ deletedAt: null }, { scheduleSuspensionToken: { not: null } }],
        },
        select: { id: true, teacherId: true },
      }),
    ]);
    await lockTeacherSchedules(tx, workspaceId, [
      teacherId,
      ...lessons.map((lesson) => lesson.teacherId),
      ...series.map((row) => row.teacherId),
    ]);
    const moving = lessons.filter((lesson) => lesson.teacherId !== teacherId);
    await this.assertTeacherFree(
      tx,
      workspaceId,
      teacherId,
      moving.filter((lesson) => lesson.deletedAt === null),
      lessons.map((lesson) => lesson.id),
    );

    const [enrollments, seriesMoved, lessonsMoved] = await Promise.all([
      tx.enrollment.updateMany({
        where: {
          workspaceId,
          groupId,
          ...liveEnrollmentWhere,
          teacherId: { not: teacherId },
        },
        data: { teacherId },
      }),
      tx.lessonSeries.updateMany({
        where: {
          id: { in: series.map((row) => row.id) },
          teacherId: { not: teacherId },
        },
        data: { teacherId },
      }),
      tx.lesson.updateMany({
        where: { id: { in: moving.map((lesson) => lesson.id) } },
        data: { teacherId },
      }),
    ]);
    return {
      enrollments: enrollments.count,
      series: seriesMoved.count,
      lessons: lessonsMoved.count,
    };
  }

  async create(
    auth: AuthenticatedUser,
    dto: CreateGroupDto,
  ): Promise<GroupResponse> {
    const { students, schedule, teacherId: _teacherId, ...fields } = dto;
    void _teacherId;
    const now = new Date();
    const group = await this.prisma.$transaction(async (tx) => {
      if (students?.studentIds.length) {
        await lockStudentLifecycles(tx, auth.workspaceId, students.studentIds);
      }
      const teacherId = await this.resolveCreateTeacher(tx, auth, dto);
      const data = { ...fields, teacherId };
      const created = await tx.group.create({
        data: { workspaceId: auth.workspaceId, ...data },
      });
      await lockGroupSchedule(tx, auth.workspaceId, created.id);
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'CREATE',
        entity: 'GROUP',
        entityId: created.id,
        changes: this.audit.buildChanges({}, data),
      });
      if (students && students.studentIds.length > 0) {
        await this.reconcileStudents(tx, auth, created, students, now);
        await this.syncGroupSchedule(tx, auth.workspaceId, created.id, now);
      }
      if (schedule) {
        await this.createSchedule(tx, auth, created, schedule, now);
      }
      return created;
    });
    return toGroupResponse(group);
  }

  async update(
    auth: AuthenticatedUser,
    groupId: string,
    dto: UpdateGroupDto,
  ): Promise<GroupResponse> {
    const { students, schedule, ...scalarDto } = dto;
    const now = new Date();
    const group = await this.prisma.$transaction(async (tx) => {
      if (students) {
        await lockStudentLifecycles(tx, auth.workspaceId, students.studentIds);
      }
      await lockGroupSchedule(tx, auth.workspaceId, groupId);
      const before = await tx.group.findFirst({
        where: { id: groupId, workspaceId: auth.workspaceId, deletedAt: null },
      });
      if (!before) {
        throw groupNotFound();
      }
      if (scalarDto.teacherId && scalarDto.teacherId !== before.teacherId) {
        await this.assertTeacher(tx, auth.workspaceId, scalarDto.teacherId);
      }

      const changes = this.audit.buildChanges(before, { ...scalarDto });
      // No-op PATCH: nothing to persist, no audit row — but a roster or a
      // schedule payload is still applied below, auditing its own rows.
      let updated = before;
      if (changes) {
        updated = await tx.group.update({
          where: { id: before.id },
          data: scalarDto,
        });
        if (scalarDto.teacherId && scalarDto.teacherId !== before.teacherId) {
          const moved = await this.reassignTeacher(
            tx,
            auth.workspaceId,
            before.id,
            scalarDto.teacherId,
            now,
          );
          changes.fields.reassignedEnrollments = {
            before: null,
            after: moved.enrollments,
          };
          changes.fields.reassignedSeries = {
            before: null,
            after: moved.series,
          };
          changes.fields.reassignedLessons = {
            before: null,
            after: moved.lessons,
          };
        }
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
        // Against `updated`, so a price or teacher changed in the same
        // request applies to the students it enrolls.
        await this.reconcileStudents(tx, auth, updated, students, now);
      }
      if (schedule) {
        await this.createSchedule(tx, auth, updated, schedule, now);
      }
      if (students || schedule) {
        await this.syncGroupSchedule(tx, auth.workspaceId, before.id, now);
      }
      return updated;
    });
    return toGroupResponse(group);
  }

  async softDelete(auth: AuthenticatedUser, groupId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockGroupSchedule(tx, auth.workspaceId, groupId);
      const group = await tx.group.findFirst({
        where: { id: groupId, workspaceId: auth.workspaceId },
      });
      if (!group) {
        throw groupNotFound();
      }
      if (group.deletedAt) {
        // Idempotent: archiving an already archived group is a no-op.
        return;
      }

      const scheduleTeachers = await tx.lessonSeries.findMany({
        where: {
          workspaceId: auth.workspaceId,
          groupId: group.id,
          deletedAt: null,
        },
        select: { teacherId: true },
      });
      await lockTeacherSchedules(
        tx,
        auth.workspaceId,
        scheduleTeachers.map((series) => series.teacherId),
      );

      const archivedAt = new Date();

      // A group archive is operational, not destructive: retain every roster,
      // lesson, package, payment, share, credit, and audit relationship. The
      // timestamp marks exactly the series and upcoming occurrences suspended
      // by this archive, so restore can revive only those records later.
      const [archivedSeries, archivedLessons] = await Promise.all([
        tx.lessonSeries.updateMany({
          where: {
            workspaceId: auth.workspaceId,
            groupId: group.id,
            deletedAt: null,
          },
          data: { deletedAt: archivedAt, scheduleSuspensionToken: null },
        }),
        tx.lesson.updateMany({
          where: {
            workspaceId: auth.workspaceId,
            groupId: group.id,
            status: 'SCHEDULED',
            deletedAt: null,
            startsAtUtc: { gte: archivedAt },
          },
          data: { deletedAt: archivedAt, scheduleSuspensionToken: null },
        }),
      ]);

      await tx.group.update({
        where: { id: group.id },
        data: { deletedAt: archivedAt },
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'DELETE',
        entity: 'GROUP',
        entityId: group.id,
        changes: this.audit.buildChanges(
          {},
          {
            archivedSeries: archivedSeries.count,
            archivedFutureScheduledLessons: archivedLessons.count,
          },
        ),
      });
    });
  }

  async restore(
    auth: AuthenticatedUser,
    groupId: string,
  ): Promise<GroupResponse> {
    const now = new Date();
    const group = await this.prisma.$transaction(async (tx) => {
      await lockGroupSchedule(tx, auth.workspaceId, groupId);
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

      // Before the archive-first implementation, group deletion tombstoned
      // dependent rows and cleared enrollment.groupId. The cleared links are
      // not always recoverable from the remaining data, so do not present this
      // as a safe restore. Operators must use the documented repair runbook.
      const deletionAudits = await tx.auditLog.findMany({
        where: {
          workspaceId: auth.workspaceId,
          entity: 'GROUP',
          entityId: existing.id,
          action: 'DELETE',
        },
        select: { diff: true },
      });
      if (deletionAudits.some((audit) => audit.diff === null)) {
        throw groupLegacyRepairRequired();
      }

      const archivedAt = existing.deletedAt;
      const suspendedLessons = await tx.lesson.findMany({
        where: {
          workspaceId: auth.workspaceId,
          groupId: existing.id,
          status: 'SCHEDULED',
          deletedAt: archivedAt,
          startsAtUtc: { gte: now },
        },
        select: {
          id: true,
          teacherId: true,
          startsAtUtc: true,
          durationMin: true,
        },
      });
      const teacherIds = [
        ...new Set(suspendedLessons.map((lesson) => lesson.teacherId)),
      ];
      await lockTeacherSchedules(tx, auth.workspaceId, teacherIds);

      // Do this before changing any state. A group can be restored only when
      // its explicitly suspended upcoming lessons still fit the calendar.
      for (const teacherId of teacherIds) {
        await this.assertTeacherFree(
          tx,
          auth.workspaceId,
          teacherId,
          suspendedLessons.filter((lesson) => lesson.teacherId === teacherId),
          suspendedLessons.map((lesson) => lesson.id),
        );
      }

      const restored = await tx.group.update({
        where: { id: existing.id },
        data: { deletedAt: null },
      });
      await Promise.all([
        tx.lessonSeries.updateMany({
          where: {
            workspaceId: auth.workspaceId,
            groupId: existing.id,
            deletedAt: archivedAt,
          },
          data: { deletedAt: null },
        }),
        tx.lesson.updateMany({
          where: {
            id: { in: suspendedLessons.map((lesson) => lesson.id) },
          },
          data: { deletedAt: null },
        }),
      ]);
      await reconcileGroupSchedule(tx, auth.workspaceId, existing.id, now);
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'RESTORE',
        entity: 'GROUP',
        entityId: existing.id,
        changes: this.audit.buildChanges(
          {},
          { restoredFutureScheduledLessons: suspendedLessons.length },
        ),
      });
      return restored;
    });
    return toGroupResponse(group);
  }
}
