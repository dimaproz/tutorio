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
  // Only settled money is reported as paid; a PENDING online payment is not
  // money in hand yet.
  payments: {
    where: { deletedAt: null, status: 'PAID' },
    select: { amountMinor: true },
  },
} satisfies Prisma.LessonPackageInclude;

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
  const paidMinor = row.payments.reduce(
    (sum, payment) => sum + payment.amountMinor,
    0,
  );
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
    endDate: row.endDate?.toISOString() ?? null,
    pricePerLessonMinorSnapshot: row.pricePerLessonMinorSnapshot,
    totalPriceMinorSnapshot: row.totalPriceMinorSnapshot,
    remainingCredits: creditBalance(row.creditEntries) - used,
    consumedCredits: used,
    paidMinor,
    currency: row.currency as PackageResponse['currency'],
    // The stored status is a cache for filtering; the response always reports
    // the truth derived from money actually received.
    paymentStatus: paymentStatusOf(row.totalPriceMinorSnapshot, paidMinor),
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

export function toPaymentResponse(row: PaymentRow): PaymentResponse {
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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
