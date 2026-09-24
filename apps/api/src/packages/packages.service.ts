import { Injectable } from '@nestjs/common';
import {
  InvalidPackagePlanError,
  planPackage,
  type RecurrenceRule,
} from '@tutorio/domain';
import { Prisma } from '@prisma/client';
import type {
  AdjustBalanceDto,
  CreatePackageDto,
  CreditLedgerResponse,
  ListPackagesQueryDto,
  PackageListResponse,
  PackageResponse,
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import { forbidden } from '../auth/auth.errors';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BillingService } from '../billing/billing.service';
import {
  enrollmentNotFound,
  invalidPackagePlan,
  packageNotFound,
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
import { packageInclude, toPackageResponse } from './packages.shared';

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
   * The "why is the balance this" view, newest first: the credits granted
   * and corrected, and one entry per lesson the package pays for.
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

  /**
   * Sells a package for one direction of a student (L-80): the package, its
   * opening credits, an optional first payment and — while the old package
   * form still offers it — the direction's schedule. A package-mode
   * direction starts here (L-10), and the new credits cover the lessons held
   * on debt first (L-82).
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

        const scheduleStart = dto.schedule
          ? new Date(dto.schedule.startDate)
          : null;
        const scheduleRules: RecurrenceRule[] = dto.schedule
          ? dto.schedule.slots.map((slot) => ({
              weekdays: [slot.weekday],
              localTime: slot.localTime,
              timezone: dto.schedule!.timezone,
              startDate: scheduleStart!,
            }))
          : [];
        const periodEndExclusive = dto.endDate
          ? new Date(new Date(dto.endDate).getTime() + 1)
          : null;

        // Size and price the package with the pure domain planner.
        let plan;
        try {
          plan = planPackage({
            sizingMode: dto.sizingMode,
            lessonsTotal: dto.lessonsTotal,
            pricePerLessonMinor: dto.pricePerLessonMinor,
            rules: scheduleRules,
            startsAt: scheduleStart,
            endDate: dto.endDate ? new Date(dto.endDate) : null,
          });
        } catch (error) {
          if (error instanceof InvalidPackagePlanError) {
            throw invalidPackagePlan(error.message);
          }
          throw error;
        }

        const initialPayment = dto.initialPayment ?? null;
        if (initialPayment) {
          if (new Date(initialPayment.paidAt).getTime() > Date.now()) {
            throw invalidPackagePlan('Payment date cannot be in the future');
          }
          if (initialPayment.amountMinor > plan.totalPriceMinor) {
            throw invalidPackagePlan(
              'Initial payment cannot exceed the package total',
            );
          }
        }
        if (dto.schedule && direction.groupId) {
          throw invalidPackagePlan(
            "A group's lessons follow the group's own schedule",
          );
        }

        const created = await tx.lessonPackage.create({
          data: {
            workspaceId: auth.workspaceId,
            enrollmentId: direction.id,
            studentId: dto.studentId,
            name: dto.name ?? null,
            sizingMode: dto.sizingMode,
            lessonsTotal: plan.lessonsTotal,
            endDate: dto.endDate ? new Date(dto.endDate) : null,
            pricePerLessonMinorSnapshot: plan.pricePerLessonMinor,
            totalPriceMinorSnapshot: plan.totalPriceMinor,
            currency: dto.currency,
            purchasedAt: dto.purchasedAt
              ? new Date(dto.purchasedAt)
              : new Date(),
            expiresAt:
              dto.sizingMode === 'BY_PERIOD'
                ? periodEndExclusive
                : dto.expiresAt
                  ? new Date(dto.expiresAt)
                  : null,
            notes: dto.notes ?? null,
            paymentStatus: initialPayment
              ? initialPayment.amountMinor >= plan.totalPriceMinor
                ? 'PAID'
                : 'PARTIAL'
              : 'PENDING',
          },
        });

        // The opening credits: the package grants its lessons up front.
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

        if (initialPayment) {
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
        }

        // Selling a package switches a pay-per-lesson direction to packages
        // (L-10); the credits then cover the lessons on debt first (L-82).
        if (direction.billingType !== 'PACKAGE') {
          await tx.enrollment.update({
            where: { id: direction.id },
            data: { billingType: 'PACKAGE' },
          });
        }
        const covered = await this.billing.coverDebtsOf(tx, direction.id);

        // The old package form can still ask for the direction's schedule.
        // It belongs to the direction and outlives the package (L-20, L-87).
        if (dto.schedule && scheduleStart) {
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
              startDate: scheduleStart,
              endsAt: null,
              horizonWeeks: workspace.scheduleHorizonWeeks,
              priceMinor: direction.priceMinor,
              currency: direction.currency,
            },
            { force },
          );
        }

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
              lessonsTotal: plan.lessonsTotal,
              totalPriceMinorSnapshot: plan.totalPriceMinor,
              currency: dto.currency,
              ...(direction.billingType !== 'PACKAGE'
                ? { billingType: 'PACKAGE' }
                : {}),
              ...(covered > 0 ? { debtLessonsCovered: covered } : {}),
            },
          ),
        });

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
   * The direction a package pays for: the student's membership of `groupId`,
   * or their lessons with a teacher (created silently when new, L-2).
   */
  private async resolveDirection(
    tx: Prisma.TransactionClient,
    auth: AuthenticatedUser,
    dto: CreatePackageDto,
  ) {
    const select = {
      id: true,
      groupId: true,
      teacherId: true,
      billingType: true,
      priceMinor: true,
      currency: true,
    } as const;
    if (dto.groupId) {
      const student = await tx.student.findFirst({
        where: {
          id: dto.studentId,
          workspaceId: auth.workspaceId,
          deletedAt: null,
          status: { not: 'ARCHIVED' },
        },
        select: { id: true },
      });
      if (!student) throw studentNotFound();
      const membership = await tx.enrollment.findFirst({
        where: {
          workspaceId: auth.workspaceId,
          studentId: dto.studentId,
          groupId: dto.groupId,
          deletedAt: null,
          status: { not: 'ARCHIVED' },
        },
        select,
      });
      if (!membership) throw enrollmentNotFound();
      return membership;
    }
    const resolved = await resolveStudentTarget(tx, auth.workspaceId, {
      studentId: dto.studentId,
      teacherId: dto.teacherId,
      priceMinor: dto.pricePerLessonMinor,
      currency: dto.currency,
    });
    return tx.enrollment.findUniqueOrThrow({
      where: { id: resolved.enrollmentId },
      select,
    });
  }

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
      const pkg = await tx.lessonPackage.findFirst({
        where: {
          id: packageId,
          workspaceId: auth.workspaceId,
          deletedAt: null,
        },
        select: { id: true, enrollmentId: true },
      });
      if (!pkg) {
        throw packageNotFound();
      }

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
}
