import type {
  PackageListStatusDto,
  PackageResponse,
  PackageSizingModeDto,
} from '@tutorio/validation';
import { PACKAGE_ENDING_DAYS, packageLifecycle } from '@tutorio/domain';

/**
 * The «Пакети» page's state (S07 board 04), all of it in the URL: the tab,
 * the teacher, the student or group, the kind, the search, the order and the
 * page. Defaults are never written.
 */

export const TABS = ['ACTIVE', 'ENDING', 'UNPAID', 'FINISHED', 'all'] as const;
export type Tab = (typeof TABS)[number];
export type SortOrder = 'ending' | 'newest';

export const KINDS = [
  'FIXED_COUNT',
  'BY_PERIOD',
  'BY_PERIOD_WEEKLY',
] as const satisfies readonly PackageSizingModeDto[];

export type PackageListState = {
  page: number;
  tab: Tab;
  teacherId: string | null;
  studentId: string | null;
  groupId: string | null;
  kind: PackageSizingModeDto | null;
  search: string | null;
  sort: SortOrder;
};

export const PARAM = {
  tab: 'tab',
  teacher: 'teacher',
  student: 'student',
  group: 'group',
  kind: 'kind',
  search: 'q',
  sort: 'sort',
  page: 'page',
} as const;

export const PAGE_SIZE = 20;

const oneOf = <T extends string>(values: readonly T[], value: string | null): T | null =>
  value !== null && (values as readonly string[]).includes(value) ? (value as T) : null;

export function readListState(params: URLSearchParams): PackageListState {
  const page = Number(params.get(PARAM.page));
  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    tab: oneOf(TABS, params.get(PARAM.tab)) ?? 'ACTIVE',
    teacherId: params.get(PARAM.teacher) || null,
    studentId: params.get(PARAM.student) || null,
    groupId: params.get(PARAM.student) ? null : params.get(PARAM.group) || null,
    kind: oneOf(KINDS, params.get(PARAM.kind)),
    search: params.get(PARAM.search)?.trim() || null,
    // «Спочатку ті, що закінчуються» is the page's order.
    sort: params.get(PARAM.sort) === 'newest' ? 'newest' : 'ending',
  };
}

/** The `GET /packages` query of a state. */
export function listQuery(state: PackageListState) {
  return {
    page: state.page,
    pageSize: PAGE_SIZE,
    status: state.tab === 'all' ? undefined : (state.tab satisfies PackageListStatusDto),
    teacherId: state.teacherId ?? undefined,
    studentId: state.studentId ?? undefined,
    groupId: state.groupId ?? undefined,
    sizingMode: state.kind ?? undefined,
    search: state.search ?? undefined,
    sort: state.sort,
  };
}

/** Whether the pills narrow the list (they show «Скинути»). */
export function pillsActive(state: PackageListState): boolean {
  return Boolean(state.teacherId || state.studentId || state.groupId || state.kind);
}

export function resetParams(everything = false): Record<string, undefined> {
  return {
    [PARAM.teacher]: undefined,
    [PARAM.student]: undefined,
    [PARAM.group]: undefined,
    [PARAM.kind]: undefined,
    ...(everything ? { [PARAM.search]: undefined, [PARAM.tab]: undefined } : {}),
  };
}

/**
 * How a row's credits read (board 04 «Заняття»): dots — bars for a package
 * of up to 4 — in warning when running out, red when none are left; the
 * window in warning when it closes within the week.
 */
export function rowCredits(
  pkg: Pick<PackageResponse, 'remainingCredits' | 'lessonsTotal' | 'expiresAt'>,
  now: Date,
  lowCreditThreshold: number,
) {
  const left = Math.max(pkg.remainingCredits, 0);
  const window = {
    remainingCredits: pkg.remainingCredits,
    expiresAt: pkg.expiresAt ? new Date(pkg.expiresAt) : null,
  };
  const lifecycle = packageLifecycle(window, now);
  const lowCredits = lifecycle === 'active' && lowCreditThreshold > 0 && left <= lowCreditThreshold;
  const windowClosing =
    lifecycle === 'active' &&
    window.expiresAt !== null &&
    window.expiresAt.getTime() - now.getTime() <= PACKAGE_ENDING_DAYS * 86_400_000;
  return {
    left,
    total: Math.max(pkg.lessonsTotal, left),
    tone: left === 0 ? ('danger' as const) : lowCredits ? ('warning' as const) : ('brand' as const),
    bars: Math.max(pkg.lessonsTotal, left) <= 4,
    windowClosing,
    lifecycle,
  };
}
