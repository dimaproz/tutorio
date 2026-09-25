import { Injectable } from '@nestjs/common';
import {
  attendanceMarkKey,
  selectAttendanceWindow,
  summarizeAttendance,
  type AttendanceMark,
} from '@tutorio/domain';
import type {
  GroupAttendanceQueryDto,
  GroupAttendanceResponse,
} from '@tutorio/validation';
import type { AuthenticatedUser } from '../auth/auth.types';
import { groupNotFound } from '../common/business.errors';
import { PrismaService } from '../prisma/prisma.service';
import { liveEnrollmentWhere } from './groups.shared';

type Row = GroupAttendanceResponse['rows'][number];

@Injectable()
export class GroupAttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Attendance of the group's current roster over its last `window` held
   * lessons, with the window before it for the trend. The rules live in
   * `summarizeAttendance`; this only gathers the rows.
   */
  async summarize(
    auth: AuthenticatedUser,
    groupId: string,
    query: GroupAttendanceQueryDto,
  ): Promise<GroupAttendanceResponse> {
    const now = new Date();
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, workspaceId: auth.workspaceId },
      select: {
        id: true,
        enrollments: {
          where: liveEnrollmentWhere,
          orderBy: [{ student: { fullName: 'asc' } }, { id: 'asc' }],
          select: {
            id: true,
            status: true,
            student: {
              select: {
                id: true,
                fullName: true,
                avatarKey: true,
                status: true,
              },
            },
          },
        },
      },
    });
    if (!group) {
      throw groupNotFound();
    }

    // Two windows back: the current one and the one before it for the trend.
    const recent = await this.prisma.lesson.findMany({
      where: {
        workspaceId: auth.workspaceId,
        groupId,
        deletedAt: null,
        status: { not: 'SCHEDULED' },
        startsAtUtc: { lte: now },
      },
      orderBy: [{ startsAtUtc: 'desc' }, { id: 'asc' }],
      take: query.window * 2,
      select: { id: true, startsAtUtc: true, status: true, topic: true },
    });
    const topics = new Map(recent.map((lesson) => [lesson.id, lesson.topic]));
    const lessons = recent.map((lesson) => ({
      id: lesson.id,
      startsAt: lesson.startsAtUtc,
      status: lesson.status,
    }));
    const current = selectAttendanceWindow(lessons, now, query.window);
    const previous = selectAttendanceWindow(
      lessons,
      now,
      query.window,
      query.window,
    );

    const marks = await this.prisma.lessonAttendance.findMany({
      where: {
        workspaceId: auth.workspaceId,
        lessonId: { in: lessons.map((lesson) => lesson.id) },
        enrollmentId: { in: group.enrollments.map((row) => row.id) },
      },
      select: { lessonId: true, enrollmentId: true, status: true },
    });

    const summary = summarizeAttendance({
      lessons: current,
      previousLessons: previous,
      participants: group.enrollments.map((row) => ({
        enrollmentId: row.id,
        hold: row.status === 'PAUSED' || row.student.status === 'ON_HOLD',
      })),
      marks: new Map<string, AttendanceMark>(
        marks.map((mark) => [
          attendanceMarkKey(mark.lessonId, mark.enrollmentId),
          mark.status,
        ]),
      ),
    });

    const students = new Map(
      group.enrollments.map((row) => [row.id, row.student]),
    );
    return {
      window: query.window,
      lessons: summary.lessons.map((lesson) => ({
        id: lesson.id,
        startsAtUtc: lesson.startsAt.toISOString(),
        status: lesson.status,
        topic: topics.get(lesson.id) ?? null,
      })),
      stats: summary.stats,
      rows: summary.rows.map((row) => {
        const student = students.get(row.enrollmentId)!;
        return {
          enrollmentId: row.enrollmentId,
          student: {
            id: student.id,
            fullName: student.fullName,
            avatarKey: student.avatarKey as Row['student']['avatarKey'],
          },
          cells: row.cells,
          rate: row.rate,
          misses: row.misses,
          trailingMisses: row.trailingMisses,
          lastPresentAt: row.lastPresentAt?.toISOString() ?? null,
          hold: row.hold,
          risk: row.risk,
        };
      }),
    };
  }
}
