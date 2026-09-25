import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  ArchiveTeacherDto,
  ScheduleConflict,
  TeacherArchivePreview,
  TeacherResponse,
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  invalidWorkspaceRelation,
  scheduleConflict,
  teacherNotFound,
} from '../common/business.errors';
import { PrismaService } from '../prisma/prisma.service';
import { detectScheduleConflicts } from '../scheduling/conflicts';
import { lockTeacherSchedules } from '../scheduling/lifecycle-suspension';
import { teacherMembershipWhere } from './teacher-stats';
import { toTeacherResponse, withMemberUser } from './teachers.service';

/** A lesson that is live, or held back by a suspension it will come back from. */
const liveOrSuspended = {
  OR: [{ deletedAt: null }, { scheduleSuspensionToken: { not: null } }],
} satisfies Prisma.LessonWhereInput & Prisma.LessonSeriesWhereInput;

/** Everything of a teacher's that an archive hands over. */
interface Handover {
  teacher: { id: string; fullName: string; status: string };
  target: { id: string } | null;
  lessons: {
    id: string;
    startsAtUtc: Date;
    durationMin: number;
    deletedAt: Date | null;
    enrollmentId: string | null;
    groupId: string | null;
  }[];
  scheduleIds: string[];
  groups: { id: string; name: string }[];
  studentCount: number;
}

/**
 * Archiving a teacher — or the owner turning their own teaching off — with an
 * optional hand-over (docs/screens/s09-teachers.md, data 5 and 6): the future
 * scheduled lessons, the active schedules (the rule in force and a planned
 * one) and the groups the teacher leads, with their members, move to another
 * active teacher after a check of that teacher's calendar (L-110). Students
 * do not change, so only the new teacher's overlaps count. Taught, cancelled
 * and past lessons, and the individual directions with their billing, keep
 * the teacher they had: history never changes.
 */
@Injectable()
export class TeacherArchiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async preview(
    auth: AuthenticatedUser,
    teacherId: string,
    dto: ArchiveTeacherDto,
  ): Promise<TeacherArchivePreview> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const handover = await this.handover(tx, auth, teacherId, dto, now);
      const live = handover.lessons.filter((lesson) => !lesson.deletedAt);
      return {
        scheduleCount: handover.scheduleIds.length,
        futureLessonCount: live.length,
        lastLessonAt:
          live.length > 0
            ? new Date(
                Math.max(...live.map((lesson) => lesson.startsAtUtc.getTime())),
              ).toISOString()
            : null,
        studentCount: handover.studentCount,
        groups: handover.groups,
        conflicts: await this.conflicts(tx, auth.workspaceId, handover),
      };
    });
  }

  async archive(
    auth: AuthenticatedUser,
    teacherId: string,
    dto: ArchiveTeacherDto,
    force: boolean,
  ): Promise<TeacherResponse> {
    const teacher = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const handover = await this.handover(tx, auth, teacherId, dto, now);
      const target = handover.target;
      const changes: Record<string, { before: unknown; after: unknown }> = {};

      if (target) {
        await lockTeacherSchedules(tx, auth.workspaceId, [
          teacherId,
          target.id,
        ]);
        const conflicts = force
          ? []
          : await this.conflicts(tx, auth.workspaceId, handover);
        if (conflicts.length > 0) {
          throw scheduleConflict(
            [...new Set(conflicts.map((conflict) => conflict.lessonId))],
            conflicts,
          );
        }
        const groupIds = handover.groups.map((group) => group.id);
        const [lessons, schedules, groups] = await Promise.all([
          tx.lesson.updateMany({
            where: { id: { in: handover.lessons.map((lesson) => lesson.id) } },
            data: { teacherId: target.id },
          }),
          tx.schedule.updateMany({
            where: { id: { in: handover.scheduleIds } },
            data: { teacherId: target.id },
          }),
          tx.group.updateMany({
            where: { id: { in: groupIds } },
            data: { teacherId: target.id },
          }),
          tx.lessonSeries.updateMany({
            where: {
              scheduleId: { in: handover.scheduleIds },
              teacherId,
              ...liveOrSuspended,
              AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
            },
            data: { teacherId: target.id },
          }),
          tx.enrollment.updateMany({
            where: { groupId: { in: groupIds }, deletedAt: null },
            data: { teacherId: target.id },
          }),
        ]);
        changes.transferredTo = { before: null, after: target.id };
        changes.transferredLessons = { before: null, after: lessons.count };
        changes.transferredSchedules = { before: null, after: schedules.count };
        changes.transferredGroups = { before: null, after: groups.count };
      }

      if (handover.teacher.status !== 'ARCHIVED') {
        changes.status = { before: handover.teacher.status, after: 'ARCHIVED' };
      }
      const updated = await tx.teacher.update({
        where: { id: teacherId },
        data:
          handover.teacher.status === 'ARCHIVED'
            ? {}
            : { status: 'ARCHIVED', archivedAt: now },
        include: withMemberUser,
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'UPDATE',
        entity: 'TEACHER',
        entityId: teacherId,
        changes: Object.keys(changes).length > 0 ? { fields: changes } : null,
      });
      return updated;
    });
    return toTeacherResponse(teacher, auth.userId);
  }

  private async handover(
    tx: Prisma.TransactionClient,
    auth: AuthenticatedUser,
    teacherId: string,
    dto: ArchiveTeacherDto,
    now: Date,
  ): Promise<Handover> {
    const workspaceId = auth.workspaceId;
    const teacher = await tx.teacher.findFirst({
      where: { id: teacherId, workspaceId, deletedAt: null },
      select: { id: true, fullName: true, status: true },
    });
    if (!teacher) {
      throw teacherNotFound();
    }
    let target: Handover['target'] = null;
    if (dto.transferTo) {
      const row = await tx.teacher.findFirst({
        where: { id: dto.transferTo, workspaceId, deletedAt: null },
        select: { id: true, status: true },
      });
      if (!row) {
        throw teacherNotFound();
      }
      if (row.id === teacherId || row.status !== 'ACTIVE') {
        throw invalidWorkspaceRelation();
      }
      target = { id: row.id };
    }

    const [lessons, schedules, groups, memberships] = await Promise.all([
      tx.lesson.findMany({
        where: {
          workspaceId,
          teacherId,
          status: 'SCHEDULED',
          startsAtUtc: { gte: now },
          ...liveOrSuspended,
        },
        select: {
          id: true,
          startsAtUtc: true,
          durationMin: true,
          deletedAt: true,
          enrollmentId: true,
          groupId: true,
        },
        orderBy: { startsAtUtc: 'asc' },
      }),
      tx.schedule.findMany({
        where: { workspaceId, teacherId, state: 'ACTIVE' },
        select: { id: true },
      }),
      tx.group.findMany({
        where: { workspaceId, teacherId, deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      tx.enrollment.findMany({
        where: teacherMembershipWhere(workspaceId, [teacherId]),
        select: { studentId: true },
        distinct: ['studentId'],
      }),
    ]);
    return {
      teacher,
      target,
      lessons,
      scheduleIds: schedules.map((schedule) => schedule.id),
      groups,
      studentCount: memberships.length,
    };
  }

  /** The new teacher's overlaps with the live lessons handed over. */
  private async conflicts(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    handover: Handover,
  ): Promise<ScheduleConflict[]> {
    const target = handover.target;
    if (!target) return [];
    const moving = handover.lessons.filter((lesson) => !lesson.deletedAt);
    const conflicts = await detectScheduleConflicts(
      tx,
      workspaceId,
      moving.map((lesson) => ({ ...lesson, teacherId: target.id })),
      { excludeIds: handover.lessons.map((lesson) => lesson.id) },
    );
    return conflicts.filter((conflict) => conflict.reason === 'TEACHER');
  }
}
