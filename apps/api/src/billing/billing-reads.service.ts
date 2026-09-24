import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  allocatePayments,
  creditWarning,
  isPackageValidAt,
  type BalanceAllocation,
} from '@tutorio/domain';
import type {
  CreditWarningListResponse,
  EnrollmentBillingResponse,
  StudentBillingResponse,
} from '@tutorio/validation';
import type { AuthenticatedUser } from '../auth/auth.types';
import { enrollmentNotFound, studentNotFound } from '../common/business.errors';
import { PrismaService } from '../prisma/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

interface Direction {
  id: string;
  billingType: 'PACKAGE' | 'PER_LESSON';
  priceMinor: number;
  currency: string;
}

const directionSelect = {
  id: true,
  billingType: true,
  priceMinor: true,
  currency: true,
} satisfies Prisma.EnrollmentSelect;

interface Balances {
  byDirection: Map<string, BalanceAllocation>;
  /** The lesson each balance charge belongs to. */
  lessonOf: Map<string, string>;
}

/**
 * What directions owe and what pays for them, read in batches for the
 * student profile, the warnings list and lesson lists (product/scheduling.md
 * L-82, L-90; ADR 0007). The charging itself is `BillingService`.
 */
@Injectable()
export class BillingReadsService {
  constructor(private readonly prisma: PrismaService) {}

  async getEnrollmentBilling(
    auth: AuthenticatedUser,
    enrollmentId: string,
  ): Promise<EnrollmentBillingResponse> {
    const direction = await this.prisma.enrollment.findFirst({
      where: { id: enrollmentId, workspaceId: auth.workspaceId },
      select: directionSelect,
    });
    if (!direction) throw enrollmentNotFound();
    const threshold = await this.thresholdOf(auth.workspaceId);
    const billing = await this.billingOf(this.prisma, [direction], threshold);
    return billing.get(direction.id)!;
  }

  /** Every direction of one student with how it is paid, and totals per currency. */
  async getStudentBilling(
    auth: AuthenticatedUser,
    studentId: string,
  ): Promise<StudentBillingResponse> {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, workspaceId: auth.workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!student) throw studentNotFound();
    const [threshold, rows] = await Promise.all([
      this.thresholdOf(auth.workspaceId),
      this.prisma.enrollment.findMany({
        where: { studentId: student.id, deletedAt: null },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          ...directionSelect,
          status: true,
          teacher: { select: { id: true, fullName: true } },
          group: { select: { id: true, name: true } },
        },
      }),
    ]);
    const billing = await this.billingOf(this.prisma, rows, threshold);
    const directions = rows.map((row) => ({
      ...billing.get(row.id)!,
      status: row.status,
      teacher: { id: row.teacher.id, name: row.teacher.fullName },
      group: row.group,
    }));

    const totals = new Map<string, StudentBillingResponse['totals'][number]>();
    for (const direction of directions) {
      const total = totals.get(direction.currency) ?? {
        currency: direction.currency,
        debtMinor: 0,
        advanceMinor: 0,
        unpaidLessons: 0,
        debtLessons: 0,
        creditsLeft: 0,
      };
      total.debtMinor += direction.balance.debtMinor;
      total.advanceMinor += direction.balance.advanceMinor;
      total.unpaidLessons += direction.balance.unpaidLessons;
      total.debtLessons += direction.debtLessons;
      total.creditsLeft += direction.creditsLeft;
      totals.set(direction.currency, total);
    }
    return {
      studentId: student.id,
      lowCreditThreshold: threshold,
      directions,
      totals: [...totals.values()].sort((a, b) =>
        a.currency.localeCompare(b.currency),
      ),
    };
  }

  /**
   * Every live direction paid by packages that shows a credit warning (L-82):
   * lessons on debt first, then no credits, then the fewest left.
   */
  async listCreditWarnings(
    auth: AuthenticatedUser,
  ): Promise<CreditWarningListResponse> {
    const [threshold, rows] = await Promise.all([
      this.thresholdOf(auth.workspaceId),
      this.prisma.enrollment.findMany({
        where: {
          workspaceId: auth.workspaceId,
          deletedAt: null,
          billingType: 'PACKAGE',
          status: { in: ['ACTIVE', 'PAUSED'] },
          student: { deletedAt: null, status: { not: 'ARCHIVED' } },
        },
        select: {
          ...directionSelect,
          student: { select: { id: true, fullName: true } },
          teacher: { select: { id: true, fullName: true } },
          group: { select: { id: true, name: true } },
        },
      }),
    ]);
    const billing = await this.billingOf(this.prisma, rows, threshold);
    const rank = { ON_DEBT: 0, NO_CREDITS: 1, LOW_CREDITS: 2 } as const;
    const items = rows
      .map((row) => ({ row, billing: billing.get(row.id)! }))
      .filter(({ billing }) => billing.warning !== null)
      .map(({ row, billing }) => ({
        enrollmentId: row.id,
        warning: billing.warning!,
        creditsLeft: billing.creditsLeft,
        debtLessons: billing.debtLessons,
        student: row.student,
        teacher: { id: row.teacher.id, name: row.teacher.fullName },
        group: row.group,
      }))
      .sort(
        (a, b) =>
          rank[a.warning] - rank[b.warning] ||
          b.debtLessons - a.debtLessons ||
          a.creditsLeft - b.creditsLeft ||
          a.student.fullName.localeCompare(b.student.fullName),
      );
    return { lowCreditThreshold: threshold, items };
  }

  /**
   * Which of these charges are paid: a package credit is, a lesson on debt is
   * not, a pay-per-lesson charge is once payments reach it (L-90).
   */
  async paidChargeIds(
    db: Db,
    charges: readonly { id: string; enrollmentId: string; source: string }[],
  ): Promise<Set<string>> {
    const paid = new Set(
      charges
        .filter((charge) => charge.source === 'PACKAGE')
        .map((charge) => charge.id),
    );
    const balanceDirections = [
      ...new Set(
        charges
          .filter((charge) => charge.source === 'BALANCE')
          .map((charge) => charge.enrollmentId),
      ),
    ];
    if (balanceDirections.length === 0) return paid;
    const directions = await db.enrollment.findMany({
      where: { id: { in: balanceDirections } },
      select: directionSelect,
    });
    const { byDirection } = await this.balancesOf(db, directions);
    for (const allocation of byDirection.values()) {
      for (const id of allocation.settledIds) paid.add(id);
    }
    return paid;
  }

  /**
   * The lessons of a workspace someone has not paid for yet: held on debt, or
   * a pay-per-lesson charge payments have not reached (L-82, L-90).
   */
  async unpaidLessonIds(db: Db, workspaceId: string): Promise<Set<string>> {
    const [debts, directions] = await Promise.all([
      db.lessonCharge.findMany({
        where: { workspaceId, voidedAt: null, source: 'DEBT' },
        select: { lessonId: true },
      }),
      db.enrollment.findMany({
        where: {
          workspaceId,
          charges: { some: { voidedAt: null, source: 'BALANCE' } },
        },
        select: directionSelect,
      }),
    ]);
    const unpaid = new Set(debts.map((debt) => debt.lessonId));
    const { byDirection, lessonOf } = await this.balancesOf(db, directions);
    for (const allocation of byDirection.values()) {
      for (const charge of allocation.unpaid) {
        const lessonId = lessonOf.get(charge.id);
        if (lessonId) unpaid.add(lessonId);
      }
    }
    return unpaid;
  }

  private async thresholdOf(workspaceId: string): Promise<number> {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { lowCreditThreshold: true },
    });
    return workspace.lowCreditThreshold;
  }

  /** How each direction is paid now, in a fixed number of queries. */
  private async billingOf(
    db: Db,
    directions: readonly Direction[],
    threshold: number,
  ): Promise<Map<string, EnrollmentBillingResponse>> {
    const ids = directions.map((direction) => direction.id);
    const [packages, debts, balances] = await Promise.all([
      db.lessonPackage.findMany({
        where: { enrollmentId: { in: ids }, deletedAt: null },
        orderBy: [{ purchasedAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          enrollmentId: true,
          name: true,
          purchasedAt: true,
          validFrom: true,
          expiresAt: true,
          creditEntries: { select: { delta: true } },
          _count: { select: { charges: { where: { voidedAt: null } } } },
        },
      }),
      db.lessonCharge.groupBy({
        by: ['enrollmentId'],
        where: { enrollmentId: { in: ids }, voidedAt: null, source: 'DEBT' },
        _count: { _all: true },
      }),
      this.balancesOf(db, directions),
    ]);
    const debtLessons = new Map(
      debts.map((row) => [row.enrollmentId, row._count._all]),
    );
    const now = new Date();
    const result = new Map<string, EnrollmentBillingResponse>();
    for (const direction of directions) {
      const items = packages
        .filter((pkg) => pkg.enrollmentId === direction.id)
        .map((pkg) => ({
          id: pkg.id,
          name: pkg.name,
          purchasedAt: pkg.purchasedAt.toISOString(),
          expiresAt: pkg.expiresAt?.toISOString() ?? null,
          remainingCredits:
            pkg.creditEntries.reduce((sum, entry) => sum + entry.delta, 0) -
            pkg._count.charges,
          usable: isPackageValidAt(pkg, now),
        }));
      const creditsLeft = items
        .filter((pkg) => pkg.usable)
        .reduce((sum, pkg) => sum + Math.max(0, pkg.remainingCredits), 0);
      const debt = debtLessons.get(direction.id) ?? 0;
      const balance =
        balances.byDirection.get(direction.id) ?? allocatePayments([], 0);
      result.set(direction.id, {
        enrollmentId: direction.id,
        billingType: direction.billingType,
        rateMinor: direction.priceMinor,
        currency: direction.currency as EnrollmentBillingResponse['currency'],
        packages: items,
        creditsLeft,
        debtLessons: debt,
        balance: {
          chargedMinor: balance.chargedMinor,
          paidMinor: balance.paidMinor,
          debtMinor: balance.debtMinor,
          advanceMinor: balance.advanceMinor,
          unpaidLessons: balance.unpaid.length,
        },
        warning: creditWarning(
          { mode: direction.billingType, creditsLeft, debtLessons: debt },
          threshold,
        ),
      });
    }
    return result;
  }

  /**
   * The pay-per-lesson balances of several directions (L-90), each against
   * the payments made without a package, in the direction's currency.
   */
  private async balancesOf(
    db: Db,
    directions: readonly Direction[],
  ): Promise<Balances> {
    const ids = directions.map((direction) => direction.id);
    if (ids.length === 0)
      return { byDirection: new Map(), lessonOf: new Map() };
    const [charges, payments] = await Promise.all([
      db.lessonCharge.findMany({
        where: { enrollmentId: { in: ids }, voidedAt: null, source: 'BALANCE' },
        select: {
          id: true,
          enrollmentId: true,
          lessonId: true,
          amountMinor: true,
          currency: true,
          lesson: { select: { startsAtUtc: true } },
        },
      }),
      db.payment.groupBy({
        by: ['enrollmentId', 'currency'],
        where: {
          enrollmentId: { in: ids },
          packageId: null,
          deletedAt: null,
          status: 'PAID',
        },
        _sum: { amountMinor: true },
      }),
    ]);
    const byDirection = new Map<string, BalanceAllocation>();
    for (const direction of directions) {
      const paid = payments.find(
        (row) =>
          row.enrollmentId === direction.id &&
          row.currency === direction.currency,
      );
      byDirection.set(
        direction.id,
        allocatePayments(
          charges
            .filter(
              (charge) =>
                charge.enrollmentId === direction.id &&
                charge.currency === direction.currency,
            )
            .map((charge) => ({
              id: charge.id,
              lessonAt: charge.lesson.startsAtUtc,
              amountMinor: charge.amountMinor,
            })),
          paid?._sum.amountMinor ?? 0,
        ),
      );
    }
    return {
      byDirection,
      lessonOf: new Map(charges.map((charge) => [charge.id, charge.lessonId])),
    };
  }
}
