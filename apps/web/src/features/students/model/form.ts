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

// ---------------------------------------------------------------------------
// Full-page student form (create and edit share one field set)
// ---------------------------------------------------------------------------

export type StudentFormValues = StudentEditValues;

export const studentFormSchema = studentEditSchema;

export const STUDENT_FORM_SECTIONS = [
  { id: 'identity', fields: ['fullName', 'avatarKey'] },
  { id: 'contacts', fields: ['email', 'phone', 'telegramUsername'] },
  { id: 'learning', fields: ['age', 'grade', 'knowledgeLevel', 'languageLevel'] },
  { id: 'preferences', fields: ['timezone'] },
  { id: 'pricing', fields: ['pricePerLesson', 'currency'] },
  { id: 'notes', fields: ['notes'] },
] as const satisfies readonly { id: string; fields: readonly (keyof StudentFormValues)[] }[];

export type StudentFormSectionId = (typeof STUDENT_FORM_SECTIONS)[number]['id'];
export type StudentFormSectionStatus = 'done' | 'error' | 'none';

/** The fields whose value marks a section as filled in. */
const MEANINGFUL: Record<StudentFormSectionId, readonly (keyof StudentFormValues)[]> = {
  identity: ['fullName'],
  contacts: ['email', 'phone', 'telegramUsername'],
  learning: ['age', 'grade', 'knowledgeLevel', 'languageLevel'],
  preferences: ['timezone'],
  pricing: ['pricePerLesson'],
  notes: ['notes'],
};

function hasValue(value: unknown): boolean {
  return typeof value === 'string' ? value.trim() !== '' : value != null;
}

/**
 * Where each section stands: an error wins, otherwise a section is done once
 * one of its meaningful fields holds a value. Drives the section navigation,
 * the progress meter and the save bar.
 */
export function studentFormSectionStatus(
  values: StudentFormValues,
  errorFields: readonly string[],
): Record<StudentFormSectionId, StudentFormSectionStatus> {
  const errors = new Set(errorFields);
  return Object.fromEntries(
    STUDENT_FORM_SECTIONS.map((section) => {
      const status: StudentFormSectionStatus = section.fields.some((field) => errors.has(field))
        ? 'error'
        : MEANINGFUL[section.id].some((field) => hasValue(values[field]))
          ? 'done'
          : 'none';
      return [section.id, status];
    }),
  ) as Record<StudentFormSectionId, StudentFormSectionStatus>;
}

/** The empty full-page form. Timezone and currency are prefilled. */
export function emptyStudentForm(options: {
  currency: string;
  timezone?: string;
}): StudentFormValues {
  return {
    fullName: '',
    email: '',
    phone: '',
    telegramUsername: '',
    timezone: resolveStudentTimezone(options.timezone),
    pricePerLesson: '',
    currency: options.currency as StudentFormValues['currency'],
    languageLevel: '',
    knowledgeLevel: '',
    age: '',
    grade: '',
    avatarKey: null,
    notes: '',
  };
}

/** The create request from the full-page form: empty fields are omitted. */
export function buildStudentCreateDto(values: StudentFormValues): CreateStudentDto {
  return {
    ...buildStudentQuickCreateDto(values),
    languageLevel: values.languageLevel === '' ? undefined : values.languageLevel,
    knowledgeLevel: values.knowledgeLevel === '' ? undefined : values.knowledgeLevel,
    avatarKey: values.avatarKey ?? undefined,
  };
}

/**
 * Local draft of an unfinished create form, kept in this browser only. The
 * key is scoped to the account and the workspace: another person signing in
 * on the same browser must never be offered someone else's student.
 */
export function studentDraftKey(userId: string, workspaceId: string): string {
  return `tutorio.student-create-draft:${userId}:${workspaceId}`;
}

/** The unscoped key used before drafts were scoped; removed on sight. */
export const LEGACY_STUDENT_DRAFT_KEY = 'tutorio.student-create-draft';

export function parseStudentDraft(raw: string | null): Partial<StudentFormValues> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const draft: Partial<StudentFormValues> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key === 'avatarKey') {
        const avatar = avatarKeySchema.nullable().safeParse(value);
        if (avatar.success) draft.avatarKey = avatar.data;
      } else if (typeof value === 'string' && key in emptyStudentForm({ currency: 'UAH' })) {
        (draft as Record<string, string>)[key] = value;
      }
    }
    return draft;
  } catch {
    return null;
  }
}
