import type {
  AvatarKeyDto,
  GroupListItem,
  LessonResponse,
  ScheduleConflict,
  ScheduleResponse,
  TeacherArchivePreview,
  TeacherListItem,
  TeacherStudent,
  TeacherSummary,
} from '@tutorio/validation';
import { DEFAULT_TIME_ZONE as TZ, addCalendarDays, zonedIso } from '@/lib/datetime';

/**
 * The Teachers stories (S09): Kyiv English Studio on Wednesday 9 September
 * 2026, 16:00. Olena Kovalenko owns it and teaches too; Iryna Bondar is the
 * profile the boards show; Andrii Savchuk is archived. The collection, both
 * profiles (their week, groups, schedules and students), the archive
 * preview — a hand-over to Kateryna overlaps one of her lessons —, the
 * archive, restore and the switch between tutor and studio mode.
 */

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const pad = (n: number) => String(n).padStart(12, '0');
const teacherId = (n: number) => `55555555-5555-4555-8555-${pad(n)}`;
const studentId = (n: number) => `d6bf671d-7a0f-4cf3-8a67-${pad(700 + n)}`;
const groupId = (n: number) => `99999999-9999-4999-8999-${pad(700 + n)}`;
const scheduleId = (n: number) => `12121212-1212-4121-d121-${pad(700 + n)}`;
const lessonId = (n: number) => `88888888-8888-4888-e000-${pad(700 + n)}`;

const pad2 = (n: number) => String(n).padStart(2, '0');
/** A wall-clock time on the studio's (Kyiv) clock in September 2026. */
const local = (day: number, hour: number, minute = 0, month = 9) =>
  zonedIso(`2026-${pad2(month)}-${pad2(day)}`, `${pad2(hour)}:${pad2(minute)}`, TZ);

/** The boards' clock: Wednesday 9 September 2026, 16:00 in Kyiv. */
export const TEACHERS_CLOCK = Date.parse(local(9, 16));

type Base = {
  n: number;
  fullName: string;
  color: string;
  subjects: string[];
  rate: number;
  currency: 'UAH' | 'PLN';
  since: string;
  avatarKey: AvatarKeyDto | null;
  students: number;
  groups: number;
  week: number[];
  email?: string;
  phone?: string;
  telegram?: string;
  bio?: string;
  notes?: string;
};

const BASES: Base[] = [
  {
    n: 1,
    fullName: 'Olena Kovalenko',
    color: '#1C7ED6',
    subjects: ['English', 'Business'],
    rate: 45000,
    currency: 'UAH',
    since: '2025-06-01T09:00:00.000Z',
    avatarKey: null,
    students: 9,
    groups: 1,
    week: [2, 1, 3, 2, 2, 2, 0],
    email: 'olena@kyivenglish.ua',
    phone: '+380671112233',
    telegram: 'olena_k',
    bio: 'Засновниця студії. Business English і групи для початківців.',
    notes: 'Вільна для нових учнів лише в першій половині дня. Відпустка 14–25 жовтня.',
  },
  {
    n: 2,
    fullName: 'Dmytro Tutor',
    color: '#4B4FE0',
    subjects: ['English', 'IELTS'],
    rate: 50000,
    currency: 'UAH',
    since: '2025-09-01T09:00:00.000Z',
    avatarKey: 'user-2',
    students: 14,
    groups: 2,
    week: [4, 3, 4, 3, 4, 0, 0],
  },
  {
    n: 3,
    fullName: 'Iryna Bondar',
    color: '#D6336C',
    subjects: ['English', 'Kids'],
    rate: 40000,
    currency: 'UAH',
    since: '2026-01-12T09:00:00.000Z',
    avatarKey: 'user-9',
    students: 11,
    groups: 3,
    week: [3, 3, 3, 2, 3, 1, 0],
    email: 'iryna@kyivenglish.ua',
    phone: '+380501234567',
    telegram: 'iryna_b',
    notes: 'Вільна для нових учнів лише в першій половині дня. Відпустка 14–25 жовтня.',
  },
  {
    n: 4,
    fullName: 'Oleh Marchenko',
    color: '#12A150',
    subjects: ['Польська', 'Deutsch'],
    rate: 12000,
    currency: 'PLN',
    since: '2026-03-03T09:00:00.000Z',
    avatarKey: 'user-4',
    students: 6,
    groups: 1,
    week: [2, 1, 2, 1, 2, 0, 0],
  },
  {
    n: 5,
    fullName: 'Kateryna Rudenko',
    color: '#F08C00',
    subjects: ['Français'],
    rate: 45000,
    currency: 'UAH',
    since: '2026-08-20T09:00:00.000Z',
    avatarKey: 'user-10',
    students: 4,
    groups: 0,
    week: [1, 1, 1, 1, 1, 0, 0],
  },
  {
    n: 6,
    fullName: 'Andrii Savchuk',
    color: '#868E96',
    subjects: ['English'],
    rate: 40000,
    currency: 'UAH',
    since: '2026-02-05T09:00:00.000Z',
    avatarKey: 'user-6',
    students: 0,
    groups: 0,
    week: [0, 0, 0, 0, 0, 0, 0],
  },
];

export const TEACHER_IDS = {
  olena: teacherId(1),
  dmytro: teacherId(2),
  iryna: teacherId(3),
  oleh: teacherId(4),
  kateryna: teacherId(5),
  andrii: teacherId(6),
};

function teacherItem(base: Base, fields: Partial<TeacherListItem> = {}): TeacherListItem {
  const lessonCount = base.week.reduce((sum, day) => sum + day, 0);
  return {
    id: teacherId(base.n),
    workspaceId: WORKSPACE,
    fullName: base.fullName,
    email: base.email ?? null,
    phone: base.phone ?? null,
    telegramUsername: base.telegram ?? null,
    subjects: base.subjects,
    bio: base.bio ?? null,
    defaultRateMinor: base.rate,
    currency: base.currency,
    color: base.color,
    avatarKey: base.avatarKey,
    status: 'ACTIVE',
    archivedAt: null,
    workspaceMemberId: base.n === 1 ? '77777777-7777-4777-8777-777777777777' : null,
    isMe: base.n === 1,
    notes: base.notes ?? null,
    createdAt: base.since,
    updatedAt: '2026-09-02T09:00:00.000Z',
    deletedAt: null,
    activeEnrollmentCount: base.students,
    studentCount: base.students,
    groupCount: base.groups,
    week: { lessonCount, days: base.week },
    ...fields,
  };
}

// ---------------------------------------------------------------------------
// The profiles: Iryna (the boards' profile) and Olena (her own).
// ---------------------------------------------------------------------------

type Who = { student: [string, number] } | { group: [string, number] };
let lessonCounter = 0;

function lesson(
  teacher: string,
  who: Who,
  startsAtUtc: string,
  status: LessonResponse['status'] = 'SCHEDULED',
): LessonResponse {
  lessonCounter += 1;
  const isGroup = 'group' in who;
  const [name, n] = isGroup ? who.group : who.student;
  return {
    id: lessonId(lessonCounter),
    workspaceId: WORKSPACE,
    enrollmentId: isGroup ? null : `66666666-6666-4666-d666-${pad(700 + lessonCounter)}`,
    groupId: isGroup ? groupId(n) : null,
    seriesId: null,
    teacherId: teacher,
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
    cancelledBy: null,
    cancelledReason: null,
    cancelledAt: null,
    completedAt: status === 'COMPLETED' ? startsAtUtc : null,
    paidAt: null,
    notes: null,
    cancellationDeadlineHours: 24,
    attendance: null,
    charges: [],
    student: isGroup ? null : { id: studentId(n), fullName: name, avatarKey: null },
    group: isGroup ? { id: groupId(n), name } : null,
    teacher: { id: teacher, name: '', color: null },
    subject: isGroup ? null : 'English',
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
    deletedAt: null,
  };
}

const S = {
  anna: ['Anna Shevchenko', 1],
  maksym: ['Maksym Tkachenko', 2],
  daryna: ['Daryna Kravets', 3],
  sofiia: ['Sofiia Melnyk', 4],
  ivan: ['Ivan Hnatiuk', 5],
  yana: ['Yana Lysenko', 6],
  taras: ['Taras Bondarenko', 7],
  mila: ['Mila Savchuk', 8],
  petro: ['Petro Ivanenko', 9],
  olha: ['Olha Moroz', 10],
  nazar: ['Nazar Sydorenko', 11],
  roman: ['Roman Kovalchuk', 12],
  irynaM: ['Iryna Martyniuk', 13],
} as const satisfies Record<string, readonly [string, number]>;
const G = {
  kidsA1: ['Kids A1', 1],
  kidsA2: ['Kids A2', 2],
  speaking: ['Speaking club', 3],
  beginners: ['Beginners', 4],
} as const satisfies Record<string, readonly [string, number]>;
const st = (key: keyof typeof S): Who => ({ student: [...S[key]] });
const gr = (key: keyof typeof G): Who => ({ group: [...G[key]] });

function irynaWeek(): LessonResponse[] {
  const iryna = TEACHER_IDS.iryna;
  return [
    lesson(iryna, gr('kidsA1'), local(7, 15), 'COMPLETED'),
    lesson(iryna, st('anna'), local(7, 17), 'COMPLETED'),
    lesson(iryna, st('daryna'), local(7, 18, 30), 'COMPLETED'),
    lesson(iryna, gr('kidsA2'), local(8, 15), 'COMPLETED'),
    lesson(iryna, st('yana'), local(8, 17), 'COMPLETED'),
    lesson(iryna, st('mila'), local(8, 18, 30), 'NO_SHOW'),
    lesson(iryna, gr('kidsA1'), local(9, 15), 'COMPLETED'),
    lesson(iryna, st('maksym'), local(9, 16, 30)),
    lesson(iryna, st('anna'), local(9, 18)),
    lesson(iryna, gr('kidsA2'), local(10, 15)),
    lesson(iryna, st('daryna'), local(10, 18, 30)),
    lesson(iryna, st('yana'), local(11, 16)),
    lesson(iryna, st('mila'), local(11, 17, 30)),
    lesson(iryna, st('maksym'), local(11, 18, 30)),
    lesson(iryna, gr('speaking'), local(12, 11)),
  ];
}

function olenaWeek(): LessonResponse[] {
  const olena = TEACHER_IDS.olena;
  return [
    lesson(olena, st('petro'), local(7, 10), 'COMPLETED'),
    lesson(olena, gr('beginners'), local(7, 18), 'COMPLETED'),
    lesson(olena, st('olha'), local(8, 10), 'COMPLETED'),
    lesson(olena, st('petro'), local(9, 10), 'COMPLETED'),
    lesson(olena, st('roman'), local(9, 16, 30)),
    lesson(olena, gr('beginners'), local(9, 18)),
    lesson(olena, st('olha'), local(10, 10)),
    lesson(olena, st('irynaM'), local(10, 12)),
    lesson(olena, st('petro'), local(11, 10)),
    lesson(olena, st('roman'), local(11, 12)),
    lesson(olena, st('nazar'), local(12, 11)),
    lesson(olena, st('irynaM'), local(12, 12, 30)),
  ];
}

const SUMMARIES: Record<string, TeacherSummary> = {
  [TEACHER_IDS.iryna]: {
    weeks: [540, 600, 660, 720, 660, 780].map((minutes, index) => ({
      weekStart: addCalendarDays('2026-08-03', index * 7),
      minutes,
    })),
    students: { total: 11, individual: 8, inGroups: 3 },
    groupCount: 3,
    month: { start: '2026-09-01', held: 21, noShows: 1, cancelledByStudents: 2 },
  },
  [TEACHER_IDS.olena]: {
    weeks: [360, 420, 480, 540, 480, 600].map((minutes, index) => ({
      weekStart: addCalendarDays('2026-08-03', index * 7),
      minutes,
    })),
    students: { total: 9, individual: 5, inGroups: 4 },
    groupCount: 1,
    month: { start: '2026-09-01', held: 16, noShows: 1, cancelledByStudents: 2 },
  },
};

const member = (key: keyof typeof S, avatar: number) => ({
  id: studentId(S[key][1]),
  fullName: S[key][0],
  avatarKey: `user-${avatar}` as AvatarKeyDto,
});

function group(
  key: keyof typeof G,
  teacher: Base,
  fields: Pick<GroupListItem, 'capacity' | 'pricePerLesson' | 'students'> & {
    weekdays: number[];
    time: string;
    next: string;
  },
): GroupListItem {
  return {
    id: groupId(G[key][1]),
    name: G[key][0],
    teacher: {
      id: teacherId(teacher.n),
      name: teacher.fullName,
      avatarKey: teacher.avatarKey,
      color: teacher.color,
    },
    capacity: fields.capacity,
    pricePerLesson: fields.pricePerLesson,
    currency: 'UAH',
    notes: null,
    deletedAt: null,
    status: 'ACTIVE',
    activeStudentCount: fields.students.length,
    students: fields.students,
    schedules: [
      { weekdays: fields.weekdays, localTime: fields.time, durationMin: 60, timezone: TZ },
    ],
    nextLesson: { id: lessonId(900 + G[key][1]), startsAtUtc: fields.next, durationMin: 60 },
    paymentDue: false,
  };
}

function groupsOf(teacher: string): GroupListItem[] {
  const [olena, , iryna] = BASES as [Base, Base, Base];
  if (teacher === TEACHER_IDS.iryna) {
    return [
      group('kidsA1', iryna, {
        capacity: 6,
        pricePerLesson: 30000,
        students: [
          member('taras', 1),
          member('petro', 2),
          member('ivan', 3),
          member('sofiia', 4),
          member('mila', 5),
        ],
        weekdays: [1, 3],
        time: '15:00',
        next: local(14, 15),
      }),
      group('kidsA2', iryna, {
        capacity: 6,
        pricePerLesson: 30000,
        students: [member('sofiia', 4), member('ivan', 3), member('daryna', 7), member('olha', 8)],
        weekdays: [2, 4],
        time: '15:00',
        next: local(10, 15),
      }),
      group('speaking', iryna, {
        capacity: 8,
        pricePerLesson: 25000,
        students: [
          member('anna', 1),
          member('maksym', 2),
          member('daryna', 7),
          member('yana', 8),
          member('nazar', 3),
          member('roman', 5),
        ],
        weekdays: [6],
        time: '11:00',
        next: local(12, 11),
      }),
    ];
  }
  if (teacher === TEACHER_IDS.olena) {
    return [
      group('beginners', olena, {
        capacity: 6,
        pricePerLesson: 35000,
        students: [member('petro', 3), member('olha', 2), member('roman', 7), member('nazar', 4)],
        weekdays: [1, 3],
        time: '18:00',
        next: local(9, 18),
      }),
    ];
  }
  return [];
}

function schedule(
  n: number,
  teacher: string,
  who: Who,
  slots: [number, string][],
  next: string | null,
  fields: Partial<ScheduleResponse> = {},
): ScheduleResponse {
  const isGroup = 'group' in who;
  const [name, key] = isGroup ? who.group : who.student;
  return {
    id: scheduleId(n),
    workspaceId: WORKSPACE,
    enrollmentId: isGroup ? null : `66666666-6666-4666-d666-${pad(800 + n)}`,
    groupId: isGroup ? groupId(key) : null,
    teacherId: teacher,
    timezone: TZ,
    durationMin: 60,
    horizonWeeks: 4,
    endsAt: null,
    state: 'ACTIVE',
    slots: slots.map(([weekday, localTime], index) => ({
      weekday,
      localTime,
      seriesId: `13131313-1313-4131-d131-${pad(800 + n * 10 + index)}`,
    })),
    nextChange: null,
    nextLessonAt: next,
    startsAt: '2026-08-31T12:00:00.000Z',
    lastLessonAt: local(7, 18, 0, 10),
    student: isGroup
      ? null
      : { id: studentId(key), fullName: name, avatarKey: `user-${(key % 10) + 1}` as AvatarKeyDto },
    group: isGroup
      ? { id: groupId(key), name, memberCount: key === 1 ? 5 : key === 2 ? 4 : 6 }
      : null,
    teacher: { id: teacher, name: '' },
    createdAt: '2026-08-31T12:00:00.000Z',
    updatedAt: '2026-08-31T12:00:00.000Z',
    ...fields,
  };
}

function schedulesOf(teacher: string): ScheduleResponse[] {
  const iryna = TEACHER_IDS.iryna;
  if (teacher === iryna) {
    return [
      schedule(
        1,
        iryna,
        gr('kidsA1'),
        [
          [1, '15:00'],
          [3, '15:00'],
        ],
        local(14, 15),
      ),
      schedule(
        2,
        iryna,
        gr('kidsA2'),
        [
          [2, '15:00'],
          [4, '15:00'],
        ],
        local(10, 15),
        {
          nextChange: {
            effectiveFrom: local(1, 0, 0, 10),
            slots: [
              { weekday: 2, localTime: '16:00' },
              { weekday: 4, localTime: '16:00' },
            ],
          },
        },
      ),
      schedule(
        3,
        iryna,
        st('maksym'),
        [
          [3, '16:30'],
          [5, '18:30'],
        ],
        local(9, 16, 30),
        {
          endsAt: local(21, 0, 0, 12),
        },
      ),
      schedule(4, iryna, gr('speaking'), [[6, '11:00']], local(12, 11)),
      schedule(
        5,
        iryna,
        st('anna'),
        [
          [1, '17:00'],
          [3, '18:00'],
        ],
        local(9, 18),
      ),
      schedule(
        6,
        iryna,
        st('daryna'),
        [
          [1, '18:30'],
          [4, '18:30'],
        ],
        local(10, 18, 30),
      ),
      schedule(
        7,
        iryna,
        st('yana'),
        [
          [2, '17:00'],
          [5, '16:00'],
        ],
        local(11, 16),
      ),
      schedule(
        8,
        iryna,
        st('mila'),
        [
          [2, '18:30'],
          [5, '17:30'],
        ],
        local(11, 17, 30),
      ),
      schedule(9, iryna, st('taras'), [[4, '17:00']], local(10, 17)),
    ];
  }
  if (teacher === TEACHER_IDS.olena) {
    return [
      schedule(
        20,
        TEACHER_IDS.olena,
        gr('beginners'),
        [
          [1, '18:00'],
          [3, '18:00'],
        ],
        local(9, 18),
      ),
      schedule(
        21,
        TEACHER_IDS.olena,
        st('petro'),
        [
          [1, '10:00'],
          [3, '10:00'],
          [5, '10:00'],
        ],
        local(11, 10),
      ),
    ];
  }
  return [];
}

const pupil = (
  key: keyof typeof S,
  level: string,
  how: { individual?: boolean; groups?: (keyof typeof G)[] },
): TeacherStudent => ({
  id: studentId(S[key][1]),
  fullName: S[key][0],
  avatarKey: `user-${(S[key][1] % 10) + 1}` as AvatarKeyDto,
  languageLevel: level,
  subject: 'English',
  individual: how.individual ?? false,
  groups: (how.groups ?? []).map((item) => ({ id: groupId(G[item][1]), name: G[item][0] })),
});

function studentsOf(teacher: string): TeacherStudent[] {
  if (teacher === TEACHER_IDS.iryna) {
    return [
      pupil('anna', 'B1', { individual: true }),
      pupil('maksym', 'B2', { individual: true }),
      pupil('daryna', 'A2', { individual: true }),
      pupil('sofiia', 'A2', { groups: ['kidsA2'] }),
      pupil('ivan', 'A2', { groups: ['kidsA2'] }),
      pupil('yana', 'B1', { individual: true }),
      pupil('taras', 'A1', { groups: ['kidsA1'] }),
      pupil('mila', 'A1', { individual: true }),
      pupil('petro', 'A1', { individual: true }),
      pupil('olha', 'A2', { individual: true }),
      pupil('nazar', 'B1', { individual: true }),
    ];
  }
  if (teacher === TEACHER_IDS.olena) {
    return [
      pupil('anna', 'B1', { individual: true }),
      pupil('maksym', 'B2', { individual: true }),
      pupil('daryna', 'A2', { individual: true }),
      pupil('sofiia', 'A2', { groups: ['beginners'] }),
      pupil('ivan', 'A2', { groups: ['beginners'] }),
      pupil('yana', 'B1', { individual: true }),
      pupil('petro', 'A1', { groups: ['beginners'] }),
      pupil('roman', 'A1', { groups: ['beginners'] }),
      pupil('olha', 'A2', { individual: true }),
    ];
  }
  return [];
}

export type TeacherStoryOptions = {
  teachers?: {
    /**
     * `studio` (six teachers, one archived), `notTeaching` (the owner turned
     * teaching off), `onlyMe` (the owner alone), `solo` (tutor mode).
     */
    scenario: 'studio' | 'notTeaching' | 'onlyMe' | 'solo';
    /** Holds the list request open, or fails it. */
    list?: 'ready' | 'pending' | 'error';
    /** Iryna's profile archived since 12 August. */
    irynaArchived?: boolean;
    /** Makes create and update fail. */
    saveFails?: boolean;
  };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Answers the teacher pages' requests, or null for anything else. Stateful
 * per story: an archive or a restore sticks until the story unmounts.
 */
export function createTeacherRoutes(options: TeacherStoryOptions) {
  const scenario = options.teachers;
  lessonCounter = 0;
  const weeks = [...irynaWeek(), ...olenaWeek()];
  const onlyOwner = scenario?.scenario === 'onlyMe' || scenario?.scenario === 'solo';
  let teachers: TeacherListItem[] = (onlyOwner ? BASES.slice(0, 1) : BASES).map((base) =>
    teacherItem(
      base,
      base.n === 6 ? { status: 'ARCHIVED', archivedAt: '2026-08-12T09:00:00.000Z' } : {},
    ),
  );
  const archive = (id: string) => {
    teachers = teachers.map((item) =>
      item.id === id
        ? { ...item, status: 'ARCHIVED', archivedAt: new Date(TEACHERS_CLOCK).toISOString() }
        : item,
    );
  };
  if (scenario?.scenario === 'notTeaching') archive(TEACHER_IDS.olena);
  if (scenario?.irynaArchived) {
    teachers = teachers.map((item) =>
      item.id === TEACHER_IDS.iryna
        ? { ...item, status: 'ARCHIVED', archivedAt: '2026-08-12T09:00:00.000Z' }
        : item,
    );
  }
  let mode: 'SCHOOL' | 'SOLO' = scenario?.scenario === 'solo' ? 'SOLO' : 'SCHOOL';
  const never = () => new Promise<Response>(() => undefined);
  const find = (id: string) => teachers.find((item) => item.id === id);

  return async (
    path: string,
    method: string,
    query: URLSearchParams,
    body: () => Record<string, unknown>,
  ): Promise<Response | null> => {
    if (!scenario) return null;

    if (path === '/teachers' && method === 'GET') {
      if (scenario.list === 'pending') return never();
      if (scenario.list === 'error') return json({ code: 'UNEXPECTED' }, 500);
      const me = teachers.find((item) => item.isMe) ?? null;
      const listed = teachers.filter((item) => !(item.isMe && item.status === 'ARCHIVED'));
      const status = query.get('status');
      const subject = query.get('subject')?.toLocaleLowerCase();
      const search = query.get('search')?.toLocaleLowerCase();
      const sort = query.get('sort') ?? 'name';
      const rows = listed
        .filter((item) => !status || item.status === status)
        .filter(
          (item) =>
            !subject || item.subjects.some((value) => value.toLocaleLowerCase() === subject),
        )
        .filter(
          (item) =>
            !search ||
            [item.fullName, item.phone ?? '', ...item.subjects].some((value) =>
              value.toLocaleLowerCase().includes(search),
            ),
        )
        .sort(
          (a, b) =>
            Number(b.isMe) - Number(a.isMe) ||
            (sort === 'workload' ? b.week.lessonCount - a.week.lessonCount : 0) ||
            (sort === 'created' ? b.createdAt.localeCompare(a.createdAt) : 0) ||
            a.fullName.localeCompare(b.fullName),
        );
      const pageSize = Number(query.get('pageSize') ?? 20);
      return json({
        items: rows.slice(0, pageSize),
        page: 1,
        pageSize,
        total: rows.length,
        totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
        counts: {
          active: listed.filter((item) => item.status === 'ACTIVE').length,
          archived: listed.filter((item) => item.status === 'ARCHIVED').length,
          all: listed.length,
        },
        me,
      });
    }

    if (path === '/teachers' && method === 'POST') {
      if (scenario.saveFails) return json({ code: 'UNEXPECTED' }, 500);
      const created = { ...teacherItem(BASES[4]!), ...body(), id: teacherId(99), isMe: false };
      teachers = [...teachers, created as TeacherListItem];
      return json(created, 201);
    }

    if (path === '/workspaces/current/settings' && method === 'PATCH') {
      const next = body().mode as 'SCHOOL' | 'SOLO' | undefined;
      const others = teachers.filter((item) => !item.isMe && item.status === 'ACTIVE').length;
      if (next === 'SOLO' && others > 0) {
        return json({ code: 'SOLO_MODE_SINGLE_TEACHER', message: 'Solo' }, 409);
      }
      if (next) mode = next;
      return json({ id: WORKSPACE, mode });
    }

    const match = path.match(/^\/teachers\/([^/]+)(\/.*)?$/);
    if (match) {
      const teacher = find(match[1]!);
      const rest = match[2] ?? '';
      if (!teacher) return json({ code: 'TEACHER_NOT_FOUND' }, 404);

      if (rest === '' && method === 'GET') return json(teacher);
      if (rest === '' && method === 'PATCH') {
        if (scenario.saveFails) return json({ code: 'UNEXPECTED' }, 500);
        teachers = teachers.map((item) => (item.id === teacher.id ? { ...item, ...body() } : item));
        return json(find(teacher.id));
      }
      if (rest === '/summary') {
        return json(
          SUMMARIES[teacher.id] ?? {
            weeks: [0, 0, 0, 0, 0, 0].map((minutes, index) => ({
              weekStart: addCalendarDays('2026-08-03', index * 7),
              minutes,
            })),
            students: {
              total: teacher.studentCount,
              individual: teacher.studentCount,
              inGroups: 0,
            },
            groupCount: teacher.groupCount,
            month: { start: '2026-09-01', held: 0, noShows: 0, cancelledByStudents: 0 },
          },
        );
      }
      if (rest === '/students') {
        const rows = studentsOf(teacher.id);
        const pageSize = Number(query.get('pageSize') ?? 20);
        return json({
          items: rows.slice(0, pageSize),
          page: 1,
          pageSize,
          total: rows.length,
          totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
        });
      }
      if (rest === '/archive/preview' && method === 'POST') {
        const transferTo = body().transferTo as string | null | undefined;
        const own = teacher.isMe;
        const conflicts: ScheduleConflict[] =
          transferTo === TEACHER_IDS.kateryna
            ? [
                {
                  candidateStartsAtUtc: local(10, 18, 30),
                  lessonId: lessonId(990),
                  startsAtUtc: local(10, 18),
                  durationMin: 60,
                  kind: 'REGULAR',
                  reason: 'TEACHER',
                  teacher: { id: TEACHER_IDS.kateryna, name: 'Kateryna Rudenko' },
                  student: { id: studentId(20), fullName: 'Marta Hrytsenko' },
                  group: null,
                  students: [],
                },
              ]
            : [];
        const preview: TeacherArchivePreview = own
          ? {
              scheduleCount: 2,
              futureLessonCount: 12,
              lastLessonAt: local(16, 18, 0, 10),
              studentCount: 9,
              groups: [{ id: groupId(4), name: 'Beginners' }],
              conflicts,
            }
          : teacher.id === TEACHER_IDS.iryna
            ? {
                scheduleCount: 3,
                futureLessonCount: 15,
                lastLessonAt: local(20, 18, 0, 10),
                studentCount: 11,
                groups: [
                  { id: groupId(1), name: 'Kids A1' },
                  { id: groupId(2), name: 'Kids A2' },
                  { id: groupId(3), name: 'Speaking club' },
                ],
                conflicts,
              }
            : {
                scheduleCount: 0,
                futureLessonCount: 0,
                lastLessonAt: null,
                studentCount: 0,
                groups: [],
                conflicts: [],
              };
        return json(preview);
      }
      if (rest === '/archive' && method === 'POST') {
        archive(teacher.id);
        return json(find(teacher.id));
      }
      if (rest === '/restore' && method === 'POST') {
        const others = teachers.filter(
          (item) => item.id !== teacher.id && item.status === 'ACTIVE',
        );
        if (mode === 'SOLO' && others.length > 0) {
          return json({ code: 'SOLO_MODE_SINGLE_TEACHER' }, 409);
        }
        teachers = teachers.map((item) =>
          item.id === teacher.id ? { ...item, status: 'ACTIVE', archivedAt: null } : item,
        );
        return json(find(teacher.id), 201);
      }
    }

    const byTeacher = query.get('teacherId');
    if (byTeacher && path === '/groups' && method === 'GET') {
      const rows = groupsOf(byTeacher);
      return json({ items: rows, page: 1, pageSize: 50, total: rows.length, totalPages: 1 });
    }
    if (byTeacher && path === '/schedules' && method === 'GET') {
      const rows = schedulesOf(byTeacher);
      const pageSize = Number(query.get('pageSize') ?? 20);
      return json({
        items: rows.slice(0, pageSize),
        page: 1,
        pageSize,
        total: rows.length,
        totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
        counts: { active: rows.length, changing: 1, ended: 0, all: rows.length },
      });
    }
    if (byTeacher && path === '/lessons' && method === 'GET' && query.has('from')) {
      const from = Date.parse(query.get('from')!);
      const to = Date.parse(query.get('to')!);
      return json({
        items: weeks.filter((item) => {
          const start = Date.parse(item.startsAtUtc);
          return item.teacherId === byTeacher && start >= from && start < to;
        }),
      });
    }

    return null;
  };
}
