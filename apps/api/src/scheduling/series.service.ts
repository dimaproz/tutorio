import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateLessonSeriesDto,
  LessonSeriesListResponse,
  LessonSeriesResponse,
  ListLessonSeriesQueryDto,
  UpdateLessonSeriesDto,
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import { forbidden } from '../auth/auth.errors';
import type { AuthenticatedUser } from '../auth/auth.types';
import { lessonSeriesNotFound } from '../common/business.errors';
import {
  buildPaginatedResponse,
  deletedAtFilter,
  toSkipTake,
} from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { MaterializerService } from './materializer.service';
import {
  assertTargetAndTeacher,
  seriesInclude,
  toSeriesResponse,
} from './scheduling.shared';

// PATCH fields that change the generated slots and require regeneration.
const SCHEDULE_FIELDS = [
  'weekdays',
  'localTime',
  'timezone',
  'durationMin',
  'startDate',
] as const;

@Injectable()
export class SeriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly materializer: MaterializerService,
  ) {}

  async list(
    auth: AuthenticatedUser,
    query: ListLessonSeriesQueryDto,
  ): Promise<LessonSeriesListResponse> {
    if (query.state !== 'active' && auth.role !== 'OWNER') {
      throw forbidden();
    }

    const where: Prisma.LessonSeriesWhereInput = {
      workspaceId: auth.workspaceId,
      ...deletedAtFilter(query.state),
      ...(query.enrollmentId ? { enrollmentId: query.enrollmentId } : {}),
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.lessonSeries.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...toSkipTake(query),
        include: seriesInclude,
      }),
      this.prisma.lessonSeries.count({ where }),
    ]);

    return buildPaginatedResponse(rows.map(toSeriesResponse), total, query);
  }

  async getDetail(
    auth: AuthenticatedUser,
    seriesId: string,
  ): Promise<LessonSeriesResponse> {
    const row = await this.prisma.lessonSeries.findFirst({
      where: { id: seriesId, workspaceId: auth.workspaceId, deletedAt: null },
      include: seriesInclude,
    });
    if (!row) {
      throw lessonSeriesNotFound();
    }
    return toSeriesResponse(row);
  }

  async create(
    auth: AuthenticatedUser,
    dto: CreateLessonSeriesDto,
  ): Promise<LessonSeriesResponse> {
    const startDate = new Date(dto.startDate);
    const enrollmentId = dto.enrollmentId ?? null;
    const groupId = dto.groupId ?? null;

    const series = await this.prisma.$transaction(async (tx) => {
      await assertTargetAndTeacher(tx, auth.workspaceId, {
        enrollmentId,
        groupId,
        teacherId: dto.teacherId,
      });

      const created = await tx.lessonSeries.create({
        data: {
          workspaceId: auth.workspaceId,
          enrollmentId,
          groupId,
          teacherId: dto.teacherId,
          weekdays: dto.weekdays,
          localTime: dto.localTime,
          timezone: dto.timezone,
          durationMin: dto.durationMin,
          priceMinor: dto.priceMinor,
          currency: dto.currency,
          startDate,
          // materializeSeries bumps this to the real horizon below.
          horizonMaterializedUntil: startDate,
        },
      });

      await this.materializer.materializeSeries(
        tx,
        created,
        this.materializer.horizonUntil(),
        startDate,
      );

      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'CREATE',
        entity: 'LESSON_SERIES',
        entityId: created.id,
        changes: this.audit.buildChanges(
          {},
          {
            enrollmentId,
            groupId,
            teacherId: dto.teacherId,
            weekdays: dto.weekdays,
            localTime: dto.localTime,
            timezone: dto.timezone,
            durationMin: dto.durationMin,
            priceMinor: dto.priceMinor,
            currency: dto.currency,
            startDate,
          },
        ),
      });

      return tx.lessonSeries.findUniqueOrThrow({
        where: { id: created.id },
        include: seriesInclude,
      });
    });

    return toSeriesResponse(series);
  }

  async update(
    auth: AuthenticatedUser,
    seriesId: string,
    dto: UpdateLessonSeriesDto,
  ): Promise<LessonSeriesResponse> {
    const series = await this.prisma.$transaction(async (tx) => {
      const before = await tx.lessonSeries.findFirst({
        where: { id: seriesId, workspaceId: auth.workspaceId, deletedAt: null },
        include: seriesInclude,
      });
      if (!before) {
        throw lessonSeriesNotFound();
      }

      const data = {
        ...dto,
        ...(dto.startDate ? { startDate: new Date(dto.startDate) } : {}),
      };
      const changes = this.audit.buildChanges(before, data);
      if (!changes) {
        return before;
      }

      const updated = await tx.lessonSeries.update({
        where: { id: before.id },
        data,
        include: seriesInclude,
      });

      // Regenerate only when a slot-affecting field changed; a price-only edit
      // leaves existing lessons untouched (they keep their price snapshot).
      const scheduleChanged = SCHEDULE_FIELDS.some(
        (field) => field in changes.fields,
      );
      if (scheduleChanged) {
        await this.materializer.regenerateFuture(tx, updated, new Date());
      }

      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'UPDATE',
        entity: 'LESSON_SERIES',
        entityId: before.id,
        changes,
      });

      return tx.lessonSeries.findUniqueOrThrow({
        where: { id: before.id },
        include: seriesInclude,
      });
    });

    return toSeriesResponse(series);
  }

  /**
   * Soft-deletes the series and stops future generation by soft-deleting its
   * future SCHEDULED lessons. Past and non-scheduled lessons are preserved.
   */
  async softDelete(auth: AuthenticatedUser, seriesId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const series = await tx.lessonSeries.findFirst({
        where: { id: seriesId, workspaceId: auth.workspaceId },
      });
      if (!series) {
        throw lessonSeriesNotFound();
      }
      if (series.deletedAt) {
        return;
      }

      const now = new Date();
      await tx.lessonSeries.update({
        where: { id: series.id },
        data: { deletedAt: now },
      });
      await tx.lesson.updateMany({
        where: {
          seriesId: series.id,
          status: 'SCHEDULED',
          deletedAt: null,
          startsAtUtc: { gte: now },
        },
        data: { deletedAt: now },
      });
      await this.audit.record(tx, {
        workspaceId: auth.workspaceId,
        actorId: auth.userId,
        action: 'DELETE',
        entity: 'LESSON_SERIES',
        entityId: series.id,
      });
    });
  }
}
