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
    super({ statusCode: status, code, message, ...(details ? { details } : {}) }, status);
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
export const scheduleConflict = (conflictIds: string[]) =>
  new BusinessApiException(
    'SCHEDULE_CONFLICT',
    'The teacher already has a lesson overlapping this time',
    HttpStatus.CONFLICT,
    { conflictIds },
  );

export const invalidLessonTransition = () =>
  new BusinessApiException(
    'INVALID_LESSON_TRANSITION',
    'This lesson status change is not allowed',
    HttpStatus.CONFLICT,
  );

export const unexpected = () =>
  new BusinessApiException(
    'UNEXPECTED',
    'Unexpected server error',
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
