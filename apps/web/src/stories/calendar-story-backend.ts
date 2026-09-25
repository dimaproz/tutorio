import type {
  LessonDetailResponse,
  LessonResponse,
  ScheduleChangePreview,
  ScheduleResponse,
  TeacherResponse,
} from '@tutorio/validation';

/**
 * The calendar's stories (S03): the boards' week of 21–27 September 2026 for
 * Dmytro (fifteen lessons: held, a no-show, a cancelled one, a group running
 * now, a makeup, an unpaid one, a long intensive) and the same week with
 * Iryna and Oleh; September filled around it for the month; Anna's Monday
 * and Friday schedule for the scope dialog; and the moves the grid makes,
 * refused with a conflict where the new time overlaps. Times are wall-clock
 * times in the browser's zone, as the calendar draws them. The clock is
 * Thursday 24 September, 18:40.
 */

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const pad = (n: number) => String(n).padStart(12, '0');
const lessonId = (n: number) => `88888888-8888-4888-c000-${pad(n)}`;
const studentId = (n: number) => `d6bf671d-7a0f-4cf3-8a67-${pad(n)}`;
const groupId = (n: number) => `99999999-9999-4999-8999-${pad(n)}`;
const enrollmentId = (n: number) => `66666666-6666-4666-c666-${pad(n)}`;
const SCHEDULE_ID = '12121212-1212-4121-c121-000000000001';
const SERIES_ID = '13131313-1313-4131-c131-000000000001';

/** A wall-clock time in the browser's zone. */
const local = (month: 9 | 10, day: number, hour: number, minute = 0) =>
  new Date(2026, month - 1, day, hour, minute).toISOString();

/** The calendar's clock: Thursday 24 September, 18:40. */
export const CALENDAR_CLOCK = Date.parse(local(9, 24, 18, 40));

type Teacher = { id: string; name: string; color: string; avatarKey: string | null };
const DMYTRO: Teacher = {
  id: '55555555-5555-4555-8555-555555555555',
  name: 'Dmytro Tutor',
  color: '#4B4FE0',
  avatarKey: null,
};
const IRYNA: Teacher = {
  id: '55555555-5555-4555-8555-555555555556',
  name: 'Iryna Bondar',
  color: '#D6336C',
  avatarKey: 'user-6',
};
const OLEH: Teacher = {
  id: '55555555-5555-4555-8555-555555555558',
  name: 'Oleh Marchenko',
  color: '#12A150',
  avatarKey: 'user-3',
};

const STUDENTS = {
  anna: { id: studentId(1), fullName: 'Anna Shevchenko', avatarKey: 'user-1' as const },
  sofiia: { id: studentId(2), fullName: 'Sofiia Melnyk', avatarKey: 'user-4' as const },
  maksym: { id: studentId(3), fullName: 'Maksym Tkachenko', avatarKey: 'user-8' as const },
  daryna: { id: studentId(4), fullName: 'Daryna Kravets', avatarKey: 'user-6' as const },
  artem: { id: studentId(5), fullName: 'Artem Lysenko', avatarKey: 'user-3' as const },
  mark: { id: studentId(11), fullName: 'Mark Petrenko', avatarKey: 'user-2' as const },
  oksana: { id: studentId(12), fullName: 'Oksana Hrytsenko', avatarKey: 'user-10' as const },
  viktoriia: { id: studentId(13), fullName: 'Viktoriia Moroz', avatarKey: 'user-7' as const },
  taras: { id: studentId(14), fullName: 'Taras Bondarenko', avatarKey: 'user-9' as const },
  petro: { id: studentId(15), fullName: 'Petro Ivanenko', avatarKey: null },
  olha: { id: studentId(16), fullName: 'Olha Savchuk', avatarKey: 'user-5' as const },
};
type Student = (typeof STUDENTS)[keyof typeof STUDENTS];

const GROUPS = {
  b1: { id: groupId(41), name: 'B1 English' },
  b2: { id: groupId(1), name: 'B2 prep · evening' },
  kidsA1: { id: groupId(42), name: 'Kids A1 · weekend' },
  kidsA2: { id: groupId(43), name: 'Kids A2' },
  b1Intensive: { id: groupId(44), name: 'B1 Intensive' },
};
type Group = (typeof GROUPS)[keyof typeof GROUPS];

let counter = 0;

function lesson(
  who: Student | Group,
  startsAtUtc: string,
  fields: Partial<LessonResponse> & { teacher?: Teacher; unpaid?: boolean } = {},
): LessonResponse {
  counter += 1;
  const { teacher = DMYTRO, unpaid = false, ...rest } = fields;
  const isGroup = !('fullName' in who);
  const status = rest.status ?? 'SCHEDULED';
  const charged = status === 'COMPLETED' || status === 'NO_SHOW' || status === 'CANCELLED_CHARGED';
  return {
    id: lessonId(counter),
    workspaceId: WORKSPACE,
    enrollmentId: isGroup ? null : enrollmentId(counter),
    groupId: isGroup ? who.id : null,
    seriesId: null,
    teacherId: teacher.id,
    startsAtUtc,
    durationMin: 60,
    priceMinor: 40000,
    currency: 'UAH',
    status,
    kind: 'REGULAR',
    originalLessonId: null,
    makeupLessonId: null,
    topic: null,
    isDetached: false,
    rescheduledCount: 0,
    rescheduledAt: null,
    cancelledBy: status.startsWith('CANCELLED') ? 'STUDENT' : null,
    cancelledReason: null,
    cancelledAt: null,
    completedAt: status === 'COMPLETED' ? startsAtUtc : null,
    paidAt: null,
    notes: null,
    cancellationDeadlineHours: 24,
    attendance: null,
    charges:
      charged && !isGroup
        ? [
            {
              id: `charge-${counter}`,
              enrollmentId: enrollmentId(counter),
              source: unpaid ? 'BALANCE' : 'PACKAGE',
              packageId: null,
              amountMinor: 40000,
              currency: 'UAH',
              paid: !unpaid,
              student: { id: who.id, fullName: (who as Student).fullName },
            },
          ]
        : [],
    student: isGroup ? null : (who as Student),
    group: isGroup ? who : null,
    teacher: { id: teacher.id, name: teacher.name, color: teacher.color },
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    deletedAt: null,
    ...rest,
  };
}

/** The boards' week for Dmytro: fifteen lessons. */
function dmytroWeek(): LessonResponse[] {
  const s = STUDENTS;
  const g = GROUPS;
  const missed = lesson(s.maksym, local(9, 21, 10), { status: 'COMPLETED', unpaid: true });
  return [
    missed,
    lesson(s.anna, local(9, 21, 17), { status: 'COMPLETED', seriesId: SERIES_ID }),
    lesson(g.b1, local(9, 21, 18, 30), {
      status: 'COMPLETED',
      durationMin: 90,
      topic: 'Unit 4 · Food',
    }),
    lesson(s.sofiia, local(9, 22, 17), { status: 'CANCELLED_UNCHARGED' }),
    lesson(g.b2, local(9, 22, 18), {
      status: 'COMPLETED',
      durationMin: 90,
      topic: 'Mock exam · part 2',
    }),
    lesson(s.mark, local(9, 23, 9), {
      status: 'COMPLETED',
      durationMin: 180,
      topic: 'Інтенсив перед співбесідою',
    }),
    lesson(s.daryna, local(9, 23, 16), { status: 'NO_SHOW' }),
    lesson(s.artem, local(9, 23, 17), { status: 'COMPLETED' }),
    lesson(s.anna, local(9, 24, 15), { status: 'COMPLETED', topic: 'Past Perfect' }),
    lesson(g.b2, local(9, 24, 18), { durationMin: 90, topic: 'Speaking: travel' }),
    lesson(s.maksym, local(9, 24, 19, 45), {
      kind: 'MAKEUP',
      originalLessonId: missed.id,
      topic: 'Відпрацювання за 21 вер',
    }),
    lesson(s.daryna, local(9, 25, 12), { durationMin: 45 }),
    lesson(s.anna, local(9, 25, 17), { seriesId: SERIES_ID }),
    lesson(s.sofiia, local(9, 25, 18, 30)),
    lesson(g.kidsA1, local(9, 26, 10), { durationMin: 90, topic: 'Animals' }),
  ];
}

/** Iryna's and Oleh's lessons in the same week. */
function otherTeachersWeek(): LessonResponse[] {
  const s = STUDENTS;
  const g = GROUPS;
  return [
    lesson(s.oksana, local(9, 21, 12), { status: 'COMPLETED', teacher: IRYNA }),
    lesson(g.kidsA2, local(9, 22, 17), { status: 'COMPLETED', teacher: IRYNA, durationMin: 45 }),
    lesson(s.petro, local(9, 23, 17, 30), { status: 'COMPLETED', teacher: OLEH }),
    lesson(g.b1Intensive, local(9, 24, 16), {
      status: 'COMPLETED',
      teacher: IRYNA,
      durationMin: 90,
    }),
    lesson(s.olha, local(9, 24, 18, 30), { teacher: OLEH }),
    lesson(s.viktoriia, local(9, 25, 10), { teacher: OLEH }),
    lesson(s.taras, local(9, 25, 17), { teacher: IRYNA, durationMin: 45 }),
    lesson(g.kidsA2, local(9, 26, 11, 30), { teacher: IRYNA }),
  ];
}

/** September around the boards' week, for the month (up to four a day). */
function septemberAround(): LessonResponse[] {
  const s = STUDENTS;
  const g = GROUPS;
  const cycle: (Student | Group)[] = [g.b2, g.b1, s.sofiia, s.anna, s.maksym, g.kidsA1, s.daryna];
  const perWeekday: Record<number, number[]> = {
    1: [10 * 60, 15 * 60 + 30],
    2: [10 * 60, 15 * 60 + 30, 17 * 60],
    3: [10 * 60, 15 * 60 + 30],
    4: [10 * 60, 15 * 60 + 30, 17 * 60, 18 * 60 + 30],
    5: [10 * 60, 15 * 60 + 30, 17 * 60],
    6: [10 * 60],
  };
  const lessons: LessonResponse[] = [];
  let index = 0;
  for (let day = 1; day <= 30; day += 1) {
    if (day >= 21 && day <= 27) continue;
    const weekday = new Date(2026, 8, day).getDay();
    for (const minute of perWeekday[weekday] ?? []) {
      const who = cycle[index % cycle.length]!;
      index += 1;
      const past = day < 24;
      lessons.push(
        lesson(who, local(9, day, Math.floor(minute / 60), minute % 60), {
          status: past ? (index % 9 === 0 ? 'CANCELLED_UNCHARGED' : 'COMPLETED') : 'SCHEDULED',
          kind: index % 17 === 0 ? 'MAKEUP' : 'REGULAR',
        }),
      );
    }
  }
  return lessons;
}

function teacherRow(teacher: Teacher, isMe: boolean): TeacherResponse {
  return {
    id: teacher.id,
    workspaceId: WORKSPACE,
    fullName: teacher.name,
    email: null,
    phone: null,
    telegramUsername: null,
    bio: null,
    defaultRateMinor: 40000,
    currency: 'UAH',
    color: teacher.color,
    avatarKey: teacher.avatarKey as TeacherResponse['avatarKey'],
    status: 'ACTIVE',
    workspaceMemberId: null,
    isMe,
    notes: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    deletedAt: null,
  };
}

const SCHEDULE: ScheduleResponse = {
  id: SCHEDULE_ID,
  workspaceId: WORKSPACE,
  enrollmentId: enrollmentId(2),
  groupId: null,
  teacherId: DMYTRO.id,
  timezone: 'Europe/Kyiv',
  durationMin: 60,
  horizonWeeks: 4,
  endsAt: null,
  state: 'ACTIVE',
  slots: [
    { weekday: 1, localTime: '17:00', seriesId: SERIES_ID },
    { weekday: 5, localTime: '17:00', seriesId: SERIES_ID },
  ],
  nextChange: null,
  nextLessonAt: local(9, 25, 17),
  startsAt: '2026-09-01T00:00:00.000Z',
  lastLessonAt: local(10, 23, 17),
  student: { id: STUDENTS.anna.id, fullName: STUDENTS.anna.fullName, avatarKey: null },
  group: null,
  teacher: { id: DMYTRO.id, name: DMYTRO.name },
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

const PREVIEW: ScheduleChangePreview = {
  effectiveFrom: local(9, 25, 14),
  moved: 4,
  unchanged: 4,
  created: 0,
  removed: 0,
  kept: 1,
  notesLost: [],
  conflicts: [],
  moves: [],
  removals: [],
  creates: [],
  keptLessons: [],
};

/** The boards' week for the pattern stories: Dmytro's fifteen lessons, then Iryna's and Oleh's. */
export function calendarStoryWeek(withOthers = false): LessonResponse[] {
  counter = 0;
  return [...dmytroWeek(), ...(withOthers ? otherTeachersWeek() : [])];
}

/** September for the month patterns. */
export function calendarStoryMonth(): LessonResponse[] {
  counter = 0;
  return [...dmytroWeek(), ...septemberAround()];
}

export type CalendarStoryOptions = {
  calendar?: {
    /** `ready` (default), `empty` (no lessons), `pending` (never answers), `error`. */
    lessons?: 'ready' | 'empty' | 'pending' | 'error';
    /** `solo`: the studio has Dmytro only; `school` (default): Iryna and Oleh too. */
    teachers?: 'school' | 'solo';
  };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * Answers the calendar's requests, or null for anything else. Stateful per
 * story: a move sticks until the story unmounts.
 */
export function createCalendarRoutes(options: CalendarStoryOptions) {
  const scenario = options.calendar;
  counter = 0;
  const lessons = scenario
    ? [
        ...dmytroWeek(),
        ...(scenario.teachers === 'solo' ? [] : otherTeachersWeek()),
        ...septemberAround(),
      ]
    : [];
  const teachers =
    scenario?.teachers === 'solo'
      ? [teacherRow(DMYTRO, true)]
      : [teacherRow(DMYTRO, true), teacherRow(IRYNA, false), teacherRow(OLEH, false)];
  const never = () => new Promise<Response>(() => undefined);
  const find = (id: string) => lessons.find((item) => item.id === id);

  const overlapping = (moving: LessonResponse, startsAtUtc: string) => {
    const start = Date.parse(startsAtUtc);
    const end = start + moving.durationMin * 60_000;
    return lessons.filter((other) => {
      if (other.id === moving.id || other.status.startsWith('CANCELLED')) return false;
      const otherStart = Date.parse(other.startsAtUtc);
      const overlaps = otherStart < end && start < otherStart + other.durationMin * 60_000;
      return overlaps && other.teacherId === moving.teacherId;
    });
  };

  return async (
    path: string,
    method: string,
    query: URLSearchParams,
    body: () => Record<string, unknown>,
  ): Promise<Response | null> => {
    if (!scenario) return null;

    if (path === '/teachers') {
      return json({
        items: teachers,
        page: 1,
        pageSize: 100,
        total: teachers.length,
        totalPages: 1,
      });
    }

    if (path === '/lessons' && method === 'GET' && query.has('from')) {
      if (scenario.lessons === 'pending') return never();
      if (scenario.lessons === 'error') return json({ code: 'UNEXPECTED' }, 500);
      if (scenario.lessons === 'empty') return json({ items: [] });
      const from = Date.parse(query.get('from')!);
      const to = Date.parse(query.get('to')!);
      return json({
        items: lessons.filter((item) => {
          const start = Date.parse(item.startsAtUtc);
          return start >= from && start < to && !item.deletedAt;
        }),
      });
    }

    if (path === '/lessons/list') {
      const next =
        scenario.lessons === 'empty'
          ? [lesson(STUDENTS.anna, local(10, 5, 17), { seriesId: SERIES_ID })]
          : lessons
              .filter(
                (item) =>
                  item.status === 'SCHEDULED' &&
                  Date.parse(item.startsAtUtc) >= Date.parse(query.get('from') ?? '') &&
                  (!query.get('teacherId') || item.teacherId === query.get('teacherId')),
              )
              .sort((left, right) => Date.parse(left.startsAtUtc) - Date.parse(right.startsAtUtc))
              .slice(0, 1);
      return json({
        items: next,
        page: 1,
        pageSize: 1,
        total: next.length,
        totalPages: 1,
        counts: { all: next.length, unpaid: 0, cancelled: 0, noShow: 0, needsMakeup: 0 },
        packages: [],
      });
    }

    const moveMatch = path.match(/^\/lessons\/([^/]+)\/reschedule$/);
    if (moveMatch && method === 'PATCH') {
      const moving = find(moveMatch[1]!);
      if (!moving) return null;
      const dto = body() as { startsAtUtc: string };
      const clashes = overlapping(moving, dto.startsAtUtc);
      if (clashes.length > 0 && query.get('force') !== 'true') {
        return json(
          {
            code: 'SCHEDULE_CONFLICT',
            message: 'The lesson overlaps another one.',
            details: {
              conflicts: clashes.map((other) => ({
                candidateStartsAtUtc: dto.startsAtUtc,
                lessonId: other.id,
                startsAtUtc: other.startsAtUtc,
                durationMin: other.durationMin,
                reason: 'TEACHER',
                kind: other.kind,
                teacher: { id: other.teacher.id, name: other.teacher.name },
                student: other.student
                  ? { id: other.student.id, fullName: other.student.fullName }
                  : null,
                group: other.group,
                students: [],
              })),
            },
          },
          409,
        );
      }
      moving.startsAtUtc = dto.startsAtUtc;
      moving.rescheduledCount += 1;
      return json(moving);
    }

    const detailMatch = method === 'GET' ? path.match(/^\/lessons\/([^/]+)$/) : null;
    const listed = detailMatch ? find(detailMatch[1]!) : undefined;
    if (listed) {
      const detail: LessonDetailResponse = {
        ...listed,
        original: null,
        makeup: null,
        schedule: listed.seriesId ? { id: SCHEDULE_ID, state: 'ACTIVE' } : null,
        history: [],
      };
      return json(detail);
    }

    if (path === `/schedules/${SCHEDULE_ID}`) return json(SCHEDULE);
    if (path === `/schedules/${SCHEDULE_ID}/changes/preview`) return json(PREVIEW);

    return null;
  };
}
