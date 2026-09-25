import { creditBalance, paymentStatusOf } from '@tutorio/domain';
import { Prisma } from '@prisma/client';
import type { PackageResponse, PaymentResponse } from '@tutorio/validation';

export const packageInclude = {
  student: { select: { id: true, fullName: true } },
  enrollment: {
    select: { groupId: true, group: { select: { id: true, name: true } } },
  },
  creditEntries: { select: { delta: true, type: true } },
  // The lessons it pays for: one credit each (ADR 0007).
  _count: { select: { charges: { where: { voidedAt: null } } } },
  // Settled money in, and money given back by a refund (L-85); a PENDING
  // online payment is not money in hand yet.
  payments: {
    where: { deletedAt: null, status: { in: ['PAID', 'REFUNDED'] } },
    select: { amountMinor: true, status: true },
  },
} satisfies Prisma.LessonPackageInclude;

type MoneyRow = { amountMinor: number; status: string };

/**
 * A package's money: paid is what came in minus what was refunded; the
 * status compares it with the price minus the refunds, so a refund of unused
 * credits leaves a paid-up package paid.
 */
export function packageMoney(
  totalMinor: number,
  payments: readonly MoneyRow[],
) {
  const sum = (status: string) =>
    payments
      .filter((payment) => payment.status === status)
      .reduce((total, payment) => total + payment.amountMinor, 0);
  const refundedMinor = sum('REFUNDED');
  const paidMinor = sum('PAID') - refundedMinor;
  return {
    paidMinor,
    refundedMinor,
    paymentStatus: paymentStatusOf(totalMinor - refundedMinor, paidMinor),
  };
}

/** Refreshes a package's cached payment status (for filtering) from its money. */
export async function refreshPaymentStatus(
  tx: Prisma.TransactionClient,
  packageId: string,
): Promise<void> {
  const pkg = await tx.lessonPackage.findUniqueOrThrow({
    where: { id: packageId },
    select: {
      totalPriceMinorSnapshot: true,
      payments: packageInclude.payments,
    },
  });
  await tx.lessonPackage.update({
    where: { id: packageId },
    data: {
      paymentStatus: packageMoney(pkg.totalPriceMinorSnapshot, pkg.payments)
        .paymentStatus,
    },
  });
}

export type PackageRow = Prisma.LessonPackageGetPayload<{
  include: typeof packageInclude;
}>;

export const paymentInclude = {
  enrollment: {
    select: { student: { select: { id: true, fullName: true } } },
  },
} satisfies Prisma.PaymentInclude;

export type PaymentRow = Prisma.PaymentGetPayload<{
  include: typeof paymentInclude;
}>;

/**
 * Builds the read model. Credits are the granted entries minus the lessons the
 * package pays for; money is the purchase snapshot against payments. The two
 * never alter each other.
 */
export function toPackageResponse(row: PackageRow): PackageResponse {
  const money = packageMoney(row.totalPriceMinorSnapshot, row.payments);
  const used = row._count.charges;

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    enrollmentId: row.enrollmentId,
    studentId: row.studentId,
    groupId: row.enrollment.groupId,
    name: row.name,
    sizingMode: row.sizingMode,
    lessonsTotal: row.lessonsTotal,
    lessonsPerWeek: row.lessonsPerWeek,
    validFrom: row.validFrom?.toISOString() ?? null,
    transferredFromPackageId: row.transferredFromPackageId,
    endDate: row.endDate?.toISOString() ?? null,
    pricePerLessonMinorSnapshot: row.pricePerLessonMinorSnapshot,
    totalPriceMinorSnapshot: row.totalPriceMinorSnapshot,
    remainingCredits: creditBalance(row.creditEntries) - used,
    consumedCredits: used,
    paidMinor: money.paidMinor,
    refundedMinor: money.refundedMinor,
    currency: row.currency as PackageResponse['currency'],
    // The stored status is a cache for filtering; the response always reports
    // the truth derived from money actually received.
    paymentStatus: money.paymentStatus,
    purchasedAt: row.purchasedAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    notes: row.notes,
    student: row.student,
    group: row.enrollment.group,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

export function toPaymentResponse(
  row: PaymentRow,
  settledLessons: number | null = null,
): PaymentResponse {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    enrollmentId: row.enrollmentId,
    packageId: row.packageId,
    amountMinor: row.amountMinor,
    currency: row.currency as PaymentResponse['currency'],
    method: row.method,
    status: row.status,
    provider: row.provider,
    externalId: row.externalId,
    paidAt: row.paidAt.toISOString(),
    note: row.note,
    student: row.enrollment.student,
    settledLessons,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
