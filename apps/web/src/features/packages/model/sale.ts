import type {
  CreatePackageDto,
  PackageSizingModeDto,
  StudentBillingResponse,
} from '@tutorio/validation';
import { z } from 'zod';
import { parsePriceInput } from '@/lib/money';
import { addDays, addMonth, dayKey, endOfDayExclusive, isDayKey, startOfDay } from './dates';

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
      /** The package's name as typed; empty until the tutor types one. */
      name: z.string(),
      /** Whether the tutor typed the name: until then it follows the default. */
      nameEdited: z.boolean(),
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
      if (values.name.trim().length > 120) issue('name', 'packageNameTooLong');
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
 * a period runs from tomorrow (the studio's) to the day before the same date
 * a month later.
 */
export function saleFormDefaults(
  direction: SaleDirection | null,
  now: Date,
  timeZone: string,
): SaleFormValues {
  const from = addDays(dayKey(now, timeZone), 1);
  const until = addDays(addMonth(from), -1);
  return {
    kind: 'FIXED_COUNT',
    lessons: '8',
    until,
    from,
    to: until,
    perWeek: '2',
    perLesson: direction && direction.rateMinor > 0 ? moneyText(direction.rateMinor) : '',
    total: '',
    priceSource: 'perLesson',
    name: '',
    nameEdited: false,
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
 * The name the package is sold with: the tutor's, or — untouched or cleared
 * — the default the form suggests («English · 8 занять»).
 */
export function saleName(
  values: Pick<SaleFormValues, 'name' | 'nameEdited'>,
  suggested: string,
): string {
  const typed = values.name.trim();
  return values.nameEdited && typed ? typed : suggested;
}

/**
 * The sale request: the direction (its group, or its teacher), the kind with
 * its count or window, and exactly one price. A period runs from the first
 * day's midnight to the last day's end; a count package's «Діє до» ends
 * after that day — the studio's midnights, whatever the browser's zone. A
 * period's count is sent only when the tutor typed one.
 */
export function saleDto(
  values: SaleFormValues,
  direction: SaleDirection,
  studentId: string,
  timeZone: string,
  name?: string,
) {
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
          expiresAt: values.until ? endOfDayExclusive(values.until, timeZone).toISOString() : null,
        }
      : {
          validFrom: startOfDay(values.from, timeZone).toISOString(),
          endDate: new Date(endOfDayExclusive(values.to, timeZone).getTime() - 1).toISOString(),
          ...(values.kind === 'BY_PERIOD_WEEKLY'
            ? { lessonsPerWeek: Number(values.perWeek) }
            : count !== null && values.lessons.trim() !== ''
              ? { lessonsTotal: count }
              : {}),
        };
  return {
    studentId,
    ...target,
    ...(name ? { name } : {}),
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
  timeZone: string,
) {
  if (!direction || !studentId) return null;
  const parsed = saleFormSchema(today).safeParse(values);
  return parsed.success ? saleDto(parsed.data, direction, studentId, timeZone) : null;
}
