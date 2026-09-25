import { makeupIsFree } from '@tutorio/domain';
import {
  lessonTopicSchema,
  type CreateMakeupDto,
  type LessonDetailResponse,
} from '@tutorio/validation';
import { z } from 'zod';
import { optionalText } from '@/lib/forms/helpers';
import { lessonDateString, lessonDurationString, lessonTimeString } from './fields';
import { addCalendarDays, zonedDate, zonedIso, zonedTime } from '@/lib/datetime';

/** A makeup (L-60): when, optionally another teacher and length, and a topic. */
export const makeupFormSchema = z.object({
  date: lessonDateString,
  time: lessonTimeString,
  durationMin: lessonDurationString,
  teacherId: z.string().uuid(),
  topic: optionalText(lessonTopicSchema),
});

export type MakeupFormValues = z.infer<typeof makeupFormSchema>;

/**
 * Starts from the original: its teacher, length and topic, at the same time
 * of day on the first day after today (a makeup is booked ahead), on the
 * studio's clock.
 */
export function makeupFormDefaults(
  original: Pick<LessonDetailResponse, 'startsAtUtc' | 'durationMin' | 'teacherId' | 'topic'>,
  now: number,
  timeZone: string,
): MakeupFormValues {
  return {
    date: addCalendarDays(zonedDate(now, timeZone), 1),
    time: zonedTime(original.startsAtUtc, timeZone),
    durationMin: String(original.durationMin),
    teacherId: original.teacherId,
    topic: original.topic ?? '',
  };
}

/** Sends only what differs from the original: the API takes its teacher and length otherwise. */
export function makeupDto(
  values: MakeupFormValues,
  original: Pick<LessonDetailResponse, 'durationMin' | 'teacherId'>,
  timeZone: string,
): CreateMakeupDto {
  const durationMin = Number(values.durationMin);
  return {
    startsAtUtc: zonedIso(values.date, values.time, timeZone),
    ...(durationMin !== original.durationMin ? { durationMin } : {}),
    ...(values.teacherId !== original.teacherId ? { teacherId: values.teacherId } : {}),
    topic: values.topic.trim() || null,
  };
}

/** Exactly one of a lesson and its makeup is charged (L-61). */
export function makeupWillBeFree(original: Pick<LessonDetailResponse, 'status'>): boolean {
  return makeupIsFree(original.status);
}
