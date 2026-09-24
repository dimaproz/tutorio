import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isDueForCompletion, lessonEndsAt } from '@tutorio/domain';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { markRosterPresent } from './attendance.service';

type DueLesson = {
  id: string;
  workspaceId: string;
  groupId: string | null;
  startsAtUtc: Date;
  durationMin: number;
  statusVersion: number;
};

/**
 * Lessons complete themselves (product/scheduling.md L-50): a scheduled lesson
 * becomes held at its end and is charged; a group's unmarked active members
 * count as present (L-72). The tutor corrects afterwards — cancel it or mark
 * a no-show. Each lesson is its own transaction with the same conditional
 * update a manual status change uses, so a run racing the tutor, or another
 * run, changes each lesson once.
 */
@Injectable()
export class LessonCompletionService {
  private readonly logger = new Logger(LessonCompletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run(): Promise<void> {
    const completed = await this.completeDue();
    if (completed > 0) {
      this.logger.log(`Auto-completion run: ${completed} lessons held`);
    }
  }

  /** Completes every scheduled lesson whose end has passed, oldest first. */
  async completeDue(now: Date = new Date(), batchSize = 100): Promise<number> {
    let total = 0;
    for (;;) {
      // Started lessons, oldest first; the ones still running sit at the end
      // and stop the loop once nothing else is left.
      const batch = await this.prisma.lesson.findMany({
        where: {
          deletedAt: null,
          status: 'SCHEDULED',
          startsAtUtc: { lte: now },
        },
        orderBy: [{ startsAtUtc: 'asc' }, { id: 'asc' }],
        take: batchSize,
        select: {
          id: true,
          workspaceId: true,
          groupId: true,
          status: true,
          startsAtUtc: true,
          durationMin: true,
          statusVersion: true,
        },
      });
      let completed = 0;
      for (const lesson of batch) {
        if (!isDueForCompletion(lesson, now)) continue;
        try {
          if (await this.completeOne(lesson, now)) completed += 1;
        } catch (error) {
          this.logger.error(`Failed to complete lesson ${lesson.id}`, error);
        }
      }
      total += completed;
      if (completed === 0 || batch.length < batchSize) return total;
    }
  }

  private completeOne(lesson: DueLesson, now: Date): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.lesson.updateMany({
        where: {
          id: lesson.id,
          deletedAt: null,
          status: 'SCHEDULED',
          statusVersion: lesson.statusVersion,
        },
        data: {
          status: 'COMPLETED',
          statusVersion: { increment: 1 },
          completedAt: lessonEndsAt(lesson),
        },
      });
      if (updated.count !== 1) return false;
      await markRosterPresent(tx, lesson, now);
      await this.billing.syncLesson(tx, lesson.workspaceId, lesson.id, null);
      await this.audit.record(tx, {
        workspaceId: lesson.workspaceId,
        actorId: null,
        action: 'UPDATE',
        entity: 'LESSON',
        entityId: lesson.id,
        changes: this.audit.buildChanges(
          { status: 'SCHEDULED' },
          { status: 'COMPLETED', completedBy: 'SCHEDULE' },
        ),
      });
      return true;
    });
  }
}
