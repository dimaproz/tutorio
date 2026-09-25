import { SUPPORTED_CURRENCIES } from '@tutorio/domain';
import {
  avatarKeySchema,
  currencyCodeSchema,
  emailSchema,
  notesSchema,
  phoneSchema,
  teacherBioSchema,
  teacherColorSchema,
  teacherFullNameSchema,
  teacherSubjectSchema,
  telegramUsernameSchema,
  TEACHER_SUBJECTS_MAX,
  type CreateTeacherDto,
  type CurrencyCodeDto,
  type TeacherResponse,
  type UpdateTeacherDto,
} from '@tutorio/validation';
import { z } from 'zod';
import { optionalText, priceString } from '@/lib/forms/helpers';
import { formatPriceInput, parsePriceInput } from '@/lib/money';

/** The API's limits for a teacher's bio and notes. */
export const TEACHER_BIO_MAX = 2000;
export const TEACHER_NOTES_MAX = 2000;

/** One schema for create and edit: only the name is required. */
export const teacherFormSchema = z.object({
  fullName: teacherFullNameSchema,
  avatarKey: avatarKeySchema.nullable(),
  email: optionalText(emailSchema),
  phone: optionalText(phoneSchema),
  telegramUsername: optionalText(telegramUsernameSchema),
  subjects: z.array(teacherSubjectSchema).max(TEACHER_SUBJECTS_MAX),
  rate: priceString({ required: false }),
  currency: currencyCodeSchema,
  color: teacherColorSchema,
  bio: optionalText(teacherBioSchema),
  notes: optionalText(notesSchema),
});
export type TeacherFormValues = z.infer<typeof teacherFormSchema>;

export function emptyTeacherForm(currency: CurrencyCodeDto, color: string): TeacherFormValues {
  return {
    fullName: '',
    avatarKey: null,
    email: '',
    phone: '',
    telegramUsername: '',
    subjects: [],
    rate: '',
    currency,
    color,
    bio: '',
    notes: '',
  };
}

export const TEACHER_FORM_SECTIONS = [
  { id: 'identity', fields: ['fullName', 'avatarKey'] },
  { id: 'contacts', fields: ['email', 'phone', 'telegramUsername'] },
  { id: 'teaching', fields: ['subjects', 'rate', 'currency', 'color'] },
  { id: 'about', fields: ['bio', 'notes'] },
] as const satisfies readonly { id: string; fields: readonly (keyof TeacherFormValues)[] }[];

export type TeacherFormSectionId = (typeof TEACHER_FORM_SECTIONS)[number]['id'];
export type TeacherFormSectionStatus = 'done' | 'error' | 'none';

/**
 * The fields whose value marks a section as filled in. The colour always
 * holds one, so it never counts on its own.
 */
const MEANINGFUL: Record<TeacherFormSectionId, readonly (keyof TeacherFormValues)[]> = {
  identity: ['fullName'],
  contacts: ['email', 'phone', 'telegramUsername'],
  teaching: ['subjects', 'rate'],
  about: ['bio', 'notes'],
};

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === 'string' ? value.trim() !== '' : value != null;
}

/**
 * Where each section stands: an error wins, otherwise a section is done once
 * one of its meaningful fields holds a value. Drives the section navigation,
 * the progress meter and the save bar.
 */
export function teacherFormSectionStatus(
  values: TeacherFormValues,
  errorFields: readonly string[],
): Record<TeacherFormSectionId, TeacherFormSectionStatus> {
  const errors = new Set(errorFields);
  return Object.fromEntries(
    TEACHER_FORM_SECTIONS.map((section) => {
      const status: TeacherFormSectionStatus = section.fields.some((field) => errors.has(field))
        ? 'error'
        : MEANINGFUL[section.id].some((field) => hasValue(values[field]))
          ? 'done'
          : 'none';
      return [section.id, status];
    }),
  ) as Record<TeacherFormSectionId, TeacherFormSectionStatus>;
}

function bareTelegram(value: string): string {
  return value.trim().replace(/^@+/, '');
}

const optionalCreateText = (value: string) => {
  const normalized = value.trim();
  return normalized === '' ? undefined : normalized;
};

const nullableEditText = (value: string) => {
  const normalized = value.trim();
  return normalized === '' ? null : normalized;
};

function isCurrency(value: string | null): value is CurrencyCodeDto {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value ?? '');
}

/** The saved teacher as form values. */
export function teacherFormDefaults(
  teacher: TeacherResponse,
  fallback: { currency: CurrencyCodeDto; color: string },
): TeacherFormValues {
  return {
    fullName: teacher.fullName,
    avatarKey: teacher.avatarKey,
    email: teacher.email ?? '',
    phone: teacher.phone ?? '',
    telegramUsername: bareTelegram(teacher.telegramUsername ?? ''),
    subjects: teacher.subjects,
    rate: teacher.defaultRateMinor === null ? '' : formatPriceInput(teacher.defaultRateMinor),
    currency: isCurrency(teacher.currency) ? teacher.currency : fallback.currency,
    color: (teacher.color ?? fallback.color).toUpperCase(),
    bio: teacher.bio ?? '',
    notes: teacher.notes ?? '',
  };
}

/** The rate in minor units, or null when the field is blank. */
function rateOf(values: TeacherFormValues): number | null {
  return values.rate.trim() === '' ? null : parsePriceInput(values.rate);
}

/** The create request: empty optional fields are omitted. */
export function buildTeacherCreateDto(values: TeacherFormValues): CreateTeacherDto {
  const telegram = bareTelegram(values.telegramUsername);
  const rate = rateOf(values);
  return {
    fullName: values.fullName.trim(),
    avatarKey: values.avatarKey ?? undefined,
    email: optionalCreateText(values.email),
    phone: optionalCreateText(values.phone),
    telegramUsername: telegram === '' ? undefined : telegram,
    subjects: values.subjects,
    defaultRateMinor: rate ?? undefined,
    currency: rate === null ? undefined : values.currency,
    color: values.color,
    bio: optionalCreateText(values.bio),
    notes: optionalCreateText(values.notes),
    status: 'ACTIVE',
  };
}

/** The edit request: an emptied optional field is cleared with null. */
export function buildTeacherEditDto(values: TeacherFormValues): UpdateTeacherDto {
  const telegram = bareTelegram(values.telegramUsername);
  const rate = rateOf(values);
  return {
    fullName: values.fullName.trim(),
    avatarKey: values.avatarKey,
    email: nullableEditText(values.email),
    phone: nullableEditText(values.phone),
    telegramUsername: telegram === '' ? null : telegram,
    subjects: values.subjects,
    defaultRateMinor: rate,
    currency: rate === null ? null : values.currency,
    color: values.color,
    bio: nullableEditText(values.bio),
    notes: nullableEditText(values.notes),
  };
}
