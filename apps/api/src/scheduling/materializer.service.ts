import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { planMaterialization } from '@tutorio/domain';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// How far ahead recurring lessons are kept materialized.
const HORIZON_WEEKS = 12;
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
  | 'horizonMaterializedUntil'
>;

@Injectable()
export class MaterializerService {
  private readonly logger = new Logger(MaterializerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** The rolling horizon end from a reference instant (default: now). */
  horizonUntil(now: Date = new Date()): Date {
    return new Date(now.getTime() + HORIZON_WEEKS * WEEK_MS);
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
  ): Promise<Date[]> {
    const existing = await tx.lesson.findMany({
      where: { seriesId: series.id },
      select: { startsAtUtc: true },
    });

    const { toCreate } = planMaterialization({
      rule: {
        weekdays: series.weekdays,
        localTime: series.localTime,
        timezone: series.timezone,
        startDate: series.startDate,
      },
      from,
      horizonUntil,
      existingSlots: existing.map((row) => row.startsAtUtc),
    });

    if (toCreate.length > 0) {
      await tx.lesson.createMany({
        data: toCreate.map((startsAtUtc) => ({
          workspaceId: series.workspaceId,
          enrollmentId: series.enrollmentId,
          groupId: series.groupId,
          seriesId: series.id,
          packageId: series.packageId,
          teacherId: series.teacherId,
          startsAtUtc,
          durationMin: series.durationMin,
          priceMinor: series.priceMinor,
          currency: series.currency,
        })),
      });
    }

    if (horizonUntil > series.horizonMaterializedUntil) {
      await tx.lessonSeries.update({
        where: { id: series.id },
        data: { horizonMaterializedUntil: horizonUntil },
      });
    }

    return toCreate;
  }

  /**
   * Regenerates future lessons after a series schedule change. Only SCHEDULED,
   * non-detached lessons at or after `pivot` are discarded and rebuilt from the
   * (already updated) series — completed, cancelled, and detached lessons keep
   * their slots and history.
   */
  async regenerateFuture(
    tx: Prisma.TransactionClient,
    series: SeriesForMaterialize,
    pivot: Date,
  ): Promise<void> {
    await tx.lesson.deleteMany({
      where: {
        seriesId: series.id,
        status: 'SCHEDULED',
        isDetached: false,
        deletedAt: null,
        startsAtUtc: { gte: pivot },
      },
    });
    await this.materializeSeries(tx, series, this.horizonUntil(), pivot);
  }

  /**
   * Daily extension of the rolling horizon for every live, active series. A
   * paused/archived enrollment stops generation (its series is skipped).
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async materializeAll(): Promise<void> {
    const horizonUntil = this.horizonUntil();
    const from = new Date();
    const seriesList = await this.prisma.lessonSeries.findMany({
      where: {
        deletedAt: null,
        OR: [{ enrollmentId: null }, { enrollment: { status: 'ACTIVE' } }],
      },
    });

    let created = 0;
    for (const series of seriesList) {
      try {
        const slots = await this.prisma.$transaction((tx) =>
          this.materializeSeries(tx, series, horizonUntil, from),
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
