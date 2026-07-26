import { resolveDefaultPrice, type CurrencyCode } from '@tutorio/domain';
import { uuidSchema, type CreateLessonDto } from '@tutorio/validation';
import { z } from 'zod';
import { localInputToIso } from '@/lib/datetime';
import { durationMinString, priceString } from '@/lib/forms/helpers';
import { parsePriceInput } from '@/lib/money';

// ---------------------------------------------------------------------------
// Shared picker/rate shapes
// ---------------------------------------------------------------------------

/** The picker options a scheduling form works with. */
export interface PersonOption {
  value: string;
  label: string;
  avatarKey?: string | null;
}

export interface RateHolder {
  id: string;
  hourlyRateMinor?: number | null;
  currency?: string | null;
}

export interface TeacherRateHolder {
  id: string;
  defaultRateMinor?: number | null;
  currency?: string | null;
}

/**
 * The teacher a lesson is booked with. An explicit choice always wins; a
 * workspace with exactly one teacher never asks. Anything else stays empty so
 * the server can reject an ambiguous booking instead of guessing.
 */
export function effectiveTeacherId(
  explicitTeacherId: string,
  teacherOptions: readonly PersonOption[],
): string {
  if (explicitTeacherId) {
    return explicitTeacherId;
  }
  return teacherOptions.length === 1 ? teacherOptions[0].value : '';
}

/**
 * The price to prefill, in minor units, from the most specific configured rate
 * (student, then teacher). `null` means "nothing configured" — the field stays
 * empty and the API resolves it at booking time.
 */
export function prefillPriceMinor(
  student: RateHolder | undefined,
  teacher: TeacherRateHolder | undefined,
): number | null {
  const resolved = resolveDefaultPrice({
    student: {
      amountMinor: student?.hourlyRateMinor,
      currency: student?.currency as CurrencyCode | null | undefined,
    },
    teacher: {
      amountMinor: teacher?.defaultRateMinor,
      currency: teacher?.currency as CurrencyCode | null | undefined,
    },
  });
  return resolved ? resolved.priceMinor : null;
}

// ---------------------------------------------------------------------------
// Lesson form
// ---------------------------------------------------------------------------

export const lessonFormSchema = z.object({
  studentId: uuidSchema,
  // Blank means "resolve on the server" (single-teacher workspace).
  teacherId: z.union([z.literal(''), uuidSchema]),
  durationMin: durationMinString,
  price: priceString({ required: false }),
  // A list of objects rather than of bare strings: react-hook-form's
  // useFieldArray only tracks object entries, and this keeps the bulk
  // "add another date" rows stable across re-renders.
  // Blanks are allowed in the list but dropped before submitting; at least one
  // date has to be filled in.
  startsAt: z
    .array(z.object({ value: z.string() }))
    .min(1)
    .refine((dates) => dates.some((date) => date.value.trim() !== ''), {
      params: { key: 'dateRequired' },
    }),
  notes: z.string(),
});

export type LessonFormValues = z.infer<typeof lessonFormSchema>;

export const EMPTY_LESSON_FORM: LessonFormValues = {
  studentId: '',
  teacherId: '',
  durationMin: '60',
  price: '',
  startsAt: [{ value: '' }],
  notes: '',
};

/**
 * Maps the lesson form to the API contract. Price and currency travel together
 * or not at all — a half-filled pair would make the server reject an otherwise
 * valid booking.
 */
export function buildCreateLessonDto(
  values: LessonFormValues,
  context: { teacherId: string; currency?: string | null },
): CreateLessonDto {
  const priceMinor = parsePriceInput(values.price);
  const hasPrice = priceMinor !== null && Boolean(context.currency);

  return {
    studentId: values.studentId,
    ...(context.teacherId ? { teacherId: context.teacherId } : {}),
    startsAt: values.startsAt
      .map((entry) => entry.value)
      .filter(Boolean)
      .map(localInputToIso),
    durationMin: Number(values.durationMin),
    ...(hasPrice
      ? {
          priceMinor: priceMinor as number,
          currency: context.currency as CreateLessonDto['currency'],
        }
      : {}),
    ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
  };
}
