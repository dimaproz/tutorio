import {
  billingTypeSchema,
  cancellationDeadlineHoursSchema,
  currencyCodeSchema,
  emailSchema,
  enrollmentStatusSchema,
  groupNameSchema,
  groupNotesSchema,
  personNameSchema,
  phoneSchema,
  registerSchema,
  studentFullNameSchema,
  studentNotesSchema,
  timezoneSchema,
} from '@tutorio/validation';
import { z } from 'zod';
import { parsePriceInput } from '@/lib/money';

// Web-only registration form schema: adds the password confirmation, which is
// checked in the browser and must never be sent to the API.
export const registerFormSchema = registerSchema
  .extend({
    confirmPassword: z.string().min(1),
  })
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

// Form inputs are always strings. An untouched optional field submits "" and
// is translated to undefined (create) or null (clear on update) at submit time.
function optionalText<T extends z.ZodTypeAny>(schema: T) {
  return z.literal('').or(schema);
}

export const studentFormSchema = z.object({
  fullName: studentFullNameSchema,
  email: optionalText(emailSchema),
  phone: optionalText(phoneSchema),
  timezone: timezoneSchema,
  parentName: optionalText(personNameSchema),
  parentEmail: optionalText(emailSchema),
  parentPhone: optionalText(phoneSchema),
  notes: optionalText(studentNotesSchema),
});

export type StudentFormValues = z.infer<typeof studentFormSchema>;

export const EMPTY_STUDENT_FORM: StudentFormValues = {
  fullName: '',
  email: '',
  phone: '',
  timezone: '',
  parentName: '',
  parentEmail: '',
  parentPhone: '',
  notes: '',
};

export const groupFormSchema = z.object({
  name: groupNameSchema,
  notes: optionalText(groupNotesSchema),
});

export type GroupFormValues = z.infer<typeof groupFormSchema>;

// Price is entered in major units and converted to integer minor units on
// submit; the field itself stays a string so "1500,50" keeps working.
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
      const valid =
        data.cancellationDeadlineHours.trim() !== '' &&
        Number.isInteger(hours) &&
        cancellationDeadlineHoursSchema.safeParse(hours).success;
      if (!valid) {
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

export const workspaceSettingsFormSchema = z.object({
  defaultCurrency: currencyCodeSchema,
  cancellationDeadlineHours: z.coerce
    .number()
    .int()
    .min(0)
    .max(336),
});

export type WorkspaceSettingsFormValues = z.infer<typeof workspaceSettingsFormSchema>;
