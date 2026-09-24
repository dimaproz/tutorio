import { makeupIsFree } from '@tutorio/domain';
import {
  lessonTopicSchema,
  type CreateMakeupDto,
  type LessonDetailResponse,
} from '@tutorio/validation';
import { addDays } from 'date-fns';
import { z } from 'zod';
import {
  durationMinString,
  localTimeString,
  optionalText,
  requiredDateString,
} from '@/lib/forms/helpers';
import { localInputToIso, splitDateTimeInput, toLocalDateTimeInput } from '@/lib/datetime';

/** A makeup (L-60): when, optionally another teacher and length, and a topic. */
export const makeupFormSchema = z.object({
  date: requiredDateString,
  time: localTimeString,
  durationMin: durationMinString,
  teacherId: z.string().uuid(),
  topic: optionalText(lessonTopicSchema),
});

export type MakeupFormValues = z.infer<typeof makeupFormSchema>;

/**
 * Starts from the original: its teacher, length and topic, at the same time
 * of day on the first day after today (a makeup is booked ahead).
 */
export function makeupFormDefaults(
  original: Pick<LessonDetailResponse, 'startsAtUtc' | 'durationMin' | 'teacherId' | 'topic'>,
  now: number,
): MakeupFormValues {
  const { time } = splitDateTimeInput(toLocalDateTimeInput(new Date(original.startsAtUtc)));
  const { date } = splitDateTimeInput(toLocalDateTimeInput(addDays(new Date(now), 1)));
  return {
    date,
    time,
    durationMin: String(original.durationMin),
    teacherId: original.teacherId,
    topic: original.topic ?? '',
  };
}

/** Sends only what differs from the original: the API takes its teacher and length otherwise. */
export function makeupDto(
  values: MakeupFormValues,
  original: Pick<LessonDetailResponse, 'durationMin' | 'teacherId'>,
): CreateMakeupDto {
  const durationMin = Number(values.durationMin);
  return {
    startsAtUtc: localInputToIso(`${values.date}T${values.time}`),
    ...(durationMin !== original.durationMin ? { durationMin } : {}),
    ...(values.teacherId !== original.teacherId ? { teacherId: values.teacherId } : {}),
    topic: values.topic.trim() || null,
  };
}

/** Exactly one of a lesson and its makeup is charged (L-61). */
export function makeupWillBeFree(original: Pick<LessonDetailResponse, 'status'>): boolean {
  return makeupIsFree(original.status);
}
