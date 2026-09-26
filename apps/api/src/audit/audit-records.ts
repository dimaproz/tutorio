import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  AuditChanges,
  AuditRecord,
  ScheduleSlotDto,
} from '@tutorio/validation';
import { normalizeSlots } from '@tutorio/domain';

/** The audit columns the resolver reads. */
export interface AuditRowRef {
  entity: string;
  entityId: string;
  diff: Prisma.JsonValue | null;
}

type Reader = Pick<
  PrismaClient,
  | 'student'
  | 'parent'
  | 'teacher'
  | 'group'
  | 'workspace'
  | 'enrollment'
  | 'lesson'
  | 'lessonSeries'
  | 'schedule'
  | 'pause'
  | 'lessonPackage'
  | 'payment'
  | 'user'
>;

const EMPTY_RECORD: AuditRecord = {
  label: null,
  detail: null,
  startsAt: null,
  amountMinor: null,
  currency: null,
  slots: null,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A direction reads as its student, or its group for a group lesson. */
const directionInclude = {
  student: { select: { fullName: true } },
  group: { select: { name: true } },
  teacher: { select: { fullName: true } },
} satisfies Prisma.EnrollmentInclude;

function changesOf(diff: Prisma.JsonValue | null): AuditChanges | null {
  return diff && typeof diff === 'object' && 'fields' in diff
    ? (diff as unknown as AuditChanges)
    : null;
}

/** The name a record's own diff carries: what a deleted record falls back to. */
function nameInDiff(diff: Prisma.JsonValue | null): string | null {
  const fields = changesOf(diff)?.fields ?? {};
  for (const key of ['fullName', 'name']) {
    const change = fields[key];
    const value = change?.after ?? change?.before;
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

/** Every id a diff points at, in before and after, single or listed. */
function idsInDiff(diff: Prisma.JsonValue | null): string[] {
  const ids: string[] = [];
  const visit = (value: unknown) => {
    if (typeof value === 'string' && UUID.test(value)) ids.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
  };
  for (const change of Object.values(changesOf(diff)?.fields ?? {})) {
    visit(change.before);
    visit(change.after);
  }
  return ids;
}

type SeriesVersion = {
  weekdays: number[];
  localTime: string;
  startDate: Date;
  endsAt: Date | null;
};

/**
 * The version of a schedule's rule in force at `at` (the one that started
 * last), else the next to start; a stopped schedule reads by its last rule.
 * The schedules service picks versions the same way.
 */
function versionAt(rows: readonly SeriesVersion[], at: Date): SeriesVersion[] {
  if (rows.length === 0) return [];
  const running = rows.filter((row) => !row.endsAt || row.endsAt > at);
  const pool = running.length ? running : rows;
  const started = pool.filter((row) => row.startDate <= at);
  const pick = started.length
    ? Math.max(...started.map((row) => row.startDate.getTime()))
    : running.length
      ? Math.min(...pool.map((row) => row.startDate.getTime()))
      : Math.max(...pool.map((row) => row.startDate.getTime()));
  return pool.filter((row) => row.startDate.getTime() === pick);
}

function slotsOfSeries(
  rows: readonly SeriesVersion[],
  at: Date,
): ScheduleSlotDto[] | null {
  const version = versionAt(rows, at);
  if (version.length === 0) return null;
  try {
    return normalizeSlots(
      version.flatMap((row) =>
        row.weekdays.map((weekday) => ({ weekday, localTime: row.localTime })),
      ),
    );
  } catch {
    return null;
  }
}

/**
 * Names the records of an audit page and the ids its diffs point at, with
 * one read per kind of record. Every read is scoped to the workspace and
 * includes deleted rows: the log speaks of what was archived too.
 */
export async function resolveAuditRecords(
  prisma: Reader,
  workspaceId: string,
  rows: readonly AuditRowRef[],
  now: Date = new Date(),
): Promise<{ records: AuditRecord[]; names: Record<string, string> }> {
  const idsOf = (entity: string) => [
    ...new Set(
      rows.filter((row) => row.entity === entity).map((row) => row.entityId),
    ),
  ];
  const scoped = (ids: string[]) => ({ workspaceId, id: { in: ids } });
  const referenced = [...new Set(rows.flatMap((row) => idsInDiff(row.diff)))];
  const want = (entity: string, extra: string[] = []) => [
    ...new Set([...idsOf(entity), ...extra]),
  ];

  const [
    students,
    parents,
    teachers,
    groups,
    workspaces,
    enrollments,
    lessons,
    series,
    schedules,
    pauses,
    packages,
    payments,
    users,
  ] = await Promise.all([
    prisma.student.findMany({
      where: scoped(want('STUDENT', referenced)),
      select: { id: true, fullName: true, currency: true },
    }),
    prisma.parent.findMany({
      where: scoped(want('PARENT', referenced)),
      select: { id: true, fullName: true },
    }),
    prisma.teacher.findMany({
      where: scoped(want('TEACHER', referenced)),
      select: { id: true, fullName: true, currency: true },
    }),
    prisma.group.findMany({
      where: scoped(want('GROUP', referenced)),
      select: { id: true, name: true, currency: true },
    }),
    prisma.workspace.findMany({
      where: {
        id: { in: idsOf('WORKSPACE').filter((id) => id === workspaceId) },
      },
      select: { id: true, name: true, defaultCurrency: true },
    }),
    prisma.enrollment.findMany({
      where: scoped(idsOf('ENROLLMENT')),
      select: { id: true, currency: true, ...directionInclude },
    }),
    prisma.lesson.findMany({
      where: scoped(idsOf('LESSON')),
      select: {
        id: true,
        startsAtUtc: true,
        currency: true,
        group: { select: { name: true } },
        enrollment: { select: { student: { select: { fullName: true } } } },
      },
    }),
    prisma.lessonSeries.findMany({
      where: scoped(idsOf('LESSON_SERIES')),
      select: {
        id: true,
        weekdays: true,
        localTime: true,
        startDate: true,
        endsAt: true,
        currency: true,
        group: { select: { name: true } },
        enrollment: { select: { student: { select: { fullName: true } } } },
      },
    }),
    prisma.schedule.findMany({
      where: scoped(idsOf('SCHEDULE')),
      select: {
        id: true,
        group: { select: { name: true } },
        enrollment: { select: { student: { select: { fullName: true } } } },
        series: {
          where: { deletedAt: null },
          select: {
            weekdays: true,
            localTime: true,
            startDate: true,
            endsAt: true,
            currency: true,
          },
        },
      },
    }),
    prisma.pause.findMany({
      where: scoped(idsOf('PAUSE')),
      select: { id: true, student: { select: { fullName: true } } },
    }),
    prisma.lessonPackage.findMany({
      where: scoped(want('LESSON_PACKAGE', referenced)),
      select: {
        id: true,
        name: true,
        currency: true,
        student: { select: { fullName: true } },
      },
    }),
    prisma.payment.findMany({
      where: scoped(idsOf('PAYMENT')),
      select: {
        id: true,
        amountMinor: true,
        currency: true,
        package: { select: { name: true } },
        enrollment: { select: { student: { select: { fullName: true } } } },
      },
    }),
    // Users carry no workspace: only the ids a diff names are read.
    referenced.length
      ? prisma.user.findMany({
          where: {
            id: { in: referenced },
            memberships: { some: { workspaceId } },
          },
          select: { id: true, name: true },
        })
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);

  const byId = <T extends { id: string }>(items: readonly T[]) =>
    new Map(items.map((item) => [item.id, item]));
  const maps = {
    STUDENT: byId(students),
    PARENT: byId(parents),
    TEACHER: byId(teachers),
    GROUP: byId(groups),
    WORKSPACE: byId(workspaces),
    ENROLLMENT: byId(enrollments),
    LESSON: byId(lessons),
    LESSON_SERIES: byId(series),
    SCHEDULE: byId(schedules),
    PAUSE: byId(pauses),
    LESSON_PACKAGE: byId(packages),
    PAYMENT: byId(payments),
  };

  const describe = (row: AuditRowRef): AuditRecord => {
    const fallback = { ...EMPTY_RECORD, label: nameInDiff(row.diff) };
    switch (row.entity) {
      case 'STUDENT':
      case 'TEACHER': {
        const found = maps[row.entity].get(row.entityId);
        return found
          ? { ...EMPTY_RECORD, label: found.fullName, currency: found.currency }
          : fallback;
      }
      case 'PARENT': {
        const found = maps.PARENT.get(row.entityId);
        return found ? { ...EMPTY_RECORD, label: found.fullName } : fallback;
      }
      case 'GROUP': {
        const found = maps.GROUP.get(row.entityId);
        return found
          ? { ...EMPTY_RECORD, label: found.name, currency: found.currency }
          : fallback;
      }
      case 'WORKSPACE': {
        const found = maps.WORKSPACE.get(row.entityId);
        return found
          ? {
              ...EMPTY_RECORD,
              label: found.name,
              currency: found.defaultCurrency,
            }
          : fallback;
      }
      case 'ENROLLMENT': {
        const found = maps.ENROLLMENT.get(row.entityId);
        return found
          ? {
              ...EMPTY_RECORD,
              label: found.student.fullName,
              detail: found.group?.name ?? found.teacher.fullName,
              currency: found.currency,
            }
          : fallback;
      }
      case 'LESSON': {
        const found = maps.LESSON.get(row.entityId);
        return found
          ? {
              ...EMPTY_RECORD,
              label:
                found.group?.name ?? found.enrollment?.student.fullName ?? null,
              startsAt: found.startsAtUtc.toISOString(),
              currency: found.currency,
            }
          : fallback;
      }
      case 'LESSON_SERIES': {
        const found = maps.LESSON_SERIES.get(row.entityId);
        return found
          ? {
              ...EMPTY_RECORD,
              label:
                found.group?.name ?? found.enrollment?.student.fullName ?? null,
              currency: found.currency,
              slots: slotsOfSeries([found], now),
            }
          : fallback;
      }
      case 'SCHEDULE': {
        const found = maps.SCHEDULE.get(row.entityId);
        return found
          ? {
              ...EMPTY_RECORD,
              label:
                found.group?.name ?? found.enrollment?.student.fullName ?? null,
              currency: found.series[0]?.currency ?? null,
              slots: slotsOfSeries(found.series, now),
            }
          : fallback;
      }
      case 'PAUSE': {
        const found = maps.PAUSE.get(row.entityId);
        return found
          ? { ...EMPTY_RECORD, label: found.student.fullName }
          : fallback;
      }
      case 'LESSON_PACKAGE': {
        const found = maps.LESSON_PACKAGE.get(row.entityId);
        return found
          ? {
              ...EMPTY_RECORD,
              label: found.student.fullName,
              detail: found.name,
              currency: found.currency,
            }
          : fallback;
      }
      case 'PAYMENT': {
        const found = maps.PAYMENT.get(row.entityId);
        return found
          ? {
              ...EMPTY_RECORD,
              label: found.enrollment.student.fullName,
              detail: found.package?.name ?? null,
              amountMinor: found.amountMinor,
              currency: found.currency,
            }
          : fallback;
      }
      default:
        return fallback;
    }
  };

  const names: Record<string, string> = {};
  const referencedSet = new Set(referenced);
  const name = (id: string, value: string | null | undefined) => {
    if (referencedSet.has(id) && value) names[id] = value;
  };
  students.forEach((item) => name(item.id, item.fullName));
  parents.forEach((item) => name(item.id, item.fullName));
  teachers.forEach((item) => name(item.id, item.fullName));
  groups.forEach((item) => name(item.id, item.name));
  packages.forEach((item) => name(item.id, item.name));
  users.forEach((item) => name(item.id, item.name));

  return { records: rows.map(describe), names };
}
