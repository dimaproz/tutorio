import { HttpException, HttpStatus } from '@nestjs/common';
import type { BusinessErrorCode } from '@tutorio/validation';

// Stable machine-readable error contract for Stage 2 business endpoints,
// mirroring AuthApiException. Cross-workspace lookups must throw the same
// *_NOT_FOUND error as truly missing records — never reveal existence.
export class BusinessApiException extends HttpException {
  constructor(
    readonly code: BusinessErrorCode,
    message: string,
    status: HttpStatus,
    details?: Record<string, unknown>,
  ) {
    super(
      { statusCode: status, code, message, ...(details ? { details } : {}) },
      status,
    );
  }
}

export const studentNotFound = () =>
  new BusinessApiException(
    'STUDENT_NOT_FOUND',
    'Student not found',
    HttpStatus.NOT_FOUND,
  );

export const parentNotFound = () =>
  new BusinessApiException(
    'PARENT_NOT_FOUND',
    'Parent not found',
    HttpStatus.NOT_FOUND,
  );

export const groupNotFound = () =>
  new BusinessApiException(
    'GROUP_NOT_FOUND',
    'Group not found',
    HttpStatus.NOT_FOUND,
  );

export const enrollmentNotFound = () =>
  new BusinessApiException(
    'ENROLLMENT_NOT_FOUND',
    'Enrollment not found',
    HttpStatus.NOT_FOUND,
  );

export const teacherNotFound = () =>
  new BusinessApiException(
    'TEACHER_NOT_FOUND',
    'Teacher not found',
    HttpStatus.NOT_FOUND,
  );

// A SOLO workspace shows no teacher controls, so it must stay single-teacher:
// raised both when adding a second teacher and when switching back to SOLO.
export const soloModeSingleTeacher = () =>
  new BusinessApiException(
    'SOLO_MODE_SINGLE_TEACHER',
    'Solo workspaces support a single teacher',
    HttpStatus.CONFLICT,
  );

export const workspaceMemberNotFound = () =>
  new BusinessApiException(
    'WORKSPACE_MEMBER_NOT_FOUND',
    'Workspace member not found',
    HttpStatus.NOT_FOUND,
  );

export const activeEnrollmentsExist = () =>
  new BusinessApiException(
    'ACTIVE_ENROLLMENTS_EXIST',
    'Record has active or paused enrollments; archive them first',
    HttpStatus.CONFLICT,
  );

export const studentHasBusinessHistory = (
  dependencies: Record<string, number>,
) =>
  new BusinessApiException(
    'STUDENT_HAS_BUSINESS_HISTORY',
    'Student cannot be permanently deleted because business history exists',
    HttpStatus.CONFLICT,
    { dependencies },
  );

export const studentArchivedRequiresRestore = () =>
  new BusinessApiException(
    'STUDENT_ARCHIVED_REQUIRES_RESTORE',
    'Restore the archived student before updating it',
    HttpStatus.CONFLICT,
  );

export const groupLegacyRepairRequired = () =>
  new BusinessApiException(
    'GROUP_LEGACY_REPAIR_REQUIRED',
    'This group was deleted by the legacy destructive lifecycle and requires manual repair before it can be restored',
    HttpStatus.CONFLICT,
  );

// A recurring schedule is taught by someone: a group needs a teacher first.
export const groupTeacherRequired = () =>
  new BusinessApiException(
    'GROUP_TEACHER_REQUIRED',
    'The group needs a teacher before it can have a schedule',
    HttpStatus.BAD_REQUEST,
  );

// The group form only creates a first schedule. Changing an existing one
// rebuilds booked lessons, so it goes through the recurring-pattern screen.
export const groupScheduleExists = () =>
  new BusinessApiException(
    'GROUP_SCHEDULE_EXISTS',
    'The group already has a schedule; change it on the recurring patterns screen',
    HttpStatus.CONFLICT,
  );

// Attendance is marked for a lesson that has started and was not cancelled.
export const attendanceNotMarkable = () =>
  new BusinessApiException(
    'ATTENDANCE_NOT_MARKABLE',
    'Attendance can be marked only for a lesson that started and was not cancelled',
    HttpStatus.CONFLICT,
  );

export const duplicateEnrollment = () =>
  new BusinessApiException(
    'DUPLICATE_ENROLLMENT',
    'An equivalent enrollment already exists',
    HttpStatus.CONFLICT,
  );

export const invalidWorkspaceRelation = () =>
  new BusinessApiException(
    'INVALID_WORKSPACE_RELATION',
    'Related record does not belong to the workspace',
    HttpStatus.NOT_FOUND,
  );

export const invalidMoneyAmount = () =>
  new BusinessApiException(
    'INVALID_MONEY_AMOUNT',
    'Money amount is invalid',
    HttpStatus.BAD_REQUEST,
  );

export const lessonNotFound = () =>
  new BusinessApiException(
    'LESSON_NOT_FOUND',
    'Lesson not found',
    HttpStatus.NOT_FOUND,
  );

export const lessonSeriesNotFound = () =>
  new BusinessApiException(
    'LESSON_SERIES_NOT_FOUND',
    'Lesson series not found',
    HttpStatus.NOT_FOUND,
  );

// 409 with the conflicting lesson ids in `details` — the web app offers a
// "book anyway" retry with ?force=true.
export const scheduleConflict = (
  conflictIds: string[],
  conflicts?: readonly unknown[],
) =>
  new BusinessApiException(
    'SCHEDULE_CONFLICT',
    'The teacher already has a lesson overlapping this time',
    HttpStatus.CONFLICT,
    { conflictIds, ...(conflicts ? { conflicts } : {}) },
  );

export const invalidLessonTransition = () =>
  new BusinessApiException(
    'INVALID_LESSON_TRANSITION',
    'This lesson status change is not allowed',
    HttpStatus.CONFLICT,
  );

// A lesson that has ended cannot go back to "scheduled": it is corrected by
// moving between final statuses instead (product/scheduling.md L-53).
export const lessonEnded = () =>
  new BusinessApiException(
    'LESSON_ENDED',
    'A lesson that has ended cannot be scheduled again; change its status instead',
    HttpStatus.CONFLICT,
  );

// Group lessons record an absence through attendance (L-52).
export const noShowIndividualOnly = () =>
  new BusinessApiException(
    'NO_SHOW_INDIVIDUAL_ONLY',
    'Only an individual lesson can be marked as a no-show',
    HttpStatus.BAD_REQUEST,
  );

// A makeup replaces a cancelled or no-show individual lesson (L-60).
export const makeupNotAllowed = () =>
  new BusinessApiException(
    'MAKEUP_NOT_ALLOWED',
    'A makeup can replace only a cancelled or no-show individual lesson',
    HttpStatus.CONFLICT,
  );

// One active schedule per direction (product/scheduling.md L-20); the
// existing one is changed instead. `details.scheduleId` names it.
export const scheduleExists = (scheduleId: string) =>
  new BusinessApiException(
    'SCHEDULE_EXISTS',
    'This student already has a schedule with this teacher; change it instead',
    HttpStatus.CONFLICT,
    { scheduleId },
  );

export const scheduleNotFound = () =>
  new BusinessApiException(
    'SCHEDULE_NOT_FOUND',
    'Schedule not found',
    HttpStatus.NOT_FOUND,
  );

export const scheduleEnded = () =>
  new BusinessApiException(
    'SCHEDULE_ENDED',
    'This schedule has ended; create a new one instead',
    HttpStatus.CONFLICT,
  );

export const makeupExists = () =>
  new BusinessApiException(
    'MAKEUP_EXISTS',
    'This lesson already has a makeup',
    HttpStatus.CONFLICT,
  );

export const lessonCharged = (charges: number) =>
  new BusinessApiException(
    'LESSON_CHARGED',
    'This lesson is charged; cancel it free or return it to scheduled before deleting it',
    HttpStatus.CONFLICT,
    { charges },
  );

// Payments already cover this pay-per-lesson lesson (L-12).
export const lessonPaid = () =>
  new BusinessApiException(
    'LESSON_PAID',
    'Payments already cover this lesson; its price can no longer change',
    HttpStatus.CONFLICT,
  );

export const lessonTransitionReplayConflict = () =>
  new BusinessApiException(
    'LESSON_TRANSITION_REPLAY_CONFLICT',
    'This transition was already recorded with different cancellation details',
    HttpStatus.CONFLICT,
  );

export const packageNotFound = () =>
  new BusinessApiException(
    'PACKAGE_NOT_FOUND',
    'Lesson package not found',
    HttpStatus.NOT_FOUND,
  );

export const paymentNotFound = () =>
  new BusinessApiException(
    'PAYMENT_NOT_FOUND',
    'Payment not found',
    HttpStatus.NOT_FOUND,
  );

export const invalidPackagePlan = (message: string) =>
  new BusinessApiException(
    'INVALID_PACKAGE_PLAN',
    message,
    HttpStatus.BAD_REQUEST,
  );

// Money is never summed or compared across currencies.
export const currencyMismatch = () =>
  new BusinessApiException(
    'CURRENCY_MISMATCH',
    'The currency does not match the target record',
    HttpStatus.CONFLICT,
  );

export const invalidPackagePaymentRelation = () =>
  new BusinessApiException(
    'INVALID_PACKAGE_PAYMENT_RELATION',
    'The enrollment does not belong to the package target',
    HttpStatus.CONFLICT,
  );

// L-85: a transfer or refund takes more credits than the package has left.
export const notEnoughCredits = (remaining: number) =>
  new BusinessApiException(
    'NOT_ENOUGH_CREDITS',
    'The package does not have that many unused credits',
    HttpStatus.CONFLICT,
    { remaining },
  );

// L-85: a refund returns more money than the package received.
export const refundTooLarge = (paidMinor: number) =>
  new BusinessApiException(
    'REFUND_TOO_LARGE',
    'A refund cannot return more than the package received',
    HttpStatus.CONFLICT,
    { paidMinor },
  );

// L-85: credits move only to another direction of the same student.
export const invalidTransferTarget = () =>
  new BusinessApiException(
    'INVALID_TRANSFER_TARGET',
    'Credits move only to another direction of the same student',
    HttpStatus.CONFLICT,
  );

export const pauseNotFound = () =>
  new BusinessApiException(
    'PAUSE_NOT_FOUND',
    'Pause not found',
    HttpStatus.NOT_FOUND,
  );

// L-100: one pause at a time for the same lessons.
export const pauseOverlap = () =>
  new BusinessApiException(
    'PAUSE_OVERLAP',
    'The student already has a pause covering this time',
    HttpStatus.CONFLICT,
  );

export const pauseEnded = () =>
  new BusinessApiException(
    'PAUSE_ENDED',
    'The pause is already over',
    HttpStatus.CONFLICT,
  );

// A running pause keeps its start and direction; only its end and reason
// change.
export const pauseRunning = () =>
  new BusinessApiException(
    'PAUSE_RUNNING',
    'The pause has begun: only its end and reason can change',
    HttpStatus.CONFLICT,
  );

export const overpayment = () =>
  new BusinessApiException(
    'OVERPAYMENT',
    'The payment exceeds the outstanding balance',
    HttpStatus.CONFLICT,
  );

export const idempotencyConflict = () =>
  new BusinessApiException(
    'IDEMPOTENCY_CONFLICT',
    'The idempotency key was already used for a different payment command',
    HttpStatus.CONFLICT,
  );

export const unexpected = () =>
  new BusinessApiException(
    'UNEXPECTED',
    'Unexpected server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
