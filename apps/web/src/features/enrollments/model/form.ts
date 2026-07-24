import {
  billingTypeSchema,
  cancellationDeadlineHoursSchema,
  currencyCodeSchema,
  enrollmentStatusSchema,
} from '@tutorio/validation';
import { z } from 'zod';
import { parsePriceInput } from '@/lib/money';

export const enrollmentFormSchema = z
  .object({
    studentId: z.string().uuid(),
    groupId: z.string(),
    teacherId: z.string().uuid(),
    status: enrollmentStatusSchema,
    billingType: billingTypeSchema,
    price: z.string().min(1),
    currency: currencyCodeSchema,
    useCustomDeadline: z.boolean(),
    cancellationDeadlineHours: z.string(),
  })
  .superRefine((data, ctx) => {
    if (parsePriceInput(data.price) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['price'],
        params: { key: 'priceInvalid' },
        message: 'Invalid price',
      });
    }
    if (data.useCustomDeadline) {
      const hours = Number(data.cancellationDeadlineHours);
      if (
        data.cancellationDeadlineHours.trim() === '' ||
        !Number.isInteger(hours) ||
        !cancellationDeadlineHoursSchema.safeParse(hours).success
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cancellationDeadlineHours'],
          params: { key: 'deadlineRange' },
          message: 'Invalid deadline',
        });
      }
    }
  });
export type EnrollmentFormValues = z.infer<typeof enrollmentFormSchema>;
