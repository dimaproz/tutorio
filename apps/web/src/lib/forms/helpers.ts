import { durationMinSchema } from '@tutorio/validation';
import { z } from 'zod';
import { parsePriceInput } from '@/lib/money';

/** Allows a blank HTML input while preserving the domain schema for filled values. */
export function optionalText<T extends z.ZodTypeAny>(schema: T) {
  return z.literal('').or(schema);
}

/**
 * A money field held as the text the user typed. Blank is allowed only when
 * `required` is false; anything non-blank must parse to minor units, so the
 * "1500" / "1500,50" leniency lives in exactly one place.
 */
export function priceString({ required }: { required: boolean }) {
  return z.string().superRefine((value, ctx) => {
    if (value.trim() === '') {
      if (required) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          params: { key: 'priceRequired' },
          message: 'Price is required',
        });
      }
      return;
    }
    if (parsePriceInput(value) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        params: { key: 'priceInvalid' },
        message: 'Invalid price',
      });
    }
  });
}

/**
 * Validates a string field against a predicate, reporting a localized message
 * key. `params.key` is only honoured on custom issues, so every bespoke rule
 * has to go through `superRefine` — this wraps that boilerplate.
 */
export function checkedString(
  isValid: (value: string) => boolean,
  key: string,
): z.ZodEffects<z.ZodString, string, string> {
  return z.string().superRefine((value, ctx) => {
    if (!isValid(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        params: { key },
        message: key,
      });
    }
  });
}

/** Local wall-clock time as typed into a native `time` input ("HH:mm"). */
const LOCAL_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Native inputs hand back strings, so these wrap the shared domain schemas for
 * the three numeric/temporal fields every scheduling form has. Defined once so
 * a lesson, a pattern and a package validate the same way.
 */
export const localTimeString = checkedString(
  (value) => LOCAL_TIME_RE.test(value),
  'timeInvalid',
);

export const durationMinString = checkedString(
  (value) => durationMinSchema.safeParse(Number(value)).success,
  'durationRange',
);

export const requiredDateString = checkedString(
  (value) => value.trim() !== '',
  'dateRequired',
);

/** Validates an optional integer represented by a native text input. */
export function optionalIntString(min: number, max: number) {
  return z.string().refine(
    (value) => {
      if (value.trim() === '') {
        return true;
      }
      const parsed = Number(value);
      return Number.isInteger(parsed) && parsed >= min && parsed <= max;
    },
    { params: { key: 'intRange', min, max } },
  );
}
