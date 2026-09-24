import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  findConflicts,
  planMaterialization,
  toInterval,
} from '@tutorio/domain';
import { Prisma } from '@prisma/client';
import { scheduleConflict } from '../common/business.errors';
import { PrismaService } from '../prisma/prisma.service';
import {
  lockGroupSchedule,
  lockTeacherSchedules,
} from './lifecycle-suspension';

// The horizon of a schedule that names none (product/scheduling.md L-22:
// each schedule keeps its own, defaulting to the studio setting).
export const HORIZON_WEEKS = 4;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type SeriesForMaterialize = Pick<
  Prisma.LessonSeriesGetPayload<true>,
  | 'id'
  | 'workspaceId'
  | 'enrollmentId'
  | 'groupId'
  | 'packageId'
  | 'teacherId'
  | 'weekdays'
  | 'localTime'
  | 'timezone'
  | 'durationMin'
  | 'priceMinor'
  | 'currency'
  | 'startDate'
  | 'endsAt'
  | 'horizonMaterializedUntil'
  | 'scheduleId'
>;

@Injectable()
export class MaterializerService {
  private readonly logger = new Logger(MaterializerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** The rolling horizon end from a reference instant (default: now). */
  horizonUntil(now: Date = new Date(), weeks: number = HORIZON_WEEKS): Date {
    return new Date(now.getTime() + weeks * WEEK_MS);
  }

  /** How far ahead the schedule a row belongs to keeps its lessons. */
  async horizonFor(
    tx: Prisma.TransactionClient,
    series: Pick<SeriesForMaterialize, 'scheduleId'>,
    now: Date = new Date(),
  ): Promise<Date> {
    const schedule = await tx.schedule.findUnique({
      where: { id: series.scheduleId },
      select: { horizonWeeks: true },
    });
    return this.horizonUntil(now, schedule?.horizonWeeks ?? HORIZON_WEEKS);
  }

  /**
   * Creates the lessons a series is missing over `[from, horizonUntil)`.
   * Idempotent: existing slots (any status, including soft-deleted, so the
   * unique index is never violated) are never regenerated. Runs inside the
   * caller's transaction.
   */
  async materializeSeries(
    tx: Prisma.TransactionClient,
    series: SeriesForMaterialize,
    horizonUntil: Date,
    from: Date = series.startDate,
    force = false,
  ): Promise<Date[]> {
    if (series.groupId) {
      await lockGroupSchedule(tx, series.workspaceId, series.groupId);
    }
    await lockTeacherSchedules(tx, series.workspaceId, [series.teacherId]);
    // The caller may have read this series before a concurrent rule update.
    // Read the canonical row only after taking its schedule locks, then use it
    // for both eligibility and occurrence generation.
    const currentSeries = await tx.lessonSeries.findFirst({
      where: {
        id: series.id,
        workspaceId: series.workspaceId,
        deletedAt: null,
      },
    });
    if (!currentSeries || !(await this.isEligible(tx, currentSeries)))
      return [];
    const effectiveUntil =
      currentSeries.endsAt && currentSeries.endsAt < horizonUntil
        ? currentSeries.endsAt
        : horizonUntil;
    if (effectiveUntil <= from) {
      return [];
    }
    const existing = await tx.lesson.findMany({
      where: { seriesId: currentSeries.id },
      select: { startsAtUtc: true },
    });

    const { toCreate } = planMaterialization({
      rule: {
        weekdays: currentSeries.weekdays,
        localTime: currentSeries.localTime,
        timezone: currentSeries.timezone,
        startDate: currentSeries.startDate,
      },
      from,
      horizonUntil: effectiveUntil,
      existingSlots: existing.map((row) => row.startsAtUtc),
    });

    if (!force && toCreate.length > 0) {
      await this.assertCandidatesAreFree(tx, currentSeries, toCreate);
    }

    if (toCreate.length > 0) {
      await tx.lesson.createMany({
        data: toCreate.map((startsAtUtc) => ({
          workspaceId: currentSeries.workspaceId,
          enrollmentId: currentSeries.enrollmentId,
          groupId: currentSeries.groupId,
          seriesId: currentSeries.id,
          packageId: currentSeries.packageId,
          teacherId: currentSeries.teacherId,
          startsAtUtc,
          durationMin: currentSeries.durationMin,
          priceMinor: currentSeries.priceMinor,
          currency: currentSeries.currency,
        })),
        // A concurrent cron/manual run may have won the unique slot race.
        skipDuplicates: true,
      });
    }

    if (effectiveUntil > currentSeries.horizonMaterializedUntil) {
      await tx.lessonSeries.update({
        where: { id: currentSeries.id },
        data: { horizonMaterializedUntil: effectiveUntil },
      });
    }

    return toCreate;
  }

  private async isEligible(
    tx: Prisma.TransactionClient,
    series: SeriesForMaterialize,
  ): Promise<boolean> {
    if (
      !(await tx.lessonSeries.findFirst({
        where: {
          id: series.id,
          workspaceId: series.workspaceId,
          deletedAt: null,
        },
        select: { id: true },
      }))
    ) {
      return false;
    }
    if (
      series.packageId &&
      !(await tx.lessonPackage.findFirst({
        where: {
          id: series.packageId,
          workspaceId: series.workspaceId,
          deletedAt: null,
        },
        select: { id: true },
      }))
    ) {
      return false;
    }
    if (series.enrollmentId) {
      return Boolean(
        await tx.enrollment.findFirst({
          where: {
            id: series.enrollmentId,
            workspaceId: series.workspaceId,
            deletedAt: null,
            status: 'ACTIVE',
            student: { deletedAt: null, status: { not: 'ARCHIVED' } },
          },
          select: { id: true },
        }),
      );
    }
    if (!series.groupId) return false;
    return Boolean(
      await tx.group.findFirst({
        where: {
          id: series.groupId,
          workspaceId: series.workspaceId,
          deletedAt: null,
          enrollments: {
            some: {
              deletedAt: null,
              status: 'ACTIVE',
              student: { deletedAt: null, status: { not: 'ARCHIVED' } },
            },
          },
        },
        select: { id: true },
      }),
    );
  }

  private async assertCandidatesAreFree(
    tx: Prisma.TransactionClient,
    series: SeriesForMaterialize,
    candidates: Date[],
  ): Promise<void> {
    const conflicts = new Set<string>();
    const accepted: { id: string; start: Date; end: Date }[] = [];
    for (const startsAtUtc of candidates) {
      const interval = toInterval(startsAtUtc, series.durationMin);
      const rows = await tx.lesson.findMany({
        where: {
          workspaceId: series.workspaceId,
          teacherId: series.teacherId,
          deletedAt: null,
          status: { in: ['SCHEDULED', 'COMPLETED'] },
          startsAtUtc: {
            gte: new Date(startsAtUtc.getTime() - 720 * 60_000),
            lt: interval.end,
          },
        },
        select: { id: true, startsAtUtc: true, durationMin: true },
      });
      for (const row of rows) {
        if (
          findConflicts(interval, [
            { ...toInterval(row.startsAtUtc, row.durationMin), id: row.id },
          ]).length
        ) {
          conflicts.add(row.id);
        }
      }
      for (const conflict of findConflicts(interval, accepted)) {
        conflicts.add(conflict.id);
      }
      accepted.push({ ...interval, id: startsAtUtc.toISOString() });
    }
    if (conflicts.size) throw scheduleConflict([...conflicts]);
  }

  /**
   * Daily extension of the rolling horizon for every live, active series. A
   * paused/archived enrollment stops generation (its series is skipped).
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async materializeAll(): Promise<void> {
    const from = new Date();
    // A schedule whose end date has passed is over: its direction may get a
    // new one (L-20).
    await this.prisma.schedule.updateMany({
      where: { state: 'ACTIVE', endsAt: { lte: from } },
      data: { state: 'ENDED' },
    });
    const seriesList = await this.prisma.lessonSeries.findMany({
      where: {
        deletedAt: null,
        schedule: { state: 'ACTIVE' },
        OR: [{ endsAt: null }, { endsAt: { gt: from } }],
        AND: [
          {
            OR: [
              {
                group: {
                  is: {
                    deletedAt: null,
                    enrollments: {
                      some: {
                        deletedAt: null,
                        status: 'ACTIVE',
                        student: {
                          deletedAt: null,
                          status: { not: 'ARCHIVED' },
                        },
                      },
                    },
                  },
                },
                enrollmentId: null,
              },
              {
                enrollment: {
                  status: 'ACTIVE',
                  student: { deletedAt: null, status: { not: 'ARCHIVED' } },
                },
              },
            ],
          },
        ],
      },
      include: { schedule: { select: { horizonWeeks: true } } },
    });

    let created = 0;
    for (const series of seriesList) {
      try {
        const slots = await this.prisma.$transaction((tx) =>
          this.materializeSeries(
            tx,
            series,
            this.horizonUntil(from, series.schedule.horizonWeeks),
            from,
          ),
        );
        created += slots.length;
      } catch (error) {
        this.logger.error(`Failed to materialize series ${series.id}`, error);
      }
    }
    this.logger.log(
      `Materialization run: ${seriesList.length} series, ${created} lessons created`,
    );
  }
}
