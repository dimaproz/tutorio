import {
  avatarKeySchema,
  currencyCodeSchema,
  emailSchema,
  phoneSchema,
  studentFullNameSchema,
  studentKnowledgeLevelSchema,
  studentLanguageLevelSchema,
  studentNotesSchema,
  telegramUsernameSchema,
  timezoneSchema,
  type CreateStudentDto,
  type StudentDetail,
  type UpdateStudentDto,
} from '@tutorio/validation';
import { z } from 'zod';
import { optionalIntString, optionalText, priceString } from '@/lib/forms/helpers';
import { parsePriceInput } from '@/lib/money';

const contactFields = {
  email: optionalText(emailSchema),
  phone: optionalText(phoneSchema),
  telegramUsername: optionalText(telegramUsernameSchema),
};

const profileFields = {
  age: optionalIntString(0, 120),
  grade: optionalIntString(1, 12),
  notes: optionalText(studentNotesSchema),
};

export const studentQuickCreateSchema = z.object({
  fullName: studentFullNameSchema,
  ...contactFields,
  timezone: timezoneSchema,
  pricePerLesson: priceString({ required: false }),
  currency: currencyCodeSchema,
  ...profileFields,
});

export type StudentQuickCreateValues = z.infer<typeof studentQuickCreateSchema>;

export function resolveStudentTimezone(browserTimezone?: string): string {
  return browserTimezone?.trim() || 'Europe/Kyiv';
}

export function emptyStudentQuickCreate(options: {
  currency: string;
  timezone?: string;
}): StudentQuickCreateValues {
  return {
    fullName: '',
    email: '',
    phone: '',
    telegramUsername: '',
    timezone: resolveStudentTimezone(options.timezone),
    pricePerLesson: '',
    currency: options.currency as StudentQuickCreateValues['currency'],
    age: '',
    grade: '',
    notes: '',
  };
}

export const studentEditSchema = z.object({
  fullName: studentFullNameSchema,
  ...contactFields,
  timezone: timezoneSchema,
  pricePerLesson: priceString({ required: false }),
  currency: currencyCodeSchema,
  languageLevel: optionalText(studentLanguageLevelSchema),
  knowledgeLevel: optionalText(studentKnowledgeLevelSchema),
  ...profileFields,
  avatarKey: avatarKeySchema.nullable(),
});

export type StudentEditValues = z.infer<typeof studentEditSchema>;

const optionalCreateText = (value: string) => {
  const normalized = value.trim();
  return normalized === '' ? undefined : normalized;
};

const nullableEditText = (value: string) => {
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
};

export function normalizeTelegram(value: string): string {
  return value.trim().replace(/^@+/, '');
}

export function buildStudentQuickCreateDto(values: StudentQuickCreateValues): CreateStudentDto {
  const price = values.pricePerLesson.trim();
  const priceMinor = price === '' ? undefined : (parsePriceInput(price) ?? undefined);
  const telegram = normalizeTelegram(values.telegramUsername);

  return {
    fullName: values.fullName.trim(),
    email: optionalCreateText(values.email),
    phone: optionalCreateText(values.phone),
    telegramUsername: telegram === '' ? undefined : telegram,
    timezone: values.timezone,
    status: 'ACTIVE',
    hourlyRateMinor: priceMinor,
    currency: priceMinor === undefined ? undefined : values.currency,
    age: values.age.trim() === '' ? undefined : Number(values.age),
    grade: values.grade.trim() === '' ? undefined : Number(values.grade),
    notes: optionalCreateText(values.notes),
  };
}

export function studentEditDefaults(
  student: StudentDetail,
  workspaceDefaultCurrency: string,
): StudentEditValues {
  return {
    fullName: student.fullName,
    email: student.email ?? '',
    phone: student.phone ?? '',
    telegramUsername: normalizeTelegram(student.telegramUsername ?? ''),
    timezone: student.timezone,
    pricePerLesson:
      student.hourlyRateMinor == null ? '' : (student.hourlyRateMinor / 100).toFixed(2),
    currency: (student.currency ?? workspaceDefaultCurrency) as StudentEditValues['currency'],
    languageLevel: student.languageLevel ?? '',
    knowledgeLevel: student.knowledgeLevel ?? '',
    age: student.age == null ? '' : String(student.age),
    grade: student.grade == null ? '' : String(student.grade),
    avatarKey: student.avatarKey,
    notes: student.notes ?? '',
  };
}

export function buildStudentEditDto(values: StudentEditValues): UpdateStudentDto {
  const price = values.pricePerLesson.trim();
  const priceMinor = price === '' ? null : parsePriceInput(price);
  const telegram = normalizeTelegram(values.telegramUsername);

  return {
    fullName: values.fullName.trim(),
    email: nullableEditText(values.email),
    phone: nullableEditText(values.phone),
    telegramUsername: telegram === '' ? null : telegram,
    timezone: values.timezone,
    hourlyRateMinor: priceMinor,
    currency: priceMinor === null ? null : values.currency,
    languageLevel: values.languageLevel === '' ? null : values.languageLevel,
    knowledgeLevel: values.knowledgeLevel === '' ? null : values.knowledgeLevel,
    age: values.age.trim() === '' ? null : Number(values.age),
    grade: values.grade.trim() === '' ? null : Number(values.grade),
    avatarKey: values.avatarKey,
    notes: nullableEditText(values.notes),
  };
}
