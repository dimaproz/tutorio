import type {
  AttentionCategory,
  AttentionItem,
  AvatarKeyDto,
  DashboardAttentionResponse,
  DashboardMoneyResponse,
  DashboardSetupResponse,
  LessonResponse,
  TeacherListItem,
} from '@tutorio/validation';
import { DEFAULT_TIME_ZONE, zonedIso } from '@/lib/datetime';
import { TEACHER_COLORS } from '@/lib/theme/user-colors';

/**
 * The Today page's stories (S11): Kyiv English Studio (Europe/Kyiv, UAH,
 * studio mode, five active teachers) and its owner Olena Kovalenko, who also
 * teaches. The clock is Saturday 26 September 2026, 13:05 — or 19:45 for the
 * end of the day. Olena's day has seven lessons; «Студія» adds four of Dmytro,
 * Iryna, Oleh and Kateryna. Tomorrow has four; Monday four more.
 */

export type TodayStoryOptions = {
  today?: {
    /** The day: mid-day, its end, a free day, or the three lessons of a first run. */
    day?: 'busy' | 'end' | 'free' | 'partial';
    /** Who the owner is: teaches with colleagues, does not teach, or a solo tutor. */
    owner?: 'teaches' | 'notTeaching' | 'solo';
    money?: 'one' | 'two' | 'firstDay' | 'pending' | 'error';
    attention?: 'typical' | 'calm' | 'many' | 'free' | 'pending' | 'error';
    setup?: 'done' | 'fresh' | 'partial';
    lessons?: 'ready' | 'pending' | 'error';
  };
};

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const pad = (n: number, width = 12) => String(n).padStart(width, '0');
const pad2 = (n: number) => String(n).padStart(2, '0');
const lessonId = (n: number) => `88888888-8888-4888-d000-${pad(n)}`;
const studentId = (n: number) => `d6bf671d-7a0f-4cf3-8d67-${pad(n)}`;
const enrollmentId = (n: number) => `66666666-6666-4666-d666-${pad(n)}`;
const groupId = (n: number) => `99999999-9999-4999-d999-${pad(n)}`;
const itemId = (n: number) => `77777777-7777-4777-d777-${pad(n)}`;

const local = (day: number, time: string, month = 9) =>
  zonedIso(`2026-${pad2(month)}-${pad2(day)}`, time, DEFAULT_TIME_ZONE);

/** The boards' clock: Saturday 26 September 2026, 13:05 Kyiv. */
export const TODAY_CLOCK = Date.parse(local(26, '13:05'));
/** The end of that day: 19:45, every lesson over. */
export const TODAY_EVENING = Date.parse(local(26, '19:45'));

type Teacher = { id: string; name: string; color: string };
const OLENA: Teacher = {
  id: '55555555-5555-4555-d555-000000000001',
  name: 'Olena Kovalenko',
  color: TEACHER_COLORS[4],
};
const DMYTRO: Teacher = {
  id: '55555555-5555-4555-d555-000000000002',
  name: 'Dmytro Tutor',
  color: TEACHER_COLORS[0],
};
const IRYNA: Teacher = {
  id: '55555555-5555-4555-d555-000000000003',
  name: 'Iryna Bondar',
  color: TEACHER_COLORS[1],
};
const OLEH: Teacher = {
  id: '55555555-5555-4555-d555-000000000004',
  name: 'Oleh Marchenko',
  color: TEACHER_COLORS[2],
};
const KATERYNA: Teacher = {
  id: '55555555-5555-4555-d555-000000000005',
  name: 'Kateryna Rudenko',
  color: TEACHER_COLORS[3],
};
export const TODAY_OWNER_TEACHER = OLENA.id;

type Who = { n: number; fullName: string; avatarKey: AvatarKeyDto | null };
const W = {
  petro: { n: 1, fullName: 'Petro Ivanenko', avatarKey: 'user-2' },
  roman: { n: 2, fullName: 'Roman Kyrylenko', avatarKey: 'user-8' },
  iryna: { n: 3, fullName: 'Iryna Moroz', avatarKey: 'user-7' },
  olha: { n: 4, fullName: 'Olha Marchuk', avatarKey: 'user-5' },
  nazar: { n: 5, fullName: 'Nazar Shevchuk', avatarKey: 'user-9' },
  anna: { n: 6, fullName: 'Anna Shevchenko', avatarKey: 'user-1' },
  marta: { n: 7, fullName: 'Marta Lysak', avatarKey: 'user-10' },
  yana: { n: 8, fullName: 'Yana Lysenko', avatarKey: 'user-4' },
} satisfies Record<string, Who>;
type Group = { id: string; name: string; members: number };
const G = {
  beginners: { id: groupId(1), name: 'Beginners', members: 4 },
  b2: { id: groupId(2), name: 'Business B2', members: 5 },
  kidsA1: { id: groupId(3), name: 'Kids A1', members: 5 },
  kidsA2: { id: groupId(4), name: 'Kids A2', members: 6 },
};

let counter = 0;
const charge = (n: number, paid: boolean, source: 'PACKAGE' | 'DEBT' | 'BALANCE') => ({
  id: `c1111111-1111-4111-d111-${pad((counter += 1))}`,
  enrollmentId: enrollmentId(n),
  source,
  packageId: null,
  amountMinor: 50000,
  currency: 'UAH' as const,
  paid,
  student: { id: studentId(n), fullName: 'Student' },
});

function lesson(
  day: number,
  time: string,
  who: Who | Group,
  teacher: Teacher,
  fields: Partial<LessonResponse> = {},
): LessonResponse {
  counter += 1;
  const group = 'members' in who ? who : null;
  const person = 'members' in who ? null : who;
  return {
    id: lessonId(counter),
    workspaceId: WORKSPACE,
    enrollmentId: person ? enrollmentId(person.n) : null,
    groupId: group?.id ?? null,
    seriesId: null,
    teacherId: teacher.id,
    startsAtUtc: local(day, time),
    durationMin: 60,
    priceMinor: 50000,
    currency: 'UAH',
    status: 'SCHEDULED',
    kind: 'REGULAR',
    originalLessonId: null,
    originalStartsAtUtc: null,
    groupMembers: group?.members ?? null,
    makeupLessonId: null,
    topic: null,
    isDetached: false,
    rescheduledCount: 0,
    rescheduledAt: null,
    cancelledBy: null,
    cancelledReason: null,
    cancelledAt: null,
    completedAt: null,
    paidAt: null,
    notes: null,
    cancellationDeadlineHours: 24,
    attendance: null,
    charges: [],
    student: person
      ? { id: studentId(person.n), fullName: person.fullName, avatarKey: person.avatarKey }
      : null,
    group: group ? { id: group.id, name: group.name } : null,
    teacher: { id: teacher.id, name: teacher.name, color: teacher.color },
    subject: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    deletedAt: null,
    ...fields,
  };
}

/** Olena's Saturday (the table of the handoff). */
function olenaDay(): LessonResponse[] {
  return [
    lesson(26, '10:00', W.petro, OLENA, {
      status: 'COMPLETED',
      topic: 'Business English',
      charges: [charge(1, true, 'PACKAGE')],
    }),
    lesson(26, '11:15', G.beginners, OLENA, {
      status: 'COMPLETED',
      topic: 'Present Perfect',
      attendance: { present: 4, marked: 4, confirmed: false },
      charges: [1, 2, 3, 4].map((n) => charge(20 + n, n !== 4, 'BALANCE')),
    }),
    lesson(26, '12:30', W.roman, OLENA, { topic: 'Speaking: travel' }),
    lesson(26, '14:30', W.iryna, OLENA, { topic: 'IELTS Writing' }),
    lesson(26, '16:00', W.olha, OLENA, {
      kind: 'MAKEUP',
      originalStartsAtUtc: local(19, '16:00'),
    }),
    lesson(26, '17:00', W.nazar, OLENA, {
      status: 'CANCELLED_UNCHARGED',
      cancelledBy: 'STUDENT',
      topic: 'Grammar',
    }),
    lesson(26, '18:00', G.b2, OLENA, { durationMin: 90, topic: 'Negotiations' }),
  ];
}

/** The colleagues' Saturday lessons «Студія» adds. */
function colleaguesDay(): LessonResponse[] {
  return [
    lesson(26, '09:00', W.anna, DMYTRO, {
      status: 'COMPLETED',
      topic: 'IELTS Speaking',
      charges: [charge(6, true, 'PACKAGE')],
    }),
    lesson(26, '11:00', G.kidsA1, IRYNA, {
      status: 'COMPLETED',
      topic: 'Animals',
      attendance: { present: 5, marked: 5, confirmed: false },
    }),
    lesson(26, '14:00', W.marta, OLEH, { topic: 'Польська A2' }),
    lesson(26, '16:30', W.yana, KATERYNA, { topic: 'Français A1' }),
  ];
}

function laterDays(): LessonResponse[] {
  return [
    lesson(27, '09:00', W.petro, OLENA),
    lesson(27, '11:00', W.roman, OLENA),
    lesson(27, '15:00', G.kidsA2, OLENA),
    lesson(27, '18:00', G.b2, OLENA, { durationMin: 90 }),
    lesson(27, '12:00', W.anna, DMYTRO),
    lesson(28, '10:00', W.petro, OLENA, { topic: 'Business English' }),
    lesson(28, '12:30', W.roman, OLENA, { topic: 'Speaking' }),
    lesson(28, '14:30', W.iryna, OLENA, { topic: 'IELTS Writing' }),
    lesson(28, '18:00', G.b2, OLENA, { durationMin: 90, topic: 'Negotiations' }),
  ];
}

/** The package each direction pays with now («пакет 3 з 8»). */
const PACKAGES = [
  { n: W.petro.n, left: 4, total: 8 },
  { n: W.roman.n, left: 3, total: 8 },
  { n: W.olha.n, left: 6, total: 8 },
  { n: W.marta.n, left: 4, total: 8 },
  { n: W.yana.n, left: 1, total: 8 },
].map((row) => ({
  enrollmentId: enrollmentId(row.n),
  packageId: `a1111111-1111-4111-d111-${pad(row.n)}`,
  left: row.left,
  total: row.total,
}));

function teacherItem(teacher: Teacher, isMe: boolean, archived = false): TeacherListItem {
  return {
    id: teacher.id,
    workspaceId: WORKSPACE,
    fullName: teacher.name,
    email: null,
    phone: null,
    telegramUsername: null,
    subjects: ['English'],
    bio: null,
    defaultRateMinor: 50000,
    currency: 'UAH',
    color: teacher.color,
    avatarKey: null,
    status: archived ? 'ARCHIVED' : 'ACTIVE',
    archivedAt: null,
    workspaceMemberId: null,
    isMe,
    notes: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
    deletedAt: null,
    activeEnrollmentCount: 10,
    studentCount: 10,
    groupCount: 2,
    week: { lessonCount: 12, days: [2, 2, 2, 2, 2, 2, 0] },
  };
}

// «Потребує уваги» ----------------------------------------------------------

const blank = (n: number): AttentionItem => ({
  id: itemId(n),
  student: null,
  group: null,
  teacher: null,
  enrollmentId: null,
  lesson: null,
  debt: null,
  package: null,
  credits: null,
  pause: null,
});
const person = (n: number, fullName: string, avatarKey: AvatarKeyDto | null = null) => ({
  id: studentId(100 + n),
  fullName,
  avatarKey,
});
const pastLesson = (
  day: number,
  time: string,
  status: 'COMPLETED' | 'NO_SHOW' | 'CANCELLED_UNCHARGED',
  cancelledBy: 'STUDENT' | 'TEACHER' | null = null,
) => ({
  id: lessonId(900 + day),
  startsAtUtc: local(day, time),
  status,
  cancelledBy,
});

const ATTENTION_ITEMS: Record<AttentionCategory['kind'], AttentionItem[]> = {
  attendance: [
    {
      ...blank(1),
      group: { id: G.beginners.id, name: 'Beginners' },
      lesson: pastLesson(26, '11:15', 'COMPLETED'),
    },
    {
      ...blank(2),
      group: { id: groupId(5), name: 'B2 Intermediate' },
      lesson: pastLesson(22, '18:00', 'COMPLETED'),
    },
    {
      ...blank(3),
      group: { id: G.kidsA1.id, name: 'Kids A1' },
      lesson: pastLesson(21, '16:00', 'COMPLETED'),
    },
  ],
  makeups: [
    {
      ...blank(4),
      student: person(1, 'Anna Shevchenko', 'user-1'),
      lesson: pastLesson(25, '15:00', 'NO_SHOW'),
    },
    {
      ...blank(5),
      student: person(2, 'Sofiia Melnyk', 'user-4'),
      lesson: pastLesson(24, '17:00', 'CANCELLED_UNCHARGED', 'TEACHER'),
    },
    {
      ...blank(6),
      student: person(3, 'Ivan Hnatiuk', 'user-3'),
      lesson: pastLesson(24, '18:00', 'CANCELLED_UNCHARGED', 'TEACHER'),
    },
  ],
  debtors: [
    {
      ...blank(7),
      student: person(4, 'Maksym Boiko', 'user-8'),
      enrollmentId: enrollmentId(104),
      debt: { amountMinor: 120000, currency: 'UAH', lessons: 3 },
    },
    {
      ...blank(8),
      student: person(5, 'Mila Savchuk', 'user-10'),
      enrollmentId: enrollmentId(105),
      debt: { amountMinor: 80000, currency: 'UAH', lessons: 2 },
    },
    {
      ...blank(9),
      student: person(6, 'Taras Bondarenko', 'user-9'),
      enrollmentId: enrollmentId(106),
      debt: { amountMinor: 30000, currency: 'UAH', lessons: 1 },
    },
  ],
  unpaidPackages: [
    {
      ...blank(10),
      student: person(7, 'Iryna Koval', 'user-6'),
      package: {
        id: itemId(110),
        name: 'Жовтень',
        currency: 'UAH',
        totalMinor: 320000,
        paidMinor: 100000,
        remainingCredits: 8,
        expiresAt: null,
      },
    },
    {
      ...blank(11),
      student: person(8, 'Petro Ivanenko', 'user-2'),
      package: {
        id: itemId(111),
        name: null,
        currency: 'UAH',
        totalMinor: 400000,
        paidMinor: 0,
        remainingCredits: 8,
        expiresAt: null,
      },
    },
    {
      ...blank(12),
      student: person(9, 'Olha Marchuk', 'user-5'),
      package: {
        id: itemId(112),
        name: null,
        currency: 'UAH',
        totalMinor: 320000,
        paidMinor: 160000,
        remainingCredits: 6,
        expiresAt: null,
      },
    },
  ],
  endingPackages: [
    {
      ...blank(13),
      student: person(10, 'Oleh Melnyk', 'user-3'),
      teacher: { id: DMYTRO.id, name: DMYTRO.name, color: DMYTRO.color },
      enrollmentId: enrollmentId(110),
      credits: { left: 1, warning: 'LOW_CREDITS' },
    },
    {
      ...blank(14),
      student: person(11, 'Yana Lysenko', 'user-4'),
      teacher: { id: KATERYNA.id, name: KATERYNA.name, color: KATERYNA.color },
      enrollmentId: enrollmentId(111),
      credits: { left: 1, warning: 'LOW_CREDITS' },
    },
    {
      ...blank(15),
      student: person(12, 'Nazar Shevchuk', 'user-9'),
      teacher: { id: OLENA.id, name: OLENA.name, color: OLENA.color },
      enrollmentId: enrollmentId(112),
      credits: { left: 0, warning: 'NO_CREDITS' },
    },
  ],
  expiringPackages: [
    {
      ...blank(16),
      student: person(13, 'Sofiia Lysenko', 'user-1'),
      package: {
        id: itemId(116),
        name: null,
        currency: 'UAH',
        totalMinor: 320000,
        paidMinor: 320000,
        remainingCredits: 3,
        expiresAt: local(2, '00:00', 10),
      },
    },
    {
      ...blank(17),
      student: person(14, 'Nazar Shevchuk', 'user-9'),
      package: {
        id: itemId(117),
        name: null,
        currency: 'UAH',
        totalMinor: 320000,
        paidMinor: 320000,
        remainingCredits: 2,
        expiresAt: local(28, '00:00'),
      },
    },
  ],
  pauses: [
    {
      ...blank(18),
      student: person(15, 'Mariia Tkach', 'user-7'),
      pause: {
        id: itemId(118),
        startsAt: local(10, '00:00'),
        endsAt: local(28, '00:00'),
        reason: 'RETURNING',
      },
    },
    {
      ...blank(19),
      student: person(16, 'Denys Koval', 'user-3'),
      pause: {
        id: itemId(119),
        startsAt: '2026-08-12T21:00:00.000Z',
        endsAt: null,
        reason: 'OPEN_LONG',
      },
    },
  ],
};

function attentionOf(
  counts: Record<AttentionCategory['kind'], number>,
): DashboardAttentionResponse {
  const categories = (Object.keys(counts) as AttentionCategory['kind'][]).map((kind) => {
    const items = ATTENTION_ITEMS[kind].slice(0, Math.min(3, counts[kind]));
    return {
      kind,
      count: counts[kind],
      items,
      names: [
        ...new Set(items.map((item) => item.group?.name ?? item.student?.fullName ?? '')),
      ].slice(0, 2),
    };
  });
  return {
    teacherId: null,
    total: categories.reduce((sum, row) => sum + row.count, 0),
    categories,
  };
}

const ATTENTION = {
  typical: {
    attendance: 2,
    makeups: 3,
    debtors: 5,
    unpaidPackages: 1,
    endingPackages: 2,
    expiringPackages: 1,
    pauses: 2,
  },
  many: {
    attendance: 12,
    makeups: 9,
    debtors: 27,
    unpaidPackages: 6,
    endingPackages: 14,
    expiringPackages: 8,
    pauses: 11,
  },
  free: {
    attendance: 0,
    makeups: 0,
    debtors: 5,
    unpaidPackages: 0,
    endingPackages: 2,
    expiringPackages: 0,
    pauses: 2,
  },
  calm: {
    attendance: 0,
    makeups: 0,
    debtors: 0,
    unpaidPackages: 0,
    endingPackages: 0,
    expiringPackages: 0,
    pauses: 0,
  },
};

// «Гроші за місяць» ---------------------------------------------------------

const UAH = {
  currency: 'UAH' as const,
  receivedMonthMinor: 6420000,
  receivedTodayMinor: 320000,
  debtMinor: 1840000,
  debtors: 5,
  dueMinor: 2160000,
  duePackages: 6,
};
const MONEY: Record<'one' | 'two' | 'firstDay', DashboardMoneyResponse> = {
  one: { month: '2026-09-01', currencies: [UAH] },
  two: {
    month: '2026-09-01',
    currencies: [
      UAH,
      {
        currency: 'PLN',
        receivedMonthMinor: 348000,
        receivedTodayMinor: 0,
        debtMinor: 36000,
        debtors: 1,
        dueMinor: 96000,
        duePackages: 2,
      },
    ],
  },
  firstDay: {
    month: '2026-09-01',
    currencies: [{ ...UAH, receivedMonthMinor: 0, receivedTodayMinor: 0 }],
  },
};

const SETUP: Record<'done' | 'fresh' | 'partial', DashboardSetupResponse> = {
  done: { teacher: true, student: true, schedule: true, sale: true },
  fresh: { teacher: false, student: false, schedule: false, sale: false },
  partial: { teacher: false, student: true, schedule: true, sale: false },
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const never = () => new Promise<Response>(() => undefined);

/** Answers the Today page's reads, or null for anything else. */
export function createTodayRoutes(options: TodayStoryOptions) {
  const scenario = options.today;
  counter = 0;
  const day = scenario?.day ?? 'busy';
  const owner = scenario?.owner ?? 'teaches';
  let lessons: LessonResponse[] = [];
  if (scenario) {
    const today =
      day === 'free'
        ? []
        : day === 'partial'
          ? olenaDay().filter((row) =>
              ['10:00', '12:30', '14:30'].some((t) => row.startsAtUtc === local(26, t)),
            )
          : [...olenaDay(), ...(owner === 'solo' ? [] : colleaguesDay())];
    const later = laterDays().filter(
      (row) => day !== 'free' || !row.startsAtUtc.startsWith('2026-09-27'),
    );
    lessons = [...today, ...later];
    if (owner === 'notTeaching') {
      // The owner does not teach: her lessons are Dmytro's.
      lessons = lessons.map((row) =>
        row.teacherId === OLENA.id
          ? {
              ...row,
              teacherId: DMYTRO.id,
              teacher: { id: DMYTRO.id, name: DMYTRO.name, color: DMYTRO.color },
            }
          : row,
      );
    }
  }
  const find = (id: string) => lessons.find((row) => row.id === id);

  return async (path: string, method: string, query: URLSearchParams): Promise<Response | null> => {
    if (!scenario || method !== 'GET') return null;

    if (path === '/dashboard/money') {
      const money = scenario.money ?? 'one';
      if (money === 'pending') return never();
      if (money === 'error') return json({ code: 'UNEXPECTED' }, 500);
      return json(MONEY[money]);
    }
    if (path === '/dashboard/attention') {
      const attention = scenario.attention ?? (day === 'free' ? 'free' : 'typical');
      if (attention === 'pending') return never();
      if (attention === 'error') return json({ code: 'UNEXPECTED' }, 500);
      return json({ ...attentionOf(ATTENTION[attention]), teacherId: query.get('teacherId') });
    }
    if (path === '/dashboard/setup') {
      return json(SETUP[scenario.setup ?? (day === 'partial' ? 'partial' : 'done')]);
    }
    if (path === '/teachers') {
      const colleagues = [DMYTRO, IRYNA, OLEH, KATERYNA].map((row) => teacherItem(row, false));
      const me =
        owner === 'solo'
          ? teacherItem(OLENA, true)
          : teacherItem(OLENA, true, owner === 'notTeaching');
      const active = owner === 'solo' ? 1 : owner === 'notTeaching' ? 4 : 5;
      return json({
        items: owner === 'solo' ? [me] : colleagues,
        page: 1,
        pageSize: Number(query.get('pageSize') ?? 20),
        total: active,
        totalPages: 1,
        counts: { active, archived: 0, all: active },
        me,
      });
    }
    if (path === '/lessons/list') {
      const state = scenario.lessons ?? 'ready';
      if (state === 'pending') return never();
      if (state === 'error') return json({ code: 'UNEXPECTED' }, 500);
      const from = Date.parse(query.get('from') ?? '');
      const to = Date.parse(query.get('to') ?? '');
      const teacherId = query.get('teacherId');
      const items = lessons
        .filter((row) => {
          const start = Date.parse(row.startsAtUtc);
          return start >= from && start < to && (!teacherId || row.teacherId === teacherId);
        })
        .sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc));
      return json({
        items,
        packages: PACKAGES.filter((row) =>
          items.some((item) => item.enrollmentId === row.enrollmentId),
        ),
        page: 1,
        pageSize: 100,
        total: items.length,
        totalPages: 1,
        counts: {
          all: items.length,
          unpaid: 0,
          cancelled: 0,
          noShow: 0,
          needsMakeup: 0,
          unconfirmed: 0,
        },
      });
    }
    const detail = path.match(/^\/lessons\/([^/]+)$/);
    const found = detail ? find(detail[1]!) : undefined;
    if (found) return json({ ...found, original: null, makeup: null, schedule: null, history: [] });
    return null;
  };
}

export const TODAY_TEACHERS = { OLENA, DMYTRO, IRYNA, OLEH, KATERYNA };
export const todayLessonId = lessonId;
