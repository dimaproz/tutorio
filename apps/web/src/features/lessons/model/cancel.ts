import { cancellationTiming, hoursUntil, suggestedCancellationStatus } from '@tutorio/domain';
import {
  notesSchema,
  type LessonDetailResponse,
  type TransitionLessonDto,
} from '@tutorio/validation';
import { z } from 'zod';
import { optionalText } from '@/lib/forms/helpers';

/** Who can call a lesson off: a student or the teacher; for a group, the group or the teacher. */
export type CancelAuthor = 'STUDENT' | 'TEACHER' | 'GROUP';

export const cancelFormSchema = z.object({
  cancelledBy: z.enum(['STUDENT', 'TEACHER', 'GROUP']),
  charge: z.enum(['charge', 'free']),
  reason: optionalText(notesSchema),
});

export type CancelFormValues = z.infer<typeof cancelFormSchema>;

/** Why the dialog suggests what it suggests (L-51). */
export type CancelAdvice =
  | { kind: 'late'; hoursLeft: number; deadlineHours: number }
  | { kind: 'onTime'; hoursLeft: number; deadlineHours: number }
  | { kind: 'started' }
  | { kind: 'teacher' }
  | { kind: 'group' };

/**
 * The suggestion for charging (L-51): a student cancelling later than the
 * deadline is charged; earlier, or a teacher or the group cancelling, is free.
 * The tutor can still switch it.
 */
export function cancelAdvice(
  lesson: Pick<LessonDetailResponse, 'startsAtUtc' | 'cancellationDeadlineHours'>,
  by: CancelAuthor,
  now: number,
): { advice: CancelAdvice; charge: CancelFormValues['charge'] } {
  if (by === 'TEACHER') return { advice: { kind: 'teacher' }, charge: 'free' };
  if (by === 'GROUP') return { advice: { kind: 'group' }, charge: 'free' };
  const start = new Date(lesson.startsAtUtc);
  const timing = cancellationTiming(start, new Date(now), lesson.cancellationDeadlineHours);
  const status = suggestedCancellationStatus(timing, by);
  const hoursLeft = hoursUntil(start, new Date(now));
  const deadlineHours = lesson.cancellationDeadlineHours;
  return {
    advice:
      hoursLeft < 0
        ? { kind: 'started' }
        : timing === 'late'
          ? { kind: 'late', hoursLeft, deadlineHours }
          : { kind: 'onTime', hoursLeft, deadlineHours },
    charge: status === 'CANCELLED_CHARGED' ? 'charge' : 'free',
  };
}

export function cancelFormDefaults(
  lesson: Pick<LessonDetailResponse, 'startsAtUtc' | 'cancellationDeadlineHours' | 'groupId'>,
  now: number,
): CancelFormValues {
  const cancelledBy: CancelAuthor = lesson.groupId ? 'GROUP' : 'STUDENT';
  return { cancelledBy, charge: cancelAdvice(lesson, cancelledBy, now).charge, reason: '' };
}

export function cancelDto(values: CancelFormValues): TransitionLessonDto {
  return {
    targetStatus: values.charge === 'charge' ? 'CANCELLED_CHARGED' : 'CANCELLED_UNCHARGED',
    cancelledBy: values.cancelledBy,
    cancelledReason: values.reason.trim() || null,
  };
}
