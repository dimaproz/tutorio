import type {
  LessonResponse,
  PackageResponse,
  PauseResponse,
  ScheduleChangePreview,
  ScheduleConflict,
  ScheduleResponse,
  StudentBillingResponse,
} from '@tutorio/validation';
import { DEFAULT_TIME_ZONE, zonedIso } from '@/lib/datetime';

/**
 * The lesson form's stories (S02): Anna's directions in every billing state
 * of the boards, the schedule with Dmytro, a paused student, the teachers'
 * own rates, the lessons of 1 October (the busy slots and the busy teacher),
 * and the writes the form makes, with a conflict on save when asked for.
 * The form's clock is Wednesday 30 September 2026; the first date is
 * Thursday 1 October.
 */

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const pad = (n: number) => String(n).padStart(12, '0');
const studentId = (n: number) => `d6bf671d-7a0f-4cf3-8a67-${pad(n)}`;
const groupId = (n: number) => `99999999-9999-4999-8999-${pad(n)}`;
const enrollmentId = (n: number) => `66666666-6666-4666-b666-${pad(n)}`;
const packageId = (n: number) => `77777777-7777-4777-b777-${pad(n)}`;
const lessonId = (n: number) => `88888888-8888-4888-b000-${pad(n)}`;

/** Kyiv wall-clock time in autumn 2026, as a UTC instant. */
export const kyivAutumn = (month: 9 | 10, day: number, hour: number, minute = 0) =>
  new Date(Date.UTC(2026, month - 1, day, hour - 3, minute)).toISOString();

const pad2 = (n: number) => String(n).padStart(2, '0');
/**
 * A wall-clock time on the studio's (Kyiv) clock, as the forms read their
 * dates and times (`lib/datetime`): the form's day read lines up with the
 * rows in any zone the browser runs in.
 */
const local = (month: 9 | 10, day: number, hour: number, minute = 0) =>
  zonedIso(`2026-${pad2(month)}-${pad2(day)}`, `${pad2(hour)}:${pad2(minute)}`, DEFAULT_TIME_ZONE);

/** The form's clock: noon on Wednesday 30 September. */
export const CREATE_CLOCK = Date.parse(local(9, 30, 12));

const DMYTRO = { id: '55555555-5555-4555-8555-555555555555', name: 'Dmytro Tutor' };
const IRYNA = { id: '55555555-5555-4555-8555-555555555556', name: 'Iryna Bondar' };
const OLEH = { id: '55555555-5555-4555-8555-555555555558', name: 'Oleh Marchenko' };

export const CREATE_STUDENT_ID = studentId(1);
export const CREATE_PAUSED_STUDENT_ID = studentId(7);
export const CREATE_GROUP_ID = groupId(1);

/** Anna's billing on the boards: a package (5 of 8), running out (1 of 8), or none. */
export type CreateBilling = 'package' | 'runningOut' | 'noPackage';

export type LessonCreateStoryOptions = {
  lessonCreate?: {
    billing?: CreateBilling;
    /** Anna and Dmytro have their Monday and Friday schedule. */
    schedule?: boolean;
    /** A save answers 409 SCHEDULE_CONFLICT until it is forced. */
    conflict?: boolean;
  };
};

const teacher = (fields: { id: string; name: string }, rate: number, avatarKey: string | null) => ({
  id: fields.id,
  workspaceId: WORKSPACE,
  fullName: fields.name,
  email: null,
  phone: null,
  telegramUsername: null,
  bio: null,
  defaultRateMinor: rate,
  currency: 'UAH',
  color: null,
  avatarKey,
  status: 'ACTIVE',
  workspaceMemberId: null,
  isMe: false,
  notes: null,
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
  deletedAt: null,
  activeEnrollmentCount: 3,
});

const TEACHERS = [
  teacher(DMYTRO, 50000, null),
  teacher(IRYNA, 45000, 'user-9'),
  teacher(OLEH, 50000, 'user-8'),
];

function billing(kind: CreateBilling, student = CREATE_STUDENT_ID): StudentBillingResponse {
  const credits = kind === 'package' ? 5 : kind === 'runningOut' ? 1 : 0;
  const perLesson = kind === 'noPackage';
  return {
    studentId: student,
    cancellationDeadlineHours: 12,
    lowCreditThreshold: 2,
    directions: [
      {
        enrollmentId: enrollmentId(1),
        billingType: perLesson ? 'PER_LESSON' : 'PACKAGE',
        rateMinor: 50000,
        currency: 'UAH',
        packages: perLesson
          ? []
          : [
              {
                id: packageId(1),
                name: 'B2 preparation',
                purchasedAt: '2026-09-01T10:00:00.000Z',
                expiresAt: kyivAutumn(10, 30, 12),
                remainingCredits: credits,
                usable: true,
                validFrom: null,
                lessonsTotal: 8,
                totalPriceMinor: 400000,
                paidMinor: 400000,
                paymentStatus: 'PAID',
              },
            ],
        creditsLeft: credits,
        debtLessons: 0,
        balance: {
          chargedMinor: 0,
          paidMinor: 0,
          debtMinor: 0,
          advanceMinor: 0,
          unpaidLessons: 0,
          unpaid: [],
        },
        warning: null,
        status: 'ACTIVE',
        teacher: { ...DMYTRO, avatarKey: null, subjects: ['English'] },
        group: null,
        cancellationDeadlineHours: null,
      },
    ],
    totals: [],
  };
}

function packageFixture(left: number): PackageResponse {
  return {
    id: packageId(1),
    workspaceId: WORKSPACE,
    enrollmentId: enrollmentId(1),
    studentId: CREATE_STUDENT_ID,
    groupId: null,
    name: 'B2 preparation',
    sizingMode: 'FIXED_COUNT',
    lessonsTotal: 8,
    lessonsPerWeek: null,
    validFrom: null,
    transferredFromPackageId: null,
    endDate: null,
    pricePerLessonMinorSnapshot: 50000,
    totalPriceMinorSnapshot: 400000,
    remainingCredits: left,
    consumedCredits: 8 - left,
    paidMinor: 400000,
    refundedMinor: 0,
    currency: 'UAH',
    paymentStatus: 'PAID',
    purchasedAt: '2026-09-01T10:00:00.000Z',
    expiresAt: kyivAutumn(10, 30, 12),
    notes: null,
    student: { id: CREATE_STUDENT_ID, fullName: 'Anna Shevchenko', avatarKey: null },
    group: null,
    teacher: {
      id: '55555555-5555-4555-8555-555555555555',
      name: 'Dmytro Tutor',
      avatarKey: null,
      subjects: ['English'],
    },
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    deletedAt: null,
  };
}

const SCHEDULE_ID = '12121212-1212-4121-b121-000000000001';
const GROUP_SCHEDULE_ID = '12121212-1212-4121-b121-000000000002';

const baseSchedule = {
  workspaceId: WORKSPACE,
  timezone: 'Europe/Kyiv',
  horizonWeeks: 4,
  endsAt: null,
  state: 'ACTIVE' as const,
  nextChange: null,
  startsAt: '2026-09-01T06:00:00.000Z',
  lastLessonAt: null,
  teacher: DMYTRO,
  subject: null,
  createdAt: '2026-08-25T08:00:00.000Z',
  updatedAt: '2026-09-01T06:00:00.000Z',
};

const ANNA_SCHEDULE: ScheduleResponse = {
  ...baseSchedule,
  id: SCHEDULE_ID,
  enrollmentId: enrollmentId(1),
  groupId: null,
  teacherId: DMYTRO.id,
  durationMin: 60,
  slots: [
    { weekday: 1, localTime: '17:00', seriesId: '13131313-1313-4131-b131-000000000001' },
    { weekday: 5, localTime: '17:00', seriesId: '13131313-1313-4131-b131-000000000002' },
  ],
  nextLessonAt: kyivAutumn(10, 2, 17),
  student: { id: CREATE_STUDENT_ID, fullName: 'Anna Shevchenko', avatarKey: null },
  group: null,
};

const GROUP_SCHEDULE: ScheduleResponse = {
  ...baseSchedule,
  id: GROUP_SCHEDULE_ID,
  enrollmentId: null,
  groupId: CREATE_GROUP_ID,
  teacherId: DMYTRO.id,
  durationMin: 90,
  slots: [
    { weekday: 2, localTime: '18:00', seriesId: '13131313-1313-4131-b131-000000000003' },
    { weekday: 4, localTime: '18:00', seriesId: '13131313-1313-4131-b131-000000000004' },
  ],
  nextLessonAt: kyivAutumn(10, 1, 18),
  student: null,
  group: { id: CREATE_GROUP_ID, name: 'B2 prep · evening', memberCount: 6 },
};

/** Oleksii is on a break until 12 October. */
const PAUSES: PauseResponse[] = [
  {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
    workspaceId: WORKSPACE,
    studentId: CREATE_PAUSED_STUDENT_ID,
    enrollmentId: null,
    startsAt: kyivAutumn(9, 21, 0),
    endsAt: kyivAutumn(10, 12, 0),
    endedAt: null,
    state: 'ACTIVE',
    reason: null,
    removedLessons: 2,
    extensions: [],
    createdAt: kyivAutumn(9, 20, 10),
    updatedAt: kyivAutumn(9, 20, 10),
  } as unknown as PauseResponse,
];

function dayLesson(
  n: number,
  startsAtUtc: string,
  durationMin: number,
  who: { teacher: { id: string; name: string }; group?: { id: string; name: string } },
): LessonResponse {
  return {
    id: lessonId(n),
    workspaceId: WORKSPACE,
    enrollmentId: null,
    groupId: who.group?.id ?? null,
    seriesId: null,
    teacherId: who.teacher.id,
    startsAtUtc,
    durationMin,
    priceMinor: 40000,
    currency: 'UAH',
    status: 'SCHEDULED',
    kind: 'REGULAR',
    originalLessonId: null,
    originalStartsAtUtc: null,
    groupMembers: null,
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
    student: null,
    group: who.group ?? null,
    teacher: { ...who.teacher, color: null },
    subject: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    deletedAt: null,
  };
}

/** 1 October: B2 prep with Dmytro at 18:00, and Oleh teaching B1 English at 17:00. */
const DAY_LESSONS: LessonResponse[] = [
  dayLesson(1, local(10, 1, 18), 90, {
    teacher: DMYTRO,
    group: { id: CREATE_GROUP_ID, name: 'B2 prep' },
  }),
  dayLesson(2, local(10, 1, 17), 60, {
    teacher: OLEH,
    group: { id: groupId(9), name: 'B1 English' },
  }),
];

const PREVIEW: ScheduleChangePreview = {
  effectiveFrom: local(10, 1, 0),
  moved: 0,
  unchanged: 8,
  created: 4,
  removed: 0,
  kept: 0,
  notesLost: [],
  conflicts: [],
  moves: [],
  removals: [],
  creates: [],
  keptLessons: [],
};

const CONFLICTS: ScheduleConflict[] = [
  {
    candidateStartsAtUtc: local(10, 1, 18, 30),
    lessonId: lessonId(1),
    startsAtUtc: local(10, 1, 18),
    durationMin: 90,
    reason: 'TEACHER',
    kind: 'REGULAR',
    teacher: DMYTRO,
    student: null,
    group: { id: CREATE_GROUP_ID, name: 'B2 prep · evening' },
    students: [],
  },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * Answers the lesson form's requests, or null for anything else (and for
 * everything when the story is not a lesson form story).
 */
export function createLessonCreateRoutes(options: LessonCreateStoryOptions) {
  const scenario = options.lessonCreate;
  const kind = scenario?.billing ?? 'package';

  return async (path: string, method: string, query: URLSearchParams): Promise<Response | null> => {
    if (!scenario) return null;

    if (path === '/teachers') {
      return json({
        items: TEACHERS,
        page: 1,
        pageSize: 100,
        total: TEACHERS.length,
        totalPages: 1,
      });
    }

    const billingMatch = path.match(/^\/students\/([^/]+)\/billing$/);
    if (billingMatch) {
      return json(
        billingMatch[1] === CREATE_PAUSED_STUDENT_ID
          ? billing('package', CREATE_PAUSED_STUDENT_ID)
          : billing(kind, billingMatch[1]!),
      );
    }

    if (path === `/packages/${packageId(1)}`) {
      return json(packageFixture(kind === 'runningOut' ? 1 : 5));
    }

    if (path === '/pauses') {
      return json({ items: PAUSES, page: 1, pageSize: 100, total: PAUSES.length, totalPages: 1 });
    }

    if (path === '/schedules' && method === 'GET') {
      const items = query.get('groupId')
        ? query.get('groupId') === CREATE_GROUP_ID
          ? [GROUP_SCHEDULE]
          : []
        : scenario.schedule &&
            query.get('studentId') === CREATE_STUDENT_ID &&
            query.get('teacherId') === DMYTRO.id
          ? [ANNA_SCHEDULE]
          : [];
      return json({ items, page: 1, pageSize: 20, total: items.length, totalPages: 1 });
    }
    if (path.match(/^\/schedules\/[^/]+\/changes\/preview$/)) return json(PREVIEW);
    if (path === '/schedules/preview' && method === 'POST') {
      return json({
        created: 8,
        firstLessonAt: local(10, 2, 17),
        existingScheduleId: null,
        conflicts: [],
      });
    }

    const forced = query.get('force') === 'true';
    const conflict = () =>
      json({ code: 'SCHEDULE_CONFLICT', details: { conflicts: CONFLICTS } }, 409);

    if (path === '/schedules' && method === 'POST') {
      if (scenario.conflict && !forced) return conflict();
      return json(ANNA_SCHEDULE, 201);
    }
    if (path.match(/^\/schedules\/[^/]+\/changes$/) && method === 'POST') {
      if (scenario.conflict && !forced) return conflict();
      return json({ schedule: ANNA_SCHEDULE, summary: PREVIEW });
    }

    if (path === '/lessons' && method === 'POST') {
      if (scenario.conflict && !forced) return conflict();
      return json({ items: [] }, 201);
    }

    // The form's day read: every lesson of the days it books.
    const filtered = ['enrollmentId', 'studentId', 'teacherId', 'groupId'].some((key) =>
      query.has(key),
    );
    if (path === '/lessons' && method === 'GET' && !filtered && query.has('from')) {
      const from = Date.parse(query.get('from')!);
      const to = Date.parse(query.get('to') ?? '');
      return json({
        items: DAY_LESSONS.filter((item) => {
          const start = Date.parse(item.startsAtUtc);
          return start >= from && start < to;
        }),
      });
    }

    return null;
  };
}
