import { Injectable } from '@nestjs/common';
import {
  compareEndingFirst,
  expandSeries,
  InvalidPackagePlanError,
  isPackageEnding,
  packageLifecycle,
  planPackage,
  transferCredits,
  type PackagePlan,
  type RecurrenceRule,
} from '@tutorio/domain';
import { Prisma } from '@prisma/client';
import type {
  AdjustBalanceDto,
  CreatePackageDto,
  CreditLedgerResponse,
  ExtendPackageDto,
  ListPackagesQueryDto,
  MemberSalePreviewResponse,
  PackageDetailResponse,
  PackageListResponse,
  PackagePreviewResponse,
  PackageResponse,
  PackageTransferResponse,
  RefundPackageDto,
  SellToMembersDto,
  SoldPackagesResponse,
  TransferPackageDto,
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import { forbidden } from '../auth/auth.errors';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BillingService } from '../billing/billing.service';
import {
  currencyMismatch,
  enrollmentNotFound,
  groupNotFound,
  invalidPackagePlan,
  invalidTransferTarget,
  notEnoughCredits,
  packageInUse,
  packageNotFound,
  refundTooLarge,
  studentNotFound,
} from '../common/business.errors';
import { buildPaginatedResponse, deletedAtFilter } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { lockStudentLifecycles } from '../scheduling/lifecycle-suspension';
import { currentOrNextPauses } from '../scheduling/pause-windows';
import { resolveStudentTarget } from '../scheduling/scheduling.shared';
import {
  packageInclude,
  packageMoney,
  refreshPaymentStatus,
  toPackageResponse,
} from './packages.shared';

type Db = Prisma.TransactionClient;

/** What is sold, whichever way the sale is made. */
type PackageSpec = Pick<
  CreatePackageDto,
  | 'name'
  | 'sizingMode'
  | 'lessonsTotal'
  | 'lessonsPerWeek'
  | 'validFrom'
  | 'endDate'
  | 'pricePerLessonMinor'
  | 'totalPriceMinor'
  | 'currency'
  | 'purchasedAt'
  | 'expiresAt'
  | 'notes'
>;

const directionSelect = {
  id: true,
  groupId: true,
  teacherId: true,
  billingType: true,
  priceMinor: true,
  currency: true,
} as const;

type Direction = Prisma.EnrollmentGetPayload<{
  select: typeof directionSelect;
}>;

/** A package sale resolved into its size, price and window. */
interface SalePlan extends PackagePlan {
  validFrom: Date | null;
  expiresAt: Date | null;
  scheduleLessons: number | null;
}

/**
 * The spec one member of a sale is sold: the shared one, or at their own
 * rate per lesson when the sale names one for them (L-11).
 */
function memberSpec(dto: SellToMembersDto, studentId: string): PackageSpec {
  const own = dto.prices?.find((price) => price.studentId === studentId);
  return own
    ? {
        ...dto,
        pricePerLessonMinor: own.pricePerLessonMinor,
        totalPriceMinor: undefined,
      }
    : dto;
}

@Injectable()
export class PackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
  ) {}

  /**
   * The «Пакети» page (S07): the packages matching the filters, with how
   * many each tab holds, what the unpaid ones still owe per currency, and the
   * tab's page in the chosen order. A package's credits and money are
   * derived, so the tabs are counted from the read rows, not in SQL.
   */
  async list(
    auth: AuthenticatedUser,
    query: ListPackagesQueryDto,
  ): Promise<PackageListResponse> {
    if (query.state !== 'active' && auth.role !== 'OWNER') {
      throw forbidden();
    }

    const search = query.search
      ? { contains: query.search, mode: 'insensitive' as const }
      : null;
    const where: Prisma.LessonPackageWhereInput = {
      workspaceId: auth.workspaceId,
      ...deletedAtFilter(query.state),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      // A group's packages are its members' packages for the group.
      ...(query.groupId || query.teacherId
        ? {
            enrollment: {
              ...(query.groupId ? { groupId: query.groupId } : {}),
              ...(query.teacherId ? { teacherId: query.teacherId } : {}),
            },
          }
        : {}),
      ...(query.sizingMode ? { sizingMode: query.sizingMode } : {}),
      ...(search
        ? {
            OR: [
              { name: search },
              { student: { fullName: search } },
              { enrollment: { group: { name: search } } },
            ],
          }
        : {}),
    };

    const [rows, workspace] = await Promise.all([
      this.prisma.lessonPackage.findMany({
        where,
        orderBy: [{ purchasedAt: 'desc' }, { id: 'desc' }],
        include: packageInclude,
      }),
      this.prisma.workspace.findUniqueOrThrow({
        where: { id: auth.workspaceId },
        select: { lowCreditThreshold: true },
      }),
    ]);
    const now = new Date();
    const threshold = workspace.lowCreditThreshold;
    const packages = rows
      .map(toPackageResponse)
      .filter(
        (pkg) =>
          !query.paymentStatus || pkg.paymentStatus === query.paymentStatus,
      )
      .map((pkg) => {
        const window = {
          remainingCredits: pkg.remainingCredits,
          expiresAt: pkg.expiresAt ? new Date(pkg.expiresAt) : null,
        };
        const lifecycle = packageLifecycle(window, now);
        return {
          pkg,
          order: {
            ...window,
            id: pkg.id,
            purchasedAt: new Date(pkg.purchasedAt),
          },
          tabs: {
            ACTIVE: lifecycle === 'active',
            ENDING: isPackageEnding(window, now, threshold),
            UNPAID: pkg.paymentStatus !== 'PAID',
            FINISHED: lifecycle !== 'active',
          },
        };
      });

    const owed = new Map<string, { amountMinor: number; packages: number }>();
    for (const { pkg, tabs } of packages) {
      if (!tabs.UNPAID) continue;
      const left = Math.max(
        pkg.totalPriceMinorSnapshot - pkg.refundedMinor - pkg.paidMinor,
        0,
      );
      const sum = owed.get(pkg.currency) ?? { amountMinor: 0, packages: 0 };
      owed.set(pkg.currency, {
        amountMinor: sum.amountMinor + left,
        packages: sum.packages + 1,
      });
    }

    const count = (tab: keyof (typeof packages)[number]['tabs']) =>
      packages.filter((row) => row.tabs[tab]).length;
    const shown = packages.filter(
      (row) => !query.status || row.tabs[query.status],
    );
    if (query.sort === 'ending') {
      const byEnd = compareEndingFirst(now, threshold);
      shown.sort((a, b) => byEnd(a.order, b.order));
    }
    const skip = (query.page - 1) * query.pageSize;
    return {
      ...buildPaginatedResponse(
        shown.slice(skip, skip + query.pageSize).map((row) => row.pkg),
        shown.length,
        query,
      ),
      counts: {
        active: count('ACTIVE'),
        ending: count('ENDING'),
        unpaid: count('UNPAID'),
        finished: count('FINISHED'),
        all: packages.length,
      },
      owed: [...owed.entries()].map(([currency, sum]) => ({
        currency: currency as PackageResponse['currency'],
        ...sum,
      })),
      lowCreditThreshold: threshold,
    };
  }

  /** One package as every operation returns it. */
  async getOne(
    auth: AuthenticatedUser,
    packageId: string,
  ): Promise<PackageResponse> {
    const row = await this.prisma.lessonPackage.findFirst({
      where: { id: packageId, workspaceId: auth.workspaceId },
      include: packageInclude,
    });
    if (!row) {
      throw packageNotFound();
    }
    return toPackageResponse(row);
  }

  /**
   * The package's ticket (S07): the package, the older packages that pay
   * first (L-81) and the pauses that moved its end (L-102).
   */
  async getDetail(
    auth: AuthenticatedUser,
    packageId: string,
  ): Promise<PackageDetailResponse> {
    const pkg = await this.getOne(auth, packageId);
    const [ahead, extensions, audits] = await Promise.all([
      this.aheadOf(pkg),
      this.prisma.pausePackageExtension.findMany({
        where: { packageId: pkg.id },
        select: {
          extendedBySeconds: true,
          pause: {
            select: { id: true, startsAt: true, endsAt: true, endedAt: true },
          },
        },
        orderBy: { pause: { startsAt: 'asc' } },
      }),
      // An extension by hand has no credit entry: its audit row is the record.
      this.prisma.auditLog.findMany({
        where: {
          workspaceId: auth.workspaceId,
          entity: 'LESSON_PACKAGE',
          entityId: pkg.id,
          action: 'UPDATE',
        },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, diff: true },
      }),
    ]);
    return {
      ...pkg,
      ahead,
      manualExtensions: audits.flatMap(({ createdAt, diff }) => {
        const change = (
          diff as {
            fields?: Record<string, { before: unknown; after: unknown }>;
          } | null
        )?.fields?.expiresAt;
        return change && typeof change.after === 'string'
          ? [
              {
                at: createdAt.toISOString(),
                from: typeof change.before === 'string' ? change.before : null,
                to: change.after,
              },
            ]
          : [];
      }),
      pauseExtensions: extensions.map(({ pause, extendedBySeconds }) => ({
        pauseId: pause.id,
        startsAt: pause.startsAt.toISOString(),
        endsAt: (pause.endedAt ?? pause.endsAt)?.toISOString() ?? null,
        extendedBySeconds,
      })),
    };
  }

  /**
   * The live packages of the direction that are older in the queue (L-81)
   * and still have credits: the one just ahead, their credits, and the
   * booked lesson that uses the last of them.
   */
  private async aheadOf(
    pkg: PackageResponse,
  ): Promise<PackageDetailResponse['ahead']> {
    const now = new Date();
    const lifecycle = packageLifecycle(
      {
        remainingCredits: pkg.remainingCredits,
        expiresAt: pkg.expiresAt ? new Date(pkg.expiresAt) : null,
      },
      now,
    );
    if (pkg.deletedAt !== null || lifecycle !== 'active') return null;
    const purchasedAt = new Date(pkg.purchasedAt).getTime();
    const older = (
      await this.billing.creditPackages(this.prisma, pkg.enrollmentId)
    )
      .filter(
        (other) =>
          other.id !== pkg.id &&
          (other.purchasedAt.getTime() < purchasedAt ||
            (other.purchasedAt.getTime() === purchasedAt &&
              other.id < pkg.id)) &&
          other.remaining > 0 &&
          (other.expiresAt === null || other.expiresAt > now),
      )
      .sort(
        (a, b) =>
          a.purchasedAt.getTime() - b.purchasedAt.getTime() ||
          a.id.localeCompare(b.id),
      );
    const last = older.at(-1);
    if (!last) return null;
    const credits = older.reduce((sum, other) => sum + other.remaining, 0);
    const [named, lesson] = await Promise.all([
      this.prisma.lessonPackage.findUniqueOrThrow({
        where: { id: last.id },
        select: { name: true },
      }),
      this.prisma.lesson.findFirst({
        where: {
          ...(pkg.groupId
            ? { groupId: pkg.groupId }
            : { enrollmentId: pkg.enrollmentId }),
          status: 'SCHEDULED',
          deletedAt: null,
          startsAtUtc: { gte: now },
        },
        orderBy: [{ startsAtUtc: 'asc' }, { id: 'asc' }],
        skip: credits - 1,
        select: { startsAtUtc: true },
      }),
    ]);
    return {
      id: last.id,
      name: named.name,
      remainingCredits: credits,
      lastLessonAt: lesson?.startsAtUtc.toISOString() ?? null,
    };
  }

  /**
   * The "why is the balance this" view, newest first: the credits granted,
   * corrected, transferred and refunded, and one entry per lesson the package
   * pays for.
   */
  async getLedger(
    auth: AuthenticatedUser,
    packageId: string,
  ): Promise<CreditLedgerResponse> {
    const pkg = await this.getOne(auth, packageId);
    const [entries, charges] = await Promise.all([
      this.prisma.lessonCreditEntry.findMany({
        where: { packageId: pkg.id, workspaceId: auth.workspaceId },
      }),
      this.prisma.lessonCharge.findMany({
        where: { packageId: pkg.id, voidedAt: null },
        include: {
          lesson: {
            select: {
              id: true,
              startsAtUtc: true,
              durationMin: true,
              status: true,
            },
          },
        },
      }),
    ]);
    const items: CreditLedgerResponse['items'] = [
      ...entries.map((entry) => ({
        id: entry.id,
        packageId: entry.packageId,
        lessonId: null,
        lesson: null,
        delta: entry.delta,
        type: entry.type,
        note: entry.note,
        createdAt: entry.createdAt.toISOString(),
      })),
      // A charge joins the package when it is charged or when new credits
      // cover it from debt: its last change is when the credit was used.
      ...charges.map((charge) => ({
        id: charge.id,
        packageId: pkg.id,
        lessonId: charge.lessonId,
        lesson: {
          id: charge.lesson.id,
          startsAt: charge.lesson.startsAtUtc.toISOString(),
          durationMin: charge.lesson.durationMin,
          status: charge.lesson.status,
        },
        delta: -1,
        type: 'lesson' as const,
        note: null,
        createdAt: charge.updatedAt.toISOString(),
      })),
    ].sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    );
    return { items, balance: pkg.remainingCredits };
  }

  // -------------------------------------------------------------------------
  // Sale (L-80, L-86, L-87)
  // -------------------------------------------------------------------------

  /**
   * What a sale would be — its credits (from the direction's schedule for a
   * by-period package), price and window — without writing anything.
   */
  async preview(
    auth: AuthenticatedUser,
    dto: CreatePackageDto,
  ): Promise<PackagePreviewResponse> {
    const direction = await this.findDirection(this.prisma, auth, dto);
    const plan = await this.planSale(this.prisma, direction, dto);
    const queue = direction
      ? await this.saleQueue(direction.id)
      : { debtLessons: 0, ahead: null };
    return {
      lessonsTotal: plan.lessonsTotal,
      pricePerLessonMinor: plan.pricePerLessonMinor,
      totalPriceMinor: plan.totalPriceMinor,
      validFrom: plan.validFrom?.toISOString() ?? null,
      expiresAt: plan.expiresAt?.toISOString() ?? null,
      scheduleLessons: plan.scheduleLessons,
      ...queue,
    };
  }

  /**
   * Where a new package of the direction stands: the lessons on debt its
   * credits pay first (L-82), and the newest live package with credits,
   * which the new one follows (L-81).
   */
  private async saleQueue(
    enrollmentId: string,
  ): Promise<Pick<PackagePreviewResponse, 'debtLessons' | 'ahead'>> {
    const now = new Date();
    const [debtLessons, packages] = await Promise.all([
      this.prisma.lessonCharge.count({
        where: { enrollmentId, voidedAt: null, source: 'DEBT' },
      }),
      this.billing.creditPackages(this.prisma, enrollmentId),
    ]);
    const last = packages
      .filter(
        (pkg) =>
          pkg.remaining > 0 && (pkg.expiresAt === null || pkg.expiresAt > now),
      )
      .sort(
        (a, b) =>
          a.purchasedAt.getTime() - b.purchasedAt.getTime() ||
          a.id.localeCompare(b.id),
      )
      .at(-1);
    if (!last) return { debtLessons, ahead: null };
    const named = await this.prisma.lessonPackage.findUniqueOrThrow({
      where: { id: last.id },
      select: { name: true },
    });
    return { debtLessons, ahead: { id: last.id, name: named.name } };
  }

  /**
   * Sells a package for one direction of a student (L-80). The sale creates
   * no schedule and records no payment (L-87): those are the next actions.
   */
  async create(
    auth: AuthenticatedUser,
    dto: CreatePackageDto,
  ): Promise<PackageResponse> {
    const row = await this.prisma.$transaction(
      async (tx) => {
        await lockStudentLifecycles(tx, auth.workspaceId, [dto.studentId]);
        const direction = await this.resolveDirection(tx, auth, dto);
        const created = await this.sellInTx(
          tx,
          auth,
          dto.studentId,
          direction,
          dto,
        );
        return tx.lessonPackage.findUniqueOrThrow({
          where: { id: created.id },
          include: packageInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return toPackageResponse(row);
  }

  /**
   * What the member sale would be for each selected member (S08), without
   * writing anything: the same plan the sale makes, the member's queue (L-81,
   * L-82) and the pause that holds the package's first lessons back (L-73).
   */
  async previewMembers(
    auth: AuthenticatedUser,
    dto: SellToMembersDto,
  ): Promise<MemberSalePreviewResponse> {
    const group = await this.liveGroup(this.prisma, auth, dto.groupId);
    const members: { studentId: string; direction: Direction }[] = [];
    for (const studentId of dto.studentIds) {
      const direction = await this.findDirection(this.prisma, auth, {
        studentId,
        groupId: group.id,
      });
      members.push({ studentId, direction: direction! });
    }
    const pauses = await currentOrNextPauses(
      this.prisma,
      members.map((member) => ({
        id: member.direction.id,
        studentId: member.studentId,
      })),
      new Date(),
    );
    let window: Pick<SalePlan, 'validFrom' | 'expiresAt'> = {
      validFrom: null,
      expiresAt: null,
    };
    const items: MemberSalePreviewResponse['items'] = [];
    for (const { studentId, direction } of members) {
      const plan = await this.planSale(
        this.prisma,
        direction,
        memberSpec(dto, studentId),
      );
      window = plan;
      const queue = await this.saleQueue(direction.id);
      const pause = pauses.get(direction.id);
      // A pause matters to the sale when it covers the package's start or
      // begins before its end.
      const from = plan.validFrom ?? new Date();
      const holds =
        pause !== undefined &&
        (plan.expiresAt === null || pause.startsAt < plan.expiresAt) &&
        (pause.endsAt === null || pause.endsAt > from);
      items.push({
        studentId,
        lessonsTotal: plan.lessonsTotal,
        pricePerLessonMinor: plan.pricePerLessonMinor,
        totalPriceMinor: plan.totalPriceMinor,
        validFrom: plan.validFrom?.toISOString() ?? null,
        expiresAt: plan.expiresAt?.toISOString() ?? null,
        scheduleLessons: plan.scheduleLessons,
        ...queue,
        pause: holds
          ? {
              startsAt: pause.startsAt.toISOString(),
              endsAt: pause.endsAt?.toISOString() ?? null,
            }
          : null,
      });
    }
    return {
      validFrom: window.validFrom?.toISOString() ?? null,
      expiresAt: window.expiresAt?.toISOString() ?? null,
      items,
    };
  }

  /**
   * Sells one package spec to each selected member of a group (L-86): one
   * package per member, for their membership, each paid separately; members
   * in `prices` at their own rate (L-11). One transaction: a member that
   * cannot be sold to sells nothing to anyone.
   */
  async sellToMembers(
    auth: AuthenticatedUser,
    dto: SellToMembersDto,
  ): Promise<SoldPackagesResponse> {
    const ids = await this.prisma.$transaction(
      async (tx) => {
        await lockStudentLifecycles(tx, auth.workspaceId, dto.studentIds);
        const group = await this.liveGroup(tx, auth, dto.groupId);
        const created: string[] = [];
        for (const studentId of dto.studentIds) {
          const direction = await this.findDirection(tx, auth, {
            studentId,
            groupId: group.id,
          });
          const pkg = await this.sellInTx(
            tx,
            auth,
            studentId,
            direction!,
            memberSpec(dto, studentId),
          );
          created.push(pkg.id);
        }
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    const rows = await this.prisma.lessonPackage.findMany({
      where: { id: { in: ids } },
      include: packageInclude,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return { items: ids.map((id) => toPackageResponse(byId.get(id)!)) };
  }

  /** A group of the workspace that is not archived (404 otherwise). */
  private async liveGroup(db: Db, auth: AuthenticatedUser, groupId: string) {
    const group = await db.group.findFirst({
      where: { id: groupId, workspaceId: auth.workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!group) throw groupNotFound();
    return group;
  }

  /**
   * One package for one direction: its credits, window and price, the
   * opening credit entry, the switch of a pay-per-lesson direction to
   * packages (L-10) and the cover of its debt (L-82).
   */
  private async sellInTx(
    tx: Db,
    auth: AuthenticatedUser,
    studentId: string,
    direction: Direction,
    spec: PackageSpec,
  ) {
    const plan = await this.planSale(tx, direction, spec);
    const created = await tx.lessonPackage.create({
      data: {
        workspaceId: auth.workspaceId,
        enrollmentId: direction.id,
        studentId,
        name: spec.name ?? null,
        sizingMode: spec.sizingMode,
        lessonsTotal: plan.lessonsTotal,
        lessonsPerWeek:
          spec.sizingMode === 'BY_PERIOD_WEEKLY'
            ? (spec.lessonsPerWeek ?? null)
            : null,
        validFrom: plan.validFrom,
        endDate: spec.endDate ? new Date(spec.endDate) : null,
        pricePerLessonMinorSnapshot: plan.pricePerLessonMinor,
        totalPriceMinorSnapshot: plan.totalPriceMinor,
        currency: spec.currency,
        purchasedAt: spec.purchasedAt ? new Date(spec.purchasedAt) : new Date(),
        expiresAt: plan.expiresAt,
        notes: spec.notes ?? null,
        paymentStatus: plan.totalPriceMinor > 0 ? 'PENDING' : 'PAID',
      },
    });
    await tx.lessonCreditEntry.create({
      data: {
        workspaceId: auth.workspaceId,
        packageId: created.id,
        delta: plan.lessonsTotal,
        type: 'purchase',
        idempotencyKey: `package:${created.id}:purchase`,
        createdById: auth.userId,
      },
    });
    const switched = await this.usePackages(tx, direction);
    const covered = await this.billing.coverDebtsOf(tx, direction.id);
    await this.audit.record(tx, {
      workspaceId: auth.workspaceId,
      actorId: auth.userId,
      action: 'CREATE',
      entity: 'LESSON_PACKAGE',
      entityId: created.id,
      changes: this.audit.buildChanges(
        {},
        {
          enrollmentId: direction.id,
          sizingMode: spec.sizingMode,
          lessonsTotal: plan.lessonsTotal,
          totalPriceMinorSnapshot: plan.totalPriceMinor,
          currency: spec.currency,
          ...(switched ? { billingType: 'PACKAGE' } : {}),
          ...(covered > 0 ? { debtLessonsCovered: covered } : {}),
        },
      ),
    });
    return created;
  }

  /** Size, price and window of a sale for a direction. */
  private async planSale(
    db: Db,
    direction: Direction | null,
    spec: PackageSpec,
  ): Promise<SalePlan> {
    const period = spec.sizingMode !== 'FIXED_COUNT';
    const purchasedAt = spec.purchasedAt
      ? new Date(spec.purchasedAt)
      : new Date();
    const validFrom = period
      ? spec.validFrom
        ? new Date(spec.validFrom)
        : purchasedAt
      : null;
    const endDate = spec.endDate ? new Date(spec.endDate) : null;
    const expiresAt = period
      ? endDate && new Date(endDate.getTime() + 1)
      : spec.expiresAt
        ? new Date(spec.expiresAt)
        : null;

    // By period from the schedule: the lessons the direction's schedule has
    // in the window, unless overridden.
    let scheduleLessons: number | null = null;
    if (
      spec.sizingMode === 'BY_PERIOD' &&
      validFrom &&
      expiresAt &&
      direction
    ) {
      scheduleLessons = await this.scheduleLessonsIn(
        db,
        direction,
        validFrom,
        expiresAt,
      );
    }
    try {
      const plan = planPackage({
        sizingMode: spec.sizingMode,
        lessonsTotal:
          spec.lessonsTotal ??
          (spec.sizingMode === 'BY_PERIOD' && scheduleLessons
            ? scheduleLessons
            : undefined),
        lessonsPerWeek: spec.lessonsPerWeek,
        pricePerLessonMinor: spec.pricePerLessonMinor,
        totalPriceMinor: spec.totalPriceMinor,
        startsAt: validFrom,
        endDate,
      });
      return { ...plan, validFrom, expiresAt, scheduleLessons };
    } catch (error) {
      if (error instanceof InvalidPackagePlanError) {
        throw invalidPackagePlan(error.message);
      }
      throw error;
    }
  }

  /** Lessons a direction's active schedule has in `[from, until)`. */
  private async scheduleLessonsIn(
    db: Db,
    direction: Direction,
    from: Date,
    until: Date,
  ): Promise<number | null> {
    const schedule = await db.schedule.findFirst({
      where: {
        state: 'ACTIVE',
        ...(direction.groupId
          ? { groupId: direction.groupId }
          : { enrollmentId: direction.id }),
      },
      select: {
        series: {
          where: {
            OR: [
              { deletedAt: null },
              { scheduleSuspensionToken: { not: null } },
            ],
          },
          select: {
            weekdays: true,
            localTime: true,
            timezone: true,
            startDate: true,
            endsAt: true,
          },
        },
      },
    });
    if (!schedule) return null;
    return countLessons(
      schedule.series.map((row) => ({
        rule: {
          weekdays: row.weekdays,
          localTime: row.localTime,
          timezone: row.timezone,
          startDate: row.startDate,
        },
        endsAt: row.endsAt,
      })),
      from,
      until,
    );
  }

  /** A package-mode direction starts with its first package (L-10). */
  private async usePackages(tx: Db, direction: Direction): Promise<boolean> {
    if (direction.billingType === 'PACKAGE') return false;
    await tx.enrollment.update({
      where: { id: direction.id },
      data: { billingType: 'PACKAGE' },
    });
    return true;
  }

  /**
   * The direction a package pays for: the student's membership of `groupId`,
   * or their lessons with a teacher (created silently when new, L-2).
   */
  private async resolveDirection(
    tx: Db,
    auth: AuthenticatedUser,
    dto: CreatePackageDto,
  ): Promise<Direction> {
    const found = await this.findDirection(tx, auth, dto);
    if (found) return found;
    const resolved = await resolveStudentTarget(tx, auth.workspaceId, {
      studentId: dto.studentId,
      teacherId: dto.teacherId,
      priceMinor: dto.pricePerLessonMinor,
      currency: dto.currency,
    });
    return tx.enrollment.findUniqueOrThrow({
      where: { id: resolved.enrollmentId },
      select: directionSelect,
    });
  }

  /**
   * An existing direction, without creating one: a group membership must
   * exist (404 ENROLLMENT_NOT_FOUND); an individual one may not yet.
   */
  private async findDirection(
    db: Db,
    auth: AuthenticatedUser,
    target: {
      studentId: string;
      groupId?: string | null;
      teacherId?: string | null;
    },
  ): Promise<Direction | null> {
    const student = await db.student.findFirst({
      where: {
        id: target.studentId,
        workspaceId: auth.workspaceId,
        deletedAt: null,
        status: { not: 'ARCHIVED' },
      },
      select: { id: true },
    });
    if (!student) throw studentNotFound();
    if (target.groupId) {
      const membership = await db.enrollment.findFirst({
        where: {
          workspaceId: auth.workspaceId,
          studentId: target.studentId,
          groupId: target.groupId,
          deletedAt: null,
          status: { not: 'ARCHIVED' },
        },
        select: directionSelect,
      });
      if (!membership) throw enrollmentNotFound();
      return membership;
    }
    return db.enrollment.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        studentId: target.studentId,
        groupId: null,
        status: 'ACTIVE',
        deletedAt: null,
        ...(target.teacherId ? { teacherId: target.teacherId } : {}),
      },
      orderBy: { createdAt: 'asc' },
      select: directionSelect,
    });
  }

  // -------------------------------------------------------------------------
  // Operations (L-84, L-85)
  // -------------------------------------------------------------------------

  /**
   * A tutor's manual correction. Appends a signed entry with a mandatory note —
   * the balance history must always explain itself. Added credits cover the
   * lessons on debt first.
   */
  async adjust(
    auth: AuthenticatedUser,
    packageId: string,
    dto: AdjustBalanceDto,
  ): Promise<PackageResponse> {
    const row = await this.prisma.$transaction(async (tx) => {
      const pkg = await this.livePackage(tx, auth, packageId);
      // Each adjustment is its own event, so the key carries a timestamp.
      await tx.lessonCreditEntry.create({
        data: {
          workspaceId: auth.workspaceId,
          packageId: pkg.id,
          delta: dto.delta,
          type: 'manual_adjustment',
          idempotencyKey: `package:${pkg.id}:manual:${Date.now()}`,
          note: dto.note,
          createdById: auth.userId,
        },
      });
      if (dto.delta > 0) {
        await this.billing.coverDebtsOf(tx, pkg.enrollmentId);
      }
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'UPDATE',
        entity: 'LESSON_PACKAGE',
        entityId: pkg.id,
        changes: this.audit.buildChanges(
          {},
          { manualAdjustment: dto.delta, note: dto.note },
        ),
      });
      return tx.lessonPackage.findUniqueOrThrow({
        where: { id: pkg.id },
        include: packageInclude,
      });
    });
    return toPackageResponse(row);
  }

  /**
   * Moves the end of a package later, so its unused credits pay again
   * (L-84); lessons on debt in the new window are covered first.
   */
  async extend(
    auth: AuthenticatedUser,
    packageId: string,
    dto: ExtendPackageDto,
  ): Promise<PackageResponse> {
    const row = await this.prisma.$transaction(async (tx) => {
      const pkg = await this.livePackage(tx, auth, packageId);
      const expiresAt = new Date(dto.expiresAt);
      if (!pkg.expiresAt) {
        throw invalidPackagePlan('This package does not expire');
      }
      if (expiresAt.getTime() <= pkg.expiresAt.getTime()) {
        throw invalidPackagePlan('An extension ends after the current end');
      }
      await tx.lessonPackage.update({
        where: { id: pkg.id },
        data: {
          expiresAt,
          ...(pkg.endDate
            ? { endDate: new Date(expiresAt.getTime() - 1) }
            : {}),
        },
      });
      await this.billing.coverDebtsOf(tx, pkg.enrollmentId);
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'UPDATE',
        entity: 'LESSON_PACKAGE',
        entityId: pkg.id,
        changes: this.audit.buildChanges(
          { expiresAt: pkg.expiresAt },
          { expiresAt },
        ),
      });
      return tx.lessonPackage.findUniqueOrThrow({
        where: { id: pkg.id },
        include: packageInclude,
      });
    });
    return toPackageResponse(row);
  }

  /**
   * Moves unused credits to another direction of the same student,
   * recalculated by price and rounded down (L-85): a new package there,
   * already paid by these credits, and the remainder reported.
   */
  async transfer(
    auth: AuthenticatedUser,
    packageId: string,
    dto: TransferPackageDto,
  ): Promise<PackageTransferResponse> {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const source = await this.livePackage(tx, auth, packageId);
        await lockStudentLifecycles(tx, auth.workspaceId, [source.studentId]);
        const target = await tx.enrollment.findFirst({
          where: {
            id: dto.toEnrollmentId,
            workspaceId: auth.workspaceId,
            deletedAt: null,
            status: { not: 'ARCHIVED' },
          },
          select: { ...directionSelect, studentId: true },
        });
        if (
          !target ||
          target.studentId !== source.studentId ||
          target.id === source.enrollmentId
        ) {
          throw invalidTransferTarget();
        }
        if (target.currency !== source.currency) throw currencyMismatch();
        const remaining = await this.remainingOf(tx, source.id);
        const credits = dto.credits ?? remaining;
        if (credits < 1 || credits > remaining) {
          throw notEnoughCredits(remaining);
        }
        const moved = transferCredits(
          credits,
          source.pricePerLessonMinorSnapshot,
          target.priceMinor,
        );
        if (moved.lessons < 1) {
          throw invalidPackagePlan(
            'These credits are worth less than one lesson of the other direction',
          );
        }

        await tx.lessonCreditEntry.create({
          data: {
            workspaceId: auth.workspaceId,
            packageId: source.id,
            delta: -credits,
            type: 'transfer_out',
            idempotencyKey: `package:${source.id}:transfer:${Date.now()}`,
            note: dto.note ?? null,
            createdById: auth.userId,
          },
        });
        // Already paid with the source's money: nothing is owed on it.
        const created = await tx.lessonPackage.create({
          data: {
            workspaceId: auth.workspaceId,
            enrollmentId: target.id,
            studentId: source.studentId,
            name: source.name,
            sizingMode: 'FIXED_COUNT',
            lessonsTotal: moved.lessons,
            pricePerLessonMinorSnapshot: target.priceMinor,
            totalPriceMinorSnapshot: 0,
            currency: source.currency,
            paymentStatus: 'PAID',
            transferredFromPackageId: source.id,
            notes: dto.note ?? null,
          },
        });
        await tx.lessonCreditEntry.create({
          data: {
            workspaceId: auth.workspaceId,
            packageId: created.id,
            delta: moved.lessons,
            type: 'transfer_in',
            idempotencyKey: `package:${created.id}:transfer-in`,
            note: dto.note ?? null,
            createdById: auth.userId,
          },
        });
        await this.usePackages(tx, target);
        await this.billing.coverDebtsOf(tx, target.id);
        await this.audit.record(tx, {
          workspaceId: auth.workspaceId,
          actorId: auth.userId,
          action: 'UPDATE',
          entity: 'LESSON_PACKAGE',
          entityId: source.id,
          changes: this.audit.buildChanges(
            {},
            {
              transferredCredits: credits,
              toEnrollmentId: target.id,
              toPackageId: created.id,
              lessons: moved.lessons,
              remainderMinor: moved.remainderMinor,
            },
          ),
        });
        return { sourceId: source.id, targetId: created.id, moved };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return {
      source: await this.getOne(auth, result.sourceId),
      target: await this.getOne(auth, result.targetId),
      valueMinor: result.moved.valueMinor,
      remainderMinor: result.moved.remainderMinor,
    };
  }

  /**
   * Takes unused credits back and records the money returned (L-85): a
   * `refund` credit entry and a `REFUNDED` payment, never an edit of what
   * was paid.
   */
  async refund(
    auth: AuthenticatedUser,
    packageId: string,
    dto: RefundPackageDto,
  ): Promise<PackageResponse> {
    const row = await this.prisma.$transaction(
      async (tx) => {
        const pkg = await this.livePackage(tx, auth, packageId);
        const remaining = await this.remainingOf(tx, pkg.id);
        if (dto.credits > remaining) throw notEnoughCredits(remaining);
        const money = packageMoney(
          pkg.totalPriceMinorSnapshot,
          await tx.payment.findMany({
            where: {
              packageId: pkg.id,
              deletedAt: null,
              status: { in: ['PAID', 'REFUNDED'] },
            },
            select: { amountMinor: true, status: true },
          }),
        );
        if (dto.amountMinor > money.paidMinor) {
          throw refundTooLarge(money.paidMinor);
        }
        if (dto.credits > 0) {
          await tx.lessonCreditEntry.create({
            data: {
              workspaceId: auth.workspaceId,
              packageId: pkg.id,
              delta: -dto.credits,
              type: 'refund',
              idempotencyKey: `package:${pkg.id}:refund:${Date.now()}`,
              note: dto.note,
              createdById: auth.userId,
            },
          });
        }
        if (dto.amountMinor > 0) {
          await tx.payment.create({
            data: {
              workspaceId: auth.workspaceId,
              enrollmentId: pkg.enrollmentId,
              packageId: pkg.id,
              amountMinor: dto.amountMinor,
              currency: pkg.currency,
              method: dto.method,
              status: 'REFUNDED',
              provider: 'manual',
              paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
              note: dto.note,
              createdById: auth.userId,
            },
          });
          await refreshPaymentStatus(tx, pkg.id);
        }
        await this.audit.record(tx, {
          workspaceId: auth.workspaceId,
          actorId: auth.userId,
          action: 'UPDATE',
          entity: 'LESSON_PACKAGE',
          entityId: pkg.id,
          changes: this.audit.buildChanges(
            {},
            {
              refundedCredits: dto.credits,
              refundedMinor: dto.amountMinor,
              note: dto.note,
            },
          ),
        });
        return tx.lessonPackage.findUniqueOrThrow({
          where: { id: pkg.id },
          include: packageInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return toPackageResponse(row);
  }

  /**
   * Deletes a package sold by mistake (S07 decision 9): only one that paid
   * for no lesson and took no money — PACKAGE_IN_USE otherwise, and the
   * tutor refunds it instead. The row is archived, so its audit trail stays.
   */
  async remove(auth: AuthenticatedUser, packageId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const pkg = await tx.lessonPackage.findFirst({
        where: {
          id: packageId,
          workspaceId: auth.workspaceId,
          deletedAt: null,
        },
        select: {
          id: true,
          _count: {
            select: {
              charges: { where: { voidedAt: null } },
              payments: { where: { deletedAt: null } },
            },
          },
        },
      });
      if (!pkg) {
        return; // Idempotent: deleting an already-deleted package is a no-op.
      }
      if (pkg._count.charges > 0 || pkg._count.payments > 0) {
        throw packageInUse(pkg._count.charges, pkg._count.payments);
      }
      await tx.lessonPackage.update({
        where: { id: pkg.id },
        data: { deletedAt: new Date() },
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'DELETE',
        entity: 'LESSON_PACKAGE',
        entityId: pkg.id,
        changes: this.audit.buildChanges(
          {},
          { retained: ['credits', 'charges', 'payments', 'history'] },
        ),
      });
    });
  }

  private async livePackage(
    tx: Db,
    auth: AuthenticatedUser,
    packageId: string,
  ) {
    const pkg = await tx.lessonPackage.findFirst({
      where: { id: packageId, workspaceId: auth.workspaceId, deletedAt: null },
    });
    if (!pkg) throw packageNotFound();
    return pkg;
  }

  /** Credits a package has left: its entries minus the lessons it pays for. */
  private async remainingOf(tx: Db, packageId: string): Promise<number> {
    const [entries, charges] = await Promise.all([
      tx.lessonCreditEntry.aggregate({
        where: { packageId },
        _sum: { delta: true },
      }),
      tx.lessonCharge.count({ where: { packageId, voidedAt: null } }),
    ]);
    return (entries._sum.delta ?? 0) - charges;
  }
}

/** Distinct lesson instants of schedule rows in `[from, until)`. */
function countLessons(
  rows: readonly { rule: RecurrenceRule; endsAt: Date | null }[],
  from: Date,
  until: Date,
): number {
  const instants = new Set<number>();
  for (const { rule, endsAt } of rows) {
    const start = rule.startDate > from ? rule.startDate : from;
    const end = endsAt && endsAt < until ? endsAt : until;
    for (const at of expandSeries(rule, { from: start, until: end })) {
      instants.add(at.getTime());
    }
  }
  return instants.size;
}
