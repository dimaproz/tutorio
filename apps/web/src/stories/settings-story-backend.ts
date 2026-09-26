import type {
  AuditLogListItem,
  AuditLogListResponse,
  AuthMe,
  WorkspaceMemberListResponse,
} from '@tutorio/validation';
import { DEFAULT_TIME_ZONE as TZ, zonedIso } from '@/lib/datetime';
import { TEACHER_IDS } from './teachers-story-backend';

/**
 * The Settings stories (S10): Kyiv English Studio on Saturday 26 September
 * 2026 — Europe/Kyiv, UAH, studio mode, 24 h / 4 weeks / 2 lessons — owned
 * by Olena Kovalenko. The settings save in memory (tutor mode is refused
 * while colleagues teach), and the change log holds 64 entries of the last
 * seven days plus a few older teacher changes, as the boards show them.
 */

const pad = (n: number) => String(n).padStart(12, '0');
const pad2 = (n: number) => String(n).padStart(2, '0');
const logId = (n: number) => `a0d17000-0000-4000-8000-${pad(n)}`;
const entityId = (n: number) => `e0d17000-0000-4000-8000-${pad(n)}`;

/** A wall-clock time on the studio's (Kyiv) clock in 2026. */
const local = (day: number, hour: number, minute = 0, month = 9) =>
  zonedIso(`2026-${pad2(month)}-${pad2(day)}`, `${pad2(hour)}:${pad2(minute)}`, TZ);

/** The boards' clock: Saturday 26 September 2026, 12:00 in Kyiv. */
export const SETTINGS_CLOCK = Date.parse(local(26, 12));

export const SETTINGS_WORKSPACE: Partial<AuthMe['workspace']> = {
  name: 'Kyiv English Studio',
  mode: 'SCHOOL',
  defaultCurrency: 'UAH',
  cancellationDeadlineHours: 24,
  timezone: TZ,
  scheduleHorizonWeeks: 4,
  lowCreditThreshold: 2,
};

const OLENA = {
  id: '66666666-6666-4666-8666-666666666666',
  name: 'Olena Kovalenko',
  email: 'olena@example.test',
};
const DMYTRO = {
  id: '66666666-6666-4666-8666-666666666667',
  name: 'Dmytro Tutor',
  email: 'dmytro@example.test',
};

const MEMBERS: WorkspaceMemberListResponse = {
  items: [
    { ...OLENA, userId: OLENA.id, id: entityId(901), role: 'OWNER', avatarKey: null },
    { ...DMYTRO, userId: DMYTRO.id, id: entityId(902), role: 'TEACHER', avatarKey: 'user-2' },
  ],
};

const PACKAGE_OCTOBER = entityId(301);

/** What the log's diffs point at, by id. */
const NAMES: Record<string, string> = {
  [TEACHER_IDS.oleh]: 'Oleh Marchenko',
  [TEACHER_IDS.dmytro]: 'Dmytro Tutor',
  [PACKAGE_OCTOBER]: 'Жовтень',
};

const RECORD = {
  label: null,
  detail: null,
  startsAt: null,
  amountMinor: null,
  currency: null,
  slots: null,
} satisfies AuditLogListItem['record'];

type Entry = Omit<AuditLogListItem, 'workspaceId' | 'actorId' | 'record' | 'id'> & {
  record: Partial<AuditLogListItem['record']>;
};

const entry = (
  n: number,
  fields: Omit<Entry, 'actor'> & { actor?: AuditLogListItem['actor'] },
): AuditLogListItem => ({
  id: logId(n),
  workspaceId: '11111111-1111-4111-8111-111111111111',
  actorId: fields.actor === undefined ? OLENA.id : (fields.actor?.id ?? null),
  actor: fields.actor === undefined ? OLENA : fields.actor,
  entity: fields.entity,
  entityId: fields.entityId,
  action: fields.action,
  changes: fields.changes,
  record: { ...RECORD, ...fields.record },
  createdAt: fields.createdAt,
});

/** Iryna's calendar colour before and after the change the boards open. */
export const IRYNA_COLORS = { before: '#D6336C', after: '#AE3EC9' } as const;

const IRYNA_BIO_BEFORE = 'Сертифікат CELTA, 8 років викладання. Веде дитячі групи.';
const IRYNA_BIO_AFTER =
  'Сертифікат CELTA, 8 років викладання. Веде дитячі групи й розмовний клуб, готує до Cambridge YLE (Starters, Movers, Flyers). Працює з дітьми від 6 років.';

/** The rows the boards show (S10 board 04), newest first. */
const BOARD_ENTRIES: AuditLogListItem[] = [
  entry(1, {
    entity: 'WORKSPACE',
    entityId: '11111111-1111-4111-8111-111111111111',
    action: 'UPDATE',
    createdAt: local(26, 10, 42),
    record: { label: 'Kyiv English Studio', currency: 'UAH' },
    changes: {
      fields: {
        cancellationDeadlineHours: { before: 24, after: 12 },
        lowCreditThreshold: { before: 2, after: 3 },
      },
    },
  }),
  entry(2, {
    entity: 'TEACHER',
    entityId: TEACHER_IDS.iryna,
    action: 'UPDATE',
    createdAt: local(26, 10, 15),
    record: { label: 'Iryna Bondar', currency: 'UAH' },
    changes: {
      fields: {
        defaultRateMinor: { before: 40000, after: 45000 },
        color: IRYNA_COLORS,
        subjects: { before: ['English', 'Kids'], after: ['English', 'Kids', 'Speaking'] },
        bio: { before: IRYNA_BIO_BEFORE, after: IRYNA_BIO_AFTER },
        phone: { before: null, after: '+380 50 222 33 44' },
        notes: { before: null, after: 'Відпустка 14–25 жовтня.' },
      },
    },
  }),
  entry(3, {
    entity: 'LESSON',
    entityId: entityId(101),
    action: 'UPDATE',
    actor: null,
    createdAt: local(26, 9, 30),
    record: { label: 'Maksym Tkachenko', startsAt: local(9, 16, 30), currency: 'UAH' },
    changes: {
      fields: {
        status: { before: 'SCHEDULED', after: 'COMPLETED' },
        completedBy: { before: null, after: 'SCHEDULE' },
      },
    },
  }),
  entry(4, {
    entity: 'PAYMENT',
    entityId: entityId(102),
    action: 'CREATE',
    createdAt: local(26, 9, 2),
    record: {
      label: 'Anna Shevchenko',
      detail: 'Жовтень',
      amountMinor: 320000,
      currency: 'UAH',
    },
    changes: {
      fields: {
        packageId: { before: null, after: PACKAGE_OCTOBER },
        amountMinor: { before: null, after: 320000 },
        currency: { before: null, after: 'UAH' },
        method: { before: null, after: 'BANK_TRANSFER' },
      },
    },
  }),
  entry(5, {
    entity: 'SCHEDULE',
    entityId: entityId(103),
    action: 'UPDATE',
    actor: DMYTRO,
    createdAt: local(25, 18, 20),
    record: {
      label: 'Kids A2',
      currency: 'UAH',
      slots: [
        { weekday: 2, localTime: '15:00' },
        { weekday: 4, localTime: '15:00' },
      ],
    },
    changes: {
      fields: {
        slots: {
          before: [
            { weekday: 2, localTime: '15:00' },
            { weekday: 4, localTime: '15:00' },
          ],
          after: [
            { weekday: 2, localTime: '15:00' },
            { weekday: 4, localTime: '16:00' },
          ],
        },
        effectiveFrom: { before: null, after: local(1, 0, 0, 10) },
        moved: { before: null, after: 3 },
      },
    },
  }),
  entry(6, {
    entity: 'TEACHER',
    entityId: TEACHER_IDS.andrii,
    action: 'DELETE',
    createdAt: local(25, 16, 5),
    record: { label: 'Andrii Savchuk', currency: 'UAH' },
    changes: {
      fields: {
        transferredTo: { before: null, after: TEACHER_IDS.oleh },
        transferredLessons: { before: null, after: 14 },
        transferredSchedules: { before: null, after: 2 },
        status: { before: 'ACTIVE', after: 'ARCHIVED' },
      },
    },
  }),
  entry(7, {
    entity: 'STUDENT',
    entityId: entityId(104),
    action: 'CREATE',
    createdAt: local(25, 12, 40),
    record: { label: 'Mila Savchuk', currency: 'UAH' },
    changes: {
      fields: {
        fullName: { before: null, after: 'Mila Savchuk' },
        status: { before: null, after: 'ACTIVE' },
        languageLevel: { before: null, after: 'A1' },
        parentIds: { before: null, after: [] },
      },
    },
  }),
  entry(8, {
    entity: 'GROUP',
    entityId: entityId(105),
    action: 'RESTORE',
    createdAt: local(25, 11, 10),
    record: { label: 'Speaking club', currency: 'UAH' },
    changes: { fields: { restoredFutureScheduledLessons: { before: null, after: 6 } } },
  }),
];

const HELD_BY = ['Sofiia Melnyk', 'Artem Lysenko', 'Daryna Kravets', 'Oleksii Koval', 'B1 English'];

/** Lessons Tutorio held over the rest of the week, to make up the 64. */
const FILLER: AuditLogListItem[] = Array.from({ length: 55 }, (_, index) => {
  const day = 24 - Math.floor(index / 14);
  const minute = 59 - (index % 14) * 4;
  return entry(100 + index, {
    entity: 'LESSON',
    entityId: entityId(500 + index),
    action: 'UPDATE',
    actor: null,
    createdAt: local(day, 20, minute),
    record: {
      label: HELD_BY[index % HELD_BY.length]!,
      startsAt: local(day, 19, 0),
      currency: 'UAH',
    },
    changes: {
      fields: {
        status: { before: 'SCHEDULED', after: 'COMPLETED' },
        completedBy: { before: null, after: 'SCHEDULE' },
      },
    },
  });
});

/** Older teacher changes: the filtered board (1–26 September) finds them. */
const OLDER: AuditLogListItem[] = [
  entry(200, {
    entity: 'TEACHER',
    entityId: TEACHER_IDS.oleh,
    action: 'UPDATE',
    createdAt: local(20, 17, 45),
    record: { label: 'Oleh Marchenko', currency: 'PLN' },
    changes: { fields: { defaultRateMinor: { before: 11000, after: 12000 } } },
  }),
  entry(201, {
    entity: 'TEACHER',
    entityId: TEACHER_IDS.kateryna,
    action: 'UPDATE',
    createdAt: local(3, 9, 12),
    record: { label: 'Kateryna Rudenko', currency: 'UAH' },
    changes: {
      fields: {
        subjects: { before: ['English'], after: ['English', 'IELTS'] },
        phone: { before: null, after: '+380 67 404 12 12' },
      },
    },
  }),
];

export type SettingsStoryOptions = {
  settings?: {
    /** Holds the log's read open, fails it, or empties the studio's log. */
    audit?: 'ready' | 'pending' | 'error' | 'empty';
    /** Makes the settings save fail. */
    saveFails?: boolean;
  };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * The settings routes: the members, the log (filters and pages as the API
 * applies them) and the settings save, whose values `/auth/me` then reports.
 */
export function createSettingsRoutes(options: SettingsStoryOptions) {
  const scenario = options.settings;
  let workspace: Partial<AuthMe['workspace']> = { ...SETTINGS_WORKSPACE };
  const log = [...BOARD_ENTRIES, ...FILLER, ...OLDER].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const never = () => new Promise<Response>(() => undefined);

  const routes = async (
    path: string,
    method: string,
    query: URLSearchParams,
    body: () => Record<string, unknown>,
    others: () => Promise<number>,
  ): Promise<Response | null> => {
    if (!scenario) return null;

    if (path === '/workspaces/current/members' && method === 'GET') return json(MEMBERS);

    if (path === '/workspaces/current/settings' && method === 'PATCH') {
      if (scenario.saveFails) return json({ code: 'UNEXPECTED' }, 500);
      const patch = body() as Partial<AuthMe['workspace']>;
      if (patch.mode === 'SOLO' && workspace.mode !== 'SOLO' && (await others()) > 0) {
        return json({ code: 'SOLO_MODE_SINGLE_TEACHER', message: 'Solo' }, 409);
      }
      workspace = { ...workspace, ...patch };
      return json({ workspace, role: 'OWNER' });
    }

    if (path === '/audit-logs' && method === 'GET') {
      const pageSize = Number(query.get('pageSize') ?? 20);
      if (scenario.audit === 'pending' && pageSize > 1) return never();
      if (scenario.audit === 'error' && pageSize > 1) return json({ code: 'UNEXPECTED' }, 500);
      const from = query.get('from');
      const to = query.get('to');
      const rows = (scenario.audit === 'empty' ? [] : log).filter(
        (item) =>
          (!query.get('entity') || item.entity === query.get('entity')) &&
          (!query.get('action') || item.action === query.get('action')) &&
          (!query.get('actorId') || item.actorId === query.get('actorId')) &&
          (!from || item.createdAt >= from) &&
          (!to || item.createdAt <= to),
      );
      const page = Number(query.get('page') ?? 1);
      const items = rows.slice((page - 1) * pageSize, page * pageSize);
      return json({
        items,
        page,
        pageSize,
        total: rows.length,
        totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
        names: NAMES,
      } satisfies AuditLogListResponse);
    }

    return null;
  };

  return { routes, workspace: () => workspace };
}
