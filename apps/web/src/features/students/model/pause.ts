import type {
  CreatePauseDto,
  PausePreviewDto,
  PauseResponse,
  UpdatePauseDto,
} from '@tutorio/validation';
import { z } from 'zod';

/**
 * The reasons offered as chips (board 02, state 08). A pause stores the key
 * as its reason, so each locale names it; any other text shows as it is.
 */
export const PAUSE_REASONS = ['HOLIDAY', 'ILLNESS', 'VACATION', 'MOVING', 'OTHER'] as const;
export type PauseReason = (typeof PAUSE_REASONS)[number];

export function isPauseReason(value: string | null): value is PauseReason {
  return PAUSE_REASONS.includes(value as PauseReason);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * «Пауза» (L-100): the whole student or one direction, from a first day
 * until an optional last day (blank: until the tutor brings them back), and
 * why.
 */
export const pauseFormSchema = z
  .object({
    scope: z.enum(['student', 'direction']),
    enrollmentId: z.string(),
    from: z.string(),
    until: z.string(),
    reason: z.enum(PAUSE_REASONS),
  })
  .superRefine((values, ctx) => {
    if (!DATE.test(values.from)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['from'],
        params: { key: 'pauseStartRequired' },
      });
    }
    if (values.until && DATE.test(values.from) && values.until < values.from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['until'],
        params: { key: 'pauseEndBeforeStart' },
      });
    }
    if (values.scope === 'direction' && !values.enrollmentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['enrollmentId'],
        params: { key: 'directionRequired' },
      });
    }
  });

export type PauseFormValues = z.infer<typeof pauseFormSchema>;

/** "yyyy-MM-dd" of a local date. */
export function dateKey(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The local midnight of a "yyyy-MM-dd". */
function midnight(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year!, month! - 1, day!);
}

/** The local midnight after a "yyyy-MM-dd": the exclusive end of that day. */
function dayAfter(key: string): Date {
  const date = midnight(key);
  date.setDate(date.getDate() + 1);
  return date;
}

/** The pause's last day, from its exclusive end. */
export function lastPauseDay(endsAt: string): Date {
  return new Date(Date.parse(endsAt) - 1);
}

/**
 * A new pause starts today for the whole student (or the direction it was
 * opened from); a change starts from the pause as it is.
 */
export function pauseFormDefaults({
  today,
  enrollmentId,
  pause,
}: {
  today: string;
  enrollmentId?: string | null;
  pause?: PauseResponse | null;
}): PauseFormValues {
  if (pause) {
    return {
      scope: pause.enrollmentId ? 'direction' : 'student',
      enrollmentId: pause.enrollmentId ?? '',
      from: dateKey(new Date(pause.startsAt)),
      until: pause.endsAt ? dateKey(lastPauseDay(pause.endsAt)) : '',
      reason: isPauseReason(pause.reason) ? pause.reason : 'OTHER',
    };
  }
  return {
    scope: enrollmentId ? 'direction' : 'student',
    enrollmentId: enrollmentId ?? '',
    from: today,
    until: '',
    reason: 'HOLIDAY',
  };
}

/**
 * The window as the API takes it: from the first day's midnight (today
 * means now) to the midnight after the last day, exclusive (L-100).
 */
function window(values: PauseFormValues, today: string) {
  return {
    ...(values.from > today ? { startsAt: midnight(values.from).toISOString() } : {}),
    endsAt: values.until ? dayAfter(values.until).toISOString() : null,
  };
}

export function pauseCreateDto(
  values: PauseFormValues,
  studentId: string,
  today: string,
): CreatePauseDto {
  return {
    studentId,
    enrollmentId: values.scope === 'direction' ? values.enrollmentId : null,
    ...window(values, today),
    reason: values.reason,
  };
}

export function pausePreviewDto(
  values: PauseFormValues,
  studentId: string,
  today: string,
  replacesPauseId?: string,
): PausePreviewDto {
  return {
    ...pauseCreateDto(values, studentId, today),
    ...(replacesPauseId ? { replacesPauseId } : {}),
  };
}

/**
 * A change: a running pause takes a new end and reason only; one that has
 * not begun takes everything.
 */
export function pauseUpdateDto(
  values: PauseFormValues,
  pause: PauseResponse,
  today: string,
): UpdatePauseDto {
  const { startsAt, endsAt } = window(values, today);
  if (pause.state === 'ACTIVE') return { endsAt, reason: values.reason };
  return {
    enrollmentId: values.scope === 'direction' ? values.enrollmentId : null,
    ...(startsAt ? { startsAt } : {}),
    endsAt,
    reason: values.reason,
  };
}

/** A form value ready to ask the preview for: a valid start and a sane end. */
export function pausePreviewReady(values: PauseFormValues): boolean {
  return pauseFormSchema.safeParse(values).success;
}
