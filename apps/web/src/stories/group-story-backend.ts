import type {
  AttendanceCellDto,
  GroupAttendanceResponse,
  GroupDetail,
  GroupListItem,
  GroupSummaryResponse,
  LessonAttendanceResponse,
  LessonResponse,
  PackageResponse,
} from '@tutorio/validation';

/**
 * Groups for the screen stories: the design boards' six groups (one of them
 * empty), two archived ones, and the full page of "B2 prep · evening" — its
 * schedule, lessons, attendance and package. Dates are relative to the story
 * clock, Wednesday 9 September 2026, so "next lesson" is Thursday the 10th.
 */

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const DAY = 24 * 60 * 60 * 1000;
/** Kyiv wall-clock time, `days` from the story day, as a UTC instant. */
const kyiv = (days: number, hour: number, minute = 0) =>
  new Date(Date.UTC(2026, 8, 9) + days * DAY + ((hour - 3) * 60 + minute) * 60_000).toISOString();

export const TEACHERS = {
  dmytro: {
    id: '55555555-5555-4555-8555-555555555555',
    name: 'Dmytro Tutor',
    avatarKey: 'user-2',
    color: null,
  },
  olena: {
    id: '55555555-5555-4555-8555-555555555557',
    name: 'Olena Kovalenko',
    avatarKey: 'user-7',
    color: null,
  },
  // The same teacher as the shared story backend's second one.
  iryna: {
    id: '55555555-5555-4555-8555-555555555556',
    name: 'Iryna Bondar',
    avatarKey: 'user-9',
    color: null,
  },
} as const;

type Teacher = (typeof TEACHERS)[keyof typeof TEACHERS];

export const storyGroupId = (n: number) => `99999999-9999-4999-8999-${String(n).padStart(12, '0')}`;
const studentId = (n: number) => `d6bf671d-7a0f-4cf3-8a67-${String(n).padStart(12, '0')}`;
const enrollmentId = (group: number, n: number) =>
  `44444444-4444-4444-8444-${String(group * 100 + n).padStart(12, '0')}`;

type Member = {
  n: number;
  fullName: string;
  avatarKey: GroupListItem['students'][number]['avatarKey'];
  status: 'ACTIVE' | 'ON_HOLD';
  languageLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | null;
};

// The first ids match the students of the shared story backend, so a roster
// row links to a student the other screens know.
const MEMBERS: Member[] = [
  { n: 1, fullName: 'Anna Shevchenko', avatarKey: 'user-1', status: 'ACTIVE', languageLevel: 'B2' },
  { n: 2, fullName: 'Sofiia Melnyk', avatarKey: 'user-4', status: 'ACTIVE', languageLevel: 'B2' },
  {
    n: 3,
    fullName: 'Maksym Tkachenko',
    avatarKey: 'user-2',
    status: 'ACTIVE',
    languageLevel: 'A2',
  },
  { n: 5, fullName: 'Artem Lysenko', avatarKey: 'user-3', status: 'ACTIVE', languageLevel: 'B1' },
  {
    n: 7,
    fullName: 'Kateryna Shevchuk',
    avatarKey: 'user-5',
    status: 'ON_HOLD',
    languageLevel: 'A2',
  },
  { n: 10, fullName: 'Denys Koval', avatarKey: 'user-8', status: 'ACTIVE', languageLevel: 'B1' },
  {
    n: 11,
    fullName: 'Mark Shevchenko',
    avatarKey: 'user-6',
    status: 'ACTIVE',
    languageLevel: 'A2',
  },
  {
    n: 12,
    fullName: 'Oksana Petrenko',
    avatarKey: 'user-10',
    status: 'ACTIVE',
    languageLevel: 'B1',
  },
];

type SampleGroup = {
  n: number;
  name: string;
  teacher: Teacher | null;
  capacity: number | null;
  price: number | null;
  schedule: { weekdays: number[]; localTime: string } | null;
  members: number[];
  next: number | null;
  paymentDue?: boolean;
  archived?: boolean;
  notes?: string | null;
  createdAt?: string;
  /** Members who pay their own price (L-11), by member number. */
  ownPrices?: Record<number, number>;
};

const SAMPLE_GROUPS: SampleGroup[] = [
  {
    n: 1,
    name: 'B2 prep · evening',
    teacher: TEACHERS.dmytro,
    capacity: 8,
    price: 40000,
    schedule: { weekdays: [2, 4], localTime: '17:00' },
    members: [1, 11, 7, 5, 2, 10],
    next: 1,
    paymentDue: true,
    notes: 'Preparing for B2 in December. The last 20 minutes are speaking practice in pairs.',
    // Mark Shevchenko pays his own price.
    ownPrices: { 11: 35000 },
  },
  {
    n: 2,
    name: 'A2 start · morning',
    teacher: TEACHERS.olena,
    capacity: 6,
    price: 35000,
    schedule: { weekdays: [1, 3], localTime: '10:00' },
    members: [3, 11, 10, 12],
    next: 5,
  },
  {
    n: 3,
    name: 'Speaking club',
    teacher: TEACHERS.dmytro,
    capacity: 10,
    price: 30000,
    schedule: { weekdays: [6], localTime: '12:00' },
    members: [1, 2, 5, 3, 10, 11, 12, 7],
    next: 3,
  },
  {
    n: 4,
    name: 'IELTS intensive',
    teacher: TEACHERS.iryna,
    capacity: 6,
    price: 60000,
    schedule: { weekdays: [1, 3, 5], localTime: '19:00' },
    members: [5, 1, 10, 12, 2],
    next: 0,
    paymentDue: true,
  },
  {
    n: 5,
    name: 'Kids 6+',
    teacher: TEACHERS.olena,
    capacity: 6,
    price: 25000,
    schedule: { weekdays: [2], localTime: '16:00' },
    members: [7, 2, 12],
    next: 6,
  },
  {
    n: 6,
    name: 'B1 evening (old)',
    teacher: null,
    capacity: null,
    price: 40000,
    schedule: null,
    members: [],
    next: null,
  },
  {
    n: 7,
    name: 'Summer camp 2026',
    teacher: TEACHERS.iryna,
    capacity: 12,
    price: 30000,
    schedule: null,
    members: [3, 11],
    next: null,
    archived: true,
  },
  {
    n: 8,
    name: 'A1 weekend',
    teacher: TEACHERS.olena,
    capacity: null,
    price: 25000,
    schedule: null,
    members: [12],
    next: null,
    archived: true,
  },
];

/** A group created a moment ago: a name and a teacher, nothing else yet. */
const NEW_GROUP: SampleGroup = {
  n: 20,
  name: 'A2 start · Saturday',
  teacher: TEACHERS.dmytro,
  capacity: null,
  price: 40000,
  schedule: null,
  members: [],
  next: null,
  createdAt: kyiv(0, 11),
};

const member = (n: number) => MEMBERS.find((item) => item.n === n)!;

function nextLessonOf(group: SampleGroup) {
  if (group.next === null || !group.schedule) return null;
  const [hour, minute] = group.schedule.localTime.split(':').map(Number) as [number, number];
  return { id: lessonId(group.n, 0), startsAtUtc: kyiv(group.next, hour, minute), durationMin: 60 };
}

function schedulesOf(group: SampleGroup) {
  return group.schedule ? [{ ...group.schedule, durationMin: 60, timezone: 'Europe/Kyiv' }] : [];
}

function toListItem(group: SampleGroup): GroupListItem {
  return {
    id: storyGroupId(group.n),
    name: group.name,
    teacher: group.teacher,
    capacity: group.capacity,
    pricePerLesson: group.price,
    currency: group.price === null ? null : 'UAH',
    notes: group.notes ?? null,
    deletedAt: group.archived ? '2026-09-01T10:00:00.000Z' : null,
    status: group.members.length > 0 ? 'ACTIVE' : 'EMPTY',
    activeStudentCount: group.members.length,
    students: group.members.map((n) => ({
      id: studentId(n),
      fullName: member(n).fullName,
      avatarKey: member(n).avatarKey,
    })),
    schedules: schedulesOf(group),
    nextLesson: nextLessonOf(group),
    paymentDue: Boolean(group.paymentDue),
  };
}

function toDetail(group: SampleGroup, members: number[]): GroupDetail {
  return {
    id: storyGroupId(group.n),
    workspaceId: WORKSPACE,
    name: group.name,
    teacherId: group.teacher?.id ?? null,
    capacity: group.capacity,
    pricePerLesson: group.price,
    currency: group.price === null ? null : 'UAH',
    notes: group.notes ?? null,
    createdAt: group.createdAt ?? '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-09-09T09:00:00.000Z',
    deletedAt: group.archived ? '2026-09-01T10:00:00.000Z' : null,
    status: members.length > 0 ? 'ACTIVE' : 'EMPTY',
    teacher: group.teacher,
    teacherMismatch: false,
    enrollments: members.map((n) => ({
      id: enrollmentId(group.n, n),
      studentId: studentId(n),
      groupId: storyGroupId(group.n),
      teacherId: group.teacher?.id ?? TEACHERS.dmytro.id,
      status: 'ACTIVE',
      billingType: 'PACKAGE',
      priceMinor: group.ownPrices?.[n] ?? group.price ?? 0,
      currency: 'UAH',
      ownPrice: group.ownPrices?.[n] !== undefined,
      cancellationDeadlineHours: null,
      student: {
        id: studentId(n),
        fullName: member(n).fullName,
        avatarKey: member(n).avatarKey,
        status: member(n).status,
        languageLevel: member(n).languageLevel,
      },
      teacher: {
        id: group.teacher?.id ?? TEACHERS.dmytro.id,
        name: group.teacher?.name ?? TEACHERS.dmytro.name,
        color: null,
      },
    })),
    schedules: schedulesOf(group).map((schedule) => ({
      ...schedule,
      id: `12121212-1212-4121-8121-${String(group.n).padStart(12, '0')}`,
    })),
    nextLesson: nextLessonOf(group)
      ? { ...nextLessonOf(group)!, notes: 'Speaking practice', status: 'SCHEDULED' }
      : null,
    lessonCounts: {
      completed: group.n === 1 ? 24 : 0,
      upcoming: group.n === 1 ? 12 : group.schedule ? 8 : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// The B2 group's lessons, attendance and package
// ---------------------------------------------------------------------------

function lessonId(group: number, n: number) {
  return `88888888-8888-4888-9${String(group).padStart(3, '0')}-${String(n).padStart(12, '0')}`;
}

const TOPICS = [
  'Speaking practice',
  'Grammar: past perfect',
  'Speaking: debates',
  'Listening lab',
  'Vocabulary: travel',
  'Reading club',
  'Writing: opinion essay',
  'Phrasal verbs',
];

/** Tuesdays and Thursdays at 17:00, a year of them around the story day. */
function b2Lessons(): LessonResponse[] {
  const group = SAMPLE_GROUPS[0]!;
  const lessons: LessonResponse[] = [];
  // Past: 24 lessons back, most recent first; future: 12 ahead.
  const days: number[] = [];
  for (let day = -86; day <= 42; day += 1) {
    const weekday = new Date(Date.UTC(2026, 8, 9) + day * DAY).getUTCDay();
    if (weekday === 2 || weekday === 4) days.push(day);
  }
  const past = days.filter((day) => day < 0).slice(-24);
  const future = days.filter((day) => day >= 0).slice(0, 12);
  [...past, ...future].forEach((day, index) => {
    const upcoming = day >= 0;
    const cancelled = !upcoming && (index === past.length - 2 || index === past.length - 6);
    const status: LessonResponse['status'] = upcoming
      ? 'SCHEDULED'
      : cancelled
        ? index === past.length - 2
          ? 'CANCELLED_UNCHARGED'
          : 'CANCELLED_CHARGED'
        : 'COMPLETED';
    const startsAtUtc = kyiv(day, 17);
    lessons.push({
      id: upcoming && day === 1 ? lessonId(1, 0) : lessonId(1, index + 1),
      workspaceId: WORKSPACE,
      enrollmentId: null,
      groupId: storyGroupId(1),
      seriesId: null,
      teacherId: TEACHERS.dmytro.id,
      startsAtUtc,
      durationMin: 60,
      priceMinor: group.price ?? 0,
      currency: 'UAH',
      status,
      isDetached: false,
      rescheduledCount: 0,
      kind: 'REGULAR',
      originalLessonId: null,
      makeupLessonId: null,
      topic: null,
      rescheduledAt: null,
      cancelledBy: cancelled ? 'TEACHER' : null,
      cancelledReason: null,
      cancelledAt: null,
      completedAt: status === 'COMPLETED' ? startsAtUtc : null,
      paidAt: null,
      notes: TOPICS[index % TOPICS.length]!,
      cancellationDeadlineHours: 12,
      attendance: status === 'COMPLETED' ? { present: index % 3 === 0 ? 5 : 6, marked: 6 } : null,
      charges: [],
      student: null,
      group: { id: storyGroupId(1), name: group.name },
      teacher: { id: TEACHERS.dmytro.id, name: TEACHERS.dmytro.name, color: null },
      createdAt: '2026-06-01T10:00:00.000Z',
      updatedAt: '2026-06-01T10:00:00.000Z',
      deletedAt: null,
    });
  });
  return lessons;
}

const P: AttendanceCellDto = 'present';
const A: AttendanceCellDto = 'absent';
const C: AttendanceCellDto = 'cancelled';
const U: AttendanceCellDto = 'unmarked';

function b2Attendance(lessons: LessonResponse[]): GroupAttendanceResponse {
  const window = lessons
    .filter((lesson) => lesson.status !== 'SCHEDULED')
    .slice(-8)
    .map((lesson) => ({ id: lesson.id, startsAtUtc: lesson.startsAtUtc, status: lesson.status }));
  const row = (
    n: number,
    cells: AttendanceCellDto[],
    patch: Partial<GroupAttendanceResponse['rows'][number]> = {},
  ): GroupAttendanceResponse['rows'][number] => {
    const present = cells.filter((cell) => cell === P).length;
    const misses = cells.filter((cell) => cell === A).length;
    return {
      enrollmentId: enrollmentId(1, n),
      student: { id: studentId(n), fullName: member(n).fullName, avatarKey: member(n).avatarKey },
      cells,
      rate: present + misses === 0 ? null : present / (present + misses),
      misses,
      trailingMisses: 0,
      lastPresentAt: window[4]?.startsAtUtc ?? null,
      hold: false,
      risk: false,
      ...patch,
    };
  };
  return {
    window: 8,
    lessons: window,
    stats: {
      lessons: 8,
      held: 6,
      rate: 0.88,
      previousRate: 0.84,
      misses: 4,
      expected: 34,
      cancelled: 2,
      cancelledCharged: 1,
      cancelledFree: 1,
    },
    rows: [
      row(5, [C, P, P, P, P, C, A, A], { trailingMisses: 2, risk: true }),
      row(7, [C, P, P, P, P, C, U, U], { hold: true, rate: null }),
      row(1, [C, P, P, P, P, C, P, A]),
      row(2, [C, P, P, P, A, C, P, P]),
      row(11, [C, P, P, P, P, C, P, P]),
      row(10, [C, P, P, P, P, C, P, P]),
    ],
  };
}

/** Each member's own package for the group (ADR 0007); one has not paid. */
function b2Packages(): PackageResponse[] {
  const memberPackage = (n: number, left: number, paid: number): PackageResponse => ({
    id: `77777777-7777-4777-8777-${String(100 + n).padStart(12, '0')}`,
    workspaceId: WORKSPACE,
    enrollmentId: enrollmentId(1, n),
    studentId: studentId(n),
    groupId: storyGroupId(1),
    name: 'Autumn 2026',
    sizingMode: 'FIXED_COUNT',
    lessonsTotal: 8,
    lessonsPerWeek: null,
    validFrom: null,
    transferredFromPackageId: null,
    endDate: null,
    pricePerLessonMinorSnapshot: 30000,
    totalPriceMinorSnapshot: 240000,
    remainingCredits: left,
    consumedCredits: 8 - left,
    paidMinor: paid,
    refundedMinor: 0,
    currency: 'UAH',
    paymentStatus: paid >= 240000 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING',
    purchasedAt: '2026-09-01T10:00:00.000Z',
    expiresAt: '2026-12-20T10:00:00.000Z',
    notes: null,
    student: { id: studentId(n), fullName: member(n).fullName },
    group: { id: storyGroupId(1), name: 'B2 prep · evening' },
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    deletedAt: null,
  });
  return [
    memberPackage(1, 2, 240000),
    memberPackage(11, 2, 240000),
    memberPackage(7, 3, 0),
    memberPackage(5, 2, 240000),
  ];
}

// ---------------------------------------------------------------------------
// The routes
// ---------------------------------------------------------------------------

export type GroupStoryOptions = {
  /** `empty`: a workspace without groups; `pending` / `error`: the list read. */
  groupList?: 'ready' | 'empty' | 'pending' | 'error';
  /** Adds the just-created group, for the "new group" page. */
  withNewGroup?: boolean;
  /**
   * `group`: every member pays the group price; `mixed` (default): Mark pays
   * his own. `saving` keeps a member's price save pending.
   */
  memberPrices?: 'mixed' | 'group' | 'saving';
};

export const NEW_GROUP_ID = storyGroupId(NEW_GROUP.n);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * Answers the group requests the screens make, or returns null for anything
 * else so the shared story backend handles it. Stateful per story: roster,
 * notes, archive and attendance changes stick until the story unmounts.
 */
export function createGroupRoutes(options: GroupStoryOptions) {
  const groups: SampleGroup[] =
    options.groupList === 'empty'
      ? []
      : [
          ...SAMPLE_GROUPS.map((group) => ({
            ...group,
            ownPrices: options.memberPrices === 'group' ? {} : { ...group.ownPrices },
          })),
          ...(options.withNewGroup ? [{ ...NEW_GROUP }] : []),
        ];
  const lessons = b2Lessons();
  const attendance = b2Attendance(lessons);
  const marks = new Map<string, Record<string, 'PRESENT' | 'ABSENT' | 'EXCUSED'>>();
  const never = () => new Promise<Response>(() => undefined);
  const find = (id: string) => groups.find((group) => storyGroupId(group.n) === id);

  return async (
    path: string,
    method: string,
    query: URLSearchParams,
    body: () => Record<string, unknown>,
  ): Promise<Response | null> => {
    if (path === '/groups/summary') {
      const live = groups.filter((group) => !group.archived);
      const summary: GroupSummaryResponse = {
        total: live.length,
        active: live.filter((group) => group.members.length > 0).length,
        empty: live.filter((group) => group.members.length === 0).length,
        archived: groups.length - live.length,
        studentsInGroups: new Set(live.flatMap((group) => group.members)).size,
        studioStudents: 48,
        freeSeats: live.reduce(
          (sum, group) =>
            sum + (group.capacity ? Math.max(0, group.capacity - group.members.length) : 0),
          0,
        ),
        lessonsThisWeek: 9,
        lessonsToday: 2,
        unpaidGroups: live.filter((group) => group.paymentDue).length,
        weekStart: '2026-09-06T21:00:00.000Z',
        weekEnd: '2026-09-13T21:00:00.000Z',
      };
      return json(summary);
    }
    if (path === '/groups/options') {
      return json({
        items: groups
          .filter((group) => !group.archived)
          .map((group) => ({ id: storyGroupId(group.n), name: group.name })),
      });
    }

    const attendanceMatch = path.match(/^\/groups\/([^/]+)\/attendance$/);
    if (attendanceMatch) {
      return attendanceMatch[1] === storyGroupId(1)
        ? json(attendance)
        : json({
            window: 8,
            lessons: [],
            stats: {
              lessons: 0,
              held: 0,
              rate: null,
              previousRate: null,
              misses: 0,
              expected: 0,
              cancelled: 0,
              cancelledCharged: 0,
              cancelledFree: 0,
            },
            rows: [],
          });
    }

    // A member's own price (L-11): the group's price clears it.
    const memberMatch = path.match(/^\/enrollments\/([^/]+)$/);
    if (memberMatch && method === 'PATCH') {
      const group = groups.find((item) =>
        item.members.some((n) => enrollmentId(item.n, n) === memberMatch[1]),
      );
      if (!group) return null;
      if (options.memberPrices === 'saving') return never();
      const n = group.members.find((item) => enrollmentId(group.n, item) === memberMatch[1])!;
      const priceMinor = Number(body().priceMinor);
      const own = { ...group.ownPrices };
      if (priceMinor === group.price) delete own[n];
      else own[n] = priceMinor;
      group.ownPrices = own;
      return json(
        toDetail(group, group.members).enrollments.find((row) => row.id === memberMatch[1]),
      );
    }

    const detailMatch = path.match(/^\/groups\/([^/]+)(\/restore)?$/);
    if (detailMatch) {
      const group = find(detailMatch[1]!);
      if (!group) return json({ code: 'GROUP_NOT_FOUND' }, 404);
      if (method === 'DELETE') {
        group.archived = true;
        return new Response(null, { status: 204 });
      }
      if (detailMatch[2]) {
        group.archived = false;
        return json(toDetail(group, group.members));
      }
      if (method === 'PATCH') {
        const patch = body() as {
          students?: { studentIds: string[] };
          notes?: string | null;
          name?: string;
          pricePerLesson?: number;
        };
        if (patch.students) {
          group.members = patch.students.studentIds
            .map((id) => MEMBERS.find((item) => studentId(item.n) === id)?.n)
            .filter((n): n is number => n !== undefined);
        }
        if (patch.notes !== undefined) group.notes = patch.notes;
        if (patch.name) group.name = patch.name;
        if (patch.pricePerLesson !== undefined) group.price = patch.pricePerLesson;
      }
      return json(toDetail(group, group.members));
    }

    if (path === '/groups') {
      if (method === 'POST') {
        const created = { ...NEW_GROUP, name: String(body().name ?? NEW_GROUP.name) };
        groups.push(created);
        return json(toDetail(created, []), 201);
      }
      if (options.groupList === 'pending' && query.get('pageSize') !== '1') return never();
      if (options.groupList === 'error') return json({ code: 'UNEXPECTED' }, 500);
      const archive = query.get('state') === 'deleted';
      const search = query.get('search')?.toLowerCase();
      const status = query.get('status');
      const teacherId = query.get('teacherId');
      const weekday = query.get('weekday');
      const unpaid = query.get('payment') === 'unpaid';
      const rows = groups
        .filter(
          (group) =>
            Boolean(group.archived) === archive &&
            (!search ||
              group.name.toLowerCase().includes(search) ||
              group.teacher?.name.toLowerCase().includes(search)) &&
            (!status || (status === 'ACTIVE') === group.members.length > 0) &&
            (!teacherId || group.teacher?.id === teacherId) &&
            (!weekday || Boolean(group.schedule?.weekdays.includes(Number(weekday)))) &&
            (!unpaid || group.paymentDue),
        )
        .sort((a, b) =>
          query.get('sort') === 'activeStudentCount'
            ? b.members.length - a.members.length
            : query.get('sort') === 'pricePerLesson'
              ? (a.price ?? Infinity) - (b.price ?? Infinity)
              : 0,
        )
        .map(toListItem);
      const pageSize = Number(query.get('pageSize') ?? 20);
      const page = Number(query.get('page') ?? 1);
      return json({
        items: rows.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        total: rows.length,
        totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
      });
    }

    if (path === '/lessons' && query.get('groupId')) {
      return json({ items: query.get('groupId') === storyGroupId(1) ? lessons : [] });
    }
    if (path === '/packages' && query.get('groupId')) {
      const items = query.get('groupId') === storyGroupId(1) ? b2Packages() : [];
      return json({ items, page: 1, pageSize: 20, total: items.length, totalPages: 1 });
    }

    // A group lesson opens in the lesson panel, with nothing linked to it.
    const detailLesson =
      method === 'GET' ? lessons.find((item) => path === `/lessons/${item.id}`) : undefined;
    if (detailLesson) {
      return json({ ...detailLesson, original: null, makeup: null, schedule: null, history: [] });
    }

    const sheetMatch = path.match(/^\/lessons\/([^/]+)\/attendance$/);
    if (sheetMatch) {
      const lesson = lessons.find((item) => item.id === sheetMatch[1]);
      if (!lesson) return json({ code: 'LESSON_NOT_FOUND' }, 404);
      const saved = marks.get(lesson.id) ?? {};
      if (method === 'PUT') {
        for (const mark of (body().marks ?? []) as {
          enrollmentId: string;
          status: 'PRESENT' | 'ABSENT' | 'EXCUSED';
        }[]) {
          saved[mark.enrollmentId] = mark.status;
        }
        marks.set(lesson.id, saved);
      }
      const sheet: LessonAttendanceResponse = {
        lessonId: lesson.id,
        startsAtUtc: lesson.startsAtUtc,
        status: lesson.status,
        markable: lesson.status === 'COMPLETED',
        participants: SAMPLE_GROUPS[0]!.members.map((n) => ({
          enrollmentId: enrollmentId(1, n),
          student: {
            id: studentId(n),
            fullName: member(n).fullName,
            avatarKey: member(n).avatarKey,
          },
          status: saved[enrollmentId(1, n)] ?? null,
          markedAt: saved[enrollmentId(1, n)] ? lesson.startsAtUtc : null,
          paused: false,
        })),
      };
      return json(sheet);
    }

    if (path === '/teachers') {
      const items = Object.values(TEACHERS).map((teacher) => ({
        id: teacher.id,
        fullName: teacher.name,
        avatarKey: teacher.avatarKey,
        status: 'ACTIVE',
      }));
      return json({ items, page: 1, pageSize: 100, total: items.length, totalPages: 1 });
    }

    return null;
  };
}
