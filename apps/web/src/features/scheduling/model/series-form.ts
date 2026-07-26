import {
  timezoneSchema,
  uuidSchema,
  weekdaysSchema,
  type CreateLessonSeriesDto,
  type LessonSeriesResponse,
  type UpdateLessonSeriesDto,
} from '@tutorio/validation';
import { z } from 'zod';
import { localInputToIso, toLocalDateInput } from '@/lib/datetime';
import {
  durationMinString,
  localTimeString,
  priceString,
  requiredDateString,
} from '@/lib/forms/helpers';
import { formatPriceInput, parsePriceInput } from '@/lib/money';

/**
 * A recurring pattern. On create the target is a student (the API resolves the
 * enrollment); on edit only the schedule itself is mutable, so `studentId` is
 * allowed to be blank and is simply not sent.
 */
export const seriesFormSchema = z.object({
  studentId: z.union([z.literal(''), uuidSchema]),
  teacherId: z.union([z.literal(''), uuidSchema]),
  weekdays: weekdaysSchema,
  localTime: localTimeString,
  timezone: timezoneSchema,
  durationMin: durationMinString,
  price: priceString({ required: false }),
  startDate: requiredDateString,
});

export type SeriesFormValues = z.infer<typeof seriesFormSchema>;

export function emptySeriesForm(timezone: string): SeriesFormValues {
  return {
    studentId: '',
    teacherId: '',
    weekdays: [1],
    localTime: '10:00',
    timezone,
    durationMin: '60',
    price: '',
    startDate: toLocalDateInput(new Date()),
  };
}

/** Fills the form from an existing pattern for editing. */
export function seriesToForm(series: LessonSeriesResponse): SeriesFormValues {
  return {
    // Target and teacher are immutable after creation.
    studentId: '',
    teacherId: '',
    weekdays: series.weekdays,
    localTime: series.localTime,
    timezone: series.timezone,
    durationMin: String(series.durationMin),
    price: formatPriceInput(series.priceMinor),
    startDate: toLocalDateInput(new Date(series.startDate)),
  };
}

/** Create payload: the student-first contract, price optional. */
export function buildCreateSeriesDto(
  values: SeriesFormValues,
  context: { teacherId: string; currency?: string | null },
): CreateLessonSeriesDto {
  const priceMinor = parsePriceInput(values.price);
  const hasPrice = priceMinor !== null && Boolean(context.currency);

  return {
    studentId: values.studentId,
    ...(context.teacherId ? { teacherId: context.teacherId } : {}),
    weekdays: values.weekdays,
    localTime: values.localTime,
    timezone: values.timezone,
    durationMin: Number(values.durationMin),
    ...(hasPrice
      ? {
          priceMinor: priceMinor as number,
          currency: context.currency as CreateLessonSeriesDto['currency'],
        }
      : {}),
    startDate: localInputToIso(values.startDate),
  };
}

/** Update payload: schedule fields only, which is all the API accepts. */
export function buildUpdateSeriesDto(
  values: SeriesFormValues,
): UpdateLessonSeriesDto {
  const priceMinor = parsePriceInput(values.price);
  return {
    weekdays: values.weekdays,
    localTime: values.localTime,
    timezone: values.timezone,
    durationMin: Number(values.durationMin),
    ...(priceMinor !== null ? { priceMinor } : {}),
    startDate: localInputToIso(values.startDate),
  };
}
