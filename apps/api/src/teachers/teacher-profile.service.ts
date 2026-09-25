import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  addCalendarDays,
  studioMonthRange,
  studioWeekRange,
  weeklyMinutes,
  zonedDate,
  zonedDayStart,
} from '@tutorio/domain';
import type {
  TeacherStudent,
  TeacherStudentsQueryDto,
  TeacherStudentsResponse,
  TeacherSummary,
} from '@tutorio/validation';
import type { AuthenticatedUser } from '../auth/auth.types';
import { teacherNotFound } from '../common/business.errors';
import { buildPaginatedResponse } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { BUSY_STATUSES } from '../scheduling/scheduling.shared';
import { teacherMembershipWhere } from './teacher-stats';

/** «Навантаження» looks back this many studio weeks, this one included. */
const LOAD_WEEKS = 6;

/** The profile's reads: the metrics and the teacher's students. */
@Injectable()
export class TeacherProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(
    auth: AuthenticatedUser,
    teacherId: string,
  ): Promise<TeacherSummary> {
    const timeZone = await this.teacherTimeZone(auth, teacherId);
    const now = new Date();
    const week = studioWeekRange(now, timeZone);
    const loadFrom = zonedDayStart(
      addCalendarDays(week.monday, -7 * (LOAD_WEEKS - 1)),
      timeZone,
    );
    const month = studioMonthRange(now, timeZone);
    const lessonWhere = {
      workspaceId: auth.workspaceId,
      teacherId,
      deletedAt: null,
    } satisfies Prisma.LessonWhereInput;

    const [load, monthLessons, memberships, groupCount] = await Promise.all([
      this.prisma.lesson.findMany({
        where: {
          ...lessonWhere,
          status: BUSY_STATUSES,
          startsAtUtc: { gte: loadFrom, lt: week.to },
        },
        select: { startsAtUtc: true, durationMin: true },
      }),
      this.prisma.lesson.findMany({
        where: {
          ...lessonWhere,
          startsAtUtc: { gte: month.from, lt: month.to },
          OR: [
            { status: { in: ['COMPLETED', 'NO_SHOW'] } },
            {
              status: { in: ['CANCELLED_CHARGED', 'CANCELLED_UNCHARGED'] },
              cancelledBy: 'STUDENT',
            },
          ],
        },
        select: { status: true },
      }),
      this.prisma.enrollment.findMany({
        where: teacherMembershipWhere(auth.workspaceId, [teacherId]),
        select: { studentId: true, groupId: true },
      }),
      this.prisma.group.count({
        where: { workspaceId: auth.workspaceId, teacherId, deletedAt: null },
      }),
    ]);

    const individual = new Set<string>();
    const inGroups = new Set<string>();
    for (const row of memberships) {
      (row.groupId ? inGroups : individual).add(row.studentId);
    }
    const count = (statuses: readonly string[]) =>
      monthLessons.filter((lesson) => statuses.includes(lesson.status)).length;

    return {
      weeks: weeklyMinutes(
        load.map((lesson) => ({
          startsAt: lesson.startsAtUtc,
          durationMin: lesson.durationMin,
        })),
        now,
        timeZone,
        LOAD_WEEKS,
      ),
      students: {
        total: new Set([...individual, ...inGroups]).size,
        individual: individual.size,
        inGroups: inGroups.size,
      },
      groupCount,
      month: {
        start: zonedDate(month.from, timeZone),
        held: count(['COMPLETED']),
        noShows: count(['NO_SHOW']),
        cancelledByStudents: count([
          'CANCELLED_CHARGED',
          'CANCELLED_UNCHARGED',
        ]),
      },
    };
  }

  /**
   * The teacher's students by name: whether they study one to one with the
   * teacher and which of the teacher's groups they attend. A teacher has tens
   * of students, so the page is cut in memory.
   */
  async students(
    auth: AuthenticatedUser,
    teacherId: string,
    query: TeacherStudentsQueryDto,
  ): Promise<TeacherStudentsResponse> {
    await this.teacherTimeZone(auth, teacherId);
    const rows = await this.prisma.enrollment.findMany({
      where: teacherMembershipWhere(auth.workspaceId, [teacherId]),
      select: {
        groupId: true,
        group: { select: { id: true, name: true } },
        student: {
          select: {
            id: true,
            fullName: true,
            avatarKey: true,
            languageLevel: true,
            subject: true,
          },
        },
      },
    });

    const byStudent = new Map<string, TeacherStudent>();
    for (const row of rows) {
      const student =
        byStudent.get(row.student.id) ??
        ({
          id: row.student.id,
          fullName: row.student.fullName,
          avatarKey: row.student.avatarKey as TeacherStudent['avatarKey'],
          languageLevel: row.student.languageLevel,
          subject: row.student.subject,
          individual: false,
          groups: [],
        } satisfies TeacherStudent);
      if (row.group) {
        student.groups.push({ id: row.group.id, name: row.group.name });
      } else {
        student.individual = true;
      }
      byStudent.set(student.id, student);
    }

    const items = [...byStudent.values()].sort(
      (a, b) =>
        a.fullName.localeCompare(b.fullName) || a.id.localeCompare(b.id),
    );
    for (const item of items) {
      item.groups.sort((a, b) => a.name.localeCompare(b.name));
    }
    const skip = (query.page - 1) * query.pageSize;
    return buildPaginatedResponse(
      items.slice(skip, skip + query.pageSize),
      items.length,
      query,
    );
  }

  /** The studio's zone, after checking the teacher is the workspace's. */
  private async teacherTimeZone(
    auth: AuthenticatedUser,
    teacherId: string,
  ): Promise<string> {
    const teacher = await this.prisma.teacher.findFirst({
      where: { id: teacherId, workspaceId: auth.workspaceId, deletedAt: null },
      select: { workspace: { select: { timezone: true } } },
    });
    if (!teacher) {
      throw teacherNotFound();
    }
    return teacher.workspace.timezone;
  }
}
