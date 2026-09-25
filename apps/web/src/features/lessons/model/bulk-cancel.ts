import {
  BULK_CANCEL_MAX_DAYS,
  notesSchema,
  type BulkCancelDto,
  type BulkCancelPreview,
} from '@tutorio/validation';
import { z } from 'zod';
import { optionalText } from '@/lib/forms/helpers';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The reason chips of the form (L-54); each fills the reason with its words. */
export const BULK_CANCEL_REASONS = ['holiday', 'sickLeave', 'vacation', 'teacherLeave'] as const;
export type BulkCancelReason = (typeof BULK_CANCEL_REASONS)[number];

/**
 * «Скасування занять» (S04): a period «З» / «По» (both days included), the
 * whole studio or one teacher, and a reason — a chip, words of one's own, or
 * both. Lessons are cancelled free, by the teacher (L-54).
 */
export const bulkCancelFormSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    scope: z.enum(['studio', 'teacher']),
    teacherId: z.string(),
    reason: z.enum(BULK_CANCEL_REASONS).nullable(),
    ownReason: optionalText(notesSchema),
  })
  .superRefine((values, ctx) => {
    const issue = (path: string, key: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], params: { key } });
    if (!DATE_RE.test(values.from)) issue('from', 'periodStartRequired');
    if (!DATE_RE.test(values.to)) issue('to', 'periodEndRequired');
    else if (DATE_RE.test(values.from)) {
      if (values.to < values.from) issue('to', 'periodEndBeforeStart');
      else if (periodDays(values.from, values.to) > BULK_CANCEL_MAX_DAYS) {
        issue('to', 'periodTooLong');
      }
    }
    if (values.scope === 'teacher' && !values.teacherId) issue('teacherId', 'teacherPick');
  });

export type BulkCancelFormValues = z.infer<typeof bulkCancelFormSchema>;

export function bulkCancelDefaults(today: string, teacherId = ''): BulkCancelFormValues {
  return {
    from: today,
    to: today,
    scope: 'studio',
    teacherId,
    reason: 'holiday',
    ownReason: '',
  };
}

/** Local midnight of "yyyy-MM-dd". */
function startOfLocalDay(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year!, month! - 1, day!);
}

/** How many calendar days «З» to «По» covers, both included. */
export function periodDays(from: string, to: string): number {
  const start = startOfLocalDay(from);
  const end = startOfLocalDay(to);
  return Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

/**
 * The request: `[from, to)` in the browser's zone, so the «По» day is
 * included; the chip's words and the tutor's own joined as the reason.
 */
export function bulkCancelDto(
  values: BulkCancelFormValues,
  reasonLabel: (reason: BulkCancelReason) => string,
): BulkCancelDto {
  const end = startOfLocalDay(values.to);
  end.setDate(end.getDate() + 1);
  const parts = [values.reason ? reasonLabel(values.reason) : null, values.ownReason?.trim()];
  const reason = parts.filter(Boolean).join(' · ');
  return {
    from: startOfLocalDay(values.from).toISOString(),
    to: end.toISOString(),
    ...(values.scope === 'teacher' && values.teacherId ? { teacherId: values.teacherId } : {}),
    reason: reason || null,
  };
}

export type BulkCancelLesson = BulkCancelPreview['lessons'][number];

/** «10 індивідуальних · 4 групових»: counted from the lessons the preview names. */
export function bulkCancelSplit(preview: BulkCancelPreview) {
  const group = preview.lessons.filter((lesson) => lesson.group !== null).length;
  // A truncated list names only its first lessons; the rest count as unknown.
  return preview.truncated ? null : { individual: preview.lessons.length - group, group };
}

/** The lessons by local day, soonest first, for the check step. */
export function lessonsByDay(lessons: readonly BulkCancelLesson[]) {
  const days = new Map<string, BulkCancelLesson[]>();
  for (const lesson of [...lessons].sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc))) {
    const start = new Date(lesson.startsAtUtc);
    const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
    days.set(key, [...(days.get(key) ?? []), lesson]);
  }
  return [...days.values()].map((items) => ({ day: items[0]!.startsAtUtc, lessons: items }));
}
