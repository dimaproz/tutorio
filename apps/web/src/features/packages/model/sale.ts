import type {
  CreatePackageDto,
  PackageSizingModeDto,
  StudentBillingResponse,
} from '@tutorio/validation';
import { z } from 'zod';
import { parsePriceInput } from '@/lib/money';
import { dayKey, endOfDayExclusive, isDayKey, startOfDay } from './dates';

/** One direction of a student, as the billing read describes it (S06). */
export type SaleDirection = StudentBillingResponse['directions'][number];

/** The three kinds, in the order the sale offers them (L-80). */
export const SALE_KINDS = [
  'FIXED_COUNT',
  'BY_PERIOD',
  'BY_PERIOD_WEEKLY',
] as const satisfies readonly PackageSizingModeDto[];

export const LESSONS_PER_WEEK = ['1', '2', '3', '4', '5'] as const;

/** Which price field the tutor typed last: it wins, the other follows (decision 2). */
export type PriceSource = 'perLesson' | 'total';

/**
 * «Новий пакет» (S07 board 01): the kind, its count or window, and the price
 * as two linked fields. `lessons` is the count of a count package or the
 * tutor's own count for a period from the schedule (empty: the schedule's).
 */
export function saleFormSchema(today: string) {
  return z
    .object({
      kind: z.enum(SALE_KINDS),
      lessons: z.string(),
      until: z.string(),
      from: z.string(),
      to: z.string(),
      perWeek: z.enum(LESSONS_PER_WEEK),
      perLesson: z.string(),
      total: z.string(),
      priceSource: z.enum(['perLesson', 'total']),
    })
    .superRefine((values, ctx) => {
      const issue = (path: string, key: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], params: { key } });
      const count = parseCount(values.lessons);
      if (values.kind === 'FIXED_COUNT') {
        if (count === null || count < 1 || count > 500) issue('lessons', 'lessonsAtLeastOne');
        if (values.until && values.until <= today) issue('until', 'dateIsPast');
      } else {
        if (!isDayKey(values.from)) issue('from', 'periodStartRequired');
        if (!isDayKey(values.to)) issue('to', 'periodEndRequired');
        else if (isDayKey(values.from) && values.to < values.from) {
          issue('to', 'periodEndBeforeStart');
        }
        if (values.kind === 'BY_PERIOD' && values.lessons.trim() !== '') {
          if (count === null || count < 1 || count > 500) issue('lessons', 'lessonsAtLeastOne');
        }
      }
      const field = values.priceSource;
      const price = parsePriceInput(values[field]);
      if (values[field].trim() === '') issue(field, 'priceRequired');
      else if (price === null) issue(field, 'priceInvalid');
      else if (price <= 0) issue(field, 'amountAboveZero');
    });
}

export type SaleFormValues = z.infer<ReturnType<typeof saleFormSchema>>;

/** A plain decimal a money field shows: 400000 → "4000", 42857 → "428.57". */
export function moneyText(minor: number): string {
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
}

/** A whole count typed in a field, or null. */
export function parseCount(text: string): number | null {
  const trimmed = text.trim();
  return /^\d{1,4}$/.test(trimmed) ? Number(trimmed) : null;
}

/**
 * Opens as a count package of 8 at the direction's rate, valid for a month;
 * a period runs from tomorrow to the last day of the next month's same date.
 */
export function saleFormDefaults(direction: SaleDirection | null, now: Date): SaleFormValues {
  const from = new Date(now);
  from.setDate(from.getDate() + 1);
  const until = new Date(from);
  until.setMonth(until.getMonth() + 1);
  until.setDate(until.getDate() - 1);
  return {
    kind: 'FIXED_COUNT',
    lessons: '8',
    until: dayKey(until),
    from: dayKey(from),
    to: dayKey(until),
    perWeek: '2',
    perLesson: direction && direction.rateMinor > 0 ? moneyText(direction.rateMinor) : '',
    total: '',
    priceSource: 'perLesson',
  };
}

/**
 * The two linked price fields (decision 2): the one typed last is kept, the
 * other is derived — the total is the per-lesson price times the lessons,
 * the per-lesson price the total divided by them, rounded like the API.
 */
export function linkedPrice(
  values: Pick<SaleFormValues, 'perLesson' | 'total' | 'priceSource'>,
  lessons: number | null,
): { perLessonMinor: number | null; totalMinor: number | null } {
  if (values.priceSource === 'perLesson') {
    const perLessonMinor = parsePriceInput(values.perLesson);
    return {
      perLessonMinor,
      totalMinor: perLessonMinor !== null && lessons ? perLessonMinor * lessons : null,
    };
  }
  const totalMinor = parsePriceInput(values.total);
  return {
    perLessonMinor: totalMinor !== null && lessons ? Math.round(totalMinor / lessons) : null,
    totalMinor,
  };
}

/** The lessons a count package holds, as typed; a period's come from the preview. */
export function typedLessons(values: Pick<SaleFormValues, 'kind' | 'lessons'>): number | null {
  if (values.kind === 'BY_PERIOD_WEEKLY') return null;
  const count = parseCount(values.lessons);
  return count !== null && count >= 1 ? count : null;
}

/**
 * The sale request: the direction (its group, or its teacher), the kind with
 * its count or window, and exactly one price. A period runs from the first
 * day's midnight to the last day's end; a count package's «Діє до» ends
 * after that day. A period's count is sent only when the tutor typed one.
 */
export function saleDto(values: SaleFormValues, direction: SaleDirection, studentId: string) {
  const price =
    values.priceSource === 'perLesson'
      ? { pricePerLessonMinor: parsePriceInput(values.perLesson) ?? 0 }
      : { totalPriceMinor: parsePriceInput(values.total) ?? 0 };
  const target = direction.group
    ? { groupId: direction.group.id }
    : { teacherId: direction.teacher.id };
  const count = parseCount(values.lessons);
  const kind =
    values.kind === 'FIXED_COUNT'
      ? {
          lessonsTotal: count ?? 0,
          expiresAt: values.until ? endOfDayExclusive(values.until).toISOString() : null,
        }
      : {
          validFrom: startOfDay(values.from).toISOString(),
          endDate: new Date(endOfDayExclusive(values.to).getTime() - 1).toISOString(),
          ...(values.kind === 'BY_PERIOD_WEEKLY'
            ? { lessonsPerWeek: Number(values.perWeek) }
            : count !== null && values.lessons.trim() !== ''
              ? { lessonsTotal: count }
              : {}),
        };
  return {
    studentId,
    ...target,
    sizingMode: values.kind,
    currency: direction.currency,
    ...kind,
    ...price,
  } satisfies CreatePackageDto;
}

/**
 * The preview request once the form can describe a package: null while a
 * field it needs is missing or wrong, so the preview shows its empty card.
 */
export function salePreviewDto(
  values: SaleFormValues,
  direction: SaleDirection | null,
  studentId: string | null,
  today: string,
) {
  if (!direction || !studentId) return null;
  const parsed = saleFormSchema(today).safeParse(values);
  return parsed.success ? saleDto(parsed.data, direction, studentId) : null;
}
