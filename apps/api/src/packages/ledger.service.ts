import { Injectable, Logger } from '@nestjs/common';
import {
  planTransition,
  type LedgerEntryType,
  type LessonStatus,
} from '@tutorio/domain';
import { Prisma } from '@prisma/client';
import {
  currencyMismatch,
  invalidPackagePaymentRelation,
  noActivePackage,
  packageNotEligibleForCredit,
  packageNotFound,
  lessonCompensationSourceMissing,
} from '../common/business.errors';

/** Append-only lesson-credit writes and exact package resolution. */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  async append(
    tx: Prisma.TransactionClient,
    entry: {
      workspaceId: string;
      packageId: string;
      enrollmentId?: string | null;
      lessonId?: string | null;
      delta: number;
      type: LedgerEntryType;
      idempotencyKey: string;
      note?: string | null;
      createdById?: string | null;
    },
  ): Promise<boolean> {
    try {
      await tx.lessonCreditEntry.create({
        data: {
          workspaceId: entry.workspaceId,
          packageId: entry.packageId,
          enrollmentId: entry.enrollmentId ?? null,
          lessonId: entry.lessonId ?? null,
          delta: entry.delta,
          type: entry.type,
          idempotencyKey: entry.idempotencyKey,
          note: entry.note ?? null,
          createdById: entry.createdById ?? null,
        },
      });
      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.debug(
          `Ledger entry ${entry.idempotencyKey} already recorded`,
        );
        return false;
      }
      throw error;
    }
  }

  /** Validates exact ownership and currency for a pinned package. */
  async assertCompatiblePackage(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    lesson: {
      packageId: string;
      enrollmentId: string | null;
      groupId: string | null;
      currency: string;
      occursAt?: Date;
    },
    allowArchived: boolean,
  ): Promise<{ id: string }> {
    const pkg = await tx.lessonPackage.findFirst({
      where: { id: lesson.packageId, workspaceId },
      select: {
        id: true,
        studentId: true,
        groupId: true,
        currency: true,
        sizingMode: true,
        expiresAt: true,
        purchasedAt: true,
        deletedAt: true,
      },
    });
    if (!pkg) throw packageNotFound();
    if (!allowArchived && pkg.deletedAt) throw noActivePackage();
    if (!allowArchived && pkg.sizingMode !== 'FIXED_COUNT')
      throw packageNotEligibleForCredit();
    if (
      !allowArchived &&
      lesson.occursAt &&
      pkg.purchasedAt > lesson.occursAt
    ) {
      throw packageNotEligibleForCredit();
    }
    if (
      !allowArchived &&
      pkg.expiresAt &&
      lesson.occursAt &&
      pkg.expiresAt <= lesson.occursAt
    ) {
      throw packageNotEligibleForCredit();
    }
    if (pkg.currency !== lesson.currency) throw currencyMismatch();
    if (lesson.groupId) {
      if (pkg.groupId !== lesson.groupId || pkg.studentId !== null) {
        throw invalidPackagePaymentRelation();
      }
      return pkg;
    }
    if (!lesson.enrollmentId) throw invalidPackagePaymentRelation();
    const enrollment = await tx.enrollment.findFirst({
      where: { id: lesson.enrollmentId, workspaceId },
      select: { studentId: true, groupId: true },
    });
    if (
      !enrollment ||
      enrollment.groupId ||
      pkg.studentId !== enrollment.studentId ||
      pkg.groupId !== null
    ) {
      throw invalidPackagePaymentRelation();
    }
    return pkg;
  }

  /** Finds an active compatible package only for the first debit of a lesson. */
  private async resolveFirstDebitPackage(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    lesson: {
      enrollmentId: string | null;
      groupId: string | null;
      currency: string;
      occursAt: Date;
    },
  ): Promise<{ id: string } | null> {
    let target: Prisma.LessonPackageWhereInput;
    if (lesson.groupId) {
      target = { groupId: lesson.groupId, studentId: null };
    } else if (lesson.enrollmentId) {
      const enrollment = await tx.enrollment.findFirst({
        where: { id: lesson.enrollmentId, workspaceId, groupId: null },
        select: { studentId: true },
      });
      if (!enrollment) return null;
      target = { studentId: enrollment.studentId, groupId: null };
    } else {
      return null;
    }
    return tx.lessonPackage.findFirst({
      where: {
        workspaceId,
        deletedAt: null,
        sizingMode: 'FIXED_COUNT',
        currency: lesson.currency,
        purchasedAt: { lte: lesson.occursAt },
        OR: [{ expiresAt: null }, { expiresAt: { gt: lesson.occursAt } }],
        ...target,
      },
      orderBy: [{ purchasedAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
  }

  private async assertCompensationSource(
    tx: Prisma.TransactionClient,
    lessonId: string,
    packageId: string,
    type: LedgerEntryType,
  ): Promise<void> {
    const entries = await tx.lessonCreditEntry.findMany({
      where: { lessonId, packageId, type },
      select: { delta: true },
    });
    if (entries.reduce((sum, entry) => sum + entry.delta, 0) >= 0) {
      throw lessonCompensationSourceMissing();
    }
  }

  /**
   * Applies one non-zero effect. Package selection happens once, on first
   * debit, and is stored on the lesson before the append-only entry is written.
   */
  async applyTransition(
    tx: Prisma.TransactionClient,
    params: {
      workspaceId: string;
      actorId?: string;
      lesson: {
        id: string;
        packageId: string | null;
        enrollmentId: string | null;
        groupId: string | null;
        currency: string;
        startsAtUtc: Date;
        status: LessonStatus;
      };
      targetStatus: LessonStatus;
      transitionVersion: number;
    },
  ): Promise<{ wrote: boolean; packageId: string | null }> {
    const plan = planTransition(
      params.lesson.status,
      params.targetStatus,
      params.lesson.id,
      params.transitionVersion,
    );
    if (!plan.entry)
      return { wrote: false, packageId: params.lesson.packageId };

    let packageId = params.lesson.packageId;
    if (packageId) {
      if (plan.entry.delta > 0) {
        await this.assertCompensationSource(
          tx,
          params.lesson.id,
          packageId,
          plan.entry.type,
        );
      }
      await this.assertCompatiblePackage(
        tx,
        params.workspaceId,
        {
          packageId,
          enrollmentId: params.lesson.enrollmentId,
          groupId: params.lesson.groupId,
          currency: params.lesson.currency,
          occursAt: params.lesson.startsAtUtc,
        },
        plan.entry.delta > 0,
      );
    } else if (plan.entry.delta < 0) {
      const resolved = await this.resolveFirstDebitPackage(
        tx,
        params.workspaceId,
        {
          enrollmentId: params.lesson.enrollmentId,
          groupId: params.lesson.groupId,
          currency: params.lesson.currency,
          occursAt: params.lesson.startsAtUtc,
        },
      );
      if (!resolved) return { wrote: false, packageId: null };
      packageId = resolved.id;
      await tx.lesson.update({
        where: { id: params.lesson.id },
        data: { packageId },
      });
    } else {
      // Never infer a package for compensation; ambiguous legacy history must
      // be repaired explicitly rather than refunded into a newer package.
      throw noActivePackage();
    }

    const wrote = await this.append(tx, {
      workspaceId: params.workspaceId,
      packageId,
      enrollmentId: params.lesson.enrollmentId,
      lessonId: params.lesson.id,
      delta: plan.entry.delta,
      type: plan.entry.type,
      idempotencyKey: plan.entry.idempotencyKey,
      createdById: params.actorId ?? null,
    });
    return { wrote, packageId };
  }
}
