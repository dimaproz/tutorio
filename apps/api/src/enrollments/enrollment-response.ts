import type { Prisma } from '@prisma/client';
import type { EnrollmentResponse } from '@tutorio/validation';

// Row shape behind every enrollment response, including the student
// profile's enrollment list.
export const enrollmentInclude = {
  student: { select: { id: true, fullName: true } },
  group: { select: { id: true, name: true } },
  teacher: { select: { id: true, fullName: true, color: true } },
} satisfies Prisma.EnrollmentInclude;

export type EnrollmentRow = Prisma.EnrollmentGetPayload<{
  include: typeof enrollmentInclude;
}>;

export function toEnrollmentResponse(
  row: EnrollmentRow,
  workspaceDefaultDeadlineHours: number,
): EnrollmentResponse {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    studentId: row.studentId,
    groupId: row.groupId,
    teacherId: row.teacherId,
    student: row.student,
    group: row.group,
    teacher: {
      id: row.teacher.id,
      name: row.teacher.fullName,
      color: row.teacher.color,
    },
    status: row.status,
    billingType: row.billingType,
    priceMinor: row.priceMinor,
    currency: row.currency as EnrollmentResponse['currency'],
    cancellationDeadlineHours: row.cancellationDeadlineHours,
    effectiveCancellationDeadlineHours:
      row.cancellationDeadlineHours ?? workspaceDefaultDeadlineHours,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}
