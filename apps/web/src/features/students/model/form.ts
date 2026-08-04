import {
  avatarKeySchema,
  currencyCodeSchema,
  emailSchema,
  phoneSchema,
  studentFullNameSchema,
  studentKnowledgeLevelSchema,
  studentLanguageLevelSchema,
  studentNotesSchema,
  studentStatusSchema,
  telegramUsernameSchema,
  timezoneSchema,
} from '@tutorio/validation';
import { z } from 'zod';
import { optionalIntString, optionalText } from '@/lib/forms/helpers';
import { parsePriceInput } from '@/lib/money';

export const studentFormSchema = z
  .object({
    fullName: studentFullNameSchema,
    email: optionalText(emailSchema),
    phone: optionalText(phoneSchema),
    timezone: timezoneSchema,
    telegramUsername: optionalText(telegramUsernameSchema),
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
