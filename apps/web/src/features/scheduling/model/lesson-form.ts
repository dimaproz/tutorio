import { resolveDefaultPrice, type CurrencyCode } from '@tutorio/domain';
import {
  cancelledBySchema,
  currencyCodeSchema,
  lessonStatusSchema,
  uuidSchema,
  type CreateLessonDto,
  type LessonStatusDto,
} from '@tutorio/validation';
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
export interface GroupRateHolder {
  id: string;
  pricePerLesson?: number | null;
  currency?: string | null;
}

/**
 * A group carries its own rate, with no enrollment behind it — so unlike the
 * student path, an empty result means the tutor has to type a price.
 */
export function prefillFromGroup(
  group: GroupRateHolder | undefined,
): { priceMinor: number; currency: string } | null {
  if (group?.pricePerLesson == null || !group.currency) {
    return null;
  }
  return { priceMinor: group.pricePerLesson, currency: group.currency };
}

/** Price *and* currency of the most specific configured rate. */
export function prefillFromStudent(
  student: RateHolder | undefined,
  teacher: TeacherRateHolder | undefined,
): { priceMinor: number; currency: string } | null {
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
  return resolved ? { priceMinor: resolved.priceMinor, currency: resolved.currency } : null;
}

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

/** Who the lesson is booked for. The API accepts either target. */
export const LESSON_TARGETS = ['student', 'group'] as const;
export type LessonTarget = (typeof LESSON_TARGETS)[number];

/** Cancellation authors, in the order the picker offers them. */
export const CANCELLED_BY_VALUES = ['STUDENT', 'TEACHER', 'GROUP'] as const;

export const lessonFormSchema = z
  .object({
    target: z.enum(LESSON_TARGETS),
    // Only the field matching `target` is validated; the other keeps whatever
    // the tutor picked before switching tabs, so flipping back is lossless.
    studentId: z.union([z.literal(''), uuidSchema]),
    groupId: z.union([z.literal(''), uuidSchema]),
    // Blank means "resolve on the server" (single-teacher workspace).
    teacherId: z.union([z.literal(''), uuidSchema]),
    durationMin: durationMinString,
    price: priceString({ required: false }),
    currency: currencyCodeSchema,
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
    status: lessonStatusSchema,
    cancelledBy: z.union([z.literal(''), cancelledBySchema]),
    /** "YYYY-MM-DD", or "" for "no payment recorded". */
    paidAt: z.string(),
    notes: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.target === 'student' && !values.studentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        params: { key: 'studentRequired' },
        path: ['studentId'],
      });
    }
    if (values.target === 'group') {
      if (!values.groupId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          params: { key: 'groupRequired' },
          path: ['groupId'],
        });
      }
      // Only the student path can fall back to a configured rate: a group
      // booking has no enrollment for the server to read a price from.
      if (parsePriceInput(values.price) === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          params: { key: 'priceRequired' },
          path: ['price'],
        });
      }
    }
    if (isCancelledStatus(values.status) && !values.cancelledBy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        params: { key: 'cancelledByRequired' },
        path: ['cancelledBy'],
      });
    }
  });

export type LessonFormValues = z.infer<typeof lessonFormSchema>;

/** The dates the tutor actually filled in; blank rows are ignored throughout. */
export function filledDates(values: Pick<LessonFormValues, 'startsAt'>): string[] {
  return values.startsAt.map((entry) => entry.value).filter(Boolean);
}

/** Cancelling is the only status that carries an author. */
export function isCancelledStatus(status: LessonStatusDto): boolean {
  return status === 'CANCELLED_CHARGED' || status === 'CANCELLED_UNCHARGED';
}

export const EMPTY_LESSON_FORM: LessonFormValues = {
  target: 'student',
  studentId: '',
  groupId: '',
  teacherId: '',
  durationMin: '60',
  price: '',
  currency: 'EUR',
  startsAt: [{ value: '' }],
  status: 'SCHEDULED',
  cancelledBy: '',
  paidAt: '',
  notes: '',
};

/**
 * Maps the lesson form to the API contract. Price and currency travel together
 * or not at all — a half-filled pair would make the server reject an otherwise
 * valid booking.
 */
export function buildCreateLessonDto(
  values: LessonFormValues,
  context: { teacherId: string },
): CreateLessonDto {
  const priceMinor = parsePriceInput(values.price);
  const cancelled = isCancelledStatus(values.status);
  const starts = filledDates(values);

  return {
    ...(values.target === 'group'
      ? { groupId: values.groupId }
      : { studentId: values.studentId }),
    ...(context.teacherId ? { teacherId: context.teacherId } : {}),
    startsAt: starts.map(localInputToIso),
    durationMin: Number(values.durationMin),
    ...(priceMinor !== null
      ? { priceMinor, currency: values.currency as CreateLessonDto['currency'] }
      : {}),
    status: values.status,
    ...(cancelled
      ? { cancelledBy: values.cancelledBy as CreateLessonDto['cancelledBy'] }
      : {}),
    // One payment belongs to one lesson. Booking several dates at once is a
    // batch of separate lessons, and stamping them all with the same payment
    // date would be a guess — so the field only travels with a single booking.
    // A date without a time is stored at local midnight: the tutor is recording
    // the day the money arrived, not the minute.
    ...(values.paidAt && starts.length === 1
      ? { paidAt: localInputToIso(`${values.paidAt}T00:00`) }
      : {}),
    ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
  };
}
