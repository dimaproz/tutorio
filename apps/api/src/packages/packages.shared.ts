import {
  consumedCredits,
  creditBalance,
  effectiveTotalMinor,
  paymentStatusOf,
} from '@tutorio/domain';
import { Prisma } from '@prisma/client';
import type {
  CreditEntryResponse,
  PackageResponse,
  PaymentResponse,
} from '@tutorio/validation';

export const packageInclude = {
  student: { select: { id: true, fullName: true } },
  group: { select: { id: true, name: true } },
  creditEntries: {
    select: {
      id: true,
      packageId: true,
      enrollmentId: true,
      lessonId: true,
      delta: true,
      type: true,
      note: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  },
  shares: {
    include: {
      enrollment: {
        select: { student: { select: { id: true, fullName: true } } },
      },
    },
  },
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

export function toCreditEntryResponse(
  row: PackageRow['creditEntries'][number],
): CreditEntryResponse {
  return {
    id: row.id,
    packageId: row.packageId,
    enrollmentId: row.enrollmentId,
    lessonId: row.lessonId,
    delta: row.delta,
    type: row.type,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Builds the read model. Balances, the effective total and every payment
 * status are **derived from the ledger and the payments**, never read from a
 * stored counter — that is what lets the UI explain any number it shows.
 */
export function toPackageResponse(row: PackageRow): PackageResponse {
  const entries = row.creditEntries.map((entry) => ({
    delta: entry.delta,
    type: entry.type,
  }));

  const unchargedCancellations = row.creditEntries.filter(
    (entry) =>
      entry.type === 'teacher_cancellation_refund' && entry.delta === 0,
  ).length;

  const paidMinor = row.payments.reduce(
    (sum, payment) => sum + payment.amountMinor,
    0,
  );

  const effectiveTotal = effectiveTotalMinor(
    row.totalPriceMinorSnapshot,
    row.pricePerLessonMinorSnapshot,
    unchargedCancellations,
  );

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    studentId: row.studentId,
    groupId: row.groupId,
    name: row.name,
    sizingMode: row.sizingMode,
    lessonsTotal: row.lessonsTotal,
    endDate: row.endDate?.toISOString() ?? null,
    pricePerLessonMinorSnapshot: row.pricePerLessonMinorSnapshot,
    totalPriceMinorSnapshot: row.totalPriceMinorSnapshot,
    effectiveTotalMinor: effectiveTotal,
    remainingCredits: creditBalance(entries),
    consumedCredits: consumedCredits(entries),
    paidMinor,
    currency: row.currency as PackageResponse['currency'],
    // The stored status is a cache for filtering; the response always reports
    // the truth derived from money actually received.
    paymentStatus: paymentStatusOf(effectiveTotal, paidMinor),
    purchasedAt: row.purchasedAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    notes: row.notes,
    student: row.student,
    group: row.group,
    shares: row.shares.map((share) => ({
      id: share.id,
      enrollmentId: share.enrollmentId,
      student: share.enrollment.student,
      oweMinor: share.oweMinor,
      paidMinor: share.paidMinor,
      paymentStatus: paymentStatusOf(share.oweMinor, share.paidMinor),
    })),
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
