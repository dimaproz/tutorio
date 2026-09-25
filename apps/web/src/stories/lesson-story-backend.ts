import type {
  AttendanceStatusDto,
  AuditLogResponse,
  EnrollmentBillingResponse,
  GroupDetail,
  LessonAttendanceResponse,
  LessonChargeResponse,
  LessonDetailResponse,
  PackageResponse,
  ScheduleChangePreview,
  ScheduleConflict,
  ScheduleResponse,
} from '@tutorio/validation';

/**
 * The lesson panel's stories (S01): one sample lesson per state of the design
 * boards, with the direction billing, packages, schedule, group and attendance
 * each state reads, and the writes the panel makes. Dates follow the boards
 * (Friday 11 September 2026 is the next individual lesson); the story clock
 * is Wednesday 9 September.
 */

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const pad = (n: number) => String(n).padStart(12, '0');
const lessonId = (n: number) => `88888888-8888-4888-a000-${pad(n)}`;
const enrollmentId = (n: number) => `66666666-6666-4666-a666-${pad(n)}`;
const packageId = (n: number) => `77777777-7777-4777-a777-${pad(n)}`;
const studentId = (n: number) => `d6bf671d-7a0f-4cf3-8a67-${pad(n)}`;
const memberEnrollment = (group: number, n: number) =>
  `44444444-4444-4444-a444-${pad(group * 100 + n)}`;

/** Kyiv wall-clock time in September 2026, as a UTC instant. */
export const kyiv = (day: number, hour: number, minute = 0) =>
  new Date(Date.UTC(2026, 8, day, hour - 3, minute)).toISOString();

const DMYTRO = { id: '55555555-5555-4555-8555-555555555555', name: 'Dmytro Tutor', color: null };
const IRYNA = { id: '55555555-5555-4555-8555-555555555556', name: 'Iryna Bondar', color: null };
const OLENA = {
  id: '66666666-6666-4666-8666-666666666666',
  name: 'Olena Kovalenko',
  email: 'olena@example.test',
};
const ANNA = { id: studentId(1), fullName: 'Anna Shevchenko', avatarKey: 'user-1' as const };

const SCHEDULE_ID = '12121212-1212-4121-a121-000000000001';
const GROUP_SCHEDULE_ID = '12121212-1212-4121-a121-000000000002';
export const LESSON_GROUP_UPCOMING = '99999999-9999-4999-a999-000000000030';
export const LESSON_GROUP_HELD = '99999999-9999-4999-a999-000000000031';

let auditSequence = 0;
function audit(
  at: string,
  fields: Record<string, { before: unknown; after: unknown }> | null,
  { actor = OLENA as typeof OLENA | null, action = 'UPDATE' as AuditLogResponse['action'] } = {},
): AuditLogResponse {
  auditSequence += 1;
  return {
    id: `00000000-0000-4000-a000-${pad(auditSequence)}`,
    workspaceId: WORKSPACE,
    actorId: actor?.id ?? null,
    actor,
    entity: 'LESSON',
    entityId: '',
    action,
    changes: fields ? { fields } : null,
    createdAt: at,
  };
}

const heldAutomatically = (day: number, hour: number, minute = 0) => [
  audit(
    kyiv(day, hour, minute),
    {
      status: { before: 'SCHEDULED', after: 'COMPLETED' },
      completedBy: { before: null, after: 'SCHEDULE' },
    },
    { actor: null },
  ),
  audit(
    kyiv(day, hour, minute),
    { 'charge.e': { before: null, after: 'PACKAGE' } },
    { actor: null },
  ),
];

/** The changes of the reference lesson: topic, substitute, price, the schedule move. */
const EDITS = [
  audit(kyiv(9, 10, 12), {
    topic: { before: 'Present Perfect', after: 'Past Perfect: розповідь про подорож' },
  }),
  audit(kyiv(5, 19, 40), { teacherId: { before: IRYNA.id, after: DMYTRO.id } }),
  audit(kyiv(3, 12), { priceMinor: { before: 45000, after: 50000 } }),
  audit(
    kyiv(1, 9),
    { startsAtUtc: { before: kyiv(11, 16), after: kyiv(11, 17) } },
    { actor: null },
  ),
];

function charge(
  enrollment: string,
  fields: Partial<LessonChargeResponse> = {},
): LessonChargeResponse {
  return {
    id: `c0c0c0c0-0000-4000-a000-${enrollment.slice(-12)}`,
    enrollmentId: enrollment,
    source: 'PACKAGE',
    packageId: null,
    amountMinor: 50000,
    currency: 'UAH',
    paid: true,
    student: ANNA,
    ...fields,
  };
}

function lesson(n: number, fields: Partial<LessonDetailResponse>): LessonDetailResponse {
  return {
    id: lessonId(n),
    workspaceId: WORKSPACE,
    enrollmentId: enrollmentId(1),
    groupId: null,
    seriesId: null,
    teacherId: DMYTRO.id,
    startsAtUtc: kyiv(11, 17),
    durationMin: 60,
    priceMinor: 50000,
    currency: 'UAH',
    status: 'SCHEDULED',
    kind: 'REGULAR',
    originalLessonId: null,
    makeupLessonId: null,
    topic: 'Past Perfect: розповідь про подорож',
    isDetached: false,
    rescheduledCount: 0,
    rescheduledAt: null,
    cancelledBy: null,
    cancelledReason: null,
    cancelledAt: null,
    completedAt: null,
    paidAt: null,
    notes: 'Принести аудіо з подкасту',
    cancellationDeadlineHours: 24,
    attendance: null,
    charges: [],
    student: ANNA,
    group: null,
    teacher: DMYTRO,
    subject: null,
    createdAt: kyiv(25 - 31, 11, 3),
    updatedAt: kyiv(9, 10, 12),
    deletedAt: null,
    original: null,
    makeup: null,
    schedule: null,
    history: [],
    ...fields,
  };
}

const fromSchedule = {
  seriesId: '13131313-1313-4131-a131-000000000001',
  schedule: { id: SCHEDULE_ID, state: 'ACTIVE' as const },
};

/** The individual lessons of board 01, by the state they show. */
function individualLessons(): LessonDetailResponse[] {
  const heldCharge = (n: number) => charge(enrollmentId(n), { packageId: packageId(n) });
  return [
    lesson(1, { ...fromSchedule, enrollmentId: enrollmentId(1), history: EDITS }),
    lesson(2, { ...fromSchedule, enrollmentId: enrollmentId(2), history: EDITS }),
    lesson(3, {
      enrollmentId: enrollmentId(3),
      notes: 'Разове заняття перед іспитом',
      history: [
        audit(kyiv(3, 12), { priceMinor: { before: 45000, after: 50000 } }),
        audit(
          kyiv(25 - 31, 11, 3),
          { startsAtUtc: { before: null, after: kyiv(11, 17) } },
          {
            action: 'CREATE',
          },
        ),
      ],
    }),
    lesson(4, {
      ...fromSchedule,
      enrollmentId: enrollmentId(4),
      startsAtUtc: kyiv(4, 17),
      status: 'COMPLETED',
      completedAt: kyiv(4, 18),
      charges: [heldCharge(4)],
      history: heldAutomatically(4, 18),
    }),
    lesson(5, {
      ...fromSchedule,
      enrollmentId: enrollmentId(5),
      startsAtUtc: kyiv(4, 17),
      status: 'COMPLETED',
      completedAt: kyiv(4, 18),
      paidAt: kyiv(5, 10, 30),
      charges: [charge(enrollmentId(5), { source: 'BALANCE', paid: true })],
      history: [
        audit(kyiv(5, 10, 30), { paidAt: { before: null, after: kyiv(5, 10, 30) } }),
        ...heldAutomatically(4, 18),
      ],
    }),
    lesson(6, {
      ...fromSchedule,
      enrollmentId: enrollmentId(6),
      startsAtUtc: kyiv(4, 17),
      status: 'COMPLETED',
      completedAt: kyiv(4, 18),
      charges: [charge(enrollmentId(6), { source: 'BALANCE', paid: false })],
      history: [
        ...heldAutomatically(4, 18),
        audit(kyiv(3, 12), { priceMinor: { before: 45000, after: 50000 } }),
      ],
    }),
    lesson(7, {
      ...fromSchedule,
      enrollmentId: enrollmentId(7),
      startsAtUtc: kyiv(4, 17),
      status: 'NO_SHOW',
      charges: [heldCharge(7)],
      history: [
        audit(kyiv(4, 18, 40), { status: { before: 'COMPLETED', after: 'NO_SHOW' } }),
        ...heldAutomatically(4, 18),
      ],
    }),
    lesson(8, {
      ...fromSchedule,
      enrollmentId: enrollmentId(8),
      status: 'CANCELLED_CHARGED',
      cancelledBy: 'STUDENT',
      cancelledReason: 'Захворіла',
      cancelledAt: kyiv(11, 14, 5),
      makeupLessonId: lessonId(11),
      makeup: { id: lessonId(11), startsAtUtc: kyiv(15, 17), status: 'SCHEDULED' },
      charges: [heldCharge(8)],
      history: [
        audit(kyiv(11, 14, 5), {
          status: { before: 'SCHEDULED', after: 'CANCELLED_CHARGED' },
          cancelledBy: { before: null, after: 'STUDENT' },
          cancelledReason: { before: null, after: 'Захворіла' },
        }),
        audit(kyiv(11, 14, 5), { 'charge.e': { before: null, after: 'PACKAGE' } }),
        ...EDITS,
      ],
    }),
    lesson(9, {
      ...fromSchedule,
      enrollmentId: enrollmentId(9),
      status: 'CANCELLED_UNCHARGED',
      cancelledBy: 'TEACHER',
      cancelledReason: 'Хворію',
      cancelledAt: kyiv(9, 16, 20),
      history: [
        audit(
          kyiv(9, 16, 20),
          {
            status: { before: 'SCHEDULED', after: 'CANCELLED_UNCHARGED' },
            cancelledBy: { before: null, after: 'TEACHER' },
            cancelledReason: { before: null, after: 'Хворію' },
          },
          { actor: { id: DMYTRO.id, name: DMYTRO.name, email: 'dmytro@example.test' } },
        ),
        ...EDITS,
      ],
    }),
    lesson(10, {
      ...fromSchedule,
      enrollmentId: enrollmentId(10),
      status: 'CANCELLED_UNCHARGED',
      cancelledBy: 'STUDENT',
      cancelledReason: 'Поїздка',
      cancelledAt: kyiv(8, 9, 30),
      history: [
        audit(kyiv(8, 9, 30), {
          status: { before: 'SCHEDULED', after: 'CANCELLED_UNCHARGED' },
          cancelledBy: { before: null, after: 'STUDENT' },
          cancelledReason: { before: null, after: 'Поїздка' },
        }),
        ...EDITS,
      ],
    }),
    lesson(11, {
      kind: 'MAKEUP',
      enrollmentId: enrollmentId(8),
      startsAtUtc: kyiv(15, 17),
      teacherId: IRYNA.id,
      teacher: IRYNA,
      notes: null,
      originalLessonId: lessonId(8),
      original: { id: lessonId(8), startsAtUtc: kyiv(11, 17), status: 'CANCELLED_CHARGED' },
      createdAt: kyiv(11, 14, 7),
      history: [
        audit(
          kyiv(11, 14, 7),
          { originalLessonId: { before: null, after: lessonId(8) } },
          {
            action: 'CREATE',
          },
        ),
      ],
    }),
    // The next lesson of the running-out direction, past the last credit.
    lesson(20, { ...fromSchedule, enrollmentId: enrollmentId(2), startsAtUtc: kyiv(14, 17) }),
  ];
}

// ---------------------------------------------------------------------------
// Board 02: the group lesson
// ---------------------------------------------------------------------------

type Member = { n: number; fullName: string; avatarKey: string | null; perLesson?: boolean };
const MEMBERS: Member[] = [
  { n: 1, fullName: 'Anna Shevchenko', avatarKey: 'user-1' },
  { n: 2, fullName: 'Sofiia Melnyk', avatarKey: 'user-4' },
  { n: 3, fullName: 'Maksym Tkachenko', avatarKey: 'user-2', perLesson: true },
  { n: 4, fullName: 'Daryna Kravets', avatarKey: 'user-6' },
  { n: 5, fullName: 'Artem Lysenko', avatarKey: 'user-3' },
  { n: 7, fullName: 'Oleksii Koval', avatarKey: null },
];
const PAUSED_MEMBER = 7;
const groupIndex = (groupId: string) => (groupId === LESSON_GROUP_HELD ? 31 : 30);

function groupDetail(groupId: string): GroupDetail {
  const index = groupIndex(groupId);
  return {
    id: groupId,
    workspaceId: WORKSPACE,
    name: 'B2 prep · evening',
    teacherId: DMYTRO.id,
    capacity: 8,
    pricePerLesson: 40000,
    currency: 'UAH',
    notes: null,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-09-09T09:00:00.000Z',
    deletedAt: null,
    status: 'ACTIVE',
    teacher: { ...DMYTRO, avatarKey: null },
    teacherMismatch: false,
    enrollments: MEMBERS.map((member) => ({
      id: memberEnrollment(index, member.n),
      studentId: studentId(member.n),
      groupId,
      teacherId: DMYTRO.id,
      status: 'ACTIVE',
      billingType: member.perLesson ? 'PER_LESSON' : 'PACKAGE',
      priceMinor: 40000,
      currency: 'UAH',
      ownPrice: false,
      cancellationDeadlineHours: null,
      student: {
        id: studentId(member.n),
        fullName: member.fullName,
        avatarKey: member.avatarKey as GroupDetail['enrollments'][number]['student']['avatarKey'],
        status: member.n === PAUSED_MEMBER ? 'ON_HOLD' : 'ACTIVE',
        languageLevel: 'B2',
      },
      teacher: DMYTRO,
    })),
    schedules: [
      {
        id: GROUP_SCHEDULE_ID,
        weekdays: [2, 4],
        localTime: '18:00',
        durationMin: 90,
        timezone: 'Europe/Kyiv',
      },
    ],
    nextLesson: null,
    lessonCounts: { completed: 12, upcoming: 8 },
  };
}

/** Members' own packages: before the lesson (4, 2, 5, 1 left) and after it was held. */
function groupPackages(groupId: string): PackageResponse[] {
  const index = groupIndex(groupId);
  const left: Record<number, number> =
    index === 30 ? { 1: 4, 2: 2, 4: 5, 5: 1 } : { 1: 3, 2: 1, 4: 5, 5: 0 };
  return Object.entries(left).map(([n, remaining]) =>
    packageFixture(index * 100 + Number(n), memberEnrollment(index, Number(n)), remaining, groupId),
  );
}

const groupLesson = (n: number, groupId: string, fields: Partial<LessonDetailResponse>) =>
  lesson(n, {
    enrollmentId: null,
    groupId,
    group: { id: groupId, name: 'B2 prep · evening' },
    student: null,
    startsAtUtc: kyiv(15, 18),
    durationMin: 90,
    priceMinor: 40000,
    topic: 'Speaking: подорожі',
    notes: null,
    seriesId: '13131313-1313-4131-a131-000000000002',
    schedule: { id: GROUP_SCHEDULE_ID, state: 'ACTIVE' },
    createdAt: kyiv(1, 9),
    ...fields,
  });

function groupLessons(): LessonDetailResponse[] {
  const held = LESSON_GROUP_HELD;
  const heldCharges = (marks: 'marked' | 'unmarked'): LessonChargeResponse[] => [
    charge(memberEnrollment(31, 1), { packageId: packageId(3101), amountMinor: 40000 }),
    charge(memberEnrollment(31, 2), { packageId: packageId(3102), amountMinor: 40000 }),
    charge(memberEnrollment(31, 3), { source: 'BALANCE', paid: false, amountMinor: 40000 }),
    ...(marks === 'unmarked'
      ? [charge(memberEnrollment(31, 4), { packageId: packageId(3104), amountMinor: 40000 })]
      : []),
    charge(memberEnrollment(31, 5), { source: 'DEBT', paid: false, amountMinor: 40000 }),
  ];
  return [
    groupLesson(31, LESSON_GROUP_UPCOMING, {}),
    groupLesson(32, held, {
      status: 'COMPLETED',
      completedAt: kyiv(15, 19, 30),
      attendance: { present: 3, marked: 5 },
      charges: heldCharges('marked'),
      history: [
        audit(kyiv(15, 19, 45), {
          [`attendance.${memberEnrollment(31, 3)}`]: { before: 'PRESENT', after: 'ABSENT' },
          [`attendance.${memberEnrollment(31, 4)}`]: { before: 'PRESENT', after: 'EXCUSED' },
        }),
        audit(
          kyiv(15, 19, 30),
          {
            status: { before: 'SCHEDULED', after: 'COMPLETED' },
            completedBy: { before: null, after: 'SCHEDULE' },
          },
          { actor: null },
        ),
      ],
    }),
    groupLesson(33, held, {
      status: 'COMPLETED',
      completedAt: kyiv(15, 19, 30),
      attendance: { present: 5, marked: 5 },
      charges: heldCharges('unmarked'),
      history: [
        audit(
          kyiv(15, 19, 30),
          {
            status: { before: 'SCHEDULED', after: 'COMPLETED' },
            completedBy: { before: null, after: 'SCHEDULE' },
          },
          { actor: null },
        ),
        audit(
          kyiv(15, 19, 30),
          Object.fromEntries(
            [1, 2, 3, 4, 5].map((n) => [
              `charge.${memberEnrollment(31, n)}`,
              { before: null, after: 'PACKAGE' },
            ]),
          ),
          { actor: null },
        ),
      ],
    }),
    groupLesson(34, LESSON_GROUP_UPCOMING, {
      status: 'CANCELLED_UNCHARGED',
      cancelledBy: 'TEACHER',
      cancelledReason: 'Свято',
      cancelledAt: kyiv(14, 20, 10),
      history: [
        audit(
          kyiv(14, 20, 10),
          {
            status: { before: 'SCHEDULED', after: 'CANCELLED_UNCHARGED' },
            cancelledBy: { before: null, after: 'TEACHER' },
            cancelledReason: { before: null, after: 'Свято' },
          },
          { actor: { id: DMYTRO.id, name: DMYTRO.name, email: 'dmytro@example.test' } },
        ),
      ],
    }),
  ];
}

/** Who came: board 02's marks; the paused member is listed and never marked. */
const GROUP_MARKS: Record<number, Record<number, AttendanceStatusDto | null>> = {
  31: {},
  32: { 1: 'PRESENT', 2: 'PRESENT', 3: 'ABSENT', 4: 'EXCUSED', 5: 'PRESENT' },
  33: { 1: 'PRESENT', 2: 'PRESENT', 3: 'PRESENT', 4: 'PRESENT', 5: 'PRESENT' },
  34: {},
};

// ---------------------------------------------------------------------------
// Directions, packages and the schedule
// ---------------------------------------------------------------------------

function packageFixture(
  n: number,
  enrollment: string,
  remaining: number,
  groupId: string | null = null,
): PackageResponse {
  return {
    id: packageId(n),
    workspaceId: WORKSPACE,
    enrollmentId: enrollment,
    studentId: studentId(1),
    groupId,
    name: groupId ? 'Autumn 2026' : 'B2 preparation',
    sizingMode: 'FIXED_COUNT',
    lessonsTotal: 8,
    lessonsPerWeek: null,
    validFrom: null,
    transferredFromPackageId: null,
    endDate: null,
    pricePerLessonMinorSnapshot: 50000,
    totalPriceMinorSnapshot: 400000,
    remainingCredits: remaining,
    consumedCredits: 8 - remaining,
    paidMinor: 400000,
    refundedMinor: 0,
    currency: 'UAH',
    paymentStatus: 'PAID',
    purchasedAt: '2026-09-01T10:00:00.000Z',
    // 30 November.
    expiresAt: kyiv(91, 12),
    notes: null,
    student: ANNA,
    group: groupId ? { id: groupId, name: 'B2 prep · evening' } : null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    deletedAt: null,
  };
}

/** Credits left per individual direction; missing ones pay per lesson. */
const DIRECTION_CREDITS: Record<number, number> = { 1: 6, 2: 1, 4: 5, 7: 5, 8: 5, 9: 6, 10: 6 };

function billing(n: number): EnrollmentBillingResponse {
  const credits = DIRECTION_CREDITS[n];
  const perLesson = credits === undefined;
  return {
    enrollmentId: enrollmentId(n),
    billingType: perLesson ? 'PER_LESSON' : 'PACKAGE',
    rateMinor: 50000,
    currency: 'UAH',
    packages: perLesson
      ? []
      : [
          {
            id: packageId(n),
            name: 'B2 preparation',
            purchasedAt: '2026-09-01T10:00:00.000Z',
            expiresAt: kyiv(91, 12),
            remainingCredits: credits,
            usable: true,
            validFrom: null,
            lessonsTotal: 8,
            totalPriceMinor: 400000,
            paidMinor: 400000,
            paymentStatus: 'PAID',
          },
        ],
    creditsLeft: credits ?? 0,
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
  };
}

const SCHEDULE: ScheduleResponse = {
  id: SCHEDULE_ID,
  workspaceId: WORKSPACE,
  enrollmentId: enrollmentId(1),
  groupId: null,
  teacherId: DMYTRO.id,
  timezone: 'Europe/Kyiv',
  durationMin: 60,
  horizonWeeks: 4,
  endsAt: null,
  state: 'ACTIVE',
  slots: [
    { weekday: 1, localTime: '17:00', seriesId: '13131313-1313-4131-a131-000000000001' },
    { weekday: 5, localTime: '17:00', seriesId: '13131313-1313-4131-a131-000000000003' },
  ],
  nextChange: null,
  nextLessonAt: kyiv(11, 17),
  startsAt: '2026-09-01T06:00:00.000Z',
  lastLessonAt: kyiv(32, 17),
  student: ANNA,
  group: null,
  teacher: { id: DMYTRO.id, name: DMYTRO.name },
  createdAt: '2026-08-25T08:03:00.000Z',
  updatedAt: '2026-09-01T06:00:00.000Z',
};

const GROUP_SCHEDULE: ScheduleResponse = {
  ...SCHEDULE,
  id: GROUP_SCHEDULE_ID,
  enrollmentId: null,
  groupId: LESSON_GROUP_UPCOMING,
  durationMin: 90,
  slots: [
    { weekday: 2, localTime: '18:00', seriesId: '13131313-1313-4131-a131-000000000002' },
    { weekday: 4, localTime: '18:00', seriesId: '13131313-1313-4131-a131-000000000004' },
  ],
  student: null,
  group: { id: LESSON_GROUP_UPCOMING, name: 'B2 prep · evening', memberCount: 6 },
};

const PREVIEW: ScheduleChangePreview = {
  effectiveFrom: kyiv(11, 17),
  moved: 14,
  unchanged: 0,
  created: 0,
  removed: 0,
  kept: 0,
  notesLost: [
    { lessonId: lessonId(40), startsAtUtc: kyiv(18, 17), topic: 'Irregular verbs', hasNotes: true },
    { lessonId: lessonId(41), startsAtUtc: kyiv(32, 17), topic: null, hasNotes: true },
  ],
  conflicts: [],
  moves: [],
  removals: [],
  creates: [],
  keptLessons: [],
};

/** What a move to Friday 18:30 overlaps (board 10, variant C). */
const CONFLICTS: ScheduleConflict[] = [
  {
    candidateStartsAtUtc: kyiv(11, 18, 30),
    lessonId: lessonId(60),
    startsAtUtc: kyiv(11, 18),
    durationMin: 90,
    reason: 'TEACHER',
    kind: 'REGULAR',
    teacher: { id: DMYTRO.id, name: DMYTRO.name },
    student: null,
    group: { id: LESSON_GROUP_UPCOMING, name: 'B2 prep · evening' },
    students: [],
  },
  {
    candidateStartsAtUtc: kyiv(11, 18, 30),
    lessonId: lessonId(61),
    startsAtUtc: kyiv(11, 18, 30),
    durationMin: 90,
    reason: 'STUDENT',
    kind: 'REGULAR',
    teacher: { id: IRYNA.id, name: IRYNA.name },
    student: null,
    group: { id: '99999999-9999-4999-a999-000000000040', name: 'B1 English' },
    students: [ANNA],
  },
];

// ---------------------------------------------------------------------------
// The scenarios and the routes
// ---------------------------------------------------------------------------

/** Every state of boards 01 and 02, and the lesson it opens. */
export const LESSON_STATES = {
  scheduledPackage: lessonId(1),
  scheduledPackageRunningOut: lessonId(2),
  scheduledOneOff: lessonId(3),
  heldPackage: lessonId(4),
  heldPaid: lessonId(5),
  heldUnpaid: lessonId(6),
  noShow: lessonId(7),
  cancelledChargedWithMakeup: lessonId(8),
  cancelledByTeacher: lessonId(9),
  cancelledInTime: lessonId(10),
  makeup: lessonId(11),
  loading: lessonId(98),
  notFound: lessonId(99),
  groupScheduled: lessonId(31),
  groupRunning: lessonId(31),
  groupHeldMarked: lessonId(32),
  groupHeldUnmarked: lessonId(33),
  groupCancelled: lessonId(34),
} as const;

export type LessonState = keyof typeof LESSON_STATES;

/** The clock of a state: the running group lesson is watched mid-lesson. */
export function lessonStateClock(state: LessonState): number | undefined {
  return state === 'groupRunning' ? Date.parse(kyiv(15, 18, 30)) : undefined;
}

export type LessonStoryOptions = {
  /** A move of a lesson answers 409 SCHEDULE_CONFLICT until it is forced. */
  lessonConflicts?: boolean;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/**
 * Answers the lesson panel's requests, or null for anything else. Stateful per
 * story: status changes, edits, makeups, marks and deletes stick.
 */
export function createLessonRoutes(options: LessonStoryOptions) {
  const lessons = new Map(
    [...individualLessons(), ...groupLessons()].map((item) => [item.id, structuredClone(item)]),
  );
  const marks = new Map(
    Object.entries(GROUP_MARKS).map(([n, byMember]) => [lessonId(Number(n)), { ...byMember }]),
  );
  const never = () => new Promise<Response>(() => undefined);

  const sheet = (item: LessonDetailResponse): LessonAttendanceResponse => {
    const index = groupIndex(item.groupId ?? '');
    const saved = marks.get(item.id) ?? {};
    return {
      lessonId: item.id,
      startsAtUtc: item.startsAtUtc,
      status: item.status,
      markable: item.status === 'COMPLETED' || item.id === lessonId(31),
      participants: MEMBERS.map((member) => ({
        enrollmentId: memberEnrollment(index, member.n),
        student: {
          id: studentId(member.n),
          fullName: member.fullName,
          avatarKey:
            member.avatarKey as LessonAttendanceResponse['participants'][number]['student']['avatarKey'],
        },
        status: member.n === PAUSED_MEMBER ? null : (saved[member.n] ?? null),
        markedAt: saved[member.n] ? kyiv(15, 19, 45) : null,
        paused: member.n === PAUSED_MEMBER,
      })),
    };
  };

  return async (
    path: string,
    method: string,
    query: URLSearchParams,
    body: () => Record<string, unknown>,
  ): Promise<Response | null> => {
    if (path === `/lessons/${lessonId(98)}`) return never();

    const attendanceMatch = path.match(/^\/lessons\/([^/]+)\/attendance$/);
    if (attendanceMatch && lessons.has(attendanceMatch[1]!)) {
      const item = lessons.get(attendanceMatch[1]!)!;
      if (method === 'PUT') {
        const saved = marks.get(item.id) ?? {};
        for (const mark of (body().marks ?? []) as {
          enrollmentId: string;
          status: AttendanceStatusDto;
        }[]) {
          const member = MEMBERS.find(
            (row) => memberEnrollment(groupIndex(item.groupId ?? ''), row.n) === mark.enrollmentId,
          );
          if (member) saved[member.n] = mark.status;
        }
        marks.set(item.id, saved);
      }
      return json(sheet(item));
    }

    const actionMatch = path.match(/^\/lessons\/([^/]+)(\/status|\/reschedule|\/makeup)?$/);
    if (actionMatch && (lessons.has(actionMatch[1]!) || actionMatch[1] === lessonId(99))) {
      const item = lessons.get(actionMatch[1]!);
      if (!item) return json({ code: 'LESSON_NOT_FOUND' }, 404);
      const action = actionMatch[2];
      const payload = method === 'GET' ? {} : body();
      if (method === 'GET') return json(item);
      if (method === 'DELETE') {
        lessons.delete(item.id);
        return new Response(null, { status: 204 });
      }
      if (action === '/status') {
        const cancel = String(payload.targetStatus).startsWith('CANCELLED');
        Object.assign(item, {
          status: payload.targetStatus,
          cancelledBy: cancel ? payload.cancelledBy : null,
          cancelledReason: cancel ? (payload.cancelledReason ?? null) : null,
          cancelledAt: cancel ? new Date().toISOString() : null,
        });
        item.history = [
          audit(new Date().toISOString(), {
            status: { before: 'SCHEDULED', after: payload.targetStatus },
            ...(cancel
              ? {
                  cancelledBy: { before: null, after: payload.cancelledBy },
                  cancelledReason: { before: null, after: payload.cancelledReason ?? null },
                }
              : {}),
          }),
          ...item.history,
        ];
        return json(item);
      }
      const forced = query.get('force') === 'true';
      if (action === '/reschedule') {
        if (options.lessonConflicts && !forced) {
          return json({ code: 'SCHEDULE_CONFLICT', details: { conflicts: CONFLICTS } }, 409);
        }
        Object.assign(item, {
          startsAtUtc: payload.startsAtUtc,
          durationMin: payload.durationMin ?? item.durationMin,
        });
        return json(item);
      }
      if (action === '/makeup') {
        const created = lesson(50, {
          kind: 'MAKEUP',
          enrollmentId: item.enrollmentId,
          startsAtUtc: String(payload.startsAtUtc),
          originalLessonId: item.id,
          original: { id: item.id, startsAtUtc: item.startsAtUtc, status: item.status },
          topic: (payload.topic as string | null) ?? null,
          notes: null,
        });
        lessons.set(created.id, created);
        Object.assign(item, {
          makeupLessonId: created.id,
          makeup: { id: created.id, startsAtUtc: created.startsAtUtc, status: 'SCHEDULED' },
        });
        return json(created, 201);
      }
      Object.assign(item, payload);
      return json(item);
    }

    // The forms' day read (busy slots, busy teachers): every lesson in the window.
    const filtered = ['enrollmentId', 'studentId', 'teacherId', 'groupId'].some((key) =>
      query.has(key),
    );
    if (path === '/lessons' && method === 'GET' && !filtered && query.has('from')) {
      const from = Date.parse(query.get('from')!);
      const to = Date.parse(query.get('to') ?? '');
      const items = [...lessons.values()].filter((item) => {
        const start = Date.parse(item.startsAtUtc);
        return start >= from && start < to;
      });
      return json({ items: items.sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc)) });
    }

    if (path === '/lessons' && query.get('enrollmentId')) {
      const items = [...lessons.values()].filter(
        (item) => item.enrollmentId === query.get('enrollmentId'),
      );
      return json({ items: items.sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc)) });
    }

    const billingMatch = path.match(/^\/enrollments\/([^/]+)\/billing$/);
    if (billingMatch) {
      const n = Number(billingMatch[1]!.slice(-12));
      return json(billing(n));
    }

    const packageMatch = path.match(/^\/packages\/([^/]+)$/);
    if (packageMatch && packageMatch[1]!.startsWith('77777777-7777-4777-a777-')) {
      const n = Number(packageMatch[1]!.slice(-12));
      if (n >= 3000) {
        const groupId = n >= 3100 ? LESSON_GROUP_HELD : LESSON_GROUP_UPCOMING;
        const found = groupPackages(groupId).find((item) => item.id === packageMatch[1]);
        return found ? json(found) : json({ code: 'PACKAGE_NOT_FOUND' }, 404);
      }
      return json(packageFixture(n, enrollmentId(n), DIRECTION_CREDITS[n] ?? 0));
    }

    if (
      path === '/packages' &&
      (query.get('groupId') === LESSON_GROUP_UPCOMING || query.get('groupId') === LESSON_GROUP_HELD)
    ) {
      const items = groupPackages(query.get('groupId')!);
      return json({ items, page: 1, pageSize: 100, total: items.length, totalPages: 1 });
    }

    const groupMatch = path.match(/^\/groups\/([^/]+)$/);
    if (
      groupMatch &&
      (groupMatch[1] === LESSON_GROUP_UPCOMING || groupMatch[1] === LESSON_GROUP_HELD)
    ) {
      return json(groupDetail(groupMatch[1]!));
    }

    if (path === `/schedules/${SCHEDULE_ID}`) return json(SCHEDULE);
    if (path === `/schedules/${GROUP_SCHEDULE_ID}`) return json(GROUP_SCHEDULE);
    if (path.match(/^\/schedules\/[^/]+\/changes\/preview$/)) return json(PREVIEW);

    return null;
  };
}
