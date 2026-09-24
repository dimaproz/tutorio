import {
  lessonTopicSchema,
  notesSchema,
  type LessonDetailResponse,
  type RescheduleLessonDto,
  type UpdateLessonDto,
} from '@tutorio/validation';
import { z } from 'zod';
import {
  durationMinString,
  localTimeString,
  optionalText,
  priceString,
  requiredDateString,
} from '@/lib/forms/helpers';
import { localInputToIso, splitDateTimeInput, toLocalDateTimeInput } from '@/lib/datetime';
import { formatPriceInput, parsePriceInput } from '@/lib/money';

/** Lesson lengths offered in the duration select; the lesson's own is added when missing. */
export const DURATION_CHOICES = [30, 45, 60, 75, 90, 120] as const;

export function durationOptions(current: number): number[] {
  return [...new Set([...DURATION_CHOICES, current])].sort((a, b) => a - b);
}

/**
 * The panel's edit form (L-40): date, start and length, the teacher (a
 * substitution for this lesson only), the price while it can change (L-12),
 * the topic and the notes. The price stays blank when it is locked.
 */
export const editFormSchema = z.object({
  date: requiredDateString,
  time: localTimeString,
  durationMin: durationMinString,
  teacherId: z.string().uuid(),
  price: priceString({ required: false }),
  topic: optionalText(lessonTopicSchema),
  notes: optionalText(notesSchema),
});

export type EditFormValues = z.infer<typeof editFormSchema>;

export function editFormDefaults(
  lesson: Pick<
    LessonDetailResponse,
    'startsAtUtc' | 'durationMin' | 'teacherId' | 'priceMinor' | 'topic' | 'notes'
  >,
): EditFormValues {
  const { date, time } = splitDateTimeInput(toLocalDateTimeInput(new Date(lesson.startsAtUtc)));
  return {
    date,
    time,
    durationMin: String(lesson.durationMin),
    teacherId: lesson.teacherId,
    price: formatPriceInput(lesson.priceMinor),
    topic: lesson.topic ?? '',
    notes: lesson.notes ?? '',
  };
}

/** What a submitted edit asks the API to do: move the lesson, and change its fields. */
export type EditPlan = {
  /** The new start, when the date or the time changed (PATCH …/reschedule). */
  move: { startsAtUtc: string; durationMin?: number } | null;
  /** Every other change (PATCH /lessons/:id). */
  update: UpdateLessonDto | null;
};

/**
 * Splits a submitted edit into a move and an update, sending only what
 * changed. A new length travels with the move when the lesson moves, so the
 * conflict check sees the final slot once. `priceLocked` drops the price.
 */
export function editPlan(
  values: EditFormValues,
  lesson: Pick<
    LessonDetailResponse,
    'startsAtUtc' | 'durationMin' | 'teacherId' | 'priceMinor' | 'currency' | 'topic' | 'notes'
  >,
  { priceLocked }: { priceLocked: boolean },
): EditPlan {
  const startsAtUtc = localInputToIso(`${values.date}T${values.time}`);
  const moved = Date.parse(startsAtUtc) !== Date.parse(lesson.startsAtUtc);
  const durationMin = Number(values.durationMin);
  const lengthChanged = durationMin !== lesson.durationMin;

  const update: UpdateLessonDto = {};
  if (lengthChanged && !moved) update.durationMin = durationMin;
  if (values.teacherId !== lesson.teacherId) update.teacherId = values.teacherId;
  const topic = values.topic.trim() || null;
  if (topic !== (lesson.topic ?? null)) update.topic = topic;
  const notes = values.notes.trim() || null;
  if (notes !== (lesson.notes ?? null)) update.notes = notes;
  if (!priceLocked) {
    const price = parsePriceInput(values.price);
    if (price !== null && price !== lesson.priceMinor) {
      update.priceMinor = price;
      update.currency = lesson.currency as UpdateLessonDto['currency'];
    }
  }

  return {
    move: moved ? { startsAtUtc, ...(lengthChanged ? { durationMin } : {}) } : null,
    update: Object.keys(update).length > 0 ? update : null,
  };
}

/** The reschedule body for a planned move and the chosen scope (L-41). */
export function rescheduleDto(
  move: NonNullable<EditPlan['move']>,
  scope: RescheduleLessonDto['scope'],
): RescheduleLessonDto {
  return { ...move, scope };
}
