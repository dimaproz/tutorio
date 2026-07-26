import {
  avatarKeySchema,
  notesSchema,
  parentFullNameSchema,
  phoneSchema,
  telegramUsernameSchema,
} from '@tutorio/validation';
import { z } from 'zod';
import { optionalText } from '@/lib/forms/helpers';

export const parentFormSchema = z.object({
  fullName: parentFullNameSchema,
  phone: optionalText(phoneSchema),
  telegramUsername: optionalText(telegramUsernameSchema),
  avatarKey: avatarKeySchema.nullable(),
  studentIds: z.array(z.string().uuid()),
  notes: optionalText(notesSchema),
});
export type ParentFormValues = z.infer<typeof parentFormSchema>;
export const EMPTY_PARENT_FORM: ParentFormValues = {
  fullName: '',
  phone: '',
  telegramUsername: '',
  avatarKey: null,
  studentIds: [],
  notes: '',
};
