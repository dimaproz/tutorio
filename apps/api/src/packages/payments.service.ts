import { Injectable } from '@nestjs/common';
import {
  assertPaymentWithinOutstanding,
  OverpaymentError,
  settledLessonsByPayment,
} from '@tutorio/domain';
import { Prisma } from '@prisma/client';
import type {
  ListPaymentsQueryDto,
  PaymentListResponse,
  PaymentResponse,
  RecordPaymentDto,
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  currencyMismatch,
  enrollmentNotFound,
  idempotencyConflict,
  invalidPackagePaymentRelation,
  overpayment,
  packageNotFound,
} from '../common/business.errors';
import { buildPaginatedResponse, toSkipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import {
  ManualPaymentProvider,
  type PaymentProvider,
} from './payment-provider';
import {
  paymentInclude,
  refreshPaymentStatus,
  toPaymentResponse,
} from './packages.shared';

@Injectable()
export class PaymentsService {
  // Typed as the interface, not the implementation: adding an online provider
  // later is a swap here, not a rewrite of this service.
  private readonly provider: PaymentProvider = new ManualPaymentProvider();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    auth: AuthenticatedUser,
    query: ListPaymentsQueryDto,
  ): Promise<PaymentListResponse> {
    const where: Prisma.PaymentWhereInput = {
      workspaceId: auth.workspaceId,
      deletedAt: null,
      ...(query.enrollmentId ? { enrollmentId: query.enrollmentId } : {}),
      ...(query.packageId ? { packageId: query.packageId } : {}),
      ...(query.studentId
        ? { enrollment: { studentId: query.studentId } }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
        ...toSkipTake(query),
        include: paymentInclude,
      }),
      this.prisma.payment.count({ where }),
    ]);

    const settled = await this.settledLessonsOf(rows);
    return buildPaginatedResponse(
      rows.map((row) =>
        toPaymentResponse(
          row,
          row.packageId === null && row.status === 'PAID'
            ? (settled.get(row.id) ?? 0)
            : null,
        ),
      ),
      total,
      query,
    );
  }

  /**
   * How many lessons each pay-per-lesson payment of a page settled in full
   * (L-90): each direction's payments, oldest first, against its charged
   * lessons, oldest first, in the direction's currency.
   */
  private async settledLessonsOf(
    rows: readonly {
      id: string;
      enrollmentId: string;
      packageId: string | null;
      status: string;
    }[],
  ): Promise<Map<string, number>> {
    const directionIds = [
      ...new Set(
        rows
          .filter((row) => row.packageId === null && row.status === 'PAID')
          .map((row) => row.enrollmentId),
      ),
    ];
    if (directionIds.length === 0) return new Map();
    const [directions, charges, payments] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { id: { in: directionIds } },
        select: { id: true, currency: true },
      }),
      this.prisma.lessonCharge.findMany({
        where: {
          enrollmentId: { in: directionIds },
          voidedAt: null,
          source: 'BALANCE',
        },
        select: {
          id: true,
          enrollmentId: true,
          amountMinor: true,
          currency: true,
          lesson: { select: { startsAtUtc: true } },
        },
      }),
      this.prisma.payment.findMany({
        where: {
          enrollmentId: { in: directionIds },
          packageId: null,
          deletedAt: null,
          status: 'PAID',
        },
        select: {
          id: true,
          enrollmentId: true,
          amountMinor: true,
          currency: true,
          paidAt: true,
        },
      }),
    ]);
    const settled = new Map<string, number>();
    for (const direction of directions) {
      const byDirection = settledLessonsByPayment(
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
        payments.filter(
          (payment) =>
            payment.enrollmentId === direction.id &&
            payment.currency === direction.currency,
        ),
      );
      for (const [id, count] of byDirection) settled.set(id, count);
    }
    return settled;
  }

  /**
   * Records money received for a direction: towards a package (capped at what
   * it still costs), or on its pay-per-lesson balance, where it settles the
   * oldest lessons first (L-90) and may run ahead of them. Money never moves
   * lesson credits.
   */
  async record(
    auth: AuthenticatedUser,
    dto: RecordPaymentDto,
  ): Promise<PaymentResponse> {
    try {
      const row = await this.prisma.$transaction(
        async (tx) => {
          if (dto.idempotencyKey) {
            const existing = await tx.payment.findFirst({
              where: {
                workspaceId: auth.workspaceId,
                idempotencyKey: dto.idempotencyKey,
              },
              include: paymentInclude,
            });
            if (existing) {
              if (!this.matchesPaymentCommand(existing, dto)) {
                throw idempotencyConflict();
              }
              return existing;
            }
          }

          const enrollment = await tx.enrollment.findFirst({
            where: {
              id: dto.enrollmentId,
              workspaceId: auth.workspaceId,
              deletedAt: null,
            },
            select: { id: true, currency: true },
          });
          if (!enrollment) {
            throw enrollmentNotFound();
          }

          if (dto.packageId) {
            const pkg = await tx.lessonPackage.findFirst({
              where: {
                id: dto.packageId,
                workspaceId: auth.workspaceId,
                deletedAt: null,
              },
              select: {
                id: true,
                enrollmentId: true,
                currency: true,
                totalPriceMinorSnapshot: true,
              },
            });
            if (!pkg) {
              throw packageNotFound();
            }
            if (pkg.currency !== dto.currency) {
              throw currencyMismatch();
            }
            // A package is paid by the direction it belongs to.
            if (pkg.enrollmentId !== enrollment.id) {
              throw invalidPackagePaymentRelation();
            }
            const paid = await tx.payment.aggregate({
              where: { packageId: pkg.id, deletedAt: null, status: 'PAID' },
              _sum: { amountMinor: true },
            });
            try {
              assertPaymentWithinOutstanding(
                pkg.totalPriceMinorSnapshot,
                paid._sum.amountMinor ?? 0,
                dto.amountMinor,
              );
            } catch (error) {
              if (error instanceof OverpaymentError) {
                throw overpayment();
              }
              throw error;
            }
          } else if (enrollment.currency !== dto.currency) {
            throw currencyMismatch();
          }

          const settlement = await this.provider.settle({
            workspaceId: auth.workspaceId,
            enrollmentId: enrollment.id,
            amountMinor: dto.amountMinor,
            currency: dto.currency,
          });

          const created = await tx.payment.create({
            data: {
              workspaceId: auth.workspaceId,
              enrollmentId: enrollment.id,
              packageId: dto.packageId ?? null,
              amountMinor: dto.amountMinor,
              currency: dto.currency,
              method: dto.method,
              // A manual entry is money already in hand; an acquirer would leave
              // this PENDING until its webhook confirms.
              status: settlement.settled ? 'PAID' : 'PENDING',
              provider: this.provider.kind,
              externalId: settlement.externalId ?? null,
              idempotencyKey: dto.idempotencyKey ?? null,
              paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
              note: dto.note ?? null,
              createdById: auth.userId,
            },
            include: paymentInclude,
          });

          // Only settled money moves a balance — the single point both the manual
          // and the future online path go through.
          if (settlement.settled) {
            await this.applyPaidPayment(tx, created);
          }

          await this.audit.record(tx, {
            workspaceId: auth.workspaceId,
            actorId: auth.userId,
            action: 'CREATE',
            entity: 'PAYMENT',
            entityId: created.id,
            changes: this.audit.buildChanges(
              {},
              {
                enrollmentId: enrollment.id,
                packageId: dto.packageId ?? null,
                amountMinor: dto.amountMinor,
                currency: dto.currency,
                // The log reads «Переказ 3 200 ₴», «Готівка …» (S10).
                method: dto.method,
              },
            ),
          });

          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return toPaymentResponse(row);
    } catch (error) {
      // The unique database key closes the race between two simultaneous
      // retries. Return the original event once its winning transaction commits.
      if (
        dto.idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.payment.findFirst({
          where: {
            workspaceId: auth.workspaceId,
            idempotencyKey: dto.idempotencyKey,
          },
          include: paymentInclude,
        });
        if (existing) {
          if (!this.matchesPaymentCommand(existing, dto)) {
            throw idempotencyConflict();
          }
          return toPaymentResponse(existing);
        }
      }
      throw error;
    }
  }

  private matchesPaymentCommand(
    payment: {
      enrollmentId: string;
      packageId: string | null;
      amountMinor: number;
      currency: string;
      method: string;
    },
    dto: RecordPaymentDto,
  ): boolean {
    return (
      payment.enrollmentId === dto.enrollmentId &&
      payment.packageId === (dto.packageId ?? null) &&
      payment.amountMinor === dto.amountMinor &&
      payment.currency === dto.currency &&
      payment.method === dto.method
    );
  }

  /**
   * The single place a *settled* payment moves a package's cached payment
   * status. Both paths converge here — the tutor recording cash today, and an
   * acquirer webhook flipping a PENDING payment to PAID later — so the
   * accounting can never drift between them. A balance payment needs no
   * write: the balance is derived from payments and charges.
   */
  private async applyPaidPayment(
    tx: Prisma.TransactionClient,
    payment: { packageId: string | null },
  ): Promise<void> {
    if (payment.packageId) {
      await refreshPaymentStatus(tx, payment.packageId);
    }
  }
}
