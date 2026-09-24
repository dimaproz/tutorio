import { z } from 'zod';
import { parsePriceInput } from '@/lib/money';
import { checkedString } from '@/lib/forms/helpers';

/** The lesson forms' length range (FieldsTime board): 5 minutes to 8 hours. */
export const LESSON_DURATION_MIN = 5;
export const LESSON_DURATION_MAX = 480;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A start time "HH:mm"; anything else reads «Вкажіть час, напр. 17:30». */
export const lessonTimeString = checkedString((value) => TIME_RE.test(value), 'lessonTimeInvalid');

/** A calendar date "yyyy-MM-dd"; blank reads «Вкажіть дату». */
export const lessonDateString = checkedString(
  (value) => /^\d{4}-\d{2}-\d{2}$/.test(value),
  'lessonDateRequired',
);

/** A length in whole minutes, 5 to 480: «Вкажіть тривалість» when blank, else the range. */
export const lessonDurationString = z.string().superRefine((value, ctx) => {
  if (value.trim() === '') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, params: { key: 'lessonDurationRequired' } });
    return;
  }
  const minutes = Number(value);
  if (
    !Number.isInteger(minutes) ||
    minutes < LESSON_DURATION_MIN ||
    minutes > LESSON_DURATION_MAX
  ) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, params: { key: 'lessonDurationRange' } });
  }
});

/**
 * A lesson price as typed: blank is allowed unless `required`; a minus reads
 * «Ціна не може бути відʼємною»; anything else must parse to minor units.
 */
export function lessonPriceString({ required }: { required: boolean }) {
  return z.string().superRefine((value, ctx) => {
    const text = value.trim();
    if (text === '') {
      if (required) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, params: { key: 'priceRequired' } });
      }
      return;
    }
    if (text.startsWith('-')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, params: { key: 'priceNegative' } });
      return;
    }
    if (parsePriceInput(text) === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, params: { key: 'priceInvalid' } });
    }
  });
}

/** A whole amount reads "500", as the design writes it; cents keep "500.50". */
export function priceInputFromMinor(amountMinor: number, format: (minor: number) => string) {
  return amountMinor % 100 === 0 ? String(amountMinor / 100) : format(amountMinor);
}
