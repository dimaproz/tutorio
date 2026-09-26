import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ATTENTION_PREVIEW,
  DUE_FORECAST_DAYS,
  EXPIRY_WARNING_DAYS,
  OPEN_PAUSE_DAYS,
  PAUSE_RETURN_DAYS,
  creditBalance,
  debtorsOf,
  dueForecast,
  expectsRenewal,
  expiresUnused,
  pauseAttention,
  receivedTotals,
  studioPeriods,
  summaryNames,
  type AttentionKind,
  type DebtEntry,
  type DueSource,
} from '@tutorio/domain';
import type {
  AttentionCategory,
  AttentionItem,
  AvatarKeyDto,
  CurrencyCodeDto,
  DashboardAttentionQueryDto,
  DashboardAttentionResponse,
  DashboardMoneyResponse,
  DashboardSetupResponse,
} from '@tutorio/validation';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BillingReadsService } from '../billing/billing-reads.service';
import { packageInclude, packageMoney } from '../packages/packages.shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  needsMakeupWhere,
  unconfirmedAttendanceWhere,
} from '../scheduling/scheduling.shared';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Rows read per category: the preview plus enough for a two-name summary. */
const CATEGORY_READ = 10;

const studentSelect = { id: true, fullName: true, avatarKey: true } as const;
const teacherSelect = { id: true, fullName: true, color: true } as const;
const groupSelect = { id: true, name: true } as const;

type StudentRow = { id: string; fullName: string; avatarKey: string | null };
type TeacherRow = { id: string; fullName: string; color: string | null };

const packageSelect = {
  id: true,
  name: true,
  currency: true,
  enrollmentId: true,
  totalPriceMinorSnapshot: true,
  expiresAt: true,
  purchasedAt: true,
  student: { select: studentSelect },
  enrollment: {
    select: {
      group: { select: groupSelect },
      teacher: { select: teacherSelect },
    },
  },
  creditEntries: packageInclude.creditEntries,
  _count: packageInclude._count,
  payments: packageInclude.payments,
} satisfies Prisma.LessonPackageSelect;

type PackageRow = Prisma.LessonPackageGetPayload<{
  select: typeof packageSelect;
}>;

function person(row: StudentRow): NonNullable<AttentionItem['student']> {
  return {
    id: row.id,
    fullName: row.fullName,
    avatarKey: row.avatarKey as AvatarKeyDto | null,
  };
}

function teacherRef(row: TeacherRow): NonNullable<AttentionItem['teacher']> {
  return { id: row.id, name: row.fullName, color: row.color };
}

function blankItem(id: string): AttentionItem {
  return {
    id,
    student: null,
    group: null,
    teacher: null,
    enrollmentId: null,
    lesson: null,
    debt: null,
    package: null,
    credits: null,
    pause: null,
  };
}

function category(
  kind: AttentionKind,
  count: number,
  rows: AttentionItem[],
): AttentionCategory {
  return {
    kind,
    count,
    items: rows.slice(0, ATTENTION_PREVIEW),
    names: summaryNames(
      rows.map((row) => row.group?.name ?? row.student?.fullName ?? ''),
    ).filter(Boolean),
  };
}

/** A package's money and credits as the dashboard reads them. */
function packageFigures(row: PackageRow) {
  const money = packageMoney(row.totalPriceMinorSnapshot, row.payments);
  const totalMinor = row.totalPriceMinorSnapshot - money.refundedMinor;
  return {
    totalMinor,
    paidMinor: money.paidMinor,
    owedMinor: Math.max(0, totalMinor - money.paidMinor),
    paymentStatus: money.paymentStatus,
    remainingCredits: creditBalance(row.creditEntries) - row._count.charges,
  };
}

function packageItem(row: PackageRow): AttentionItem {
  const figures = packageFigures(row);
  return {
    ...blankItem(row.id),
    student: person(row.student),
    group: row.enrollment.group,
    teacher: teacherRef(row.enrollment.teacher),
    enrollmentId: row.enrollmentId,
    package: {
      id: row.id,
      name: row.name,
      currency: row.currency as CurrencyCodeDto,
      totalMinor: figures.totalMinor,
      paidMinor: figures.paidMinor,
      remainingCredits: figures.remainingCredits,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    },
  };
}

/**
 * The owner's Today dashboard (S11): «Гроші за місяць», «Потребує уваги» and
 * the first-run checklist, each its own read. The rules live in
 * `@tutorio/domain` (dashboard); this service reads the rows.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingReads: BillingReadsService,
  ) {}

  /** The studio's money this month, per currency; never scoped to a teacher. */
  async money(auth: AuthenticatedUser): Promise<DashboardMoneyResponse> {
    const now = new Date();
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: auth.workspaceId },
      select: { timezone: true, defaultCurrency: true },
    });
    const periods = studioPeriods(now, workspace.timezone);
    const [payments, debts, due] = await Promise.all([
      this.prisma.payment.findMany({
        where: {
          workspaceId: auth.workspaceId,
          deletedAt: null,
          status: { in: ['PAID', 'REFUNDED'] },
          paidAt: { gte: periods.monthStart, lt: periods.monthEnd },
        },
        select: {
          amountMinor: true,
          currency: true,
          status: true,
          paidAt: true,
        },
      }),
      this.debtEntries(auth.workspaceId, undefined, now),
      this.dueSources(auth.workspaceId, now),
    ]);
    const received = receivedTotals(
      payments.map((payment) => ({
        ...payment,
        status: payment.status as 'PAID' | 'REFUNDED',
      })),
      periods,
    );
    const debt = debtorsOf(debts).totals;
    const expected = dueForecast(due);
    const currencies = [
      ...new Set([
        workspace.defaultCurrency,
        ...[...received, ...debt, ...expected]
          .map((row) => row.currency)
          .sort(),
      ]),
    ];
    return {
      month: periods.today.slice(0, 7) + '-01',
      currencies: currencies.map((currency) => {
        const got = received.find((row) => row.currency === currency);
        const owed = debt.find((row) => row.currency === currency);
        const soon = expected.find((row) => row.currency === currency);
        return {
          currency: currency as CurrencyCodeDto,
          receivedMonthMinor: got?.monthMinor ?? 0,
          receivedTodayMinor: got?.todayMinor ?? 0,
          debtMinor: owed?.amountMinor ?? 0,
          debtors: owed?.students ?? 0,
          dueMinor: soon?.amountMinor ?? 0,
          duePackages: soon?.packages ?? 0,
        };
      }),
    };
  }

  /** «Потребує уваги»: the seven categories in their fixed order. */
  async attention(
    auth: AuthenticatedUser,
    query: DashboardAttentionQueryDto,
  ): Promise<DashboardAttentionResponse> {
    const now = new Date();
    const teacherId = query.teacherId;
    const categories = await Promise.all([
      this.lessonCategory(
        auth,
        'attendance',
        unconfirmedAttendanceWhere(now),
        teacherId,
      ),
      this.lessonCategory(auth, 'makeups', needsMakeupWhere, teacherId),
      this.debtorCategory(auth, teacherId, now),
      this.unpaidPackageCategory(auth, teacherId),
      this.endingCategory(auth, teacherId),
      this.expiringCategory(auth, teacherId, now),
      this.pauseCategory(auth, teacherId, now),
    ]);
    return {
      teacherId: teacherId ?? null,
      total: categories.reduce((sum, row) => sum + row.count, 0),
      categories,
    };
  }

  /** Which first-run steps the studio's data already ticks. */
  async setup(auth: AuthenticatedUser): Promise<DashboardSetupResponse> {
    const workspaceId = auth.workspaceId;
    const exists = async (count: Promise<number>) => (await count) > 0;
    const [workspace, colleague, student, schedule, lesson, pkg, payment] =
      await Promise.all([
        this.prisma.workspace.findUniqueOrThrow({
          where: { id: workspaceId },
          select: { mode: true },
        }),
        exists(
          this.prisma.teacher.count({
            where: {
              workspaceId,
              deletedAt: null,
              status: 'ACTIVE',
              OR: [
                { workspaceMemberId: null },
                { workspaceMember: { userId: { not: auth.userId } } },
              ],
            },
            take: 1,
          }),
        ),
        exists(
          this.prisma.student.count({
            where: { workspaceId, deletedAt: null },
            take: 1,
          }),
        ),
        exists(this.prisma.schedule.count({ where: { workspaceId }, take: 1 })),
        exists(
          this.prisma.lesson.count({
            where: { workspaceId, deletedAt: null },
            take: 1,
          }),
        ),
        exists(
          this.prisma.lessonPackage.count({
            where: { workspaceId, deletedAt: null },
            take: 1,
          }),
        ),
        exists(
          this.prisma.payment.count({
            where: { workspaceId, deletedAt: null },
            take: 1,
          }),
        ),
      ]);
    return {
      teacher: workspace.mode === 'SCHOOL' ? colleague : null,
      student,
      schedule: schedule || lesson,
      sale: pkg || payment,
    };
  }

  /** Unconfirmed attendance and missing makeups: the most recent lessons first. */
  private async lessonCategory(
    auth: AuthenticatedUser,
    kind: AttentionKind,
    where: Prisma.LessonWhereInput,
    teacherId: string | undefined,
  ): Promise<AttentionCategory> {
    const full: Prisma.LessonWhereInput = {
      AND: [
        {
          workspaceId: auth.workspaceId,
          deletedAt: null,
          ...(teacherId ? { teacherId } : {}),
        },
        where,
      ],
    };
    const [count, rows] = await Promise.all([
      this.prisma.lesson.count({ where: full }),
      this.prisma.lesson.findMany({
        where: full,
        orderBy: [{ startsAtUtc: 'desc' }, { id: 'desc' }],
        take: CATEGORY_READ,
        select: {
          id: true,
          startsAtUtc: true,
          status: true,
          cancelledBy: true,
          enrollmentId: true,
          group: { select: groupSelect },
          teacher: { select: teacherSelect },
          enrollment: { select: { student: { select: studentSelect } } },
        },
      }),
    ]);
    return category(
      kind,
      count,
      rows.map((row) => ({
        ...blankItem(row.id),
        student: row.enrollment ? person(row.enrollment.student) : null,
        group: row.group,
        teacher: teacherRef(row.teacher),
        enrollmentId: row.enrollmentId,
        lesson: {
          id: row.id,
          startsAtUtc: row.startsAtUtc.toISOString(),
          status: row.status,
          cancelledBy: row.cancelledBy,
        },
      })),
    );
  }

  /**
   * What students owe now (L-82, L-90): each lesson held on debt at its
   * price, and each pay-per-lesson direction's debt.
   */
  private async debtEntries(
    workspaceId: string,
    teacherId: string | undefined,
    now: Date,
  ): Promise<DebtEntry[]> {
    const [debts, balances] = await Promise.all([
      this.prisma.lessonCharge.findMany({
        where: {
          workspaceId,
          voidedAt: null,
          source: 'DEBT',
          enrollment: {
            student: { deletedAt: null },
            ...(teacherId ? { teacherId } : {}),
          },
        },
        select: {
          amountMinor: true,
          currency: true,
          enrollmentId: true,
          enrollment: { select: { studentId: true } },
          lesson: { select: { startsAtUtc: true } },
        },
      }),
      this.billingReads.balanceDebts(this.prisma, workspaceId, teacherId),
    ]);
    return [
      ...debts.map((charge) => ({
        studentId: charge.enrollment.studentId,
        currency: charge.currency,
        amountMinor: charge.amountMinor,
        lessons: 1,
        oldestAt: charge.lesson.startsAtUtc,
        enrollmentId: charge.enrollmentId,
      })),
      ...balances.map((balance) => ({
        studentId: balance.studentId,
        currency: balance.currency,
        amountMinor: balance.debtMinor,
        lessons: balance.unpaid.length,
        oldestAt: balance.unpaid[0]?.lessonAt ?? now,
        enrollmentId: balance.enrollmentId,
      })),
    ];
  }

  private async debtorCategory(
    auth: AuthenticatedUser,
    teacherId: string | undefined,
    now: Date,
  ): Promise<AttentionCategory> {
    const { rows } = debtorsOf(
      await this.debtEntries(auth.workspaceId, teacherId, now),
    );
    const shown = rows.slice(0, CATEGORY_READ);
    const students = await this.prisma.student.findMany({
      where: { id: { in: shown.map((row) => row.studentId) } },
      select: studentSelect,
    });
    const byId = new Map(students.map((row) => [row.id, row]));
    return category(
      'debtors',
      rows.length,
      shown.flatMap((row) => {
        const student = byId.get(row.studentId);
        return student
          ? [
              {
                ...blankItem(`${row.studentId}:${row.currency}`),
                student: person(student),
                enrollmentId: row.enrollmentId ?? null,
                debt: {
                  amountMinor: row.amountMinor,
                  currency: row.currency as CurrencyCodeDto,
                  lessons: row.lessons,
                },
              },
            ]
          : [];
      }),
    );
  }

  /** Live packages of live students, optionally of one teacher's directions. */
  private livePackages(
    workspaceId: string,
    teacherId: string | undefined,
    where: Prisma.LessonPackageWhereInput,
    orderBy: Prisma.LessonPackageOrderByWithRelationInput[],
  ): Promise<PackageRow[]> {
    return this.prisma.lessonPackage.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        student: { deletedAt: null },
        ...(teacherId ? { enrollment: { teacherId } } : {}),
        ...where,
      },
      orderBy,
      select: packageSelect,
    });
  }

  /** Sold packages not paid in full (L-87), the oldest sale first. */
  private async unpaidPackages(
    workspaceId: string,
    teacherId: string | undefined,
  ): Promise<PackageRow[]> {
    const rows = await this.livePackages(
      workspaceId,
      teacherId,
      // The stored status is a filter cache; the money decides below.
      { paymentStatus: { not: 'PAID' } },
      [{ purchasedAt: 'asc' }, { id: 'asc' }],
    );
    return rows.filter((row) => packageFigures(row).owedMinor > 0);
  }

  private async unpaidPackageCategory(
    auth: AuthenticatedUser,
    teacherId: string | undefined,
  ): Promise<AttentionCategory> {
    const rows = await this.unpaidPackages(auth.workspaceId, teacherId);
    return category(
      'unpaidPackages',
      rows.length,
      rows.slice(0, CATEGORY_READ).map(packageItem),
    );
  }

  /**
   * Directions running out of credits: none left, or no more than the studio
   * threshold (L-82, L-120). A direction on debt is a debtor instead.
   */
  private async endingCategory(
    auth: AuthenticatedUser,
    teacherId: string | undefined,
  ): Promise<AttentionCategory> {
    const { items } = await this.billingReads.listCreditWarnings(auth);
    const rows = items.filter(
      (item) =>
        item.warning !== 'ON_DEBT' &&
        (!teacherId || item.teacher.id === teacherId),
    );
    const shown = rows.slice(0, CATEGORY_READ);
    const directions = await this.prisma.enrollment.findMany({
      where: { id: { in: shown.map((row) => row.enrollmentId) } },
      select: {
        id: true,
        student: { select: studentSelect },
        teacher: { select: teacherSelect },
      },
    });
    const byId = new Map(directions.map((row) => [row.id, row]));
    return category(
      'endingPackages',
      rows.length,
      shown.flatMap((row) => {
        const direction = byId.get(row.enrollmentId);
        return direction
          ? [
              {
                ...blankItem(row.enrollmentId),
                student: person(direction.student),
                group: row.group,
                teacher: teacherRef(direction.teacher),
                enrollmentId: row.enrollmentId,
                credits: { left: row.creditsLeft, warning: row.warning },
              },
            ]
          : [];
      }),
    );
  }

  /** Packages whose window closes within three days with credits left (L-84). */
  private async expiringCategory(
    auth: AuthenticatedUser,
    teacherId: string | undefined,
    now: Date,
  ): Promise<AttentionCategory> {
    const rows = (
      await this.livePackages(
        auth.workspaceId,
        teacherId,
        {
          expiresAt: {
            gt: now,
            lte: new Date(now.getTime() + EXPIRY_WARNING_DAYS * DAY_MS),
          },
        },
        [{ expiresAt: 'asc' }, { id: 'asc' }],
      )
    ).filter((row) =>
      expiresUnused(
        {
          remainingCredits: packageFigures(row).remainingCredits,
          expiresAt: row.expiresAt,
        },
        now,
      ),
    );
    return category(
      'expiringPackages',
      rows.length,
      rows.slice(0, CATEGORY_READ).map(packageItem),
    );
  }

  /**
   * Pauses ending within three days (L-103), then open-ended ones running
   * longer than thirty days, the longest first.
   */
  private async pauseCategory(
    auth: AuthenticatedUser,
    teacherId: string | undefined,
    now: Date,
  ): Promise<AttentionCategory> {
    const rows = await this.prisma.pause.findMany({
      where: {
        workspaceId: auth.workspaceId,
        startsAt: { lte: now },
        endedAt: null,
        student: { deletedAt: null },
        AND: [
          {
            OR: [
              {
                endsAt: null,
                startsAt: {
                  lt: new Date(now.getTime() - OPEN_PAUSE_DAYS * DAY_MS),
                },
              },
              {
                endsAt: {
                  gt: now,
                  lte: new Date(now.getTime() + PAUSE_RETURN_DAYS * DAY_MS),
                },
              },
            ],
          },
          ...(teacherId
            ? [
                {
                  OR: [
                    { enrollment: { teacherId } },
                    {
                      enrollmentId: null,
                      student: {
                        enrollments: { some: { teacherId, deletedAt: null } },
                      },
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        endedAt: true,
        enrollmentId: true,
        student: { select: studentSelect },
        enrollment: {
          select: {
            group: { select: groupSelect },
            teacher: { select: teacherSelect },
          },
        },
      },
    });
    const flagged = rows
      .map((row) => ({ row, reason: pauseAttention(row, now) }))
      .filter(
        (
          entry,
        ): entry is {
          row: (typeof rows)[number];
          reason: NonNullable<typeof entry.reason>;
        } => entry.reason !== null,
      )
      .sort((a, b) =>
        a.reason !== b.reason
          ? a.reason === 'RETURNING'
            ? -1
            : 1
          : a.reason === 'RETURNING'
            ? a.row.endsAt!.getTime() - b.row.endsAt!.getTime()
            : a.row.startsAt.getTime() - b.row.startsAt.getTime(),
      );
    return category(
      'pauses',
      flagged.length,
      flagged.slice(0, CATEGORY_READ).map(({ row, reason }) => ({
        ...blankItem(row.id),
        student: person(row.student),
        group: row.enrollment?.group ?? null,
        teacher: row.enrollment ? teacherRef(row.enrollment.teacher) : null,
        enrollmentId: row.enrollmentId,
        pause: {
          id: row.id,
          startsAt: row.startsAt.toISOString(),
          endsAt: row.endsAt?.toISOString() ?? null,
          reason,
        },
      })),
    );
  }

  /**
   * «До оплати за 7 днів»: each package-paid direction whose current package
   * runs out within the week at that package's price, plus the unpaid rest of
   * every sold package.
   */
  private async dueSources(
    workspaceId: string,
    now: Date,
  ): Promise<DueSource[]> {
    const until = new Date(now.getTime() + DUE_FORECAST_DAYS * DAY_MS);
    const [directions, unpaid] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          billingType: 'PACKAGE',
          status: { in: ['ACTIVE', 'PAUSED'] },
          student: { deletedAt: null, status: { not: 'ARCHIVED' } },
        },
        select: { id: true, groupId: true },
      }),
      this.unpaidPackages(workspaceId, undefined),
    ]);
    const current = await this.billingReads.currentPackages(
      this.prisma,
      workspaceId,
      directions.map((direction) => direction.id),
    );
    const groupIds = [
      ...new Set(directions.flatMap((d) => (d.groupId ? [d.groupId] : []))),
    ];
    const upcoming = {
      status: 'SCHEDULED',
      deletedAt: null,
      startsAtUtc: { gte: now, lt: until },
    } satisfies Prisma.LessonWhereInput;
    const [packages, individual, grouped] = await Promise.all([
      this.prisma.lessonPackage.findMany({
        where: { id: { in: current.map((row) => row.packageId) } },
        select: {
          id: true,
          currency: true,
          totalPriceMinorSnapshot: true,
          expiresAt: true,
        },
      }),
      this.prisma.lesson.groupBy({
        by: ['enrollmentId'],
        where: {
          ...upcoming,
          groupId: null,
          enrollmentId: { in: directions.map((direction) => direction.id) },
        },
        _count: { _all: true },
      }),
      this.prisma.lesson.groupBy({
        by: ['groupId'],
        where: { ...upcoming, groupId: { in: groupIds } },
        _count: { _all: true },
      }),
    ]);
    const lessonsOf = new Map<string, number>([
      ...individual.map((row) => [row.enrollmentId!, row._count._all] as const),
      ...grouped.map((row) => [row.groupId!, row._count._all] as const),
    ]);
    const groupOf = new Map(directions.map((d) => [d.id, d.groupId]));
    const packageById = new Map(packages.map((pkg) => [pkg.id, pkg]));
    const sources = new Map<string, DueSource>();
    for (const row of current) {
      const pkg = packageById.get(row.packageId);
      if (!pkg) continue;
      const renew = expectsRenewal(
        {
          creditsLeft: row.left,
          expiresAt: pkg.expiresAt,
          upcomingLessons:
            lessonsOf.get(groupOf.get(row.enrollmentId) ?? row.enrollmentId) ??
            0,
        },
        now,
      );
      if (!renew) continue;
      sources.set(pkg.id, {
        currency: pkg.currency,
        renewalMinor: pkg.totalPriceMinorSnapshot,
        owedMinor: 0,
      });
    }
    for (const row of unpaid) {
      const owed = packageFigures(row).owedMinor;
      const source = sources.get(row.id);
      sources.set(row.id, {
        currency: row.currency,
        renewalMinor: source?.renewalMinor ?? null,
        owedMinor: owed,
      });
    }
    return [...sources.values()];
  }
}
