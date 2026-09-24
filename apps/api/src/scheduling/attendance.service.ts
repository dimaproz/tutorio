import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  AuditChanges,
  LessonAttendanceResponse,
  SetLessonAttendanceDto,
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  attendanceNotMarkable,
  invalidWorkspaceRelation,
  lessonNotFound,
} from '../common/business.errors';
import { PrismaService } from '../prisma/prisma.service';

type AttendanceLesson = {
  id: string;
  workspaceId: string;
  groupId: string | null;
  enrollmentId: string | null;
  startsAtUtc: Date;
  durationMin: number;
  status: LessonAttendanceResponse['status'];
};

type Participant = LessonAttendanceResponse['participants'][number];

/**
 * A group lesson becoming held counts every active member without a mark as
 * present (product/scheduling.md L-72): the tutor marks only the exceptions.
 * Written as ordinary marks (no author), so attendance and charges agree.
 */
export async function markRosterPresent(
  tx: Prisma.TransactionClient,
  lesson: { id: string; workspaceId: string; groupId: string | null },
  now: Date,
): Promise<number> {
  if (!lesson.groupId) return 0;
  const unmarked = await tx.enrollment.findMany({
    where: {
      workspaceId: lesson.workspaceId,
      groupId: lesson.groupId,
      deletedAt: null,
      status: 'ACTIVE',
      student: { deletedAt: null, status: { not: 'ARCHIVED' } },
      attendance: { none: { lessonId: lesson.id } },
    },
    select: { id: true },
  });
  if (unmarked.length === 0) return 0;
  const created = await tx.lessonAttendance.createMany({
    data: unmarked.map((member) => ({
      workspaceId: lesson.workspaceId,
      lessonId: lesson.id,
      enrollmentId: member.id,
      status: 'PRESENT' as const,
      markedAt: now,
    })),
    skipDuplicates: true,
  });
  return created.count;
}

/** Marks are accepted once a lesson has started, unless it was cancelled. */
export function isMarkable(lesson: AttendanceLesson, now: Date): boolean {
  if (lesson.status === 'COMPLETED') return true;
  return (
    lesson.status === 'SCHEDULED' &&
    lesson.startsAtUtc.getTime() <= now.getTime()
  );
}

const studentSelect = {
  select: { id: true, fullName: true, avatarKey: true },
} as const;

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
  ) {}

  /**
   * Who a lesson is for: everyone already marked, plus — for a group lesson —
   * the live roster, and for an individual lesson its one enrollment. The
   * roster is today's, not the one on the lesson date: a tutor who moves an
   * existing group into Tutorio backfills its past lessons with it.
   */
  private async participants(
    tx: Prisma.TransactionClient,
    lesson: AttendanceLesson,
  ): Promise<Participant[]> {
    const marks = await tx.lessonAttendance.findMany({
      where: { lessonId: lesson.id },
      select: {
        enrollmentId: true,
        status: true,
        markedAt: true,
        enrollment: { select: { student: studentSelect } },
      },
    });
    const roster = lesson.groupId
      ? await tx.enrollment.findMany({
          where: {
            workspaceId: lesson.workspaceId,
            groupId: lesson.groupId,
            deletedAt: null,
            status: { in: ['ACTIVE', 'PAUSED'] },
            studentArchivedAt: null,
          },
          select: { id: true, student: studentSelect },
        })
      : lesson.enrollmentId
        ? await tx.enrollment.findMany({
            where: { id: lesson.enrollmentId },
            select: { id: true, student: studentSelect },
          })
        : [];

    const byEnrollment = new Map<string, Participant>();
    for (const row of roster) {
      byEnrollment.set(row.id, {
        enrollmentId: row.id,
        student: {
          ...row.student,
          avatarKey: row.student
            .avatarKey as Participant['student']['avatarKey'],
        },
        status: null,
        markedAt: null,
      });
    }
    for (const mark of marks) {
      byEnrollment.set(mark.enrollmentId, {
        enrollmentId: mark.enrollmentId,
        student: {
          ...mark.enrollment.student,
          avatarKey: mark.enrollment.student
            .avatarKey as Participant['student']['avatarKey'],
        },
        status: mark.status,
        markedAt: mark.markedAt.toISOString(),
      });
    }
    return [...byEnrollment.values()].sort(
      (a, b) =>
        a.student.fullName.localeCompare(b.student.fullName) ||
        a.enrollmentId.localeCompare(b.enrollmentId),
    );
  }

  private async findLesson(
    tx: Prisma.TransactionClient,
    auth: AuthenticatedUser,
    lessonId: string,
  ): Promise<AttendanceLesson> {
    const lesson = await tx.lesson.findFirst({
      where: { id: lessonId, workspaceId: auth.workspaceId, deletedAt: null },
      select: {
        id: true,
        workspaceId: true,
        groupId: true,
        enrollmentId: true,
        startsAtUtc: true,
        durationMin: true,
        status: true,
      },
    });
    if (!lesson) {
      throw lessonNotFound();
    }
    return lesson;
  }

  private toResponse(
    lesson: AttendanceLesson,
    participants: Participant[],
    now: Date,
  ): LessonAttendanceResponse {
    return {
      lessonId: lesson.id,
      startsAtUtc: lesson.startsAtUtc.toISOString(),
      status: lesson.status,
      markable: isMarkable(lesson, now),
      participants,
    };
  }

  async get(
    auth: AuthenticatedUser,
    lessonId: string,
  ): Promise<LessonAttendanceResponse> {
    const lesson = await this.findLesson(this.prisma, auth, lessonId);
    const participants = await this.participants(this.prisma, lesson);
    return this.toResponse(lesson, participants, new Date());
  }

  /**
   * Sets the given participants' marks in one transaction. A participant not
   * in the payload keeps its mark; one mark per (lesson, enrollment).
   */
  async set(
    auth: AuthenticatedUser,
    lessonId: string,
    dto: SetLessonAttendanceDto,
  ): Promise<LessonAttendanceResponse> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const lesson = await this.findLesson(tx, auth, lessonId);
      if (!isMarkable(lesson, now)) {
        throw attendanceNotMarkable();
      }
      const participants = await this.participants(tx, lesson);
      const known = new Map(
        participants.map((participant) => [
          participant.enrollmentId,
          participant,
        ]),
      );
      if (dto.marks.some((mark) => !known.has(mark.enrollmentId))) {
        throw invalidWorkspaceRelation();
      }

      const fields: AuditChanges['fields'] = {};
      for (const mark of dto.marks) {
        const before = known.get(mark.enrollmentId)?.status ?? null;
        if (before === mark.status) continue;
        await tx.lessonAttendance.upsert({
          where: {
            lessonId_enrollmentId: {
              lessonId: lesson.id,
              enrollmentId: mark.enrollmentId,
            },
          },
          create: {
            workspaceId: auth.workspaceId,
            lessonId: lesson.id,
            enrollmentId: mark.enrollmentId,
            status: mark.status,
            markedAt: now,
            markedById: auth.userId,
          },
          update: {
            status: mark.status,
            markedAt: now,
            markedById: auth.userId,
          },
        });
        fields[`attendance.${mark.enrollmentId}`] = {
          before,
          after: mark.status,
        };
      }

      if (Object.keys(fields).length > 0) {
        await this.audit.record(tx, {
          workspaceId: auth.workspaceId,
          actorId: auth.userId,
          action: 'UPDATE',
          entity: 'LESSON',
          entityId: lesson.id,
          changes: { fields },
        });
        // A mark decides whether the participant pays (L-71, L-74).
        await this.billing.syncLesson(
          tx,
          auth.workspaceId,
          lesson.id,
          auth.userId,
        );
      }

      return this.toResponse(lesson, await this.participants(tx, lesson), now);
    });
  }
}
