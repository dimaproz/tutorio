import { Injectable } from '@nestjs/common';
import {
  expandSeries,
  InvalidPackagePlanError,
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
  packageNotFound,
  refundTooLarge,
  studentNotFound,
} from '../common/business.errors';
import {
  buildPaginatedResponse,
  deletedAtFilter,
  toSkipTake,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { lockStudentLifecycles } from '../scheduling/lifecycle-suspension';
import { SchedulesService } from '../scheduling/schedules.service';
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

@Injectable()
export class PackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
    private readonly schedules: SchedulesService,
  ) {}

  async list(
    auth: AuthenticatedUser,
    query: ListPackagesQueryDto,
  ): Promise<PackageListResponse> {
    if (query.state !== 'active' && auth.role !== 'OWNER') {
      throw forbidden();
    }

    const where: Prisma.LessonPackageWhereInput = {
      workspaceId: auth.workspaceId,
      ...deletedAtFilter(query.state),
      ...(query.studentId ? { studentId: query.studentId } : {}),
      // A group's packages are its members' packages for the group.
      ...(query.groupId ? { enrollment: { groupId: query.groupId } } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.lessonPackage.findMany({
        where,
        orderBy: [{ purchasedAt: 'desc' }, { id: 'desc' }],
        ...toSkipTake(query),
        include: packageInclude,
      }),
      this.prisma.lessonPackage.count({ where }),
    ]);

    return buildPaginatedResponse(rows.map(toPackageResponse), total, query);
  }

  async getDetail(
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
   * The "why is the balance this" view, newest first: the credits granted,
   * corrected, transferred and refunded, and one entry per lesson the package
   * pays for.
   */
  async getLedger(
    auth: AuthenticatedUser,
    packageId: string,
  ): Promise<CreditLedgerResponse> {
    const pkg = await this.getDetail(auth, packageId);
    const [entries, charges] = await Promise.all([
      this.prisma.lessonCreditEntry.findMany({
        where: { packageId: pkg.id, workspaceId: auth.workspaceId },
      }),
      this.prisma.lessonCharge.findMany({
        where: { packageId: pkg.id, voidedAt: null },
      }),
    ]);
    const items: CreditLedgerResponse['items'] = [
      ...entries.map((entry) => ({
        id: entry.id,
        packageId: entry.packageId,
        lessonId: null,
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
    return {
      lessonsTotal: plan.lessonsTotal,
      pricePerLessonMinor: plan.pricePerLessonMinor,
      totalPriceMinor: plan.totalPriceMinor,
      validFrom: plan.validFrom?.toISOString() ?? null,
      expiresAt: plan.expiresAt?.toISOString() ?? null,
      scheduleLessons: plan.scheduleLessons,
    };
  }

  /**
   * Sells a package for one direction of a student (L-80). The current
   * package form may still attach a first payment and ask for the
   * direction's schedule; the new sale flow does neither (L-87).
   */
  async create(
    auth: AuthenticatedUser,
    dto: CreatePackageDto,
    force = false,
  ): Promise<PackageResponse> {
    const row = await this.prisma.$transaction(
      async (tx) => {
        await lockStudentLifecycles(tx, auth.workspaceId, [dto.studentId]);
        const direction = await this.resolveDirection(tx, auth, dto);
        if (dto.schedule && direction.groupId) {
          throw invalidPackagePlan(
            "A group's lessons follow the group's own schedule",
          );
        }
        const legacyRules = dto.schedule
          ? dto.schedule.slots.map((slot) => ({
              weekdays: [slot.weekday],
              localTime: slot.localTime,
              timezone: dto.schedule!.timezone,
              startDate: new Date(dto.schedule!.startDate),
            }))
          : null;
        const created = await this.sellInTx(
          tx,
          auth,
          dto.studentId,
          direction,
          dto,
          legacyRules,
        );

        const initialPayment = dto.initialPayment ?? null;
        if (initialPayment) {
          if (new Date(initialPayment.paidAt).getTime() > Date.now()) {
            throw invalidPackagePlan('Payment date cannot be in the future');
          }
          if (initialPayment.amountMinor > created.totalPriceMinorSnapshot) {
            throw invalidPackagePlan(
              'Initial payment cannot exceed the package total',
            );
          }
          await tx.payment.create({
            data: {
              workspaceId: auth.workspaceId,
              enrollmentId: direction.id,
              packageId: created.id,
              amountMinor: initialPayment.amountMinor,
              currency: dto.currency,
              method: 'OTHER',
              status: 'PAID',
              provider: 'manual',
              paidAt: new Date(initialPayment.paidAt),
              createdById: auth.userId,
            },
          });
          await refreshPaymentStatus(tx, created.id);
        }

        // The direction's schedule belongs to the direction and outlives the
        // package (L-20); only the current form still asks for it here.
        if (dto.schedule) {
          const workspace = await tx.workspace.findUniqueOrThrow({
            where: { id: auth.workspaceId },
            select: { scheduleHorizonWeeks: true },
          });
          await this.schedules.createInTx(
            tx,
            auth,
            {
              enrollmentId: direction.id,
              groupId: null,
              teacherId: direction.teacherId,
              slots: dto.schedule.slots,
              durationMin: dto.schedule.durationMin,
              timezone: dto.schedule.timezone,
              startDate: new Date(dto.schedule.startDate),
              endsAt: null,
              horizonWeeks: workspace.scheduleHorizonWeeks,
              priceMinor: direction.priceMinor,
              currency: direction.currency,
            },
            { force },
          );
        }

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
   * Sells one package spec to each selected member of a group (L-86): one
   * package per member, for their membership, each paid separately.
   */
  async sellToMembers(
    auth: AuthenticatedUser,
    dto: SellToMembersDto,
  ): Promise<SoldPackagesResponse> {
    const ids = await this.prisma.$transaction(
      async (tx) => {
        await lockStudentLifecycles(tx, auth.workspaceId, dto.studentIds);
        const group = await tx.group.findFirst({
          where: {
            id: dto.groupId,
            workspaceId: auth.workspaceId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!group) throw groupNotFound();
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
            dto,
            null,
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
    legacyRules: RecurrenceRule[] | null,
  ) {
    const plan = await this.planSale(tx, direction, spec, legacyRules);
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
    legacyRules: RecurrenceRule[] | null = null,
  ): Promise<SalePlan> {
    const period = spec.sizingMode !== 'FIXED_COUNT';
    const purchasedAt = spec.purchasedAt
      ? new Date(spec.purchasedAt)
      : new Date();
    const validFrom = period
      ? spec.validFrom
        ? new Date(spec.validFrom)
        : (legacyRules?.[0]?.startDate ?? purchasedAt)
      : null;
    const endDate = spec.endDate ? new Date(spec.endDate) : null;
    const expiresAt = period
      ? endDate && new Date(endDate.getTime() + 1)
      : spec.expiresAt
        ? new Date(spec.expiresAt)
        : null;

    // By period from the schedule: the lessons the direction's schedule (or
    // the current form's own slots) has in the window, unless overridden.
    let scheduleLessons: number | null = null;
    if (spec.sizingMode === 'BY_PERIOD' && validFrom && expiresAt) {
      scheduleLessons = legacyRules
        ? countLessons(
            legacyRules.map((rule) => ({ rule, endsAt: null })),
            validFrom,
            expiresAt,
          )
        : direction
          ? await this.scheduleLessonsIn(db, direction, validFrom, expiresAt)
          : null;
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
      source: await this.getDetail(auth, result.sourceId),
      target: await this.getDetail(auth, result.targetId),
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
   * Archives a package: it pays for no new lesson, and the lessons it paid
   * for, its credits and its payments stay as history.
   */
  async remove(auth: AuthenticatedUser, packageId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const pkg = await tx.lessonPackage.findFirst({
        where: {
          id: packageId,
          workspaceId: auth.workspaceId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!pkg) {
        return; // Idempotent: deleting an already-deleted package is a no-op.
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
