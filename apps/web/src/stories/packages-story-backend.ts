import {
  compareEndingFirst,
  isPackageEnding,
  packageLifecycle,
  transferCredits,
  weeksInPeriod,
} from '@tutorio/domain';
import type {
  CreditEntryResponse,
  PackageDetailResponse,
  PackageListResponse,
  PackagePreviewResponse,
  PackageResponse,
  PaymentResponse,
} from '@tutorio/validation';
import { BILLING_PACKAGES, BILLING_STUDENT_ID } from './student-billing-story-backend';

/**
 * The package stories (S07): the ticket in each state of board 02, the
 * studio's packages of board 04, the sale preview and every operation of
 * board 03, all in memory. The clock is Friday 25 September 2026, noon in
 * Kyiv. Anna's directions and schedules come from the S06 billing stories.
 */

const WORKSPACE = '11111111-1111-4111-8111-111111111111';

/** Kyiv wall-clock time as an instant (summer time ends on 25 October). */
function kyiv(month: number, day: number, hour = 0, minute = 0): string {
  const offset = month > 10 || (month === 10 && day > 25) ? 2 : 3;
  return new Date(Date.UTC(2026, month - 1, day, hour - offset, minute)).toISOString();
}

/** The stories' clock: Friday 25 September 2026, noon in Kyiv. */
export const PACKAGES_CLOCK = Date.parse(kyiv(9, 25, 12));

const uuid = (prefix: string, n: number) =>
  `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const packageId = (n: number) => uuid('cdcdcdcd', n);
const lessonId = (n: number) => uuid('1c1c1c1c', n);
const enrollmentId = (n: number) => uuid('e6e6e6e6', n);
const studentId = (n: number) => uuid('d6bf671d', n);

const DMYTRO = {
  id: '55555555-5555-4555-8555-555555555555',
  name: 'Dmytro Tutor',
  avatarKey: null,
  subjects: ['English'],
};
const IRYNA = {
  id: '55555555-5555-4555-8555-555555555556',
  name: 'Iryna Bondar',
  avatarKey: 'user-9' as const,
  subjects: ['English'],
};
const OLEH = {
  id: '55555555-5555-4555-8555-555555555558',
  name: 'Oleh Marchenko',
  avatarKey: 'user-8' as const,
  subjects: ['Deutsch', 'Польська'],
};

const ANNA = { id: BILLING_STUDENT_ID, fullName: 'Anna Shevchenko', avatarKey: 'user-1' as const };

/** The ticket of each board 02 state. */
export const TICKET_IDS = {
  new: packageId(1),
  partial: packageId(2),
  used: packageId(3),
  expired: packageId(4),
  paused: packageId(5),
} as const;
export type TicketStory = keyof typeof TICKET_IDS;

/** Starter: the older package the new one waits for (L-81). */
const STARTER_ID = packageId(9);

function pkg(n: number, fields: Partial<PackageDetailResponse>): PackageDetailResponse {
  return {
    id: packageId(n),
    workspaceId: WORKSPACE,
    enrollmentId: enrollmentId(1),
    studentId: ANNA.id,
    groupId: null,
    name: 'B2 preparation',
    sizingMode: 'FIXED_COUNT',
    lessonsTotal: 8,
    endDate: null,
    pricePerLessonMinorSnapshot: 50000,
    totalPriceMinorSnapshot: 400000,
    lessonsPerWeek: null,
    validFrom: null,
    transferredFromPackageId: null,
    remainingCredits: 4,
    consumedCredits: 4,
    paidMinor: 400000,
    refundedMinor: 0,
    currency: 'UAH',
    paymentStatus: 'PAID',
    purchasedAt: kyiv(9, 1, 10),
    expiresAt: kyiv(10, 31),
    notes: null,
    student: ANNA,
    group: null,
    teacher: DMYTRO,
    createdAt: kyiv(9, 1, 10),
    updatedAt: kyiv(9, 1, 10),
    deletedAt: null,
    ahead: null,
    pauseExtensions: [],
    ...fields,
  };
}

function ticketPackages(): PackageDetailResponse[] {
  return [
    pkg(1, {
      remainingCredits: 8,
      consumedCredits: 0,
      paidMinor: 0,
      paymentStatus: 'PENDING',
      purchasedAt: kyiv(9, 25, 11),
      ahead: {
        id: STARTER_ID,
        name: 'Starter',
        remainingCredits: 1,
        lastLessonAt: kyiv(9, 28, 17),
      },
    }),
    pkg(2, { paidMinor: 200000, paymentStatus: 'PARTIAL' }),
    pkg(3, { remainingCredits: 0, consumedCredits: 8 }),
    pkg(4, { remainingCredits: 2, consumedCredits: 6, expiresAt: kyiv(9, 21) }),
    pkg(5, {
      remainingCredits: 5,
      consumedCredits: 3,
      expiresAt: kyiv(11, 14),
      pauseExtensions: [
        {
          pauseId: uuid('9a9a9a9a', 7),
          startsAt: kyiv(10, 1),
          endsAt: kyiv(10, 15),
          extendedBySeconds: 14 * 24 * 60 * 60,
        },
      ],
    }),
    // Unused and unpaid: the one package that can be deleted (board 03, state 07).
    pkg(9, {
      name: 'Starter',
      lessonsTotal: 4,
      remainingCredits: 4,
      consumedCredits: 0,
      totalPriceMinorSnapshot: 160000,
      paidMinor: 0,
      paymentStatus: 'PENDING',
      purchasedAt: kyiv(9, 20, 10),
    }),
  ];
}

/** The lessons behind a ticket: 24, 21, 18 (a late cancellation) and 14 September, then earlier. */
function ledgerOf(detail: PackageDetailResponse): CreditEntryResponse[] {
  const days = [24, 21, 18, 14, 11, 7, 4, 1].slice(0, Math.max(detail.consumedCredits, 0));
  const lessons: CreditEntryResponse[] = days.map((day, index) => {
    const startsAt = kyiv(9, day, 17);
    return {
      id: lessonId(index + 1),
      packageId: detail.id,
      lessonId: lessonId(index + 1),
      lesson: {
        id: lessonId(index + 1),
        startsAt,
        durationMin: 60,
        status: day === 18 ? 'CANCELLED_CHARGED' : 'COMPLETED',
      },
      delta: -1,
      type: 'lesson',
      note: null,
      createdAt: startsAt,
    };
  });
  return [
    ...lessons,
    {
      id: uuid('e0e0e0e0', 1),
      packageId: detail.id,
      lessonId: null,
      lesson: null,
      delta: detail.lessonsTotal,
      type: 'purchase',
      note: null,
      createdAt: detail.purchasedAt,
    },
  ];
}

function paymentOf(
  detail: PackageDetailResponse,
  n: number,
  amountMinor: number,
  fields: Partial<PaymentResponse> = {},
): PaymentResponse {
  return {
    id: uuid('fafafafa', n),
    workspaceId: WORKSPACE,
    enrollmentId: detail.enrollmentId,
    packageId: detail.id,
    amountMinor,
    currency: detail.currency,
    method: 'BANK_TRANSFER',
    status: 'PAID',
    provider: 'manual',
    externalId: null,
    paidAt: kyiv(9, 2, 12),
    note: null,
    student: { id: detail.student.id, fullName: detail.student.fullName },
    settledLessons: null,
    createdAt: kyiv(9, 2, 12),
    updatedAt: kyiv(9, 2, 12),
    ...fields,
  };
}

// ---------------------------------------------------------------------------
// The studio's packages (board 04)
// ---------------------------------------------------------------------------

function row(
  n: number,
  who: { fullName: string; avatarKey: PackageResponse['student']['avatarKey'] },
  fields: Partial<PackageDetailResponse>,
): PackageDetailResponse {
  return pkg(n, {
    id: packageId(n),
    studentId: studentId(n),
    enrollmentId: enrollmentId(10 + n),
    student: { id: studentId(n), ...who },
    ...fields,
  });
}

const B1_GROUP = { id: uuid('96969696', 1), name: 'B1 English' };
const KIDS_GROUP = { id: uuid('96969696', 2), name: 'Kids A1' };

function studioPackages(): PackageDetailResponse[] {
  return [
    row(21, ANNA, { remainingCredits: 6, consumedCredits: 2, expiresAt: kyiv(10, 31) }),
    row(
      22,
      { fullName: 'Sofiia Melnyk', avatarKey: 'user-2' },
      {
        teacher: IRYNA,
        remainingCredits: 1,
        consumedCredits: 7,
        pricePerLessonMinorSnapshot: 45000,
        totalPriceMinorSnapshot: 360000,
        paidMinor: 200000,
        paymentStatus: 'PARTIAL',
        expiresAt: kyiv(10, 16),
      },
    ),
    row(
      23,
      { fullName: 'Maksym Tkachenko', avatarKey: 'user-3' },
      {
        teacher: IRYNA,
        group: B1_GROUP,
        groupId: B1_GROUP.id,
        sizingMode: 'BY_PERIOD',
        lessonsTotal: 9,
        remainingCredits: 7,
        consumedCredits: 2,
        pricePerLessonMinorSnapshot: 35000,
        totalPriceMinorSnapshot: 315000,
        paidMinor: 0,
        paymentStatus: 'PENDING',
        validFrom: kyiv(10, 1),
        expiresAt: kyiv(11, 1),
      },
    ),
    row(
      24,
      { fullName: 'Daryna Kravets', avatarKey: 'user-4' },
      {
        teacher: OLEH,
        sizingMode: 'BY_PERIOD_WEEKLY',
        lessonsPerWeek: 3,
        lessonsTotal: 13,
        remainingCredits: 10,
        consumedCredits: 3,
        pricePerLessonMinorSnapshot: 40000,
        totalPriceMinorSnapshot: 520000,
        paidMinor: 520000,
        validFrom: kyiv(10, 1),
        expiresAt: kyiv(11, 1),
      },
    ),
    row(
      25,
      { fullName: 'Mark Petrenko', avatarKey: 'user-5' },
      {
        teacher: { ...OLEH, subjects: ['Польська'] },
        lessonsTotal: 4,
        remainingCredits: 2,
        consumedCredits: 2,
        pricePerLessonMinorSnapshot: 12000,
        totalPriceMinorSnapshot: 48000,
        paidMinor: 48000,
        currency: 'PLN',
        expiresAt: null,
      },
    ),
    row(
      26,
      { fullName: 'Artem Lysenko', avatarKey: 'user-6' },
      {
        remainingCredits: 8,
        consumedCredits: 0,
        paidMinor: 0,
        paymentStatus: 'PENDING',
        purchasedAt: kyiv(9, 24, 10),
        expiresAt: kyiv(11, 21),
      },
    ),
    row(
      27,
      { fullName: 'Yuliia Tkachuk', avatarKey: null },
      {
        teacher: IRYNA,
        group: KIDS_GROUP,
        groupId: KIDS_GROUP.id,
        sizingMode: 'BY_PERIOD',
        remainingCredits: 2,
        consumedCredits: 6,
        pricePerLessonMinorSnapshot: 30000,
        totalPriceMinorSnapshot: 240000,
        validFrom: kyiv(9, 4),
        expiresAt: kyiv(10, 1),
      },
    ),
    row(
      28,
      { fullName: 'Viktoriia Hnatiuk', avatarKey: 'user-7' },
      {
        name: 'Starter',
        lessonsTotal: 4,
        remainingCredits: 0,
        consumedCredits: 4,
        totalPriceMinorSnapshot: 160000,
        paidMinor: 160000,
        expiresAt: kyiv(9, 1),
        purchasedAt: kyiv(8, 1, 10),
      },
    ),
    row(
      29,
      { fullName: 'Oksana Bondarenko', avatarKey: 'user-10' },
      {
        remainingCredits: 2,
        consumedCredits: 6,
        paidMinor: 400000,
        expiresAt: kyiv(9, 20),
        purchasedAt: kyiv(8, 15, 10),
      },
    ),
  ];
}

export type PackagesStoryOptions = {
  packagesStory?: {
    /** The studio's packages; `empty` has none, `pending` and `error` hold or fail the read. */
    list?: 'ready' | 'empty' | 'pending' | 'error';
    /** Every write, for the interaction tests. */
    onWrite?: (write: { method: string; path: string; body: unknown }) => void;
  };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const THRESHOLD = 2;

/** Lessons Anna's Monday and Friday schedule has in a window. */
function scheduleLessons(from: Date, until: Date): number {
  let count = 0;
  for (let day = new Date(from); day < until; day = new Date(day.getTime() + 86_400_000)) {
    const weekday = new Date(day.getTime() + 3 * 3_600_000).getUTCDay();
    if (weekday === 1 || weekday === 5) count += 1;
  }
  return count;
}

type SaleBody = {
  sizingMode: PackageResponse['sizingMode'];
  lessonsTotal?: number;
  lessonsPerWeek?: number;
  validFrom?: string;
  endDate?: string;
  expiresAt?: string | null;
  pricePerLessonMinor?: number;
  totalPriceMinor?: number;
};

/** What a sale would be: the count, the schedule's lessons for a period, a weekly count, the price. */
function previewOf(body: SaleBody): PackagePreviewResponse {
  const from = body.validFrom ? new Date(body.validFrom) : null;
  const until = body.endDate ? new Date(Date.parse(body.endDate) + 1) : null;
  const fromSchedule = from && until ? scheduleLessons(from, until) : null;
  const lessons =
    body.sizingMode === 'FIXED_COUNT'
      ? (body.lessonsTotal ?? 1)
      : body.sizingMode === 'BY_PERIOD'
        ? (body.lessonsTotal ?? fromSchedule ?? 1)
        : from && until
          ? weeksInPeriod(from, until) * (body.lessonsPerWeek ?? 1)
          : 1;
  const perLesson =
    body.pricePerLessonMinor ?? Math.round((body.totalPriceMinor ?? 0) / Math.max(lessons, 1));
  return {
    lessonsTotal: lessons,
    pricePerLessonMinor: perLesson,
    totalPriceMinor: body.totalPriceMinor ?? perLesson * lessons,
    validFrom: body.validFrom ?? null,
    expiresAt: until ? until.toISOString() : (body.expiresAt ?? null),
    scheduleLessons: body.sizingMode === 'BY_PERIOD' ? fromSchedule : null,
    debtLessons: 0,
    ahead: { id: BILLING_PACKAGES[0]!.id, name: 'B2 preparation' },
  };
}

/**
 * Answers the package reads and writes of the S07 stories, or null for
 * anything else (and for everything when the story is not a package story).
 */
export function createPackagesRoutes(options: PackagesStoryOptions) {
  const scenario = options.packagesStory;
  const packages = [...ticketPackages(), ...studioPackages()];
  const billing = BILLING_PACKAGES.map((item) =>
    pkg(0, { ...item, ahead: null, pauseExtensions: [] }),
  );
  const payments: PaymentResponse[] = [];
  for (const item of packages) {
    if (item.paidMinor > 0) payments.push(paymentOf(item, payments.length + 1, item.paidMinor));
  }
  let sold = 0;

  const find = (id: string) =>
    packages.find((item) => item.id === id) ?? billing.find((item) => item.id === id);
  const restate = (item: PackageDetailResponse) => {
    const owed = item.totalPriceMinorSnapshot - item.refundedMinor - item.paidMinor;
    item.paymentStatus = owed <= 0 ? 'PAID' : item.paidMinor > 0 ? 'PARTIAL' : 'PENDING';
  };

  return async (
    path: string,
    method: string,
    query: URLSearchParams,
    readBody: () => unknown,
  ): Promise<Response | null> => {
    if (!scenario) return null;
    const write = (body: unknown = null) => scenario.onWrite?.({ method, path, body });
    const never = () => new Promise<Response>(() => undefined);

    if (
      path === '/packages' &&
      method === 'GET' &&
      !query.get('studentId') &&
      !query.get('groupId')
    ) {
      if (scenario.list === 'pending') return never();
      if (scenario.list === 'error') return json({ code: 'UNEXPECTED' }, 500);
      const now = new Date(PACKAGES_CLOCK);
      const all = scenario.list === 'empty' ? [] : studioPackages();
      const search = query.get('search')?.toLowerCase();
      const filtered = all.filter(
        (item) =>
          (!search ||
            [item.student.fullName, item.name ?? '', item.group?.name ?? ''].some((value) =>
              value.toLowerCase().includes(search),
            )) &&
          (!query.get('teacherId') || item.teacher.id === query.get('teacherId')) &&
          (!query.get('sizingMode') || item.sizingMode === query.get('sizingMode')),
      );
      const tabs = (item: PackageResponse) => {
        const window = {
          remainingCredits: item.remainingCredits,
          expiresAt: item.expiresAt ? new Date(item.expiresAt) : null,
        };
        const lifecycle = packageLifecycle(window, now);
        return {
          ACTIVE: lifecycle === 'active',
          ENDING: isPackageEnding(window, now, THRESHOLD),
          UNPAID: item.paymentStatus !== 'PAID',
          FINISHED: lifecycle !== 'active',
        };
      };
      const status = query.get('status') as keyof ReturnType<typeof tabs> | null;
      const shown = filtered.filter((item) => !status || tabs(item)[status]);
      if (query.get('sort') === 'ending') {
        const byEnd = compareEndingFirst(now, THRESHOLD);
        shown.sort((a, b) =>
          byEnd(
            {
              ...a,
              expiresAt: a.expiresAt ? new Date(a.expiresAt) : null,
              purchasedAt: new Date(a.purchasedAt),
            },
            {
              ...b,
              expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
              purchasedAt: new Date(b.purchasedAt),
            },
          ),
        );
      }
      const count = (tab: 'ACTIVE' | 'ENDING' | 'UNPAID' | 'FINISHED') =>
        filtered.filter((item) => tabs(item)[tab]).length;
      const owed = new Map<string, { amountMinor: number; packages: number }>();
      for (const item of filtered.filter((entry) => tabs(entry).UNPAID)) {
        const sum = owed.get(item.currency) ?? { amountMinor: 0, packages: 0 };
        owed.set(item.currency, {
          amountMinor: sum.amountMinor + item.totalPriceMinorSnapshot - item.paidMinor,
          packages: sum.packages + 1,
        });
      }
      const pageSize = Number(query.get('pageSize') ?? 20);
      const pageNumber = Number(query.get('page') ?? 1);
      return json({
        items: shown.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
        page: pageNumber,
        pageSize,
        total: shown.length,
        totalPages: Math.max(1, Math.ceil(shown.length / pageSize)),
        counts: {
          active: count('ACTIVE'),
          ending: count('ENDING'),
          unpaid: count('UNPAID'),
          finished: count('FINISHED'),
          all: filtered.length,
        },
        owed: [...owed.entries()].map(([currency, sum]) => ({ currency, ...sum })),
        lowCreditThreshold: THRESHOLD,
      } as PackageListResponse);
    }

    if (path === '/packages/preview' && method === 'POST') {
      return json(previewOf(readBody() as SaleBody));
    }

    if (path === '/packages' && method === 'POST') {
      const body = readBody() as Record<string, unknown>;
      write(body);
      sold += 1;
      const preview = previewOf(body as SaleBody);
      const created = pkg(40 + sold, {
        name: null,
        sizingMode: body.sizingMode as PackageResponse['sizingMode'],
        lessonsTotal: preview.lessonsTotal,
        remainingCredits: preview.lessonsTotal,
        consumedCredits: 0,
        pricePerLessonMinorSnapshot: preview.pricePerLessonMinor,
        totalPriceMinorSnapshot: preview.totalPriceMinor,
        paidMinor: 0,
        paymentStatus: 'PENDING',
        validFrom: preview.validFrom,
        expiresAt: preview.expiresAt,
        purchasedAt: new Date(PACKAGES_CLOCK).toISOString(),
      });
      packages.push(created);
      return json(created, 201);
    }

    const detailMatch = path.match(/^\/packages\/([^/]+)$/);
    if (detailMatch && method === 'GET') {
      const found = find(detailMatch[1]!);
      return found ? json(found) : json({ code: 'PACKAGE_NOT_FOUND' }, 404);
    }
    if (detailMatch && method === 'DELETE') {
      const found = find(detailMatch[1]!);
      write();
      if (!found) return new Response(null, { status: 204 });
      if (found.consumedCredits > 0 || payments.some((row) => row.packageId === found.id)) {
        return json({ code: 'PACKAGE_IN_USE', details: { charges: found.consumedCredits } }, 409);
      }
      found.deletedAt = new Date(PACKAGES_CLOCK).toISOString();
      return new Response(null, { status: 204 });
    }
    const ledgerMatch = path.match(/^\/packages\/([^/]+)\/ledger$/);
    if (ledgerMatch) {
      const found = find(ledgerMatch[1]!);
      return found
        ? json({ items: ledgerOf(found), balance: found.remainingCredits })
        : json({ code: 'PACKAGE_NOT_FOUND' }, 404);
    }
    if (path === '/payments' && method === 'GET' && query.get('packageId')) {
      const items = payments.filter((row) => row.packageId === query.get('packageId'));
      return json({ items, page: 1, pageSize: 100, total: items.length, totalPages: 1 });
    }
    if (path === '/payments' && method === 'POST') {
      const body = readBody() as { packageId?: string; amountMinor: number; paidAt?: string };
      const found = body.packageId ? find(body.packageId) : undefined;
      if (!found) return null;
      write(body);
      const owed = found.totalPriceMinorSnapshot - found.refundedMinor - found.paidMinor;
      if (body.amountMinor > owed) return json({ code: 'OVERPAYMENT' }, 409);
      const created = paymentOf(found, payments.length + 1, body.amountMinor, {
        paidAt: body.paidAt ?? new Date(PACKAGES_CLOCK).toISOString(),
      });
      payments.push(created);
      found.paidMinor += body.amountMinor;
      restate(found);
      return json(created, 201);
    }

    const operation = path.match(/^\/packages\/([^/]+)\/(extend|transfer|refund|adjust)$/);
    if (operation && method === 'POST') {
      const found = find(operation[1]!);
      if (!found) return json({ code: 'PACKAGE_NOT_FOUND' }, 404);
      const body = readBody() as Record<string, unknown>;
      write(body);
      if (operation[2] === 'extend') {
        found.expiresAt = String(body.expiresAt);
      }
      if (operation[2] === 'adjust') {
        found.remainingCredits += Number(body.delta);
      }
      if (operation[2] === 'refund') {
        found.remainingCredits -= Number(body.credits);
        found.refundedMinor += Number(body.amountMinor);
        found.paidMinor -= Number(body.amountMinor);
        restate(found);
      }
      if (operation[2] === 'transfer') {
        const credits = Number(body.credits ?? found.remainingCredits);
        const moved = transferCredits(credits, found.pricePerLessonMinorSnapshot, 35000);
        found.remainingCredits -= credits;
        const target = pkg(60, {
          name: found.name,
          enrollmentId: String(body.toEnrollmentId),
          lessonsTotal: moved.lessons,
          remainingCredits: moved.lessons,
          consumedCredits: 0,
          totalPriceMinorSnapshot: 0,
          paidMinor: 0,
          transferredFromPackageId: found.id,
        });
        packages.push(target);
        return json(
          {
            source: found,
            target,
            valueMinor: moved.valueMinor,
            remainderMinor: moved.remainderMinor,
          },
          201,
        );
      }
      return json(found, 201);
    }
    return null;
  };
}
