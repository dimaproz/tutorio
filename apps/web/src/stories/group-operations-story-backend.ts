import type {
  GroupBillingResponse,
  MemberSalePreviewResponse,
  PackageResponse,
  ScheduleChangePreview,
  ScheduleResponse,
  SellToMembersDto,
} from '@tutorio/validation';
import {
  enrollmentId,
  kyiv,
  member,
  PLANNED_FROM,
  storyGroupId,
  studentId,
  TEACHERS,
  WORKSPACE,
} from './group-story-backend';

/**
 * The S08 fixture of the B2 group (handoff section 1): each member's billing,
 * the group's schedule and what a sale to members answers.
 *
 * | Member            | Billing                                            |
 * | Artem Lysenko     | Pays per lesson, owes 800 ₴ for 2 lessons          |
 * | Anna Shevchenko   | Package 2 of 8, running low                        |
 * | Denys Koval       | Package 5 of 8, 1 600 of 3 200 ₴ paid              |
 * | Sofiia Melnyk     | Pays per lesson, no package                        |
 * | Mark Shevchenko   | Package 6 of 8, own price 350 ₴                    |
 * | Kateryna Shevchuk | Paused until 4 October, package 3 of 8 waiting     |
 */

const DAY = 24 * 60 * 60 * 1000;
export const B2_SCHEDULE_ID = '12121212-1212-4121-8121-000000000101';
const SERIES_ID = '12121212-1212-4121-8121-000000000102';
/** The studio's midnight after a day of 2026 (month 1-based): a package's exclusive end. */
const endOf = (month: number, day: number) =>
  new Date(Date.UTC(2026, month - 1, day, 21)).toISOString();

type Billing = GroupBillingResponse['members'][number];

const balance = (debtMinor = 0, unpaidLessons = 0): Billing['balance'] => ({
  chargedMinor: debtMinor,
  paidMinor: 0,
  debtMinor,
  advanceMinor: 0,
  unpaidLessons,
  unpaid: Array.from({ length: unpaidLessons }, (_, index) => ({
    lessonId: `88888888-8888-4888-9001-${String(900 + index).padStart(12, '0')}`,
    startsAt: kyiv(-8 + index * 2, 17),
    outstandingMinor: debtMinor / Math.max(unpaidLessons, 1),
  })),
});

function pkg(
  n: number,
  {
    left,
    total = 8,
    expiresAt,
    priceMinor = 40000,
    paidMinor,
  }: { left: number; total?: number; expiresAt: string; priceMinor?: number; paidMinor?: number },
): Billing['packages'][number] {
  const totalMinor = priceMinor * total;
  const paid = paidMinor ?? totalMinor;
  return {
    id: `77777777-7777-4777-8777-${String(800 + n).padStart(12, '0')}`,
    name: 'B2 prep · вересень',
    purchasedAt: '2026-09-01T10:00:00.000Z',
    expiresAt,
    validFrom: null,
    lessonsTotal: total,
    remainingCredits: left,
    usable: true,
    totalPriceMinor: totalMinor,
    paidMinor: paid,
    paymentStatus: paid >= totalMinor ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING',
  };
}

/** How each member pays the group (`GET /groups/:id/billing`). */
export function b2Billing(members: readonly number[]): GroupBillingResponse {
  const row = (n: number, patch: Partial<Billing>): Billing => ({
    enrollmentId: enrollmentId(1, n),
    studentId: studentId(n),
    billingType: 'PACKAGE',
    rateMinor: 40000,
    currency: 'UAH',
    packages: [],
    creditsLeft: 0,
    debtLessons: 0,
    balance: balance(),
    warning: null,
    pause: null,
    ...patch,
  });
  const rows: Record<number, Billing> = {
    5: row(5, { billingType: 'PER_LESSON', balance: balance(80000, 2) }),
    1: row(1, {
      packages: [pkg(1, { left: 2, expiresAt: endOf(9, 30) })],
      creditsLeft: 2,
      warning: 'LOW_CREDITS',
    }),
    10: row(10, {
      packages: [pkg(10, { left: 5, expiresAt: endOf(10, 20), paidMinor: 160000 })],
      creditsLeft: 5,
    }),
    2: row(2, { billingType: 'PER_LESSON' }),
    11: row(11, {
      rateMinor: 35000,
      packages: [pkg(11, { left: 6, expiresAt: endOf(10, 20), priceMinor: 35000 })],
      creditsLeft: 6,
    }),
    7: row(7, {
      packages: [pkg(7, { left: 3, expiresAt: endOf(11, 12) })],
      creditsLeft: 3,
      pause: { startsAt: '2026-09-01T09:00:00.000Z', endsAt: endOf(10, 4) },
    }),
  };
  return {
    groupId: storyGroupId(1),
    lowCreditThreshold: 2,
    members: members.flatMap((n) => (rows[n] ? [rows[n]] : [])),
  };
}

/** Whether a member pays the group per lesson (Artem and Sofiia). */
export const paysPerLesson = (n: number) => n === 5 || n === 2;

/** The B2 group's schedule: Tuesday and Thursday at 17:00, and the planned move to 18:00. */
export function b2Schedule(
  planned: boolean,
  memberCount: number,
  stopsAt: string | null = null,
): ScheduleResponse {
  return {
    id: B2_SCHEDULE_ID,
    workspaceId: WORKSPACE,
    enrollmentId: null,
    groupId: storyGroupId(1),
    teacherId: TEACHERS.dmytro.id,
    timezone: 'Europe/Kyiv',
    durationMin: 60,
    horizonWeeks: 4,
    endsAt: stopsAt,
    state: 'ACTIVE',
    slots: [
      { weekday: 2, localTime: '17:00', seriesId: SERIES_ID },
      { weekday: 4, localTime: '17:00', seriesId: SERIES_ID },
    ],
    nextChange: planned
      ? {
          effectiveFrom: PLANNED_FROM,
          slots: [
            { weekday: 2, localTime: '18:00' },
            { weekday: 4, localTime: '18:00' },
          ],
        }
      : null,
    nextLessonAt: kyiv(1, 17),
    startsAt: '2026-06-01T14:00:00.000Z',
    lastLessonAt: kyiv(42, 17),
    student: null,
    group: { id: storyGroupId(1), name: 'B2 prep · evening', memberCount },
    teacher: { id: TEACHERS.dmytro.id, name: TEACHERS.dmytro.name },
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
  };
}

/** What a change, a stop or a cancelled change did, for the dialogs' result. */
export function changeSummary(effectiveFrom: string, removed = 0): ScheduleChangePreview {
  return {
    effectiveFrom,
    moved: 0,
    unchanged: 0,
    created: 0,
    removed,
    kept: 0,
    notesLost: [],
    conflicts: [],
    moves: [],
    removals: [],
    creates: [],
    keptLessons: [],
  };
}

/** The Tuesdays and Thursdays of `[from, until)`: a period package's lessons from the schedule. */
function scheduleLessonsIn(from: string, until: string): number {
  let count = 0;
  for (let at = Date.parse(from) + 12 * 60 * 60 * 1000; at < Date.parse(until); at += DAY) {
    const weekday = new Date(at).getUTCDay();
    if (weekday === 2 || weekday === 4) count += 1;
  }
  return count;
}

/** The sale's size and window, as the API plans it. */
function planOf(body: SellToMembersDto) {
  const period = body.sizingMode !== 'FIXED_COUNT';
  const validFrom = period ? (body.validFrom ?? kyiv(0, 12)) : null;
  const expiresAt = period
    ? body.endDate
      ? new Date(Date.parse(body.endDate) + 1).toISOString()
      : null
    : (body.expiresAt ?? null);
  const scheduleLessons =
    body.sizingMode === 'BY_PERIOD' && validFrom && expiresAt
      ? scheduleLessonsIn(validFrom, expiresAt)
      : null;
  const lessonsTotal =
    body.lessonsTotal ??
    scheduleLessons ??
    (validFrom && expiresAt
      ? Math.round(
          ((Date.parse(expiresAt) - Date.parse(validFrom)) / (7 * DAY)) *
            (body.lessonsPerWeek ?? 1),
        )
      : 0);
  return { validFrom, expiresAt, scheduleLessons, lessonsTotal };
}

/** One member's price and total, at their own rate when the sale names one. */
function priceOf(body: SellToMembersDto, id: string, lessons: number) {
  const own = body.prices?.find((price) => price.studentId === id);
  const perLesson =
    own?.pricePerLessonMinor ??
    body.pricePerLessonMinor ??
    Math.round((body.totalPriceMinor ?? 0) / Math.max(lessons, 1));
  const total =
    own || body.totalPriceMinor === undefined ? perLesson * lessons : body.totalPriceMinor;
  return { perLesson, total };
}

const memberN = (id: string) => Number(id.slice(-12));

/** `POST /packages/members/preview`: every member's line. */
export function memberSalePreview(
  body: SellToMembersDto,
  billing: GroupBillingResponse,
): MemberSalePreviewResponse {
  const plan = planOf(body);
  return {
    validFrom: plan.validFrom,
    expiresAt: plan.expiresAt,
    items: body.studentIds.map((id) => {
      const row = billing.members.find((item) => item.studentId === id);
      const price = priceOf(body, id, plan.lessonsTotal);
      const live = row?.packages.find((item) => item.usable && item.remainingCredits > 0);
      return {
        studentId: id,
        lessonsTotal: plan.lessonsTotal,
        pricePerLessonMinor: price.perLesson,
        totalPriceMinor: price.total,
        validFrom: plan.validFrom,
        expiresAt: plan.expiresAt,
        scheduleLessons: plan.scheduleLessons,
        debtLessons: owedOf(row, plan.lessonsTotal),
        ahead: live ? { id: live.id, name: live.name } : null,
        pause: row?.pause ?? null,
      };
    }),
  };
}

/**
 * The owed lessons a new package pays for first, up to its size: on debt and
 * unpaid per lesson (L-82, L-91).
 */
function owedOf(row: Billing | undefined, lessons: number): number {
  return row ? Math.min(row.debtLessons + row.balance.unpaidLessons, lessons) : 0;
}

/** `POST /packages/members`: one new package per member; each closes the member's owed lessons. */
export function soldToMembers(
  body: SellToMembersDto,
  billing: GroupBillingResponse,
): PackageResponse[] {
  const plan = planOf(body);
  return body.studentIds.map((id) => {
    const n = memberN(id);
    const price = priceOf(body, id, plan.lessonsTotal);
    const covered = owedOf(
      billing.members.find((item) => item.studentId === id),
      plan.lessonsTotal,
    );
    return {
      id: `77777777-7777-4777-8777-${String(900 + n).padStart(12, '0')}`,
      workspaceId: WORKSPACE,
      enrollmentId: enrollmentId(1, n),
      studentId: id,
      groupId: storyGroupId(1),
      name: body.name ?? null,
      sizingMode: body.sizingMode,
      lessonsTotal: plan.lessonsTotal,
      lessonsPerWeek: body.lessonsPerWeek ?? null,
      validFrom: plan.validFrom,
      transferredFromPackageId: null,
      endDate: body.endDate ?? null,
      pricePerLessonMinorSnapshot: price.perLesson,
      totalPriceMinorSnapshot: price.total,
      remainingCredits: plan.lessonsTotal - covered,
      consumedCredits: covered,
      paidMinor: 0,
      refundedMinor: 0,
      currency: body.currency,
      paymentStatus: 'PENDING',
      purchasedAt: kyiv(0, 12),
      expiresAt: plan.expiresAt,
      notes: null,
      student: { id, fullName: member(n).fullName, avatarKey: null },
      group: { id: storyGroupId(1), name: 'B2 prep · evening' },
      teacher: {
        id: TEACHERS.dmytro.id,
        name: TEACHERS.dmytro.name,
        avatarKey: null,
        subjects: ['English'],
      },
      createdAt: kyiv(0, 12),
      updatedAt: kyiv(0, 12),
      deletedAt: null,
    };
  });
}
