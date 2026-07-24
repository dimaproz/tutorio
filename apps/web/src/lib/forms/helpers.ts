import { z } from 'zod';

/** Allows a blank HTML input while preserving the domain schema for filled values. */
export function optionalText<T extends z.ZodTypeAny>(schema: T) {
  return z.literal('').or(schema);
}

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
