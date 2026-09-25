import type { LessonQuickFilterDto, LessonStatusDto } from '@tutorio/validation';

/**
 * The Lessons page's state (S04), all of it in the URL so a view survives a
 * reload and can be shared: the quick filter, the period, the teacher, the
 * student or group, the statuses, the search, the order and the page. A
 * default is never written, so the plain page has a plain URL.
 */

export const QUICK_FILTERS = ['all', 'unpaid', 'cancelled', 'no_show', 'needs_makeup'] as const;
export type QuickFilter = (typeof QUICK_FILTERS)[number];

export const PERIOD_PRESETS = ['week', 'month', 'lastMonth', 'last3Months', 'all'] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];
export type Period = PeriodPreset | 'custom';

/** The status menu's lines; «Скасовані» covers both cancelled statuses. */
export const STATUS_OPTIONS = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
export type StatusOption = (typeof STATUS_OPTIONS)[number];

export type ListOrder = 'desc' | 'asc';

export type LessonListState = {
  page: number;
  quick: QuickFilter;
  period: Period;
  /** "yyyy-MM-dd", both days included; only for a custom period. */
  from: string | null;
  to: string | null;
  teacherId: string | null;
  studentId: string | null;
  groupId: string | null;
  statuses: StatusOption[];
  search: string | null;
  order: ListOrder;
};

/** The URL parameters the page writes. */
export const PARAM = {
  quick: 'quick',
  period: 'period',
  from: 'from',
  to: 'to',
  teacher: 'teacher',
  student: 'student',
  group: 'group',
  status: 'status',
  search: 'q',
  order: 'order',
  page: 'page',
} as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const oneOf = <T extends string>(values: readonly T[], value: string | null): T | null =>
  value !== null && (values as readonly string[]).includes(value) ? (value as T) : null;

export function readListState(params: URLSearchParams): LessonListState {
  const from = params.get(PARAM.from);
  const to = params.get(PARAM.to);
  const custom = from !== null && DATE_RE.test(from) && (to === null || DATE_RE.test(to));
  const page = Number(params.get(PARAM.page));
  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    quick: oneOf(QUICK_FILTERS, params.get(PARAM.quick)) ?? 'all',
    period: custom ? 'custom' : (oneOf(PERIOD_PRESETS, params.get(PARAM.period)) ?? 'month'),
    from: custom ? from : null,
    to: custom ? (to ?? from) : null,
    teacherId: params.get(PARAM.teacher) || null,
    studentId: params.get(PARAM.student) || null,
    groupId: params.get(PARAM.student) ? null : params.get(PARAM.group) || null,
    statuses: (params.get(PARAM.status) ?? '')
      .split(',')
      .map((value) => oneOf(STATUS_OPTIONS, value))
      .filter((value): value is StatusOption => value !== null),
    search: params.get(PARAM.search)?.trim() || null,
    order: params.get(PARAM.order) === 'asc' ? 'asc' : 'desc',
  };
}

/** A local "yyyy-MM-dd". */
export function dayKey(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDay(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year!, month! - 1, day!);
}

/** Monday of the week `date` is in, at local midnight. */
function startOfWeek(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

/**
 * The period as the API reads it, `[from, to)` in the browser's zone (the
 * clock the list shows times by); «Увесь час» has no bounds.
 */
export function periodRange(
  state: Pick<LessonListState, 'period' | 'from' | 'to'>,
  now: number,
): { from: Date; to: Date } | null {
  const today = new Date(now);
  const year = today.getFullYear();
  const month = today.getMonth();
  switch (state.period) {
    case 'week': {
      const from = startOfWeek(today);
      return { from, to: new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7) };
    }
    case 'month':
      return { from: new Date(year, month, 1), to: new Date(year, month + 1, 1) };
    case 'lastMonth':
      return { from: new Date(year, month - 1, 1), to: new Date(year, month, 1) };
    case 'last3Months':
      return { from: new Date(year, month - 2, 1), to: new Date(year, month + 1, 1) };
    case 'all':
      return null;
    case 'custom': {
      if (!state.from || !state.to) return null;
      const [first, last] =
        state.from <= state.to ? [state.from, state.to] : [state.to, state.from];
      const to = parseDay(last);
      to.setDate(to.getDate() + 1);
      return { from: parseDay(first), to };
    }
  }
}

/** The current week, for the header's «12 цього тижня». */
export function currentWeek(now: number) {
  return periodRange({ period: 'week', from: null, to: null }, now)!;
}

const STATUS_VALUES: Record<StatusOption, LessonStatusDto[]> = {
  SCHEDULED: ['SCHEDULED'],
  COMPLETED: ['COMPLETED'],
  CANCELLED: ['CANCELLED_CHARGED', 'CANCELLED_UNCHARGED'],
  NO_SHOW: ['NO_SHOW'],
};

export const PAGE_SIZE = 20;

/** The `GET /lessons/list` query of a state. */
export function listQuery(state: LessonListState, now: number) {
  const range = periodRange(state, now);
  const statuses = state.statuses.flatMap((option) => STATUS_VALUES[option]);
  return {
    page: state.page,
    pageSize: PAGE_SIZE,
    from: range?.from.toISOString(),
    to: range?.to.toISOString(),
    teacherId: state.teacherId ?? undefined,
    studentId: state.studentId ?? undefined,
    groupId: state.groupId ?? undefined,
    status: statuses.length > 0 ? statuses.join(',') : undefined,
    filter: state.quick === 'all' ? undefined : (state.quick as LessonQuickFilterDto),
    search: state.search ?? undefined,
    order: state.order === 'asc' ? 'asc' : undefined,
  };
}

/** Whether the pills narrow the list (they show «Скинути»). */
export function pillsActive(state: LessonListState): boolean {
  return Boolean(state.teacherId || state.studentId || state.groupId || state.statuses.length);
}

/** Whether anything but the period narrows the list («… за фільтрами»). */
export function narrowed(state: LessonListState): boolean {
  return pillsActive(state) || state.quick !== 'all' || Boolean(state.search);
}

/** How many filters the phone's «Фільтри» button counts. */
export function sheetFilterCount(state: LessonListState): number {
  return (
    (state.teacherId ? 1 : 0) +
    (state.studentId || state.groupId ? 1 : 0) +
    (state.statuses.length > 0 ? 1 : 0)
  );
}

/** The URL writes that set a period: a preset, or a custom range. */
export function periodParams(
  period: PeriodPreset | { from: string; to: string },
): Record<string, string | undefined> {
  if (typeof period === 'string') {
    return {
      [PARAM.period]: period === 'month' ? undefined : period,
      [PARAM.from]: undefined,
      [PARAM.to]: undefined,
    };
  }
  return {
    [PARAM.period]: undefined,
    [PARAM.from]: period.from,
    [PARAM.to]: period.to === period.from ? undefined : period.to,
  };
}

/** The URL writes that clear the pills; `everything` also clears the quick filter and search. */
export function resetParams(everything = false): Record<string, undefined> {
  return {
    [PARAM.teacher]: undefined,
    [PARAM.student]: undefined,
    [PARAM.group]: undefined,
    [PARAM.status]: undefined,
    ...(everything ? { [PARAM.quick]: undefined, [PARAM.search]: undefined } : {}),
  };
}
