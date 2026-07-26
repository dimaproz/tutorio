import {
  avatarKeySchema,
  currencyCodeSchema,
  emailSchema,
  notesSchema,
  phoneSchema,
  studentSubjectSchema,
  teacherBioSchema,
  teacherColorSchema,
  teacherFullNameSchema,
  teacherStatusSchema,
  telegramUsernameSchema,
} from '@tutorio/validation';
import { z } from 'zod';
import { optionalText } from '@/lib/forms/helpers';
import { parsePriceInput } from '@/lib/money';

export const teacherFormSchema = z
  .object({
    fullName: teacherFullNameSchema,
    email: optionalText(emailSchema),
    phone: optionalText(phoneSchema),
    telegramUsername: optionalText(telegramUsernameSchema),
    subjects: z.array(studentSubjectSchema),
    defaultRate: z.string(),
    currency: currencyCodeSchema,
    color: teacherColorSchema,
    status: teacherStatusSchema,
    bio: optionalText(teacherBioSchema),
    avatarKey: avatarKeySchema.nullable(),
    notes: optionalText(notesSchema),
  })
  .superRefine((data, ctx) => {
    if (data.defaultRate.trim() !== '' && parsePriceInput(data.defaultRate) === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['defaultRate'],
        params: { key: 'priceInvalid' },
        message: 'Invalid price',
      });
    }
  });

export type TeacherFormValues = z.infer<typeof teacherFormSchema>;
export const EMPTY_TEACHER_FORM: TeacherFormValues = {
  fullName: '',
  email: '',
  phone: '',
  telegramUsername: '',
  subjects: [],
  defaultRate: '',
  currency: 'EUR',
  color: '#465FFF',
  status: 'ACTIVE',
  bio: '',
  avatarKey: null,
  notes: '',
};
