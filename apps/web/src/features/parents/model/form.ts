import {
  avatarKeySchema,
  emailSchema,
  notesSchema,
  parentFullNameSchema,
  phoneSchema,
  telegramUsernameSchema,
  type CreateParentDto,
  type ParentDetail,
  type UpdateParentDto,
} from '@tutorio/validation';
import { z } from 'zod';
import { optionalText } from '@/lib/forms/helpers';

/** The API's limit for parent notes. */
export const PARENT_NOTES_MAX = 2000;
/** The API's limit for the students linked in one request. */
export const PARENT_STUDENTS_MAX = 20;

/** One schema for create and edit: only the name is required. */
export const parentFormSchema = z.object({
  fullName: parentFullNameSchema,
  email: optionalText(emailSchema),
  phone: optionalText(phoneSchema),
  telegramUsername: optionalText(telegramUsernameSchema),
  avatarKey: avatarKeySchema.nullable(),
  // The API links at most this many students in one request.
  studentIds: z.array(z.string().uuid()).max(PARENT_STUDENTS_MAX),
  notes: optionalText(notesSchema),
});
export type ParentFormValues = z.infer<typeof parentFormSchema>;

export const EMPTY_PARENT_FORM: ParentFormValues = {
  fullName: '',
  email: '',
  phone: '',
  telegramUsername: '',
  avatarKey: null,
  studentIds: [],
  notes: '',
};

export const PARENT_FORM_SECTIONS = [
  { id: 'identity', fields: ['fullName', 'avatarKey'] },
  { id: 'contacts', fields: ['email', 'phone', 'telegramUsername'] },
  { id: 'students', fields: ['studentIds'] },
  { id: 'notes', fields: ['notes'] },
] as const satisfies readonly { id: string; fields: readonly (keyof ParentFormValues)[] }[];

export type ParentFormSectionId = (typeof PARENT_FORM_SECTIONS)[number]['id'];
export type ParentFormSectionStatus = 'done' | 'error' | 'none';

/** The fields whose value marks a section as filled in. */
const MEANINGFUL: Record<ParentFormSectionId, readonly (keyof ParentFormValues)[]> = {
  identity: ['fullName'],
  contacts: ['email', 'phone', 'telegramUsername'],
  students: ['studentIds'],
  notes: ['notes'],
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
export function parentFormSectionStatus(
  values: ParentFormValues,
  errorFields: readonly string[],
): Record<ParentFormSectionId, ParentFormSectionStatus> {
  const errors = new Set(errorFields);
  return Object.fromEntries(
    PARENT_FORM_SECTIONS.map((section) => {
      const status: ParentFormSectionStatus = section.fields.some((field) => errors.has(field))
        ? 'error'
        : MEANINGFUL[section.id].some((field) => hasValue(values[field]))
          ? 'done'
          : 'none';
      return [section.id, status];
    }),
  ) as Record<ParentFormSectionId, ParentFormSectionStatus>;
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

/** The saved record as form values. */
export function parentFormDefaults(parent: ParentDetail): ParentFormValues {
  return {
    fullName: parent.fullName,
    email: parent.email ?? '',
    phone: parent.phone ?? '',
    telegramUsername: bareTelegram(parent.telegramUsername ?? ''),
    avatarKey: parent.avatarKey,
    studentIds: parent.students.map((student) => student.id),
    notes: parent.notes ?? '',
  };
}

/** The create request: empty optional fields are omitted. */
export function buildParentCreateDto(values: ParentFormValues): CreateParentDto {
  const telegram = bareTelegram(values.telegramUsername);
  return {
    fullName: values.fullName.trim(),
    email: optionalCreateText(values.email),
    phone: optionalCreateText(values.phone),
    telegramUsername: telegram === '' ? undefined : telegram,
    avatarKey: values.avatarKey ?? undefined,
    studentIds: values.studentIds,
    notes: optionalCreateText(values.notes),
  };
}

/**
 * The edit request: an emptied optional field is cleared with null. The
 * student links go only when the form changed them, so a rename cannot
 * overwrite links made elsewhere since the page opened.
 */
export function buildParentEditDto(
  values: ParentFormValues,
  { linksChanged = true }: { linksChanged?: boolean } = {},
): UpdateParentDto {
  const telegram = bareTelegram(values.telegramUsername);
  const dto: UpdateParentDto = {
    fullName: values.fullName.trim(),
    email: nullableEditText(values.email),
    phone: nullableEditText(values.phone),
    telegramUsername: telegram === '' ? null : telegram,
    avatarKey: values.avatarKey,
    studentIds: values.studentIds,
    notes: nullableEditText(values.notes),
  };
  if (!linksChanged) delete dto.studentIds;
  return dto;
}
