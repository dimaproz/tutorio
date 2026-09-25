import type {
  CreatePauseDto,
  PausePreviewDto,
  PauseResponse,
  UpdatePauseDto,
} from '@tutorio/validation';
import { z } from 'zod';
import { dayEndIso, dayStartIso, zonedDate } from '@/lib/datetime';

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

/** "yyyy-MM-dd": the studio's day of an instant. */
export function dateKey(date: Date | number | string, timeZone: string): string {
  return zonedDate(date, timeZone);
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
  timeZone,
}: {
  today: string;
  enrollmentId?: string | null;
  pause?: PauseResponse | null;
  timeZone: string;
}): PauseFormValues {
  if (pause) {
    return {
      scope: pause.enrollmentId ? 'direction' : 'student',
      enrollmentId: pause.enrollmentId ?? '',
      from: dateKey(pause.startsAt, timeZone),
      until: pause.endsAt ? dateKey(lastPauseDay(pause.endsAt), timeZone) : '',
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
 * means now) to the midnight after the last day, exclusive (L-100) — the
 * studio's midnights.
 */
function window(values: PauseFormValues, today: string, timeZone: string) {
  return {
    ...(values.from > today ? { startsAt: dayStartIso(values.from, timeZone) } : {}),
    endsAt: values.until ? dayEndIso(values.until, timeZone) : null,
  };
}

export function pauseCreateDto(
  values: PauseFormValues,
  studentId: string,
  today: string,
  timeZone: string,
): CreatePauseDto {
  return {
    studentId,
    enrollmentId: values.scope === 'direction' ? values.enrollmentId : null,
    ...window(values, today, timeZone),
    reason: values.reason,
  };
}

export function pausePreviewDto(
  values: PauseFormValues,
  studentId: string,
  today: string,
  timeZone: string,
  replacesPauseId?: string,
): PausePreviewDto {
  return {
    ...pauseCreateDto(values, studentId, today, timeZone),
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
  timeZone: string,
): UpdatePauseDto {
  const { startsAt, endsAt } = window(values, today, timeZone);
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
