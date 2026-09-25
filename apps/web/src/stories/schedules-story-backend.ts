import type {
  CreateScheduleDto,
  ScheduleChangePreview,
  ScheduleConflict,
  ScheduleCreatePreview,
  ScheduleResponse,
  ScheduleSlotDto,
} from '@tutorio/validation';
import {
  DEFAULT_TIME_ZONE as TZ,
  addCalendarDays,
  calendarWeekday,
  zonedDate,
  zonedDateTime,
  zonedDayEnd,
  zonedDayStart,
  zonedIso,
  zonedWeekday,
} from '@/lib/datetime';

/**
 * The Schedules stories (S05): the boards' studio — sixteen active schedules
 * (a group running today, Sofiia's planned change, Daryna's schedule until 31
 * October), three ended ones — and the previews the dialogs read: the dates
 * of a new schedule (with Anna's Thursdays overlapping B2 prep when asked),
 * Sofiia's change from 1 October, Anna's stop and B2 prep's horizon. The
 * form's student, billing and teachers come from the lesson form backend.
 * Times are wall-clock times in the browser's zone; the clock is Thursday
 * 24 September 2026, 12:00.
 */

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const pad = (n: number) => String(n).padStart(12, '0');
const scheduleId = (n: number) => `12121212-1212-4121-d121-${pad(n)}`;
const seriesId = (n: number) => `13131313-1313-4131-d131-${pad(n)}`;
const studentId = (n: number) => `d6bf671d-7a0f-4cf3-8a67-${pad(n)}`;
const groupId = (n: number) => `99999999-9999-4999-8999-${pad(n)}`;
const enrollmentId = (n: number) => `66666666-6666-4666-d666-${pad(n)}`;
const lessonId = (n: number) => `88888888-8888-4888-e000-${pad(n)}`;

const pad2 = (n: number) => String(n).padStart(2, '0');
/** A wall-clock time on the studio's (Kyiv) clock, as the stories' next-intl reads it. */
const local = (month: number, day: number, hour = 0, minute = 0) =>
  zonedIso(`2026-${pad2(month)}-${pad2(day)}`, `${pad2(hour)}:${pad2(minute)}`, TZ);

/** The page's clock: Thursday 24 September 2026, 12:00. */
export const SCHEDULES_CLOCK = Date.parse(local(9, 24, 12));
const DAY_MS = 24 * 60 * 60 * 1000;

const DMYTRO = { id: '55555555-5555-4555-8555-555555555555', name: 'Dmytro Tutor' };
const IRYNA = { id: '55555555-5555-4555-8555-555555555556', name: 'Iryna Bondar' };
const OLEH = { id: '55555555-5555-4555-8555-555555555558', name: 'Oleh Marchenko' };
type Teacher = typeof DMYTRO;

type AvatarKey = NonNullable<ScheduleResponse['student']>['avatarKey'];
type Who =
  | { student: { id: string; fullName: string; avatarKey: AvatarKey } }
  | { group: { id: string; name: string; memberCount: number } };

let counter = 0;

function schedule(
  who: Who,
  teacher: Teacher,
  slots: [number, string][],
  fields: Partial<ScheduleResponse> = {},
): ScheduleResponse {
  counter += 1;
  const n = counter;
  return {
    id: scheduleId(n),
    workspaceId: WORKSPACE,
    enrollmentId: 'student' in who ? enrollmentId(n) : null,
    groupId: 'group' in who ? who.group.id : null,
    teacherId: teacher.id,
    timezone: 'Europe/Kyiv',
    durationMin: 60,
    horizonWeeks: 4,
    endsAt: null,
    state: 'ACTIVE',
    slots: slots.map(([weekday, localTime]) => ({ weekday, localTime, seriesId: seriesId(n) })),
    nextChange: null,
    nextLessonAt: null,
    startsAt: local(9, 1),
    lastLessonAt: local(10, 22, 17),
    student: 'student' in who ? who.student : null,
    group: 'group' in who ? who.group : null,
    teacher,
    createdAt: new Date(Date.UTC(2026, 7, 1) + n * 3600_000).toISOString(),
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...fields,
  };
}

const student = (n: number, fullName: string, avatarKey: AvatarKey): Who => ({
  student: { id: studentId(n), fullName, avatarKey },
});
const group = (n: number, name: string, memberCount: number): Who => ({
  group: { id: groupId(n), name, memberCount },
});

function studio(): ScheduleResponse[] {
  counter = 0;
  const rows = [
    schedule(
      group(1, 'B2 prep · evening', 6),
      DMYTRO,
      [
        [2, '18:00'],
        [4, '18:00'],
      ],
      {
        durationMin: 90,
        nextLessonAt: local(9, 24, 18),
      },
    ),
    schedule(
      student(1, 'Anna Shevchenko', 'user-1'),
      DMYTRO,
      [
        [1, '17:00'],
        [4, '15:00'],
      ],
      {
        nextLessonAt: local(9, 28, 17),
      },
    ),
    schedule(
      student(2, 'Sofiia Melnyk', 'user-4'),
      IRYNA,
      [
        [2, '17:00'],
        [5, '18:30'],
      ],
      {
        nextLessonAt: local(9, 25, 18, 30),
        lastLessonAt: local(10, 23, 18, 30),
        nextChange: {
          effectiveFrom: local(10, 1),
          slots: [
            { weekday: 2, localTime: '18:00' },
            { weekday: 5, localTime: '18:30' },
          ],
        },
      },
    ),
    schedule(
      group(42, 'Kids A1', 5),
      IRYNA,
      [
        [1, '17:30'],
        [3, '17:30'],
      ],
      {
        nextLessonAt: local(9, 28, 17, 30),
        lastLessonAt: local(10, 21, 17, 30),
      },
    ),
    schedule(
      student(4, 'Daryna Kravets', 'user-6'),
      OLEH,
      [
        [3, '16:00'],
        [5, '12:00'],
      ],
      {
        nextLessonAt: local(9, 25, 12),
        lastLessonAt: local(10, 23, 12),
        startsAt: local(9, 2),
        endsAt: local(11, 1),
      },
    ),
    schedule(student(3, 'Maksym Tkachenko', 'user-8'), OLEH, [[1, '10:00']], {
      nextLessonAt: local(9, 28, 10),
      lastLessonAt: local(10, 19, 10),
    }),
  ];
  const more: [string, Teacher, number, string][] = [
    ['Viktoriia Moroz', OLEH, 2, '11:00'],
    ['Taras Bondarenko', IRYNA, 3, '12:00'],
    ['Oksana Hrytsenko', IRYNA, 4, '13:00'],
    ['Petro Ivanenko', OLEH, 5, '14:00'],
    ['Olha Savchuk', OLEH, 1, '15:00'],
    ['Kateryna Bondarenko', DMYTRO, 2, '16:00'],
    ['Mariia Lytvyn', DMYTRO, 3, '09:00'],
    ['Ivan Shevchuk', IRYNA, 4, '10:30'],
    ['Nazar Kovalenko', OLEH, 5, '15:30'],
    ['Yuliia Tkachuk', DMYTRO, 1, '12:30'],
  ];
  more.forEach(([name, teacher, weekday, time], index) => {
    const day = 28 + ((weekday - 1 + 7) % 7);
    rows.push(
      schedule(student(20 + index, name, null), teacher, [[weekday, time]], {
        // Past the 30th rolls into October.
        nextLessonAt: local(9, day, Number(time.slice(0, 2)), Number(time.slice(3))),
      }),
    );
  });
  rows.push(
    schedule(student(11, 'Mark Petrenko', 'user-2'), OLEH, [[3, '09:00']], {
      state: 'ENDED',
      durationMin: 180,
      startsAt: local(7, 1),
      endsAt: local(9, 24),
      nextLessonAt: null,
      lastLessonAt: null,
    }),
    schedule(
      group(46, 'Summer intensive', 4),
      IRYNA,
      [
        [1, '10:00'],
        [3, '10:00'],
        [5, '10:00'],
      ],
      {
        state: 'ENDED',
        durationMin: 90,
        startsAt: local(7, 1),
        endsAt: local(8, 30),
        nextLessonAt: null,
        lastLessonAt: null,
      },
    ),
    schedule(student(5, 'Artem Lysenko', 'user-3'), DMYTRO, [[2, '16:00']], {
      state: 'ENDED',
      startsAt: local(3, 3),
      endsAt: local(7, 1),
      nextLessonAt: null,
      lastLessonAt: null,
    }),
  );
  return rows;
}

export type SchedulesStoryOptions = {
  schedulesList?: {
    /** `ready` (default), `empty` (no schedule), `pending`, `error`. */
    schedules?: 'ready' | 'empty' | 'pending' | 'error';
    /** New schedules and changes overlap other lessons until forced. */
    conflicts?: boolean;
  };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** The lessons a new rule generates from its start to the horizon or its last day. */
function occurrences(dto: CreateScheduleDto): string[] {
  const start = Date.parse(dto.startDate ?? new Date(SCHEDULES_CLOCK).toISOString());
  const from = Math.max(start, SCHEDULES_CLOCK);
  let until = SCHEDULES_CLOCK + (dto.horizonWeeks ?? 4) * 7 * DAY_MS;
  if (dto.endsOn) until = Math.min(until, zonedDayEnd(dto.endsOn, TZ).getTime());
  const dates: string[] = [];
  for (
    let day = zonedDate(start, TZ);
    zonedDayStart(day, TZ).getTime() < until;
    day = addCalendarDays(day, 1)
  ) {
    for (const slot of dto.slots as ScheduleSlotDto[]) {
      if (calendarWeekday(day) !== slot.weekday) continue;
      const at = zonedDateTime(day, slot.localTime, TZ).getTime();
      if (at >= from && at < until) dates.push(new Date(at).toISOString());
    }
  }
  return dates.sort();
}

const B2 = { id: groupId(1), name: 'B2 prep · evening' };

/** Anna's new Thursdays at 15:00 run into B2 prep, 14:30–16:00 with Dmytro. */
function createConflicts(dates: readonly string[]): ScheduleConflict[] {
  return dates
    .filter((iso) => {
      const day = zonedDate(iso, TZ).slice(8);
      return zonedWeekday(iso, TZ) === 4 && (day === '01' || day === '15');
    })
    .map((iso, index) => {
      const booked = zonedDateTime(zonedDate(iso, TZ), '14:30', TZ);
      return {
        candidateStartsAtUtc: iso,
        lessonId: lessonId(index + 1),
        startsAtUtc: booked.toISOString(),
        durationMin: 90,
        reason: 'TEACHER',
        kind: 'REGULAR',
        teacher: DMYTRO,
        student: null,
        group: B2,
        students: [],
      };
    });
}

/** Sofiia's change from 1 October: Tuesdays to 18:00, Fridays dropped. */
function sofiiaPreview(conflicts: boolean): ScheduleChangePreview {
  const tuesdays = [6, 13, 20, 27];
  return {
    effectiveFrom: local(10, 1),
    moved: 4,
    unchanged: 0,
    created: 0,
    removed: 3,
    kept: 2,
    moves: tuesdays.map((day, index) => ({
      lessonId: lessonId(20 + index),
      startsAtUtc: local(10, day, 17),
      toStartsAtUtc: local(10, day, 18),
    })),
    removals: [2, 9, 23].map((day, index) => ({
      lessonId: lessonId(30 + index),
      startsAtUtc: local(10, day, 18, 30),
    })),
    creates: [],
    keptLessons: [
      { lessonId: lessonId(40), startsAtUtc: local(9, 25, 18, 30), reason: 'HELD' },
      { lessonId: lessonId(41), startsAtUtc: local(10, 16, 18, 30), reason: 'MOVED' },
    ],
    notesLost: [
      {
        lessonId: lessonId(31),
        startsAtUtc: local(10, 9, 18, 30),
        topic: 'Travel vocabulary',
        hasNotes: true,
      },
    ],
    conflicts: conflicts
      ? [
          {
            candidateStartsAtUtc: local(10, 6, 18),
            lessonId: lessonId(50),
            startsAtUtc: local(10, 6, 18),
            durationMin: 60,
            reason: 'TEACHER',
            kind: 'MAKEUP',
            teacher: IRYNA,
            student: { id: studentId(3), fullName: 'Maksym Tkachenko' },
            group: null,
            students: [],
          },
        ]
      : [],
  };
}

const EMPTY_PREVIEW = (effectiveFrom: string): ScheduleChangePreview => ({
  effectiveFrom,
  moved: 0,
  unchanged: 0,
  created: 0,
  removed: 0,
  kept: 0,
  moves: [],
  removals: [],
  creates: [],
  keptLessons: [],
  notesLost: [],
  conflicts: [],
});

/** Anna's stop from today: seven lessons go, the Thursday moved by hand stays. */
function stopPreview(from: string): ScheduleChangePreview {
  const days: [number, number, number][] = [
    [9, 28, 17],
    [10, 1, 15],
    [10, 5, 17],
    [10, 12, 17],
    [10, 15, 15],
    [10, 19, 17],
    [10, 22, 15],
  ];
  const removals = days
    .map(([month, day, hour], index) => ({
      lessonId: lessonId(60 + index),
      startsAtUtc: local(month, day, hour),
    }))
    .filter((removal) => removal.startsAtUtc >= from);
  return {
    ...EMPTY_PREVIEW(from),
    removed: removals.length,
    kept: 1,
    removals,
    keptLessons: [{ lessonId: lessonId(70), startsAtUtc: local(10, 8, 16), reason: 'MOVED' }],
  };
}

/**
 * Answers the Schedules page's and dialogs' requests, or null for anything
 * else (the form's student, billing and teachers go to the lesson form
 * backend). Stateful per story: a create, change, stop or horizon sticks.
 */
export function createSchedulesRoutes(options: SchedulesStoryOptions) {
  const scenario = options.schedulesList;
  const rows = scenario ? studio() : [];
  const never = () => new Promise<Response>(() => undefined);
  const find = (id: string) => rows.find((row) => row.id === id);

  return async (
    path: string,
    method: string,
    query: URLSearchParams,
    body: () => Record<string, unknown>,
  ): Promise<Response | null> => {
    if (!scenario) return null;
    const forced = query.get('force') === 'true';

    // The page's read carries a sort; the form's own check falls through.
    if (path === '/schedules' && method === 'GET' && query.has('sort')) {
      if (scenario.schedules === 'pending') return never();
      if (scenario.schedules === 'error') return json({ code: 'UNEXPECTED' }, 500);
      const source = scenario.schedules === 'empty' ? [] : rows;
      const search = query.get('search')?.toLocaleLowerCase();
      const kind = query.get('kind');
      const base = source.filter((row) => {
        const name = (row.student?.fullName ?? row.group?.name ?? '').toLocaleLowerCase();
        return (
          (!query.get('teacherId') || row.teacherId === query.get('teacherId')) &&
          (!query.get('studentId') || row.student?.id === query.get('studentId')) &&
          (!query.get('groupId') || row.groupId === query.get('groupId')) &&
          (!kind || (kind === 'group') === (row.groupId !== null)) &&
          (!search ||
            name.includes(search) ||
            row.teacher.name.toLocaleLowerCase().includes(search))
        );
      });
      const state = query.get('state') ?? 'ACTIVE';
      const filtered = base.filter((row) =>
        state === 'all'
          ? true
          : state === 'CHANGING'
            ? row.state === 'ACTIVE' && row.nextChange !== null
            : row.state === state,
      );
      if (query.get('sort') === 'next') {
        filtered.sort((a, b) => (a.nextLessonAt ?? '9999').localeCompare(b.nextLessonAt ?? '9999'));
      } else filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const page = Number(query.get('page') ?? 1);
      const pageSize = Number(query.get('pageSize') ?? 20);
      return json({
        items: filtered.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        total: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
        counts: {
          active: base.filter((row) => row.state === 'ACTIVE').length,
          changing: base.filter((row) => row.state === 'ACTIVE' && row.nextChange).length,
          ended: base.filter((row) => row.state === 'ENDED').length,
          all: base.length,
        },
      });
    }

    if (path === '/lessons/list' && query.get('pageSize') === '1') {
      return json({
        items: [],
        page: 1,
        pageSize: 1,
        total: 38,
        totalPages: 38,
        counts: { all: 38, unpaid: 0, cancelled: 0, noShow: 0, needsMakeup: 0 },
        packages: [],
      });
    }

    if (path === '/schedules/preview' && method === 'POST') {
      const dto = body() as unknown as CreateScheduleDto;
      const dates = occurrences(dto);
      const preview: ScheduleCreatePreview = {
        created: dates.length,
        dates,
        firstLessonAt: dates[0] ?? null,
        existingScheduleId: null,
        conflicts: scenario.conflicts ? createConflicts(dates) : [],
      };
      return json(preview);
    }

    if (path === '/schedules' && method === 'POST') {
      const dto = body() as unknown as CreateScheduleDto;
      const dates = occurrences(dto);
      const conflicts = scenario.conflicts ? createConflicts(dates) : [];
      if (conflicts.length > 0 && !forced) {
        return json({ code: 'SCHEDULE_CONFLICT', details: { conflicts } }, 409);
      }
      const created = schedule(student(1, 'Anna Shevchenko', 'user-1'), DMYTRO, [], {
        slots: dto.slots.map((slot) => ({ ...slot, seriesId: seriesId(99) })),
        nextLessonAt: dates[0] ?? null,
        lastLessonAt: dates.at(-1) ?? null,
      });
      rows.unshift(created);
      return json(created, 201);
    }

    const changeMatch = path.match(/^\/schedules\/([^/]+)\/changes(\/preview)?$/);
    if (changeMatch && method === 'POST') {
      const row = find(changeMatch[1]!);
      if (!row) return json({ code: 'SCHEDULE_NOT_FOUND' }, 404);
      const request = body() as {
        effectiveFrom?: string;
        slots: ScheduleSlotDto[];
        durationMin: number;
      };
      const preview =
        row.student?.fullName === 'Sofiia Melnyk'
          ? sofiiaPreview(Boolean(scenario.conflicts))
          : EMPTY_PREVIEW(request.effectiveFrom ?? local(9, 24, 12));
      if (changeMatch[2]) return json(preview);
      if (preview.conflicts.length > 0 && !forced) {
        return json({ code: 'SCHEDULE_CONFLICT', details: { conflicts: preview.conflicts } }, 409);
      }
      row.nextChange = { effectiveFrom: preview.effectiveFrom, slots: request.slots };
      row.durationMin = request.durationMin;
      return json({ schedule: row, summary: preview }, 201);
    }

    const stopMatch = path.match(/^\/schedules\/([^/]+)\/stop(\/preview)?$/);
    if (stopMatch && method === 'POST') {
      const row = find(stopMatch[1]!);
      if (!row) return json({ code: 'SCHEDULE_NOT_FOUND' }, 404);
      const from = String(body().from ?? new Date(SCHEDULES_CLOCK).toISOString());
      const preview = stopPreview(
        from < new Date(SCHEDULES_CLOCK).toISOString()
          ? new Date(SCHEDULES_CLOCK).toISOString()
          : from,
      );
      if (stopMatch[2]) return json(preview);
      Object.assign(row, { state: 'ENDED', endsAt: preview.effectiveFrom, nextLessonAt: null });
      return json({ schedule: row, summary: preview }, 201);
    }

    const horizonMatch = path.match(/^\/schedules\/([^/]+)\/horizon\/preview$/);
    if (horizonMatch && method === 'POST') {
      const weeks = Number(body().horizonWeeks);
      const row = find(horizonMatch[1]!);
      const added = Math.max(0, weeks - (row?.horizonWeeks ?? 4)) * (row?.slots.length ?? 1);
      const last = zonedDateTime(zonedDate(SCHEDULES_CLOCK + weeks * 7 * DAY_MS, TZ), '18:00', TZ);
      return json({
        horizonWeeks: weeks,
        added,
        dates: [],
        lastLessonAt: added > 0 ? last.toISOString() : (row?.lastLessonAt ?? null),
      });
    }

    const detailMatch = path.match(/^\/schedules\/([^/]+)$/);
    if (detailMatch && method === 'PATCH') {
      const row = find(detailMatch[1]!);
      if (!row) return json({ code: 'SCHEDULE_NOT_FOUND' }, 404);
      row.horizonWeeks = Number(body().horizonWeeks);
      return json(row);
    }
    if (detailMatch && method === 'GET') {
      const row = find(detailMatch[1]!);
      return row ? json(row) : null;
    }

    return null;
  };
}
