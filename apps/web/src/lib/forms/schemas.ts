import {
  avatarKeySchema,
  billingTypeSchema,
  cancellationDeadlineHoursSchema,
  currencyCodeSchema,
  emailSchema,
  enrollmentStatusSchema,
  groupNameSchema,
  groupNotesSchema,
  notesSchema,
  parentFullNameSchema,
  phoneSchema,
  registerSchema,
  studentFullNameSchema,
  studentNotesSchema,
  studentKnowledgeLevelSchema,
  studentLanguageLevelSchema,
  studentStatusSchema,
  studentSubjectSchema,
  telegramUsernameSchema,
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

// A number typed into a plain <input>, allowed to be blank. `min`/`max` mirror
// the corresponding @tutorio/validation integer schema.
function optionalIntString(min: number, max: number) {
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

export const studentFormSchema = z
  .object({
    fullName: studentFullNameSchema,
    email: optionalText(emailSchema),
    phone: optionalText(phoneSchema),
    timezone: timezoneSchema,
    telegramUsername: optionalText(telegramUsernameSchema),
    subject: optionalText(studentSubjectSchema),
    hourlyRate: z.string(),
    currency: currencyCodeSchema,
    status: studentStatusSchema,
    languageLevel: optionalText(studentLanguageLevelSchema),
    knowledgeLevel: optionalText(studentKnowledgeLevelSchema),
    age: optionalIntString(0, 120),
    grade: optionalIntString(1, 12),
    avatarKey: avatarKeySchema.nullable(),
    parentIds: z.array(z.string().uuid()),
    notes: optionalText(studentNotesSchema),
  })
  .superRefine((data, ctx) => {
    if (data.hourlyRate.trim() !== '' && parsePriceInput(data.hourlyRate) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['hourlyRate'],
        params: { key: 'priceInvalid' },
        message: 'Invalid price',
      });
    }
  });

export type StudentFormValues = z.infer<typeof studentFormSchema>;

export const EMPTY_STUDENT_FORM: StudentFormValues = {
  fullName: '',
  email: '',
  phone: '',
  timezone: '',
  telegramUsername: '',
  subject: '',
  hourlyRate: '',
  currency: 'EUR',
  status: 'ACTIVE',
  languageLevel: '',
  knowledgeLevel: '',
  age: '',
  grade: '',
  avatarKey: null,
  parentIds: [],
  notes: '',
};

export const groupFormSchema = z
  .object({
    name: groupNameSchema,
    pricePerLesson: z.string(),
    currency: currencyCodeSchema,
    notes: optionalText(groupNotesSchema),
  })
  .superRefine((data, ctx) => {
    if (
      data.pricePerLesson.trim() !== '' &&
      parsePriceInput(data.pricePerLesson) === null
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pricePerLesson'],
        params: { key: 'priceInvalid' },
        message: 'Invalid price',
      });
    }
  });

export type GroupFormValues = z.infer<typeof groupFormSchema>;

export const parentFormSchema = z.object({
  fullName: parentFullNameSchema,
  phone: optionalText(phoneSchema),
  telegramUsername: optionalText(telegramUsernameSchema),
  avatarKey: avatarKeySchema.nullable(),
  notes: optionalText(notesSchema),
});

export type ParentFormValues = z.infer<typeof parentFormSchema>;

export const EMPTY_PARENT_FORM: ParentFormValues = {
  fullName: '',
  phone: '',
  telegramUsername: '',
  avatarKey: null,
  notes: '',
};

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
