import { Injectable } from '@nestjs/common';
import { paymentStatusOf } from '@tutorio/domain';
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
  packageNotFound,
} from '../common/business.errors';
import { buildPaginatedResponse, toSkipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import {
  ManualPaymentProvider,
  type PaymentProvider,
} from './payment-provider';
import { paymentInclude, toPaymentResponse } from './packages.shared';

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

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
        ...toSkipTake(query),
        include: paymentInclude,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return buildPaginatedResponse(rows.map(toPaymentResponse), total, query);
  }

  /**
   * Records money received. Writing a payment never touches lesson credits —
   * the two ledgers stay separate. What it does update is how much of a
   * package (or a group member's share) has been settled.
   */
  async record(
    auth: AuthenticatedUser,
    dto: RecordPaymentDto,
  ): Promise<PaymentResponse> {
    const row = await this.prisma.$transaction(async (tx) => {
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
          select: { id: true, currency: true },
        });
        if (!pkg) {
          throw packageNotFound();
        }
        if (pkg.currency !== dto.currency) {
          throw currencyMismatch();
        }
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
          },
        ),
      });

      return created;
    });

    return toPaymentResponse(row);
  }

  /**
   * The single place a *settled* payment moves balances: it credits the
   * member's share of a group package and refreshes the package's cached
   * payment status from the money actually received.
   *
   * Both paths converge here — the tutor recording cash today, and an acquirer
   * webhook flipping a PENDING payment to PAID later — so the accounting can
   * never drift between them.
   */
  private async applyPaidPayment(
    tx: Prisma.TransactionClient,
    payment: {
      packageId: string | null;
      enrollmentId: string;
      amountMinor: number;
    },
  ): Promise<void> {
    const packageId = payment.packageId;
    if (!packageId) {
      return;
    }
    const { enrollmentId, amountMinor } = payment;

    const share = await tx.packageParticipantShare.findUnique({
      where: { packageId_enrollmentId: { packageId, enrollmentId } },
      select: { id: true },
    });
    if (share) {
      await tx.packageParticipantShare.update({
        where: { id: share.id },
        data: { paidMinor: { increment: amountMinor } },
      });
    }

    const [pkg, paid] = await Promise.all([
      tx.lessonPackage.findUniqueOrThrow({
        where: { id: packageId },
        select: { totalPriceMinorSnapshot: true },
      }),
      // Only settled money counts — a PENDING online payment must not make a
      // package look paid before the provider confirms it.
      tx.payment.aggregate({
        where: { packageId, deletedAt: null, status: 'PAID' },
        _sum: { amountMinor: true },
      }),
    ]);

    await tx.lessonPackage.update({
      where: { id: packageId },
      data: {
        paymentStatus: paymentStatusOf(
          pkg.totalPriceMinorSnapshot,
          paid._sum.amountMinor ?? 0,
        ),
      },
    });
  }
}
