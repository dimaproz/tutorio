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

// The same row plus the workspace default deadline, so a mutation can answer
// without a separate workspace query.
export const enrollmentWithDeadlineInclude = {
  ...enrollmentInclude,
  workspace: { select: { cancellationDeadlineHours: true } },
} satisfies Prisma.EnrollmentInclude;

export type EnrollmentWithDeadlineRow = Prisma.EnrollmentGetPayload<{
  include: typeof enrollmentWithDeadlineInclude;
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
    student: { id: row.student.id, fullName: row.student.fullName },
    group: row.group ? { id: row.group.id, name: row.group.name } : null,
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
