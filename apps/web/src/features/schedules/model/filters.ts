import type { ScheduleListStateDto, ScheduleResponse } from '@tutorio/validation';

/**
 * The Schedules page's state (S05), all of it in the URL: the state tab, the
 * teacher, the student or group, the type, the search, the order and the
 * page. Defaults are never written.
 */

export const STATE_TABS = ['ACTIVE', 'CHANGING', 'ENDED', 'all'] as const;
export type StateTab = (typeof STATE_TABS)[number];
export type Kind = 'individual' | 'group';
export type SortOrder = 'next' | 'created';

export type ScheduleListState = {
  page: number;
  tab: StateTab;
  teacherId: string | null;
  studentId: string | null;
  groupId: string | null;
  kind: Kind | null;
  search: string | null;
  sort: SortOrder;
};

export const PARAM = {
  tab: 'state',
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

export function readListState(params: URLSearchParams): ScheduleListState {
  const page = Number(params.get(PARAM.page));
  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    tab: oneOf(STATE_TABS, params.get(PARAM.tab)) ?? 'ACTIVE',
    teacherId: params.get(PARAM.teacher) || null,
    studentId: params.get(PARAM.student) || null,
    groupId: params.get(PARAM.student) ? null : params.get(PARAM.group) || null,
    kind: oneOf(['individual', 'group'] as const, params.get(PARAM.kind)),
    search: params.get(PARAM.search)?.trim() || null,
    sort: params.get(PARAM.sort) === 'created' ? 'created' : 'next',
  };
}

/** The `GET /schedules` query of a state. */
export function listQuery(state: ScheduleListState) {
  return {
    page: state.page,
    pageSize: PAGE_SIZE,
    state: state.tab === 'ACTIVE' ? undefined : (state.tab satisfies ScheduleListStateDto),
    teacherId: state.teacherId ?? undefined,
    studentId: state.studentId ?? undefined,
    groupId: state.groupId ?? undefined,
    kind: state.kind ?? undefined,
    search: state.search ?? undefined,
    sort: state.sort,
  };
}

/** Whether the pills narrow the list (they show «Скинути»). */
export function pillsActive(state: ScheduleListState): boolean {
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
 * Where a schedule stands (S05 components): ended; a change planned for
 * later; running until an end date; or active with no end.
 */
export type ScheduleStatus =
  | { kind: 'ended' }
  | { kind: 'changing'; from: string }
  | { kind: 'until'; lastDay: string }
  | { kind: 'active' };

export function scheduleStatus(
  schedule: Pick<ScheduleResponse, 'state' | 'nextChange' | 'endsAt'>,
): ScheduleStatus {
  if (schedule.state === 'ENDED') return { kind: 'ended' };
  if (schedule.nextChange) return { kind: 'changing', from: schedule.nextChange.effectiveFrom };
  if (schedule.endsAt) return { kind: 'until', lastDay: lastDayOf(schedule.endsAt) };
  return { kind: 'active' };
}

/** The last day of a schedule whose exclusive end is `endsAt`. */
export function lastDayOf(endsAt: string): string {
  return new Date(Date.parse(endsAt) - 1).toISOString();
}

/** A planned change, weekday by weekday: «ВТ 17:00 → 18:00», a day added or dropped. */
export function plannedChanges(schedule: Pick<ScheduleResponse, 'slots' | 'nextChange'>) {
  if (!schedule.nextChange) return [];
  const after = schedule.nextChange.slots;
  const days = new Set([...schedule.slots, ...after].map((slot) => slot.weekday));
  return [...days]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((weekday) => ({
      weekday,
      before: schedule.slots.find((slot) => slot.weekday === weekday)?.localTime ?? null,
      after: after.find((slot) => slot.weekday === weekday)?.localTime ?? null,
    }))
    .filter((change) => change.before !== change.after);
}
