import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  BulkCancelDto,
  BulkCancelPreview,
  BulkCancelResult,
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { teacherNotFound } from '../common/business.errors';
import { PrismaService } from '../prisma/prisma.service';
import { lockTeacherSchedules } from './lifecycle-suspension';

/** How many lessons a preview lists; the count covers them all. */
const PREVIEW_LIMIT = 200;

const lessonSelect = {
  id: true,
  startsAtUtc: true,
  durationMin: true,
  statusVersion: true,
  enrollment: {
    select: { student: { select: { id: true, fullName: true } } },
  },
  group: { select: { id: true, name: true } },
  teacher: { select: { id: true, fullName: true, color: true } },
} satisfies Prisma.LessonSelect;

type TeacherRef = BulkCancelPreview['byTeacher'][number]['teacher'];

/**
 * Cancels every scheduled lesson of one teacher, or of the whole studio, in a
 * period — a holiday, an illness (product/scheduling.md L-54). Free, cancelled
 * by the teacher, with an optional reason; held, cancelled and no-show
 * lessons are left alone. The preview selects exactly what the apply cancels.
 */
@Injectable()
export class BulkCancelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async preview(
    auth: AuthenticatedUser,
    dto: BulkCancelDto,
  ): Promise<BulkCancelPreview> {
    const lessons = await this.select(this.prisma, auth, dto);
    const byTeacher = new Map<string, { teacher: TeacherRef; count: number }>();
    for (const lesson of lessons) {
      const teacher = toTeacherRef(lesson.teacher);
      const entry = byTeacher.get(teacher.id) ?? { teacher, count: 0 };
      entry.count += 1;
      byTeacher.set(teacher.id, entry);
    }
    return {
      count: lessons.length,
      byTeacher: [...byTeacher.values()].sort(
        (a, b) =>
          b.count - a.count || a.teacher.name.localeCompare(b.teacher.name),
      ),
      lessons: lessons.slice(0, PREVIEW_LIMIT).map((lesson) => ({
        id: lesson.id,
        startsAtUtc: lesson.startsAtUtc.toISOString(),
        durationMin: lesson.durationMin,
        student: lesson.enrollment?.student ?? null,
        group: lesson.group,
        teacher: toTeacherRef(lesson.teacher),
      })),
      truncated: lessons.length > PREVIEW_LIMIT,
    };
  }

  async apply(
    auth: AuthenticatedUser,
    dto: BulkCancelDto,
  ): Promise<BulkCancelResult> {
    return this.prisma.$transaction(async (tx) => {
      const candidates = await this.select(tx, auth, dto);
      await lockTeacherSchedules(
        tx,
        auth.workspaceId,
        candidates.map((lesson) => lesson.teacher.id),
      );
      const now = new Date();
      const reason = dto.reason?.trim() || null;
      const cancelled: string[] = [];
      for (const lesson of candidates) {
        // The same conditional update a single status change uses: a lesson
        // changed meanwhile is left as it is.
        const updated = await tx.lesson.updateMany({
          where: {
            id: lesson.id,
            status: 'SCHEDULED',
            statusVersion: lesson.statusVersion,
            deletedAt: null,
          },
          data: {
            status: 'CANCELLED_UNCHARGED',
            statusVersion: { increment: 1 },
            cancelledBy: 'TEACHER',
            cancelledReason: reason,
            cancelledAt: now,
            completedAt: null,
          },
        });
        if (updated.count !== 1) continue;
        cancelled.push(lesson.id);
        await this.audit.record(tx, {
          workspaceId: auth.workspaceId,
          actorId: auth.userId,
          action: 'UPDATE',
          entity: 'LESSON',
          entityId: lesson.id,
          changes: this.audit.buildChanges(
            { status: 'SCHEDULED' },
            {
              status: 'CANCELLED_UNCHARGED',
              cancelledBy: 'TEACHER',
              cancelledReason: reason,
              bulk: true,
            },
          ),
        });
      }
      return { cancelled: cancelled.length, lessonIds: cancelled };
    });
  }

  /** The scheduled lessons in [from, to), of one teacher or of every one. */
  private async select(
    db: Prisma.TransactionClient,
    auth: AuthenticatedUser,
    dto: BulkCancelDto,
  ) {
    if (dto.teacherId) {
      const teacher = await db.teacher.findFirst({
        where: { id: dto.teacherId, workspaceId: auth.workspaceId },
        select: { id: true },
      });
      if (!teacher) throw teacherNotFound();
    }
    return db.lesson.findMany({
      where: {
        workspaceId: auth.workspaceId,
        deletedAt: null,
        status: 'SCHEDULED',
        startsAtUtc: { gte: new Date(dto.from), lt: new Date(dto.to) },
        ...(dto.teacherId ? { teacherId: dto.teacherId } : {}),
      },
      orderBy: [{ startsAtUtc: 'asc' }, { id: 'asc' }],
      select: lessonSelect,
    });
  }
}

function toTeacherRef(teacher: {
  id: string;
  fullName: string;
  color: string | null;
}): TeacherRef {
  return { id: teacher.id, name: teacher.fullName, color: teacher.color };
}
