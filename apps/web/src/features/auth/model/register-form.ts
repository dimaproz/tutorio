import { registerSchema } from '@tutorio/validation';
import { z } from 'zod';

/** Web-only confirmation field; never sent to the API. */
export const registerFormSchema = registerSchema
  .extend({ confirmPassword: z.string().min(1) })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        params: { key: 'confirmPasswordMismatch' },
        message: 'Passwords do not match',
      });
    }
  });

export type RegisterFormValues = z.infer<typeof registerFormSchema>;
