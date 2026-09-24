import type {
  AttendanceStatusDto,
  AuditLogResponse,
  CancelledByDto,
  LessonDetailResponse,
  LessonStatusDto,
} from '@tutorio/validation';

type Actor = string | null;
type Base = { id: string; at: string; actor: Actor };

/** One entry of a lesson's history, decoded from its audit trail. */
export type HistoryEvent = Base &
  (
    | { kind: 'created'; source: 'schedule' | 'makeup' | 'manual' }
    | {
        kind: 'status';
        to: LessonStatusDto;
        cancelledBy: CancelledByDto | null;
        reason: string | null;
        /** Held by the end-of-lesson automation, not by a person (L-50). */
        automatic: boolean;
        /** Participants charged by this change, from the billing entry beside it. */
        charged: number;
      }
    | { kind: 'topic'; before: string | null; after: string | null }
    | { kind: 'notes' }
    | { kind: 'teacher'; beforeId: string | null; afterId: string | null }
    | { kind: 'price'; before: number | null; after: number | null }
    | { kind: 'moved'; before: string | null; after: string | null }
    | { kind: 'duration'; before: number | null; after: number | null }
    | { kind: 'attendance'; marks: Record<AttendanceStatusDto, number>; charged: number }
    | { kind: 'charge'; charged: number; released: number }
    | { kind: 'paid'; paidAt: string | null }
  );

type Fields = Record<string, { before?: unknown; after?: unknown }>;

/** An event without its id, time and actor, per kind. */
type EventBody = HistoryEvent extends infer E
  ? E extends HistoryEvent
    ? Omit<E, keyof Base>
    : never
  : never;

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const number = (value: unknown): number | null => (typeof value === 'number' ? value : null);

/** Charges written in the same transaction as the change they follow. */
const SAME_CHANGE_MS = 5_000;

function chargesOf(fields: Fields) {
  let charged = 0;
  let released = 0;
  for (const [key, change] of Object.entries(fields)) {
    if (!key.startsWith('charge.')) continue;
    if (change.after) charged += 1;
    else if (change.before) released += 1;
  }
  return { charged, released };
}

function eventsOf(entry: AuditLogResponse): HistoryEvent[] {
  const base: Base = { id: entry.id, at: entry.createdAt, actor: entry.actor?.name ?? null };
  const fields: Fields = entry.changes?.fields ?? {};

  if (entry.action === 'CREATE') {
    const source = fields.originalLessonId?.after ? 'makeup' : 'manual';
    return [{ ...base, id: `${entry.id}:created`, kind: 'created', source }];
  }
  if (entry.action !== 'UPDATE') return [];

  const events: HistoryEvent[] = [];
  const add = (suffix: string, event: EventBody) =>
    events.push({ ...base, id: `${entry.id}:${suffix}`, ...event } as HistoryEvent);

  if (fields.status) {
    const to = fields.status.after as LessonStatusDto;
    add('status', {
      kind: 'status',
      to,
      cancelledBy: (fields.cancelledBy?.after as CancelledByDto | undefined) ?? null,
      reason: text(fields.cancelledReason?.after),
      automatic: fields.completedBy?.after === 'SCHEDULE' || entry.actor === null,
      charged: 0,
    });
  }
  const marks = Object.entries(fields).filter(([key]) => key.startsWith('attendance.'));
  if (marks.length > 0) {
    const count: Record<AttendanceStatusDto, number> = { PRESENT: 0, ABSENT: 0, EXCUSED: 0 };
    for (const [, change] of marks) {
      const mark = change.after as AttendanceStatusDto | null;
      if (mark) count[mark] += 1;
    }
    add('attendance', { kind: 'attendance', marks: count, charged: 0 });
  }
  if (fields.topic) {
    add('topic', {
      kind: 'topic',
      before: text(fields.topic.before),
      after: text(fields.topic.after),
    });
  }
  if (fields.notes) add('notes', { kind: 'notes' });
  if (fields.teacherId) {
    add('teacher', {
      kind: 'teacher',
      beforeId: text(fields.teacherId.before),
      afterId: text(fields.teacherId.after),
    });
  }
  if (fields.priceMinor) {
    add('price', {
      kind: 'price',
      before: number(fields.priceMinor.before),
      after: number(fields.priceMinor.after),
    });
  }
  if (fields.startsAtUtc) {
    add('moved', {
      kind: 'moved',
      before: text(fields.startsAtUtc.before),
      after: text(fields.startsAtUtc.after),
    });
  }
  if (fields.durationMin) {
    add('duration', {
      kind: 'duration',
      before: number(fields.durationMin.before),
      after: number(fields.durationMin.after),
    });
  }
  if (fields.paidAt?.after) add('paid', { kind: 'paid', paidAt: text(fields.paidAt.after) });

  const { charged, released } = chargesOf(fields);
  if (charged > 0 || released > 0) add('charge', { kind: 'charge', charged, released });
  return events;
}

/**
 * A lesson's history, newest first, as the panel shows it. Every audit entry
 * of the lesson becomes one event per change it carries. A billing entry
 * written with a status change or with attendance marks folds into that event
 * ("held · charged 1 lesson") instead of standing alone. When the trail has no
 * creation (lessons generated by a schedule are not audited), the lesson's own
 * creation time stands in for it.
 */
export function lessonHistory(
  lesson: Pick<LessonDetailResponse, 'history' | 'createdAt' | 'seriesId' | 'kind' | 'id'>,
): HistoryEvent[] {
  const events = lesson.history.flatMap(eventsOf);

  const merged: HistoryEvent[] = [];
  for (const event of events) {
    if (event.kind === 'charge') {
      const time = Date.parse(event.at);
      const owner = [...merged, ...events].find(
        (other) =>
          (other.kind === 'status' || other.kind === 'attendance') &&
          Math.abs(Date.parse(other.at) - time) <= SAME_CHANGE_MS,
      );
      if (owner && (owner.kind === 'status' || owner.kind === 'attendance')) {
        owner.charged += event.charged;
        continue;
      }
    }
    merged.push(event);
  }

  if (!merged.some((event) => event.kind === 'created')) {
    merged.push({
      id: `${lesson.id}:created`,
      at: lesson.createdAt,
      actor: null,
      kind: 'created',
      source: lesson.kind === 'MAKEUP' ? 'makeup' : lesson.seriesId ? 'schedule' : 'manual',
    });
  }
  return merged.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/**
 * Who called the lesson off: the person on the cancelling history entry, for
 * the cancellation card. Null when the trail does not say.
 */
export function cancellationActor(events: HistoryEvent[]): string | null {
  const cancel = events.find(
    (event) =>
      event.kind === 'status' &&
      (event.to === 'CANCELLED_CHARGED' || event.to === 'CANCELLED_UNCHARGED'),
  );
  return cancel?.actor ?? null;
}

/** The latest attendance entry: who marked it and when. */
export function lastAttendanceMark(events: HistoryEvent[]): HistoryEvent | null {
  return events.find((event) => event.kind === 'attendance') ?? null;
}
