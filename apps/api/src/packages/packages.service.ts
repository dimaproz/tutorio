import { Injectable } from '@nestjs/common';
import {
  creditBalance,
  InvalidPackagePlanError,
  planPackage,
  splitShares,
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
import {
  groupNotFound,
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
import { MaterializerService } from '../scheduling/materializer.service';
import { resolveStudentTarget } from '../scheduling/scheduling.shared';
import { LedgerService } from './ledger.service';
import { packageInclude, toPackageResponse } from './packages.shared';

@Injectable()
export class PackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
    private readonly materializer: MaterializerService,
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
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
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
      where: { id: packageId, workspaceId: auth.workspaceId, deletedAt: null },
      include: packageInclude,
    });
    if (!row) {
      throw packageNotFound();
    }
    return toPackageResponse(row);
  }

  /** The "why is the balance this" view: every entry, newest first. */
  async getLedger(
    auth: AuthenticatedUser,
    packageId: string,
  ): Promise<CreditLedgerResponse> {
    const pkg = await this.getDetail(auth, packageId);
    const rows = await this.prisma.lessonCreditEntry.findMany({
      where: { packageId: pkg.id, workspaceId: auth.workspaceId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        packageId: row.packageId,
        enrollmentId: row.enrollmentId,
        lessonId: row.lessonId,
        delta: row.delta,
        type: row.type,
        note: row.note,
        createdAt: row.createdAt.toISOString(),
      })),
      balance: creditBalance(rows),
    };
  }

  /**
   * Buys a package. One transaction creates the package, the opening `purchase`
   * credit entry, the per-member shares for a group, and — when a schedule is
   * given — the `LessonSeries` whose materialization produces the actual
   * lessons. Either all of that exists, or none of it does.
   */
  async create(
    auth: AuthenticatedUser,
    dto: CreatePackageDto,
  ): Promise<PackageResponse> {
    const studentId = dto.studentId ?? null;
    const groupId = dto.groupId ?? null;

    const row = await this.prisma.$transaction(async (tx) => {
      const enrollments = await this.assertTargetAndCollectEnrollments(
        tx,
        auth.workspaceId,
        {
          studentId,
          groupId,
          currency: dto.currency,
          pricePerLessonMinor: dto.pricePerLessonMinor,
        },
      );

      // Size and price the package with the pure domain planner.
      let plan;
      try {
        plan = planPackage({
          sizingMode: dto.sizingMode,
          lessonsTotal: dto.lessonsTotal,
          pricePerLessonMinor: dto.pricePerLessonMinor,
          rule: dto.schedule
            ? {
                weekdays: dto.schedule.weekdays,
                localTime: dto.schedule.localTime,
                timezone: dto.schedule.timezone,
                startDate: new Date(dto.schedule.startDate),
              }
            : null,
          startsAt: dto.schedule ? new Date(dto.schedule.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        });
      } catch (error) {
        if (error instanceof InvalidPackagePlanError) {
          throw invalidPackagePlan(error.message);
        }
        throw error;
      }

      const created = await tx.lessonPackage.create({
        data: {
          workspaceId: auth.workspaceId,
          studentId,
          groupId,
          name: dto.name ?? null,
          sizingMode: dto.sizingMode,
          lessonsTotal: plan.lessonsTotal,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          pricePerLessonMinorSnapshot: plan.pricePerLessonMinor,
          totalPriceMinorSnapshot: plan.totalPriceMinor,
          currency: dto.currency,
          purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : new Date(),
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          notes: dto.notes ?? null,
        },
      });

      // The opening balance: the package grants its lessons up front.
      await this.ledger.append(tx, {
        workspaceId: auth.workspaceId,
        packageId: created.id,
        enrollmentId: enrollments[0]?.id ?? null,
        delta: plan.lessonsTotal,
        type: 'purchase',
        idempotencyKey: `package:${created.id}:purchase`,
        createdById: auth.userId,
      });

      // A group shares the schedule but splits the money.
      if (groupId && enrollments.length > 0) {
        const shares = splitShares(
          plan.totalPriceMinor,
          enrollments.map((enrollment) => enrollment.id),
        );
        await tx.packageParticipantShare.createMany({
          data: shares.map((share) => ({
            workspaceId: auth.workspaceId,
            packageId: created.id,
            enrollmentId: share.enrollmentId,
            oweMinor: share.oweMinor,
          })),
        });
      }

      // The optional recurring schedule is what turns the package into lessons.
      if (dto.schedule) {
        const startDate = new Date(dto.schedule.startDate);
        const series = await tx.lessonSeries.create({
          data: {
            workspaceId: auth.workspaceId,
            enrollmentId: groupId ? null : (enrollments[0]?.id ?? null),
            groupId,
            packageId: created.id,
            teacherId: enrollments[0].teacherId,
            weekdays: dto.schedule.weekdays,
            localTime: dto.schedule.localTime,
            timezone: dto.schedule.timezone,
            durationMin: dto.schedule.durationMin,
            priceMinor: plan.pricePerLessonMinor,
            currency: dto.currency,
            startDate,
            horizonMaterializedUntil: startDate,
          },
        });
        await this.materializer.materializeSeries(
          tx,
          series,
          this.materializer.horizonUntil(),
          startDate,
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
            studentId,
            groupId,
            lessonsTotal: plan.lessonsTotal,
            totalPriceMinorSnapshot: plan.totalPriceMinor,
            currency: dto.currency,
          },
        ),
      });

      return tx.lessonPackage.findUniqueOrThrow({
        where: { id: created.id },
        include: packageInclude,
      });
    });

    return toPackageResponse(row);
  }

  /**
   * A tutor's manual correction. Appends a signed entry with a mandatory note —
   * the balance history must always explain itself.
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
        select: { id: true },
      });
      if (!pkg) {
        throw packageNotFound();
      }

      // Each adjustment is its own event, so the key carries a timestamp.
      await this.ledger.append(tx, {
        workspaceId: auth.workspaceId,
        packageId: pkg.id,
        delta: dto.delta,
        type: 'manual_adjustment',
        idempotencyKey: `package:${pkg.id}:manual:${Date.now()}`,
        note: dto.note,
        createdById: auth.userId,
      });

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

  /** Soft delete. The ledger history is never removed. */
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
      });
    });
  }

  /**
   * Validates the package target and returns the enrollments the money attaches
   * to: one for an individual package, one per member for a group package.
   */
  private async assertTargetAndCollectEnrollments(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    target: {
      studentId: string | null;
      groupId: string | null;
      currency: string;
      pricePerLessonMinor: number;
    },
  ): Promise<{ id: string; teacherId: string; currency: string }[]> {
    if (target.studentId) {
      const student = await tx.student.findFirst({
        where: { id: target.studentId, workspaceId },
        select: { id: true },
      });
      if (!student) {
        throw studentNotFound();
      }
      const enrollments = await tx.enrollment.findMany({
        where: {
          workspaceId,
          studentId: target.studentId,
          groupId: null,
          status: 'ACTIVE',
          deletedAt: null,
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, teacherId: true, currency: true },
      });
      if (enrollments.length > 0) {
        return enrollments;
      }

      // A tutor may buy a package for a brand-new student who has never been
      // scheduled yet. Rather than failing, resolve (and create) the enrollment
      // the same way booking a lesson does — the tutor never has to know the
      // word "enrollment".
      const resolved = await resolveStudentTarget(tx, workspaceId, {
        studentId: target.studentId,
        priceMinor: target.pricePerLessonMinor,
        currency: target.currency,
      });
      return [
        {
          id: resolved.enrollmentId,
          teacherId: resolved.teacherId,
          currency: resolved.currency,
        },
      ];
    }

    const group = await tx.group.findFirst({
      where: { id: target.groupId ?? '', workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!group) {
      throw groupNotFound();
    }
    // A group package needs at least one member to split the money between.
    const enrollments = await tx.enrollment.findMany({
      where: {
        workspaceId,
        groupId: target.groupId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, teacherId: true, currency: true },
    });
    if (enrollments.length === 0) {
      throw invalidPackagePlan(
        'Add at least one active student to the group before buying a package',
      );
    }
    return enrollments;
  }
}
