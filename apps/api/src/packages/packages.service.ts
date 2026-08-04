import { Injectable } from '@nestjs/common';
import {
  creditBalance,
  expandPackageSchedule,
  findConflicts,
  InvalidPackagePlanError,
  planPackage,
  splitShares,
  toInterval,
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
import {
  groupNotFound,
  invalidPackagePlan,
  packageNotFound,
  scheduleConflict,
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

const DAY_MS = 86_400_000;
const MAX_DURATION_MIN = 720;

interface PlannedConflict {
  candidate: {
    startsAtUtc: string;
    durationMin: number;
  };
  existing: {
    id: string | null;
    startsAtUtc: string;
    durationMin: number;
    student: { id: string; fullName: string } | null;
    group: { id: string; name: string } | null;
  };
  teacher: { id: string; name: string };
  source: 'EXISTING_LESSON' | 'NEW_SLOT';
}

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
    force = false,
  ): Promise<PackageResponse> {
    const studentId = dto.studentId ?? null;
    const groupId = dto.groupId ?? null;

    const row = await this.prisma.$transaction(
      async (tx) => {
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
            endDate: periodEndExclusive
              ? new Date(periodEndExclusive.getTime() - 1)
              : null,
          });
        } catch (error) {
          if (error instanceof InvalidPackagePlanError) {
            throw invalidPackagePlan(error.message);
          }
          throw error;
        }

        const initialPayment = dto.initialPayment ?? null;
        if (initialPayment) {
          const paidAt = new Date(initialPayment.paidAt);
          if (paidAt.getTime() > Date.now()) {
            throw invalidPackagePlan('Payment date cannot be in the future');
          }
          if (initialPayment.amountMinor > plan.totalPriceMinor) {
            throw invalidPackagePlan(
              'Initial payment cannot exceed the package total',
            );
          }
          if (groupId && initialPayment.amountMinor !== plan.totalPriceMinor) {
            throw invalidPackagePlan(
              'A group package only supports a full initial payment',
            );
          }
        }

        let plannedStarts: Date[] = [];
        let seriesEndsAt: Date | null = null;
        if (dto.schedule && scheduleStart) {
          const expansionUntil =
            dto.sizingMode === 'BY_PERIOD'
              ? periodEndExclusive!
              : dto.expiresAt
                ? new Date(dto.expiresAt)
                : new Date(
                    scheduleStart.getTime() +
                      Math.max(plan.lessonsTotal, 1) * 7 * DAY_MS,
                  );
          const expanded = expandPackageSchedule(scheduleRules, {
            from: scheduleStart,
            until: expansionUntil,
          });
          plannedStarts =
            dto.sizingMode === 'FIXED_COUNT'
              ? expanded.slice(0, plan.lessonsTotal)
              : expanded;
          seriesEndsAt =
            dto.sizingMode === 'FIXED_COUNT'
              ? plannedStarts.length > 0
                ? new Date(plannedStarts.at(-1)!.getTime() + 1)
                : expansionUntil
              : expansionUntil;

          if (!force) {
            const conflicts = await this.findPackageConflicts(tx, {
              workspaceId: auth.workspaceId,
              teacherId: enrollments[0].teacherId,
              starts: plannedStarts,
              durationMin: dto.schedule.durationMin,
            });
            if (conflicts.length > 0) {
              throw scheduleConflict(
                [
                  ...new Set(
                    conflicts.flatMap((conflict) =>
                      conflict.existing.id ? [conflict.existing.id] : [],
                    ),
                  ),
                ],
                conflicts,
              );
            }
          }
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
        const shares = groupId
          ? splitShares(
              plan.totalPriceMinor,
              enrollments.map((enrollment) => enrollment.id),
            )
          : [];
        if (shares.length > 0) {
          await tx.packageParticipantShare.createMany({
            data: shares.map((share) => ({
              workspaceId: auth.workspaceId,
              packageId: created.id,
              enrollmentId: share.enrollmentId,
              oweMinor: share.oweMinor,
              paidMinor: initialPayment ? share.oweMinor : 0,
            })),
          });
        }

        if (initialPayment) {
          const paidAt = new Date(initialPayment.paidAt);
          const payments = groupId
            ? shares.map((share) => ({
                enrollmentId: share.enrollmentId,
                amountMinor: share.oweMinor,
              }))
            : [
                {
                  enrollmentId: enrollments[0].id,
                  amountMinor: initialPayment.amountMinor,
                },
              ];
          await tx.payment.createMany({
            data: payments.map((payment) => ({
              workspaceId: auth.workspaceId,
              enrollmentId: payment.enrollmentId,
              packageId: created.id,
              amountMinor: payment.amountMinor,
              currency: dto.currency,
              method: 'OTHER',
              status: 'PAID',
              provider: 'manual',
              paidAt,
              createdById: auth.userId,
            })),
          });
        }

        // The optional recurring schedule is what turns the package into lessons.
        if (dto.schedule && scheduleStart && seriesEndsAt) {
          for (const slot of dto.schedule.slots) {
            const series = await tx.lessonSeries.create({
              data: {
                workspaceId: auth.workspaceId,
                enrollmentId: groupId ? null : (enrollments[0]?.id ?? null),
                groupId,
                packageId: created.id,
                teacherId: enrollments[0].teacherId,
                weekdays: [slot.weekday],
                localTime: slot.localTime,
                timezone: dto.schedule.timezone,
                durationMin: dto.schedule.durationMin,
                priceMinor: plan.pricePerLessonMinor,
                currency: dto.currency,
                startDate: scheduleStart,
                endsAt: seriesEndsAt,
                horizonMaterializedUntil: scheduleStart,
              },
            });
            await this.materializer.materializeSeries(
              tx,
              series,
              this.materializer.horizonUntil(),
              scheduleStart,
            );
          }
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
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return toPackageResponse(row);
  }

  private async findPackageConflicts(
    tx: Prisma.TransactionClient,
    params: {
      workspaceId: string;
      teacherId: string;
      starts: readonly Date[];
      durationMin: number;
    },
  ): Promise<PlannedConflict[]> {
    if (params.starts.length === 0) {
      return [];
    }

    const teacher = await tx.teacher.findUniqueOrThrow({
      where: { id: params.teacherId },
      select: { id: true, fullName: true },
    });
    const first = params.starts[0];
    const last = params.starts.at(-1)!;
    const rows = await tx.lesson.findMany({
      where: {
        workspaceId: params.workspaceId,
        teacherId: params.teacherId,
        deletedAt: null,
        status: { in: ['SCHEDULED', 'COMPLETED'] },
        startsAtUtc: {
          gte: new Date(first.getTime() - MAX_DURATION_MIN * 60_000),
          lt: new Date(last.getTime() + params.durationMin * 60_000),
        },
      },
      select: {
        id: true,
        startsAtUtc: true,
        durationMin: true,
        enrollment: {
          select: { student: { select: { id: true, fullName: true } } },
        },
        group: { select: { id: true, name: true } },
      },
    });

    const conflicts: PlannedConflict[] = [];
    const busy = rows.map((row) => ({
      ...toInterval(row.startsAtUtc, row.durationMin),
      id: row.id,
      row,
    }));
    params.starts.forEach((start, index) => {
      const candidate = toInterval(start, params.durationMin);
      for (const overlap of findConflicts(candidate, busy)) {
        const row = rows.find((item) => item.id === overlap.id)!;
        conflicts.push({
          candidate: {
            startsAtUtc: start.toISOString(),
            durationMin: params.durationMin,
          },
          existing: {
            id: row.id,
            startsAtUtc: row.startsAtUtc.toISOString(),
            durationMin: row.durationMin,
            student: row.enrollment?.student ?? null,
            group: row.group,
          },
          teacher: { id: teacher.id, name: teacher.fullName },
          source: 'EXISTING_LESSON',
        });
      }

      for (
        let otherIndex = index + 1;
        otherIndex < params.starts.length;
        otherIndex += 1
      ) {
        const other = params.starts[otherIndex];
        if (other.getTime() >= candidate.end.getTime()) {
          break;
        }
        conflicts.push({
          candidate: {
            startsAtUtc: other.toISOString(),
            durationMin: params.durationMin,
          },
          existing: {
            id: null,
            startsAtUtc: start.toISOString(),
            durationMin: params.durationMin,
            student: null,
            group: null,
          },
          teacher: { id: teacher.id, name: teacher.fullName },
          source: 'NEW_SLOT',
        });
      }
    });

    return conflicts;
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
