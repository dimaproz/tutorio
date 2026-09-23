import {
  GROUP_CAPACITY_MAX,
  currencyCodeSchema,
  groupNameSchema,
  groupNotesSchema,
  type CreateGroupDto,
  type GroupDetail,
  type UpdateGroupDto,
} from '@tutorio/validation';
import { z } from 'zod';
import { optionalText } from '@/lib/forms/helpers';
import { formatPriceInput, parsePriceInput } from '@/lib/money';

/** The API's limit for group notes. */
export const GROUP_NOTES_MAX = 2000;
/** The API's limit for one roster payload. */
export const GROUP_STUDENTS_MAX = 200;

const LOCAL_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function wholeNumber(value: string): number | null {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/**
 * One schema for create and edit: only the name is required. A schedule is
 * set once at least one weekday is picked; then it needs a start and a
 * duration. `teacherRequired` is on in a school, where somebody has to be
 * named to teach the students or the schedule; a solo tutor never picks one.
 */
export function makeGroupFormSchema({ teacherRequired }: { teacherRequired: boolean }) {
  return z
    .object({
      name: groupNameSchema,
      teacherId: z.string().uuid().nullable(),
      capacity: z.string(),
      weekdays: z.array(z.number().int().min(0).max(6)),
      localTime: z.string(),
      durationMin: z.string(),
      pricePerLesson: z.string(),
      currency: currencyCodeSchema,
      studentIds: z.array(z.string().uuid()).max(GROUP_STUDENTS_MAX),
      notes: optionalText(groupNotesSchema),
    })
    .superRefine((data, ctx) => {
      // No explicit message: a set message would bypass the localized error
      // map, which reads `params.key`.
      const issue = (path: string, key: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], params: { key } });

      if (data.capacity.trim() !== '') {
        const capacity = wholeNumber(data.capacity);
        if (capacity === null || capacity < 1 || capacity > GROUP_CAPACITY_MAX) {
          issue('capacity', 'capacityRange');
        }
      }
      if (data.pricePerLesson.trim() !== '' && parsePriceInput(data.pricePerLesson) === null) {
        issue('pricePerLesson', 'priceInvalid');
      }
      const scheduled = data.weekdays.length > 0;
      if (scheduled) {
        if (!LOCAL_TIME.test(data.localTime)) issue('localTime', 'timeInvalid');
        const duration = wholeNumber(data.durationMin);
        if (duration === null || duration < 5 || duration > 720) {
          issue('durationMin', 'durationRange');
        }
      }
      if (teacherRequired && !data.teacherId && (scheduled || data.studentIds.length > 0)) {
        issue('teacherId', 'teacherRequired');
      }
    });
}

export type GroupFormValues = z.infer<ReturnType<typeof makeGroupFormSchema>>;

export function emptyGroupForm(currency: GroupFormValues['currency']): GroupFormValues {
  return {
    name: '',
    teacherId: null,
    capacity: '',
    weekdays: [],
    localTime: '17:00',
    durationMin: '60',
    pricePerLesson: '',
    currency,
    studentIds: [],
    notes: '',
  };
}

export const GROUP_FORM_SECTIONS = [
  { id: 'basics', fields: ['name', 'teacherId', 'capacity'] },
  { id: 'schedule', fields: ['weekdays', 'localTime', 'durationMin'] },
  { id: 'price', fields: ['pricePerLesson', 'currency'] },
  { id: 'students', fields: ['studentIds'] },
  { id: 'notes', fields: ['notes'] },
] as const satisfies readonly { id: string; fields: readonly (keyof GroupFormValues)[] }[];

export type GroupFormSectionId = (typeof GROUP_FORM_SECTIONS)[number]['id'];
export type GroupFormSectionStatus = 'done' | 'error' | 'none';

/** The fields whose value marks a section as filled in. */
const MEANINGFUL: Record<GroupFormSectionId, readonly (keyof GroupFormValues)[]> = {
  basics: ['name'],
  schedule: ['weekdays'],
  price: ['pricePerLesson'],
  students: ['studentIds'],
  notes: ['notes'],
};

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === 'string' ? value.trim() !== '' : value != null;
}

/**
 * Where each section stands: an error wins, otherwise a section is done once
 * one of its meaningful fields holds a value. A group whose schedule already
 * exists (edited on the patterns screen) counts its schedule as done.
 */
export function groupFormSectionStatus(
  values: Pick<GroupFormValues, 'name' | 'weekdays' | 'pricePerLesson' | 'studentIds' | 'notes'>,
  errorFields: readonly string[],
  { scheduleLocked = false }: { scheduleLocked?: boolean } = {},
): Record<GroupFormSectionId, GroupFormSectionStatus> {
  const errors = new Set(errorFields);
  return Object.fromEntries(
    GROUP_FORM_SECTIONS.map((section) => {
      const status: GroupFormSectionStatus = section.fields.some((field) => errors.has(field))
        ? 'error'
        : (section.id === 'schedule' && scheduleLocked) ||
            MEANINGFUL[section.id].some((field) => hasValue(values[field as keyof typeof values]))
          ? 'done'
          : 'none';
      return [section.id, status];
    }),
  ) as Record<GroupFormSectionId, GroupFormSectionStatus>;
}

/** The saved group as form values. */
export function groupFormDefaults(
  group: GroupDetail,
  fallbackCurrency: GroupFormValues['currency'],
): GroupFormValues {
  return {
    name: group.name,
    teacherId: group.teacherId ?? group.teacher?.id ?? null,
    capacity: group.capacity === null ? '' : String(group.capacity),
    weekdays: [],
    localTime: '17:00',
    durationMin: '60',
    pricePerLesson: group.pricePerLesson === null ? '' : formatPriceInput(group.pricePerLesson),
    currency: group.currency ?? fallbackCurrency,
    studentIds: group.enrollments.map((enrollment) => enrollment.studentId),
    notes: group.notes ?? '',
  };
}

function priceOf(values: GroupFormValues): number | null {
  return values.pricePerLesson.trim() === '' ? null : parsePriceInput(values.pricePerLesson);
}

function scheduleOf(values: GroupFormValues) {
  return values.weekdays.length > 0
    ? {
        weekdays: [...values.weekdays].sort((a, b) => a - b),
        localTime: values.localTime,
        durationMin: Number(values.durationMin.trim()),
      }
    : undefined;
}

/** The create request: empty optional fields are omitted. */
export function buildGroupCreateDto(values: GroupFormValues): CreateGroupDto {
  const price = priceOf(values);
  const capacity = wholeNumber(values.capacity);
  const notes = values.notes.trim();
  return {
    name: values.name.trim(),
    teacherId: values.teacherId ?? undefined,
    capacity: capacity ?? undefined,
    pricePerLesson: price ?? undefined,
    currency: price === null ? undefined : values.currency,
    notes: notes === '' ? undefined : notes,
    students:
      values.studentIds.length > 0
        ? { studentIds: values.studentIds, teacherId: values.teacherId ?? undefined }
        : undefined,
    schedule: scheduleOf(values),
  };
}

/**
 * The edit request: an emptied optional field is cleared with null. The
 * roster goes only when the form changed it, so a rename cannot overwrite a
 * roster edited elsewhere since the page opened; the teacher only when it
 * changed, because a new teacher moves the group's upcoming lessons; the
 * schedule only when the group had none.
 */
export function buildGroupEditDto(
  values: GroupFormValues,
  /** The values the form opened with (`groupFormDefaults`), not the record. */
  original: Pick<GroupFormValues, 'teacherId'> & { studentIds: readonly string[] },
  { scheduleLocked }: { scheduleLocked: boolean },
): UpdateGroupDto {
  const price = priceOf(values);
  const capacity = wholeNumber(values.capacity);
  const notes = values.notes.trim();
  const before = new Set(original.studentIds);
  const rosterChanged =
    before.size !== values.studentIds.length || values.studentIds.some((id) => !before.has(id));

  const dto: UpdateGroupDto = {
    name: values.name.trim(),
    capacity: capacity,
    pricePerLesson: price,
    currency: price === null ? null : values.currency,
    notes: notes === '' ? null : notes,
  };
  if (values.teacherId && values.teacherId !== original.teacherId) {
    dto.teacherId = values.teacherId;
  }
  if (rosterChanged) {
    dto.students = { studentIds: values.studentIds, teacherId: values.teacherId ?? undefined };
  }
  const schedule = scheduleLocked ? undefined : scheduleOf(values);
  if (schedule) dto.schedule = schedule;
  return dto;
}
