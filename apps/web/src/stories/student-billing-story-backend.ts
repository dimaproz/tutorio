import type {
  LessonResponse,
  PackageResponse,
  PauseEndPreviewResponse,
  PausePreviewResponse,
  PauseResponse,
  PaymentResponse,
  ScheduleConflict,
  ScheduleResponse,
  StudentBillingResponse,
} from '@tutorio/validation';

/**
 * The student profile's learning and billing stories (S06): Anna's
 * directions in every state of board 01 «ProfileLearning», her packages,
 * payments, schedules and pauses, and the answers of the payment, direction
 * settings and pause dialogs of board 02. The clock is Thursday 24 September
 * 2026 at noon in Kyiv.
 */

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
export const BILLING_STUDENT_ID = 'd6bf671d-7a0f-4cf3-8a67-000000000001';
const STUDENT = { id: BILLING_STUDENT_ID, fullName: 'Anna Shevchenko' };

/** Kyiv wall-clock time as an instant (summer time ends on 25 October). */
function kyiv(month: number, day: number, hour = 0, minute = 0): string {
  const offset = month > 10 || (month === 10 && day > 25) ? 2 : 3;
  return new Date(Date.UTC(2026, month - 1, day, hour - offset, minute)).toISOString();
}

/** The stories' clock: Thursday 24 September 2026, noon in Kyiv. */
export const BILLING_CLOCK = Date.parse(kyiv(9, 24, 12));

const uuid = (prefix: string, n: number) =>
  `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const enrollmentId = (n: number) => uuid('e6e6e6e6', n);
const packageId = (n: number) => uuid('abababab', n);
const lessonId = (n: number) => uuid('1e1e1e1e', n);
const pauseId = (n: number) => uuid('9a9a9a9a', n);
const groupId = (n: number) => uuid('96969696', n);

const DMYTRO = { id: '55555555-5555-4555-8555-555555555555', name: 'Dmytro Tutor' };
const IRYNA = { id: '55555555-5555-4555-8555-555555555556', name: 'Iryna Bondar' };
const OLEH = { id: '55555555-5555-4555-8555-555555555558', name: 'Oleh Marchenko' };
const B1_GROUP = { id: groupId(1), name: 'B1 English' };

export type ProfileBillingState =
  | 'package'
  | 'partial'
  | 'low'
  | 'debt'
  | 'advance'
  | 'two'
  | 'three'
  | 'pauseScheduled'
  | 'paused'
  | 'directionPaused';

export type ProfileBillingOptions = {
  profileBilling?: {
    state: ProfileBillingState;
    /** The pause return finds two of its lessons' time taken (board 02, state 13). */
    returnConflicts?: boolean;
    /** Every write the dialogs make, for the interaction tests. */
    onWrite?: (write: { method: string; path: string; body: unknown }) => void;
  };
};

type Direction = StudentBillingResponse['directions'][number];
type BillingPackage = Direction['packages'][number];

const B2: BillingPackage = {
  id: packageId(1),
  name: 'B2 preparation',
  purchasedAt: kyiv(9, 1, 10),
  validFrom: null,
  expiresAt: kyiv(10, 31),
  lessonsTotal: 8,
  remainingCredits: 6,
  usable: true,
  totalPriceMinor: 400000,
  paidMinor: 400000,
  paymentStatus: 'PAID',
};

const noBalance: Direction['balance'] = {
  chargedMinor: 0,
  paidMinor: 0,
  debtMinor: 0,
  advanceMinor: 0,
  unpaidLessons: 0,
  unpaid: [],
};

function direction(fields: Partial<Direction> & Pick<Direction, 'enrollmentId'>): Direction {
  return {
    billingType: 'PACKAGE',
    rateMinor: 50000,
    currency: 'UAH',
    packages: [B2],
    creditsLeft: 6,
    debtLessons: 0,
    balance: noBalance,
    warning: null,
    status: 'ACTIVE',
    teacher: { ...DMYTRO, avatarKey: null, subjects: ['English'] },
    group: null,
    cancellationDeadlineHours: 24,
    ...fields,
  };
}

const english = (fields: Partial<Direction> = {}) =>
  direction({ enrollmentId: enrollmentId(1), ...fields });

const englishPerLesson = (balance: Direction['balance']) =>
  english({ billingType: 'PER_LESSON', packages: [], creditsLeft: 0, balance });

const ENGLISH_DEBT = englishPerLesson({
  chargedMinor: 400000,
  paidMinor: 300000,
  debtMinor: 100000,
  advanceMinor: 0,
  unpaidLessons: 2,
  unpaid: [
    { lessonId: lessonId(21), startsAt: kyiv(9, 21, 17), outstandingMinor: 50000 },
    { lessonId: lessonId(23), startsAt: kyiv(9, 23, 17), outstandingMinor: 50000 },
  ],
});

const GROUP_DEBT = direction({
  enrollmentId: enrollmentId(2),
  billingType: 'PER_LESSON',
  rateMinor: 35000,
  packages: [],
  creditsLeft: 0,
  teacher: { ...IRYNA, avatarKey: 'user-9', subjects: ['English'] },
  group: B1_GROUP,
  cancellationDeadlineHours: 12,
  balance: {
    chargedMinor: 245000,
    paidMinor: 140000,
    debtMinor: 105000,
    advanceMinor: 0,
    unpaidLessons: 3,
    unpaid: [
      { lessonId: lessonId(31), startsAt: kyiv(9, 16, 18, 30), outstandingMinor: 35000 },
      { lessonId: lessonId(32), startsAt: kyiv(9, 21, 18, 30), outstandingMinor: 35000 },
      { lessonId: lessonId(33), startsAt: kyiv(9, 23, 18, 30), outstandingMinor: 35000 },
    ],
  },
});

const POLISH = direction({
  enrollmentId: enrollmentId(3),
  billingType: 'PER_LESSON',
  rateMinor: 12000,
  currency: 'PLN',
  packages: [],
  creditsLeft: 0,
  teacher: { ...OLEH, avatarKey: 'user-8', subjects: ['Польська'] },
  balance: { ...noBalance, paidMinor: 24000, advanceMinor: 24000 },
});

function directionsOf(state: ProfileBillingState): Direction[] {
  switch (state) {
    case 'partial':
      return [english({ packages: [{ ...B2, paidMinor: 200000, paymentStatus: 'PARTIAL' }] })];
    case 'low':
      return [
        english({
          packages: [{ ...B2, remainingCredits: 2 }],
          creditsLeft: 2,
          warning: 'LOW_CREDITS',
        }),
      ];
    case 'debt':
      return [ENGLISH_DEBT];
    case 'advance':
      return [
        englishPerLesson({
          ...noBalance,
          chargedMinor: 200000,
          paidMinor: 300000,
          advanceMinor: 100000,
        }),
      ];
    case 'two':
    case 'directionPaused':
      return [english(), GROUP_DEBT];
    case 'three':
      return [english(), GROUP_DEBT, POLISH];
    case 'paused':
      // The running pause pushed the package to 14 November.
      return [english({ packages: [{ ...B2, expiresAt: kyiv(11, 15) }] })];
    default:
      return [english()];
  }
}

function totalsOf(directions: Direction[]): StudentBillingResponse['totals'] {
  const byCurrency = new Map<string, StudentBillingResponse['totals'][number]>();
  for (const row of directions) {
    const total = byCurrency.get(row.currency) ?? {
      currency: row.currency,
      debtMinor: 0,
      advanceMinor: 0,
      unpaidLessons: 0,
      debtLessons: 0,
      creditsLeft: 0,
    };
    total.debtMinor += row.balance.debtMinor;
    total.advanceMinor += row.balance.advanceMinor;
    total.unpaidLessons += row.balance.unpaidLessons;
    total.creditsLeft += row.creditsLeft;
    byCurrency.set(row.currency, total);
  }
  return [...byCurrency.values()];
}

function pause(n: number, fields: Partial<PauseResponse>): PauseResponse {
  return {
    id: pauseId(n),
    workspaceId: WORKSPACE,
    studentId: BILLING_STUDENT_ID,
    enrollmentId: null,
    startsAt: kyiv(10, 1),
    endsAt: kyiv(10, 15),
    endedAt: null,
    state: 'SCHEDULED',
    reason: 'HOLIDAY',
    removedLessons: 8,
    extensions: [],
    student: STUDENT,
    createdAt: kyiv(9, 20, 10),
    updatedAt: kyiv(9, 20, 10),
    ...fields,
  };
}

function pausesOf(state: ProfileBillingState): PauseResponse[] {
  if (state === 'pauseScheduled') {
    return [pause(1, { extensions: [{ packageId: B2.id, extendedBySeconds: 14 * 86_400 }] })];
  }
  if (state === 'paused') {
    return [
      pause(2, {
        startsAt: kyiv(9, 21),
        endsAt: kyiv(10, 5),
        state: 'ACTIVE',
        removedLessons: 6,
        extensions: [{ packageId: B2.id, extendedBySeconds: 14 * 86_400 }],
      }),
    ];
  }
  if (state === 'directionPaused') {
    return [
      pause(3, {
        enrollmentId: GROUP_DEBT.enrollmentId,
        startsAt: kyiv(9, 21),
        endsAt: kyiv(10, 13),
        state: 'ACTIVE',
        removedLessons: 0,
      }),
    ];
  }
  return [];
}

function schedule(
  n: number,
  fields: Pick<ScheduleResponse, 'slots' | 'durationMin' | 'teacher' | 'nextLessonAt'> &
    Partial<ScheduleResponse>,
): ScheduleResponse {
  return {
    id: uuid('5c5c5c5c', n),
    workspaceId: WORKSPACE,
    enrollmentId: null,
    groupId: null,
    teacherId: fields.teacher.id,
    timezone: 'Europe/Kyiv',
    horizonWeeks: 4,
    endsAt: null,
    state: 'ACTIVE',
    nextChange: null,
    startsAt: kyiv(9, 1),
    lastLessonAt: kyiv(10, 23, 17),
    student: null,
    group: null,
    createdAt: kyiv(9, 1, 10),
    updatedAt: kyiv(9, 1, 10),
    ...fields,
  };
}

const slot = (weekday: number, localTime: string, n: number) => ({
  weekday,
  localTime,
  seriesId: uuid('5e5e5e5e', n),
});

const ENGLISH_SCHEDULE = schedule(1, {
  enrollmentId: enrollmentId(1),
  teacher: DMYTRO,
  student: { ...STUDENT, avatarKey: 'user-1' },
  slots: [slot(1, '17:00', 1), slot(5, '17:00', 2)],
  durationMin: 60,
  nextLessonAt: kyiv(9, 25, 17),
});
const GROUP_SCHEDULE = schedule(2, {
  groupId: B1_GROUP.id,
  teacher: IRYNA,
  group: { ...B1_GROUP, memberCount: 6 },
  slots: [slot(1, '18:30', 3), slot(3, '18:30', 4)],
  durationMin: 90,
  nextLessonAt: kyiv(9, 28, 18, 30),
});
const POLISH_SCHEDULE = schedule(3, {
  enrollmentId: enrollmentId(3),
  teacher: OLEH,
  student: { ...STUDENT, avatarKey: 'user-1' },
  slots: [slot(6, '10:00', 5)],
  durationMin: 60,
  nextLessonAt: kyiv(9, 26, 10),
});

function lesson(
  n: number,
  startsAtUtc: string,
  status: LessonResponse['status'],
  who: { teacher: typeof DMYTRO; group?: typeof B1_GROUP; durationMin?: number } = {
    teacher: DMYTRO,
  },
): LessonResponse {
  return {
    id: lessonId(n),
    workspaceId: WORKSPACE,
    enrollmentId: who.group ? null : enrollmentId(1),
    groupId: who.group?.id ?? null,
    seriesId: null,
    teacherId: who.teacher.id,
    startsAtUtc,
    durationMin: who.durationMin ?? 60,
    priceMinor: 50000,
    currency: 'UAH',
    status,
    isDetached: false,
    rescheduledCount: 0,
    kind: 'REGULAR',
    originalLessonId: null,
    makeupLessonId: null,
    topic: null,
    rescheduledAt: null,
    cancelledBy: status.startsWith('CANCELLED') ? 'STUDENT' : null,
    cancelledReason: null,
    cancelledAt: null,
    completedAt: status === 'COMPLETED' ? startsAtUtc : null,
    paidAt: null,
    notes: null,
    cancellationDeadlineHours: 24,
    attendance: null,
    charges: [],
    student: who.group ? null : STUDENT,
    group: who.group ?? null,
    teacher: { ...who.teacher, color: null },
    createdAt: kyiv(9, 1, 10),
    updatedAt: kyiv(9, 1, 10),
    deletedAt: null,
  } as LessonResponse;
}

function lessonsOf(state: ProfileBillingState): LessonResponse[] {
  const paused = state === 'paused';
  const upcoming = paused
    ? [
        lesson(1, kyiv(10, 5, 17), 'SCHEDULED'),
        lesson(2, kyiv(10, 9, 17), 'SCHEDULED'),
        lesson(3, kyiv(10, 12, 17), 'SCHEDULED'),
      ]
    : [
        lesson(1, kyiv(9, 25, 17), 'SCHEDULED'),
        lesson(2, kyiv(9, 28, 17), 'SCHEDULED'),
        lesson(3, kyiv(10, 2, 17), 'SCHEDULED'),
      ];
  const groups =
    state === 'two' || state === 'three'
      ? [
          lesson(4, kyiv(9, 28, 18, 30), 'SCHEDULED', {
            teacher: IRYNA,
            group: B1_GROUP,
            durationMin: 90,
          }),
        ]
      : [];
  const past = [
    lesson(21, kyiv(9, 21, 17), 'COMPLETED'),
    lesson(40, kyiv(9, 16, 17), 'CANCELLED_CHARGED'),
    ...Array.from({ length: 11 }, (_, index) =>
      lesson(41 + index, kyiv(9, 14 - index, 17), 'COMPLETED'),
    ),
  ];
  return [...upcoming, ...groups, ...past];
}

function payment(
  n: number,
  fields: Partial<PaymentResponse> & Pick<PaymentResponse, 'amountMinor' | 'paidAt'>,
): PaymentResponse {
  return {
    id: uuid('7a7a7a7a', n),
    workspaceId: WORKSPACE,
    enrollmentId: enrollmentId(1),
    packageId: null,
    currency: 'UAH',
    method: 'CASH',
    status: 'PAID',
    provider: 'manual',
    externalId: null,
    note: null,
    student: STUDENT,
    createdAt: fields.paidAt,
    updatedAt: fields.paidAt,
    ...fields,
  };
}

const PAYMENTS: PaymentResponse[] = [
  payment(1, { amountMinor: 100000, paidAt: kyiv(9, 23, 19) }),
  payment(2, {
    amountMinor: 400000,
    paidAt: kyiv(9, 1, 12),
    packageId: packageId(1),
    method: 'BANK_TRANSFER',
  }),
  payment(3, { amountMinor: 160000, paidAt: kyiv(8, 20, 12), packageId: packageId(2) }),
  payment(4, {
    amountMinor: 30000,
    paidAt: kyiv(8, 19, 12),
    packageId: packageId(3),
    method: 'BANK_TRANSFER',
    status: 'REFUNDED',
  }),
  payment(5, {
    amountMinor: 60000,
    paidAt: kyiv(8, 12, 12),
    packageId: packageId(3),
    method: 'OTHER',
  }),
];

function historyPackage(
  n: number,
  name: string,
  fields: Partial<PackageResponse>,
): PackageResponse {
  return {
    id: packageId(n),
    workspaceId: WORKSPACE,
    enrollmentId: enrollmentId(1),
    studentId: BILLING_STUDENT_ID,
    groupId: null,
    name,
    sizingMode: 'FIXED_COUNT',
    lessonsTotal: 8,
    endDate: null,
    pricePerLessonMinorSnapshot: 50000,
    totalPriceMinorSnapshot: 400000,
    lessonsPerWeek: null,
    validFrom: null,
    transferredFromPackageId: null,
    remainingCredits: 6,
    consumedCredits: 2,
    paidMinor: 400000,
    refundedMinor: 0,
    currency: 'UAH',
    paymentStatus: 'PAID',
    purchasedAt: kyiv(9, 1, 10),
    expiresAt: kyiv(10, 31),
    notes: null,
    student: STUDENT,
    group: null,
    createdAt: kyiv(9, 1, 10),
    updatedAt: kyiv(9, 1, 10),
    deletedAt: null,
    ...fields,
  } as PackageResponse;
}

const PACKAGES: PackageResponse[] = [
  historyPackage(1, 'B2 preparation', {}),
  historyPackage(2, 'Starter', {
    lessonsTotal: 4,
    remainingCredits: 0,
    consumedCredits: 4,
    totalPriceMinorSnapshot: 160000,
    paidMinor: 160000,
    purchasedAt: kyiv(8, 20, 10),
    expiresAt: kyiv(9, 1),
  }),
  historyPackage(3, 'Пробний', {
    lessonsTotal: 2,
    remainingCredits: 1,
    consumedCredits: 1,
    totalPriceMinorSnapshot: 60000,
    paidMinor: 30000,
    refundedMinor: 30000,
    paymentStatus: 'PARTIAL',
    purchasedAt: kyiv(8, 12, 10),
    expiresAt: kyiv(8, 20),
  }),
];

/** «8 занять буде прибрано: English 4, B1 English 4» for 1–14 October. */
function pausePreview(
  body: {
    enrollmentId?: string | null;
    startsAt?: string;
    endsAt?: string | null;
    replacesPauseId?: string;
  },
  directions: Direction[],
): PausePreviewResponse {
  const startsAt = body.startsAt ?? new Date(BILLING_CLOCK).toISOString();
  const endsAt = body.endsAt ?? null;
  const covered = body.enrollmentId
    ? directions.filter((row) => row.enrollmentId === body.enrollmentId)
    : directions;
  const days = endsAt ? Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 86_400_000) : 0;
  const packages = covered.flatMap((row) => row.packages);
  return {
    startsAt,
    endsAt,
    directions: covered.map((row) => ({
      enrollmentId: row.enrollmentId,
      removedLessons: row.group ? 0 : 4,
      groupLessons: row.group ? 4 : 0,
    })),
    extensions:
      endsAt && days > 0
        ? packages.map((pkg) => ({
            packageId: pkg.id,
            name: pkg.name,
            expiresAt: pkg.expiresAt!,
            nextExpiresAt: new Date(Date.parse(pkg.expiresAt!) + days * 86_400_000).toISOString(),
          }))
        : [],
    holdsStudent: !body.enrollmentId,
  };
}

const RETURN_CONFLICTS: ScheduleConflict[] = [
  {
    candidateStartsAtUtc: kyiv(9, 28, 17),
    lessonId: lessonId(90),
    startsAtUtc: kyiv(9, 28, 17),
    durationMin: 60,
    kind: 'REGULAR',
    reason: 'TEACHER',
    teacher: DMYTRO,
    student: { id: uuid('d6bf671d', 2), fullName: 'Sofiia Melnyk' },
    group: null,
    students: [],
  },
  {
    candidateStartsAtUtc: kyiv(10, 2, 17),
    lessonId: lessonId(91),
    startsAtUtc: kyiv(10, 2, 17),
    durationMin: 60,
    kind: 'REGULAR',
    reason: 'TEACHER',
    teacher: DMYTRO,
    student: { id: uuid('d6bf671d', 3), fullName: 'Mark Petrenko' },
    group: null,
    students: [],
  },
];

/** What ending the story's pause brings back: its lessons and the shorter extension. */
function endPreview(current: PauseResponse, conflicts: boolean): PauseEndPreviewResponse {
  const returning = (at: string) => ({
    startsAtUtc: at,
    durationMin: 60,
    enrollmentId: enrollmentId(1),
    groupId: null,
  });
  if (current.state === 'SCHEDULED') {
    return {
      action: 'CANCEL',
      lessons: [1, 2, 5, 6, 8, 9, 12, 13].map((day) => returning(kyiv(10, day, 17))),
      conflicts: [],
      extensions: [
        { packageId: B2.id, name: B2.name, expiresAt: kyiv(11, 14), nextExpiresAt: kyiv(10, 31) },
      ],
    };
  }
  return {
    action: 'END',
    lessons: [returning(kyiv(9, 28, 17)), returning(kyiv(9, 30, 17)), returning(kyiv(10, 2, 17))],
    conflicts: conflicts ? RETURN_CONFLICTS : [],
    extensions: [
      { packageId: B2.id, name: B2.name, expiresAt: kyiv(11, 15), nextExpiresAt: kyiv(11, 8) },
    ],
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const page = <T>(items: T[]) => ({
  items,
  page: 1,
  pageSize: 100,
  total: items.length,
  totalPages: 1,
});

/**
 * Answers the profile's billing requests, or null for anything else (and for
 * everything when the story is not a billing story).
 */
export function createProfileBillingRoutes(options: ProfileBillingOptions) {
  const scenario = options.profileBilling;
  const state = scenario?.state ?? 'package';
  const directions = directionsOf(state);
  const pauses = pausesOf(state);
  const lessons = lessonsOf(state);

  return async (
    path: string,
    method: string,
    query: URLSearchParams,
    readBody: () => unknown,
  ): Promise<Response | null> => {
    if (!scenario) return null;
    const write = (body: unknown = null) => scenario.onWrite?.({ method, path, body });

    if (path === `/students/${BILLING_STUDENT_ID}/billing`) {
      return json({
        studentId: BILLING_STUDENT_ID,
        cancellationDeadlineHours: 24,
        lowCreditThreshold: 2,
        directions,
        totals: totalsOf(directions),
      } satisfies StudentBillingResponse);
    }
    if (path === '/pauses' && method === 'GET') return json(page(pauses));
    if (path === '/payments' && method === 'GET') return json(page(PAYMENTS));
    if (path === '/packages' && method === 'GET') return json(page(PACKAGES));
    if (path === '/schedules' && method === 'GET') {
      const group = query.get('groupId');
      if (group)
        return json({
          ...page(group === B1_GROUP.id ? [GROUP_SCHEDULE] : []),
          counts: { active: 1, changing: 0, ended: 0, all: 1 },
        });
      const own = state === 'three' ? [ENGLISH_SCHEDULE, POLISH_SCHEDULE] : [ENGLISH_SCHEDULE];
      return json({
        ...page(own),
        counts: { active: own.length, changing: 0, ended: 0, all: own.length },
      });
    }
    if (path === '/lessons' && method === 'GET' && query.has('from')) {
      const from = Date.parse(query.get('from') ?? '');
      const to = Date.parse(query.get('to') ?? '');
      return json({
        items: lessons
          .filter((row) => {
            const start = Date.parse(row.startsAtUtc);
            return (
              start >= from &&
              start <= to &&
              (!query.get('status') || row.status === query.get('status'))
            );
          })
          .sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc)),
      });
    }

    if (path === '/pauses/preview' && method === 'POST') {
      return json(pausePreview(readBody() as Parameters<typeof pausePreview>[0], directions));
    }
    const endPreviewMatch = path.match(/^\/pauses\/([^/]+)\/end\/preview$/);
    if (endPreviewMatch && method === 'POST') {
      const current = pauses.find((row) => row.id === endPreviewMatch[1]);
      return current
        ? json(endPreview(current, Boolean(scenario.returnConflicts)))
        : json({ code: 'PAUSE_NOT_FOUND' }, 404);
    }
    const endMatch = path.match(/^\/pauses\/([^/]+)\/end$/);
    if (endMatch && method === 'POST') {
      write({ force: query.get('force'), skipConflicts: query.get('skipConflicts') });
      const current = pauses.find((row) => row.id === endMatch[1]);
      if (!current) return json({ code: 'PAUSE_NOT_FOUND' }, 404);
      if (scenario.returnConflicts && !query.get('force') && !query.get('skipConflicts')) {
        return json({ code: 'SCHEDULE_CONFLICT', details: { conflicts: RETURN_CONFLICTS } }, 409);
      }
      return json({ ...current, state: current.state === 'SCHEDULED' ? 'CANCELLED' : 'ENDED' });
    }
    const pauseMatch = path.match(/^\/pauses\/([^/]+)$/);
    if (pauseMatch && method === 'PATCH') {
      write(readBody());
      return json(pause(9, { ...(readBody() as Partial<PauseResponse>) }));
    }
    if (path === '/pauses' && method === 'POST') {
      write(readBody());
      return json(pause(9, { ...(readBody() as Partial<PauseResponse>) }), 201);
    }
    if (path === '/payments' && method === 'POST') {
      const body = readBody() as Partial<PaymentResponse>;
      write(body);
      return json(
        payment(9, { amountMinor: body.amountMinor ?? 0, paidAt: body.paidAt ?? kyiv(9, 24, 12) }),
        201,
      );
    }
    const enrollmentMatch = path.match(/^\/enrollments\/([^/]+)$/);
    if (enrollmentMatch && method === 'PATCH') {
      write(readBody());
      return json({ id: enrollmentMatch[1] });
    }
    return null;
  };
}
