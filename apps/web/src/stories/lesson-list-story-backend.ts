import type {
  BulkCancelPreview,
  LessonChargeResponse,
  LessonDetailResponse,
  LessonResponse,
  LessonStatusDto,
  TeacherResponse,
} from '@tutorio/validation';

/**
 * The Lessons page's stories (S04): September 2026 of a studio with three
 * teachers — the boards' rows first (a weekend group, a makeup, a no-show, a
 * free cancellation, groups partly paid), then held, cancelled and
 * scheduled lessons around them — and a Wednesday 14 October with fourteen
 * scheduled lessons for the bulk cancel. The list read filters, counts,
 * orders and pages them the way the API does; a bulk cancel sticks until
 * the story unmounts. Times are wall-clock times in the browser's zone. The
 * clock is Thursday 24 September, 18:40.
 */

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const pad = (n: number) => String(n).padStart(12, '0');
const lessonId = (n: number) => `88888888-8888-4888-d000-${pad(n)}`;
const studentId = (n: number) => `d6bf671d-7a0f-4cf3-8a67-${pad(n)}`;
const groupId = (n: number) => `99999999-9999-4999-8999-${pad(n)}`;
const enrollmentId = (n: number) => `66666666-6666-4666-d666-${pad(n)}`;

const local = (month: 9 | 10, day: number, hour: number, minute = 0) =>
  new Date(2026, month - 1, day, hour, minute).toISOString();

/** The page's clock: Thursday 24 September 2026, 18:40. */
export const LESSON_LIST_CLOCK = Date.parse(local(9, 24, 18, 40));

type Teacher = { id: string; name: string; color: string | null; avatarKey: string | null };
const DMYTRO: Teacher = {
  id: '55555555-5555-4555-8555-555555555555',
  name: 'Dmytro Tutor',
  color: null,
  avatarKey: null,
};
const IRYNA: Teacher = {
  id: '55555555-5555-4555-8555-555555555556',
  name: 'Iryna Bondar',
  color: null,
  avatarKey: 'user-6',
};
const OLEH: Teacher = {
  id: '55555555-5555-4555-8555-555555555558',
  name: 'Oleh Marchenko',
  color: null,
  avatarKey: 'user-3',
};

const STUDENTS = {
  anna: { id: studentId(1), fullName: 'Anna Shevchenko', avatarKey: 'user-1' as const },
  sofiia: { id: studentId(2), fullName: 'Sofiia Melnyk', avatarKey: 'user-4' as const },
  maksym: { id: studentId(3), fullName: 'Maksym Tkachenko', avatarKey: 'user-8' as const },
  daryna: { id: studentId(4), fullName: 'Daryna Kravets', avatarKey: 'user-6' as const },
  artem: { id: studentId(5), fullName: 'Artem Lysenko', avatarKey: 'user-3' as const },
  viktoriia: { id: studentId(13), fullName: 'Viktoriia Moroz', avatarKey: 'user-7' as const },
  taras: { id: studentId(14), fullName: 'Taras Bondarenko', avatarKey: 'user-9' as const },
};
type Student = (typeof STUDENTS)[keyof typeof STUDENTS];

const GROUPS = {
  kidsA1: { id: groupId(42), name: 'Kids A1 · weekend' },
  kids: { id: groupId(45), name: 'Kids A1' },
  b1: { id: groupId(41), name: 'B1 English' },
  b2: { id: groupId(1), name: 'B2 prep · evening' },
};
type Group = (typeof GROUPS)[keyof typeof GROUPS];

let counter = 0;

type Pay = 'paid' | 'unpaid' | 'debt' | 'package' | { paid: number; total: number };

function charges(who: Student | Group, pay: Pay | undefined, n: number): LessonChargeResponse[] {
  if (!pay) return [];
  const one = (index: number, source: LessonChargeResponse['source'], paid: boolean) => ({
    id: `charge-${n}-${index}`,
    enrollmentId: enrollmentId(n * 10 + index),
    source,
    packageId: null,
    amountMinor: 40000,
    currency: 'UAH' as const,
    paid,
    student: 'fullName' in who ? { id: who.id, fullName: who.fullName } : STUDENTS.anna,
  });
  if (typeof pay === 'object') {
    return Array.from({ length: pay.total }, (_, index) => one(index, 'BALANCE', index < pay.paid));
  }
  if (pay === 'package') return [one(0, 'PACKAGE', true)];
  if (pay === 'debt') return [one(0, 'DEBT', false)];
  return [one(0, 'BALANCE', pay === 'paid')];
}

function lesson(
  who: Student | Group,
  startsAtUtc: string,
  fields: Partial<LessonResponse> & { teacher?: Teacher; pay?: Pay } = {},
): LessonResponse {
  counter += 1;
  const { teacher = DMYTRO, pay, ...rest } = fields;
  const isGroup = !('fullName' in who);
  const status: LessonStatusDto = rest.status ?? 'SCHEDULED';
  return {
    id: lessonId(counter),
    workspaceId: WORKSPACE,
    enrollmentId: isGroup ? null : enrollmentId(counter),
    groupId: isGroup ? who.id : null,
    seriesId: null,
    teacherId: teacher.id,
    startsAtUtc,
    durationMin: 60,
    priceMinor: isGroup ? 30000 : 40000,
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
    charges: charges(who, pay, counter),
    student: isGroup ? null : (who as Student),
    group: isGroup ? (who as Group) : null,
    teacher: { id: teacher.id, name: teacher.name, color: teacher.color },
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    deletedAt: null,
    ...rest,
  };
}

/** The boards' rows and September around them. */
function september(): LessonResponse[] {
  const s = STUDENTS;
  const g = GROUPS;
  const rows = [
    lesson(g.kidsA1, local(9, 26, 10), { teacher: OLEH, durationMin: 90 }),
    lesson(s.sofiia, local(9, 25, 18, 30), { teacher: IRYNA, priceMinor: 45000 }),
    lesson(s.daryna, local(9, 25, 12), { teacher: OLEH, durationMin: 45 }),
    lesson(s.maksym, local(9, 24, 19), { teacher: IRYNA, kind: 'MAKEUP', priceMinor: 0 }),
    lesson(s.anna, local(9, 24, 15), { status: 'COMPLETED', pay: 'paid', priceMinor: 50000 }),
    lesson(s.daryna, local(9, 23, 16), { teacher: OLEH, status: 'NO_SHOW', pay: 'unpaid' }),
    lesson(g.kids, local(9, 23, 17, 30), {
      teacher: IRYNA,
      status: 'COMPLETED',
      pay: { paid: 4, total: 5 },
    }),
    lesson(s.sofiia, local(9, 22, 17), {
      teacher: IRYNA,
      status: 'CANCELLED_UNCHARGED',
      priceMinor: 45000,
    }),
    lesson(g.b2, local(9, 22, 18), {
      status: 'COMPLETED',
      durationMin: 90,
      priceMinor: 40000,
      pay: { paid: 6, total: 6 },
    }),
    lesson(s.sofiia, local(9, 15, 17), {
      teacher: IRYNA,
      status: 'COMPLETED',
      pay: 'unpaid',
      priceMinor: 45000,
    }),
    lesson(s.sofiia, local(9, 11, 18, 30), {
      teacher: IRYNA,
      status: 'COMPLETED',
      pay: 'package',
      priceMinor: 45000,
    }),
    lesson(s.artem, local(9, 21, 17), { status: 'COMPLETED', pay: 'debt' }),
    lesson(s.viktoriia, local(9, 21, 10), {
      teacher: OLEH,
      status: 'CANCELLED_CHARGED',
      pay: 'unpaid',
    }),
  ];
  // The rest of the month: held and paid before the clock, scheduled after it.
  const cycle: [Student | Group, Teacher][] = [
    [s.anna, DMYTRO],
    [g.b1, IRYNA],
    [s.taras, IRYNA],
    [s.viktoriia, OLEH],
    [g.b2, DMYTRO],
    [s.artem, DMYTRO],
  ];
  let index = 0;
  for (let day = 1; day <= 30; day += 1) {
    const weekday = new Date(2026, 8, day).getDay();
    if (weekday === 0 || (day >= 21 && day <= 26)) continue;
    const [who, teacher] = cycle[index % cycle.length]!;
    index += 1;
    const past = day < 24;
    rows.push(
      lesson(who, local(9, day, 11 + (index % 5)), {
        teacher,
        status: past ? 'COMPLETED' : 'SCHEDULED',
        pay: past ? ('fullName' in who ? 'package' : { paid: 5, total: 5 }) : undefined,
      }),
    );
  }
  return rows;
}

/** Wednesday 14 October: ten individual and four group lessons to cancel. */
function holiday(): LessonResponse[] {
  const s = STUDENTS;
  const g = GROUPS;
  const people: [Student, Teacher][] = [
    [s.maksym, OLEH],
    [s.daryna, OLEH],
    [s.anna, DMYTRO],
    [s.sofiia, IRYNA],
    [s.artem, DMYTRO],
    [s.viktoriia, OLEH],
    [s.taras, IRYNA],
  ];
  const hours = [10, 16, 11, 12, 13, 14, 15, 17, 19, 20];
  return [
    ...hours.map((hour, index) => {
      const [who, teacher] = people[index % people.length]!;
      return lesson(who, local(10, 14, hour), { teacher });
    }),
    lesson(g.kids, local(10, 14, 17, 30), { teacher: IRYNA }),
    lesson(g.b1, local(10, 14, 18, 30), { teacher: IRYNA, durationMin: 90, priceMinor: 35000 }),
    lesson(g.b2, local(10, 14, 18), { durationMin: 90 }),
    lesson(g.kidsA1, local(10, 14, 9), { teacher: OLEH }),
  ];
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

export type LessonListStoryOptions = {
  lessonList?: {
    /** `ready` (default), `empty` (a studio with no lesson), `pending`, `error`. */
    lessons?: 'ready' | 'empty' | 'pending' | 'error';
    /** `solo`: Dmytro alone; `school` (default): Iryna and Oleh too. */
    teachers?: 'school' | 'solo';
  };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const unpaid = (item: LessonResponse) => item.charges.some((charge) => !charge.paid);
const cancelled = (item: LessonResponse) => item.status.startsWith('CANCELLED');
const needsMakeup = (item: LessonResponse) =>
  item.groupId === null &&
  (cancelled(item) || item.status === 'NO_SHOW') &&
  item.makeupLessonId === null;
const QUICK: Record<string, (item: LessonResponse) => boolean> = {
  unpaid,
  cancelled,
  no_show: (item) => item.status === 'NO_SHOW',
  needs_makeup: needsMakeup,
};

/**
 * Answers the Lessons page's requests, or null for anything else. Stateful
 * per story: a bulk cancel sticks until the story unmounts.
 */
export function createLessonListRoutes(options: LessonListStoryOptions) {
  const scenario = options.lessonList;
  counter = 0;
  const solo = scenario?.teachers === 'solo';
  const lessons = scenario
    ? [...september(), ...holiday()].filter((item) => !solo || item.teacherId === DMYTRO.id)
    : [];
  const teachers = solo
    ? [teacherRow(DMYTRO, true)]
    : [teacherRow(DMYTRO, true), teacherRow(IRYNA, false), teacherRow(OLEH, false)];
  const never = () => new Promise<Response>(() => undefined);

  /** The lessons a bulk cancel covers: scheduled, in `[from, to)`, of one teacher or all. */
  const toCancel = (body: Record<string, unknown>) => {
    const from = Date.parse(String(body.from));
    const to = Date.parse(String(body.to));
    return lessons
      .filter((item) => {
        const start = Date.parse(item.startsAtUtc);
        return (
          item.status === 'SCHEDULED' &&
          start >= from &&
          start < to &&
          (!body.teacherId || item.teacherId === body.teacherId)
        );
      })
      .sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc));
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

    if (path === '/groups/options') {
      return json({ items: Object.values(GROUPS) });
    }

    if (path === '/lessons/list') {
      const pageSize = Number(query.get('pageSize') ?? 20);
      const counting = pageSize === 1;
      if (scenario.lessons === 'pending' && !counting) return never();
      if (scenario.lessons === 'error' && !counting) return json({ code: 'UNEXPECTED' }, 500);
      const source = scenario.lessons === 'empty' ? [] : lessons;
      const from = query.get('from') ? Date.parse(query.get('from')!) : -Infinity;
      const to = query.get('to') ? Date.parse(query.get('to')!) : Infinity;
      const statuses = query.get('status')?.split(',');
      const search = query.get('search')?.toLocaleLowerCase();
      const studentFilter = query.get('studentId');
      const base = source.filter((item) => {
        const start = Date.parse(item.startsAtUtc);
        const name = (item.student?.fullName ?? item.group?.name ?? '').toLocaleLowerCase();
        return (
          start >= from &&
          start < to &&
          (!query.get('teacherId') || item.teacherId === query.get('teacherId')) &&
          (!studentFilter || item.student?.id === studentFilter) &&
          (!query.get('groupId') || item.groupId === query.get('groupId')) &&
          (!statuses || statuses.includes(item.status)) &&
          (!search ||
            name.includes(search) ||
            item.teacher.name.toLocaleLowerCase().includes(search))
        );
      });
      const filter = query.get('filter');
      const rows = filter ? base.filter(QUICK[filter]!) : base;
      const order = query.get('order') === 'asc' ? 1 : -1;
      rows.sort((a, b) => order * a.startsAtUtc.localeCompare(b.startsAtUtc));
      const page = Number(query.get('page') ?? 1);
      return json({
        items: rows.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        total: rows.length,
        totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
        counts: {
          all: base.length,
          unpaid: base.filter(unpaid).length,
          cancelled: base.filter(cancelled).length,
          noShow: base.filter(QUICK.no_show!).length,
          needsMakeup: base.filter(needsMakeup).length,
        },
      });
    }

    if (path === '/lessons/bulk-cancel/preview' && method === 'POST') {
      const found = toCancel(body());
      const preview: BulkCancelPreview = {
        count: found.length,
        byTeacher: [],
        lessons: found.map((item) => ({
          id: item.id,
          startsAtUtc: item.startsAtUtc,
          durationMin: item.durationMin,
          student: item.student ? { id: item.student.id, fullName: item.student.fullName } : null,
          group: item.group,
          teacher: item.teacher,
        })),
        truncated: false,
      };
      return json(preview);
    }

    if (path === '/lessons/bulk-cancel' && method === 'POST') {
      const request = body();
      const found = toCancel(request);
      for (const item of found) {
        Object.assign(item, {
          status: 'CANCELLED_UNCHARGED',
          cancelledBy: 'TEACHER',
          cancelledReason: request.reason ?? null,
        });
      }
      return json({ cancelled: found.length, lessonIds: found.map((item) => item.id) });
    }

    const detailMatch = method === 'GET' ? path.match(/^\/lessons\/([^/]+)$/) : null;
    const listed = detailMatch ? lessons.find((item) => item.id === detailMatch[1]) : undefined;
    if (listed) {
      const detail: LessonDetailResponse = {
        ...listed,
        original: null,
        makeup: null,
        schedule: null,
        history: [],
      };
      return json(detail);
    }

    return null;
  };
}
