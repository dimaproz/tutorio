import { currencyCodeSchema, groupNameSchema, groupNotesSchema } from '@tutorio/validation';
import { z } from 'zod';
import { optionalText } from '@/lib/forms/helpers';
import { parsePriceInput } from '@/lib/money';

export const groupFormSchema = z
  .object({
    name: groupNameSchema,
    pricePerLesson: z.string(),
    currency: currencyCodeSchema,
    notes: optionalText(groupNotesSchema),
  })
  .superRefine((data, ctx) => {
    if (data.pricePerLesson.trim() !== '' && parsePriceInput(data.pricePerLesson) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pricePerLesson'],
        params: { key: 'priceInvalid' },
        message: 'Invalid price',
      });
    }
  });
export type GroupFormValues = z.infer<typeof groupFormSchema>;
