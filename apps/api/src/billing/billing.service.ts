import { Injectable } from '@nestjs/common';
import { Prisma, type LessonCharge } from '@prisma/client';
import {
  allocatePayments,
  coverDebts,
  initialSource,
  isChargedStatus,
  isPackageValidAt,
  participantIsCharged,
  pickPackage,
  type BalanceAllocation,
  type CreditPackage,
} from '@tutorio/domain';
import type { EnrollmentBillingResponse } from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { enrollmentNotFound, lessonPaid } from '../common/business.errors';
import { PrismaService } from '../prisma/prisma.service';
import { lockEnrollmentBilling } from '../scheduling/lifecycle-suspension';

type Db = Prisma.TransactionClient;

interface Direction {
  id: string;
  billingType: 'PACKAGE' | 'PER_LESSON';
  priceMinor: number;
  currency: string;
}

/**
 * Per-participant charging (product/scheduling.md L-10…L-12, L-61, L-70…L-74,
 * L-81…L-83, L-90, L-91; ADR 0007). The rules are the pure functions of
 * `@tutorio/domain` billing; this service reads the state they need and writes
 * one `LessonCharge` per lesson and participant.
 *
 * Charges are re-evaluated from state, not from transition deltas: after any
 * change to a lesson's status, its makeup pairing or its attendance, the
 * caller asks for `syncLesson`, which makes the charges match what is owed
 * now. Repeating it changes nothing.
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Makes the lesson's charges (and its makeup's, whose pairing depends on
   * it) match what each participant owes now.
   */
  async syncLesson(
    tx: Db,
    workspaceId: string,
    lessonId: string,
    actorId: string | null,
  ): Promise<void> {
    const lesson = await tx.lesson.findFirst({
      where: { id: lessonId, workspaceId },
      select: {
        id: true,
        status: true,
        enrollmentId: true,
        groupId: true,
        startsAtUtc: true,
        priceMinor: true,
        currency: true,
        deletedAt: true,
        original: { select: { status: true } },
        makeup: { select: { id: true } },
        attendance: { select: { enrollmentId: true, status: true } },
        charges: true,
      },
    });
    if (!lesson) return;

    const marks = new Map(
      lesson.attendance.map((mark) => [mark.enrollmentId, mark.status]),
    );
    // Whoever was charged or marked stays a participant; a held group lesson
    // also counts every active member (L-3, L-72). Like attendance, that is
    // today's roster: a tutor moving a group into Tutorio backfills its past
    // lessons with it.
    const participants = new Set(
      lesson.charges.map((charge) => charge.enrollmentId),
    );
    if (lesson.enrollmentId) participants.add(lesson.enrollmentId);
    for (const enrollmentId of marks.keys()) participants.add(enrollmentId);
    if (lesson.groupId && isChargedStatus(lesson.status) && !lesson.deletedAt) {
      const members = await tx.enrollment.findMany({
        where: {
          workspaceId,
          groupId: lesson.groupId,
          deletedAt: null,
          status: 'ACTIVE',
          student: { deletedAt: null, status: { not: 'ARCHIVED' } },
        },
        select: { id: true },
      });
      for (const member of members) participants.add(member.id);
    }
    if (participants.size === 0) return;

    const enrollmentIds = [...participants].sort();
    await lockEnrollmentBilling(tx, workspaceId, enrollmentIds);
    const directions = await tx.enrollment.findMany({
      where: { id: { in: enrollmentIds } },
      select: { id: true, billingType: true, priceMinor: true, currency: true },
    });

    const now = new Date();
    const freed = new Set<string>();
    const changes: Record<
      string,
      { before: string | null; after: string | null }
    > = {};
    for (const direction of directions) {
      const row = lesson.charges.find(
        (charge) => charge.enrollmentId === direction.id,
      );
      const owed =
        !lesson.deletedAt &&
        participantIsCharged(
          {
            status: lesson.status,
            isGroup: lesson.groupId !== null,
            originalStatus: lesson.original?.status ?? null,
          },
          marks.get(direction.id) ?? null,
        );
      const active = row !== undefined && row.voidedAt === null;
      if (owed && !active) {
        const choice = await this.chooseSource(
          tx,
          direction,
          lesson.startsAtUtc,
        );
        // A group member pays their own rate (the group price unless
        // overridden, L-11); an individual lesson its own price (L-12).
        const amount = lesson.groupId
          ? { amountMinor: direction.priceMinor, currency: direction.currency }
          : { amountMinor: lesson.priceMinor, currency: lesson.currency };
        const data = { ...choice, ...amount, voidedAt: null };
        if (row) {
          await tx.lessonCharge.update({ where: { id: row.id }, data });
        } else {
          await tx.lessonCharge.create({
            data: {
              workspaceId,
              lessonId: lesson.id,
              enrollmentId: direction.id,
              ...data,
            },
          });
        }
        changes[`charge.${direction.id}`] = {
          before: null,
          after: choice.source,
        };
      } else if (!owed && active) {
        await tx.lessonCharge.update({
          where: { id: row.id },
          data: { voidedAt: now },
        });
        if (row.source === 'PACKAGE') freed.add(direction.id);
        changes[`charge.${direction.id}`] = { before: row.source, after: null };
      }
    }

    // A credit given back covers the oldest debt first (L-82).
    for (const enrollmentId of freed) {
      await this.coverDebtsOf(tx, enrollmentId);
    }
    if (Object.keys(changes).length > 0) {
      await this.audit.record(tx, {
        workspaceId,
        actorId,
        action: 'UPDATE',
        entity: 'LESSON',
        entityId: lesson.id,
        changes: { fields: changes },
      });
    }
    if (lesson.makeup) {
      await this.syncLesson(tx, workspaceId, lesson.makeup.id, actorId);
    }
  }

  /** What pays for a new charge of this direction for a lesson at `at`. */
  private async chooseSource(
    tx: Db,
    direction: Direction,
    at: Date,
  ): Promise<Pick<LessonCharge, 'source' | 'packageId'>> {
    if (direction.billingType === 'PER_LESSON') {
      return { source: initialSource('PER_LESSON'), packageId: null };
    }
    const packageId = pickPackage(
      await this.creditPackages(tx, direction.id),
      at,
    );
    return packageId
      ? { source: 'PACKAGE', packageId }
      : { source: initialSource('PACKAGE'), packageId: null };
  }

  /** The live packages of a direction with the credits each has left. */
  async creditPackages(tx: Db, enrollmentId: string): Promise<CreditPackage[]> {
    const packages = await tx.lessonPackage.findMany({
      where: { enrollmentId, deletedAt: null },
      select: {
        id: true,
        purchasedAt: true,
        expiresAt: true,
        creditEntries: { select: { delta: true } },
        _count: { select: { charges: { where: { voidedAt: null } } } },
      },
    });
    return packages.map((pkg) => ({
      id: pkg.id,
      purchasedAt: pkg.purchasedAt,
      expiresAt: pkg.expiresAt,
      remaining:
        pkg.creditEntries.reduce((sum, entry) => sum + entry.delta, 0) -
        pkg._count.charges,
    }));
  }

  /**
   * New credits (a sale, a correction, a charge given back) cover the
   * lessons held on debt, oldest first (L-82). Takes the direction's lock.
   */
  async coverDebtsOf(tx: Db, enrollmentId: string): Promise<number> {
    const direction = await tx.enrollment.findUniqueOrThrow({
      where: { id: enrollmentId },
      select: { workspaceId: true },
    });
    await lockEnrollmentBilling(tx, direction.workspaceId, [enrollmentId]);
    const debts = await tx.lessonCharge.findMany({
      where: { enrollmentId, voidedAt: null, source: 'DEBT' },
      select: { id: true, lesson: { select: { startsAtUtc: true } } },
    });
    if (debts.length === 0) return 0;
    const covers = coverDebts(
      debts.map((debt) => ({ id: debt.id, lessonAt: debt.lesson.startsAtUtc })),
      await this.creditPackages(tx, enrollmentId),
    );
    for (const cover of covers) {
      await tx.lessonCharge.update({
        where: { id: cover.chargeId },
        data: { source: 'PACKAGE', packageId: cover.packageId },
      });
    }
    return covers.length;
  }

  /**
   * The pay-per-lesson balance of a direction (L-90): its balance charges in
   * the direction's currency against the payments made without a package.
   */
  async balanceOf(tx: Db, direction: Direction): Promise<BalanceAllocation> {
    const [charges, paid] = await Promise.all([
      tx.lessonCharge.findMany({
        where: {
          enrollmentId: direction.id,
          voidedAt: null,
          source: 'BALANCE',
          currency: direction.currency,
        },
        select: {
          id: true,
          amountMinor: true,
          lesson: { select: { startsAtUtc: true } },
        },
      }),
      tx.payment.aggregate({
        where: {
          enrollmentId: direction.id,
          packageId: null,
          deletedAt: null,
          status: 'PAID',
          currency: direction.currency,
        },
        _sum: { amountMinor: true },
      }),
    ]);
    return allocatePayments(
      charges.map((charge) => ({
        id: charge.id,
        lessonAt: charge.lesson.startsAtUtc,
        amountMinor: charge.amountMinor,
      })),
      paid._sum.amountMinor ?? 0,
    );
  }

  /**
   * A new price for an individual lesson (L-12) reprices its balance charge,
   * unless payments already cover part of it (409 LESSON_PAID). A package
   * lesson costs one credit whatever its price.
   */
  async repriceLesson(
    tx: Db,
    lesson: { id: string; enrollmentId: string | null; groupId: string | null },
    priceMinor: number,
    currency: string,
  ): Promise<void> {
    if (!lesson.enrollmentId || lesson.groupId) return;
    const charge = await tx.lessonCharge.findFirst({
      where: { lessonId: lesson.id, voidedAt: null },
      include: {
        enrollment: {
          select: {
            id: true,
            billingType: true,
            priceMinor: true,
            currency: true,
          },
        },
      },
    });
    if (!charge) return;
    if (charge.source === 'BALANCE') {
      await lockEnrollmentBilling(tx, charge.workspaceId, [
        charge.enrollmentId,
      ]);
      const balance = await this.balanceOf(tx, charge.enrollment);
      const unpaid = balance.unpaid.find((item) => item.id === charge.id);
      const untouched =
        charge.currency !== charge.enrollment.currency ||
        unpaid?.outstandingMinor === charge.amountMinor;
      if (!untouched) throw lessonPaid();
    }
    await tx.lessonCharge.update({
      where: { id: charge.id },
      data: { amountMinor: priceMinor, currency },
    });
  }

  async getEnrollmentBilling(
    auth: AuthenticatedUser,
    enrollmentId: string,
  ): Promise<EnrollmentBillingResponse> {
    const direction = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, workspaceId: auth.workspaceId },
      select: { id: true, billingType: true, priceMinor: true, currency: true },
    });
    if (!direction) throw enrollmentNotFound();
    const [packages, rows, debtLessons, balance] = await Promise.all([
      this.creditPackages(this.prisma, direction.id),
      this.prisma.lessonPackage.findMany({
        where: { enrollmentId: direction.id, deletedAt: null },
        select: { id: true, name: true },
      }),
      this.prisma.lessonCharge.count({
        where: { enrollmentId: direction.id, voidedAt: null, source: 'DEBT' },
      }),
      this.balanceOf(this.prisma, direction),
    ]);
    const names = new Map(rows.map((row) => [row.id, row.name]));
    const now = new Date();
    const items = packages
      .sort(
        (a, b) =>
          a.purchasedAt.getTime() - b.purchasedAt.getTime() ||
          a.id.localeCompare(b.id),
      )
      .map((pkg) => ({
        id: pkg.id,
        name: names.get(pkg.id) ?? null,
        purchasedAt: pkg.purchasedAt.toISOString(),
        expiresAt: pkg.expiresAt?.toISOString() ?? null,
        remainingCredits: pkg.remaining,
        usable: isPackageValidAt(pkg, now),
      }));
    return {
      enrollmentId: direction.id,
      billingType: direction.billingType,
      rateMinor: direction.priceMinor,
      currency: direction.currency as EnrollmentBillingResponse['currency'],
      packages: items,
      creditsLeft: items
        .filter((pkg) => pkg.usable)
        .reduce((sum, pkg) => sum + Math.max(0, pkg.remainingCredits), 0),
      debtLessons,
      balance: {
        chargedMinor: balance.chargedMinor,
        paidMinor: balance.paidMinor,
        debtMinor: balance.debtMinor,
        advanceMinor: balance.advanceMinor,
        unpaidLessons: balance.unpaid.length,
      },
    };
  }
}
