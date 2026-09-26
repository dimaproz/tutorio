import type { AuditActionDto, AuditEntityDto, AuditLogListItem } from '@tutorio/validation';
import {
  addCalendarDays,
  calendarMonthStart,
  dayEndIso,
  dayStartIso,
  isCalendarDate,
  zonedDate,
} from '@/lib/datetime';

/**
 * The audit log page (S10 board 04): its filters, all in the URL — what
 * changed, the action, who, and the period (the last 7 days by default) —,
 * the rows grouped by day, and how each changed field reads.
 */

/** «Що змінили»: the records the API writes to the log, in the menu's order. */
export const AUDIT_ENTITIES = [
  'WORKSPACE',
  'STUDENT',
  'PARENT',
  'GROUP',
  'TEACHER',
  'ENROLLMENT',
  'LESSON',
  'SCHEDULE',
  'PAUSE',
  'LESSON_PACKAGE',
  'PAYMENT',
] as const satisfies readonly AuditEntityDto[];

export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'RESTORE',
] as const satisfies readonly AuditActionDto[];

export const AUDIT_PERIODS = ['week', 'month', 'thisMonth', 'custom'] as const;
export type AuditPeriod = (typeof AUDIT_PERIODS)[number];

export type AuditFilters = {
  entity: AuditEntityDto | null;
  action: AuditActionDto | null;
  /** The user who made the change. */
  actorId: string | null;
  period: AuditPeriod;
  /** Own range, "yyyy-MM-dd" on the studio's clock. */
  from: string | null;
  to: string | null;
};

export const AUDIT_PARAM = {
  entity: 'entity',
  action: 'action',
  actor: 'actor',
  period: 'period',
  from: 'from',
  to: 'to',
} as const;

export const AUDIT_PAGE_SIZE = 20;

const oneOf = <T extends string>(values: readonly T[], value: string | null): T | null =>
  value !== null && (values as readonly string[]).includes(value) ? (value as T) : null;

export function readAuditFilters(params: URLSearchParams): AuditFilters {
  const from = params.get(AUDIT_PARAM.from);
  const to = params.get(AUDIT_PARAM.to);
  const custom =
    params.get(AUDIT_PARAM.period) === 'custom' &&
    from !== null &&
    to !== null &&
    isCalendarDate(from) &&
    isCalendarDate(to);
  const period = oneOf(AUDIT_PERIODS, params.get(AUDIT_PARAM.period));
  return {
    entity: oneOf(AUDIT_ENTITIES, params.get(AUDIT_PARAM.entity)),
    action: oneOf(AUDIT_ACTIONS, params.get(AUDIT_PARAM.action)),
    actorId: params.get(AUDIT_PARAM.actor) || null,
    period: custom ? 'custom' : period && period !== 'custom' ? period : 'week',
    from: custom ? (from <= to ? from : to) : null,
    to: custom ? (from <= to ? to : from) : null,
  };
}

/** The URL writes for a period: defaults are never written. */
export function periodParams(
  period: AuditPeriod,
  range?: { from: string; to: string },
): Record<string, string | undefined> {
  return {
    [AUDIT_PARAM.period]: period === 'week' ? undefined : period,
    [AUDIT_PARAM.from]: period === 'custom' ? range?.from : undefined,
    [AUDIT_PARAM.to]: period === 'custom' ? range?.to : undefined,
  };
}

/** Every filter back to its default. */
export function resetAuditParams(): Record<string, undefined> {
  return Object.fromEntries(Object.values(AUDIT_PARAM).map((key) => [key, undefined]));
}

/** The calendar days a period covers, first and last, on the studio's clock. */
export function periodDays(
  filters: Pick<AuditFilters, 'period' | 'from' | 'to'>,
  now: number,
  timeZone: string,
): { from: string; to: string } {
  const today = zonedDate(now, timeZone);
  switch (filters.period) {
    case 'month':
      return { from: addCalendarDays(today, -29), to: today };
    case 'thisMonth':
      return { from: calendarMonthStart(today), to: today };
    case 'custom':
      return { from: filters.from ?? today, to: filters.to ?? today };
    default:
      return { from: addCalendarDays(today, -6), to: today };
  }
}

/** The `GET /audit-logs` query of the filters (the page comes from the pager). */
export function auditQuery(filters: AuditFilters, now: number, timeZone: string) {
  const days = periodDays(filters, now, timeZone);
  return {
    pageSize: AUDIT_PAGE_SIZE,
    entity: filters.entity ?? undefined,
    action: filters.action ?? undefined,
    actorId: filters.actorId ?? undefined,
    from: dayStartIso(days.from, timeZone),
    to: dayEndIso(days.to, timeZone),
  };
}

/** The query of the overview's «N записів за тиждень»: only the total is read. */
export function weekTotalQuery(now: number, timeZone: string) {
  const { from, to } = auditQuery(readAuditFilters(new URLSearchParams()), now, timeZone);
  return { pageSize: 1, from, to };
}

/** How many filters besides the period narrow the log (the phone's «Фільтри» count). */
export function filterCount(filters: AuditFilters): number {
  return [filters.entity, filters.action, filters.actorId].filter(Boolean).length;
}

/** Whether anything but the default period is set («Скинути» shows). */
export function filtersActive(filters: AuditFilters): boolean {
  return filterCount(filters) > 0 || filters.period !== 'week';
}

export type AuditDay<T> = { day: string; items: T[] };

/** Rows grouped by their day on the studio's clock, newest day first. */
export function groupByDay<T extends Pick<AuditLogListItem, 'createdAt'>>(
  items: readonly T[],
  timeZone: string,
): AuditDay<T>[] {
  const days: AuditDay<T>[] = [];
  for (const item of items) {
    const day = zonedDate(item.createdAt, timeZone);
    const last = days[days.length - 1];
    if (last?.day === day) last.items.push(item);
    else days.push({ day, items: [item] });
  }
  return days;
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

/**
 * How a changed field's values read: `money` in minor units of the record's
 * currency, `ref`/`refs` as the names of the records they point at,
 * `enum` through its value labels, counts and durations with their unit.
 */
export type FieldKind =
  | 'text'
  | 'longText'
  | 'money'
  | 'date'
  | 'datetime'
  | 'color'
  | 'ref'
  | 'refs'
  | 'list'
  | 'enum'
  | 'bool'
  | 'count'
  | 'hours'
  | 'weeks'
  | 'lessons'
  | 'minutes'
  | 'slots'
  | 'avatar'
  | 'currency';

export type FieldSpec = {
  kind: FieldKind;
  /** The label key under `settings.audit.fields`. */
  label: string;
  /** The value labels under `settings.audit.values`, for an `enum`. */
  values?: string;
};

const spec = (kind: FieldKind, label: string, values?: string): FieldSpec => ({
  kind,
  label,
  values,
});

/** Fields the log shows with the same meaning on every record. */
const COMMON: Record<string, FieldSpec> = {
  fullName: spec('text', 'fullName'),
  name: spec('text', 'name'),
  email: spec('text', 'email'),
  phone: spec('text', 'phone'),
  telegramUsername: spec('text', 'telegramUsername'),
  timezone: spec('text', 'timezone'),
  notes: spec('longText', 'notes'),
  note: spec('longText', 'note'),
  bio: spec('longText', 'bio'),
  topic: spec('text', 'topic'),
  subjects: spec('list', 'subjects'),
  color: spec('color', 'color'),
  avatarKey: spec('avatar', 'avatarKey'),
  currency: spec('currency', 'currency'),
  defaultCurrency: spec('currency', 'defaultCurrency'),
  mode: spec('enum', 'mode', 'mode'),
  cancellationDeadlineHours: spec('hours', 'cancellationDeadlineHours'),
  scheduleHorizonWeeks: spec('weeks', 'scheduleHorizonWeeks'),
  lowCreditThreshold: spec('lessons', 'lowCreditThreshold'),
  horizonWeeks: spec('weeks', 'horizonWeeks'),
  languageLevel: spec('enum', 'languageLevel', 'languageLevel'),
  knowledgeLevel: spec('enum', 'knowledgeLevel', 'knowledgeLevel'),
  age: spec('count', 'age'),
  grade: spec('count', 'grade'),
  capacity: spec('count', 'capacity'),
  hourlyRateMinor: spec('money', 'hourlyRateMinor'),
  defaultRateMinor: spec('money', 'defaultRateMinor'),
  pricePerLesson: spec('money', 'priceMinor'),
  priceMinor: spec('money', 'priceMinor'),
  amountMinor: spec('money', 'amountMinor'),
  method: spec('enum', 'method', 'paymentMethod'),
  totalPriceMinorSnapshot: spec('money', 'totalPriceMinorSnapshot'),
  remainderMinor: spec('money', 'remainderMinor'),
  refundedMinor: spec('money', 'refundedMinor'),
  billingType: spec('enum', 'billingType', 'billingType'),
  sizingMode: spec('enum', 'sizingMode', 'sizingMode'),
  ownPrice: spec('bool', 'ownPrice'),
  isDetached: spec('bool', 'isDetached'),
  cancelled: spec('bool', 'cancelled'),
  bulk: spec('bool', 'bulk'),
  kind: spec('enum', 'kind', 'lessonKind'),
  cancelledBy: spec('enum', 'cancelledBy', 'cancelledBy'),
  completedBy: spec('enum', 'completedBy', 'completedBy'),
  cancelledReason: spec('text', 'cancelledReason'),
  startsAtUtc: spec('datetime', 'startsAtUtc'),
  paidAt: spec('datetime', 'paidAt'),
  startsAt: spec('date', 'startsAt'),
  endsAt: spec('date', 'endsAt'),
  endedAt: spec('date', 'endedAt'),
  expiresAt: spec('date', 'expiresAt'),
  effectiveFrom: spec('date', 'effectiveFrom'),
  durationMin: spec('minutes', 'durationMin'),
  slots: spec('slots', 'slots'),
  studentId: spec('ref', 'studentId'),
  groupId: spec('ref', 'groupId'),
  teacherId: spec('ref', 'teacherId'),
  transferredTo: spec('ref', 'transferredTo'),
  packageId: spec('ref', 'packageId'),
  toPackageId: spec('ref', 'toPackageId'),
  workspaceMemberId: spec('ref', 'workspaceMemberId'),
  enrollmentId: spec('ref', 'enrollmentId'),
  toEnrollmentId: spec('ref', 'toEnrollmentId'),
  originalLessonId: spec('ref', 'originalLessonId'),
  replacedByPauseId: spec('ref', 'replacedByPauseId'),
  parentIds: spec('refs', 'parentIds'),
  studentIds: spec('refs', 'studentIds'),
  retained: spec('list', 'retained'),
  lessonsTotal: spec('lessons', 'lessonsTotal'),
  manualAdjustment: spec('lessons', 'manualAdjustment'),
  transferredCredits: spec('lessons', 'transferredCredits'),
  refundedCredits: spec('lessons', 'refundedCredits'),
  debtLessonsCovered: spec('lessons', 'debtLessonsCovered'),
  lessons: spec('lessons', 'lessons'),
};

const COUNTS = [
  'archivedSeries',
  'archivedFutureScheduledLessons',
  'archivedGroupEnrollments',
  'restoredFutureScheduledLessons',
  'restoredGroupEnrollments',
  'reassignedEnrollments',
  'reassignedSeries',
  'reassignedLessons',
  'repricedMembers',
  'transferredLessons',
  'transferredSchedules',
  'transferredGroups',
  'transferredDirections',
  'removedLessons',
  'restoredLessons',
  'skippedLessons',
  'moved',
  'created',
  'removed',
] as const;

/** A status's values depend on whose status it is. */
const STATUS_VALUES: Partial<Record<AuditEntityDto, string>> = {
  STUDENT: 'studentStatus',
  TEACHER: 'teacherStatus',
  ENROLLMENT: 'enrollmentStatus',
  LESSON: 'lessonStatus',
};

/** Keys that are plumbing, not something a person changed. */
const HIDDEN = new Set(['workspaceId']);

/**
 * How one field of one record reads. Unknown keys still show, as text under
 * their own name, so a field added to the API later is never silently lost.
 */
export function fieldSpec(entity: AuditEntityDto, key: string): FieldSpec | null {
  if (HIDDEN.has(key)) return null;
  if (key.startsWith('attendance.')) return spec('enum', 'attendance', 'attendance');
  if (key.startsWith('charge.')) return spec('enum', 'charge', 'charge');
  if (key === 'status') return spec('enum', 'status', STATUS_VALUES[entity] ?? 'status');
  if ((COUNTS as readonly string[]).includes(key)) return spec('count', key);
  return COMMON[key] ?? spec('text', key);
}

/** The visible fields of a row's diff, in the order the API wrote them. */
export function visibleFields(
  item: Pick<AuditLogListItem, 'entity' | 'changes'>,
): { key: string; spec: FieldSpec; before: unknown; after: unknown }[] {
  return Object.entries(item.changes?.fields ?? {}).flatMap(([key, change]) => {
    const fieldSpecOf = fieldSpec(item.entity, key);
    return fieldSpecOf
      ? [{ key, spec: fieldSpecOf, before: change.before, after: change.after }]
      : [];
  });
}

/** Whether a value is "nothing": shown as «—». */
export function isEmptyValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Kinds whose values are short enough to show as «a → b» in the one-line summary. */
const SHORT_KINDS = new Set<FieldKind>([
  'ref',
  'money',
  'enum',
  'bool',
  'count',
  'hours',
  'weeks',
  'lessons',
  'minutes',
  'currency',
  'date',
]);

export const SUMMARY_FIELDS = 3;

/**
 * The fields the one-line summary names (S10 board 04): the first three
 * changed ones, a short value pair shown as «a → b» and a text, a colour or a
 * list only by its label; then «, …» when more changed. A lesson Tutorio held
 * reads «(автоматично після закінчення)» after its status.
 */
export function summaryFields(item: Pick<AuditLogListItem, 'entity' | 'changes'>) {
  // Who held a lesson reads as «(автоматично …)» after its status instead.
  const fields = visibleFields(item).filter((field) => field.key !== 'completedBy');
  return {
    fields: fields.slice(0, SUMMARY_FIELDS).map((field) => ({
      ...field,
      withValues: SHORT_KINDS.has(field.spec.kind),
    })),
    more: fields.length > SUMMARY_FIELDS,
  };
}

/** The money fields of a row read in the diff's own currency, else the record's. */
export function moneyCurrency(
  item: Pick<AuditLogListItem, 'changes' | 'record'>,
  side: 'before' | 'after',
): string | null {
  const change = item.changes?.fields.currency;
  const own = change?.[side] ?? change?.after ?? change?.before;
  return typeof own === 'string' ? own : item.record.currency;
}

/** A lesson that Tutorio held at its end (L-50). */
export function heldAutomatically(item: Pick<AuditLogListItem, 'actor' | 'changes'>): boolean {
  return item.actor === null && item.changes?.fields.completedBy?.after === 'SCHEDULE';
}
