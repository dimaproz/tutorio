import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { mergeSlot, normalizeSlots, type ScheduleSlot } from '@tutorio/domain';
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
import { SchedulesService, currentVersionRows } from './schedules.service';
import { seriesInclude, toSeriesResponse } from './scheduling.shared';

/** The fixed horizon recurring patterns had before schedules (12 weeks). */
const LEGACY_PATTERN_HORIZON_WEEKS = 12;

/**
 * The recurring-pattern endpoints the current screens use, kept on top of
 * schedules (product/scheduling.md L-20…L-27): a series row is one weekday of
 * one version of a schedule. Creating a pattern for a direction that has a
 * schedule adds its days to it (L-23); editing or deleting a row changes the
 * schedule from now on, moving lessons instead of deleting them.
 */
@Injectable()
export class SeriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly schedules: SchedulesService,
  ) {}

  async list(
    auth: AuthenticatedUser,
    query: ListLessonSeriesQueryDto,
  ): Promise<LessonSeriesListResponse> {
    if (query.state !== 'active' && auth.role !== 'OWNER') {
      throw forbidden();
    }
    const now = new Date();
    const where: Prisma.LessonSeriesWhereInput = {
      workspaceId: auth.workspaceId,
      ...deletedAtFilter(query.state),
      // An active pattern is a row of the rule in force or a planned one.
      ...(query.state === 'active'
        ? { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }
        : {}),
      ...(query.enrollmentId ? { enrollmentId: query.enrollmentId } : {}),
      ...(query.groupId ? { groupId: query.groupId } : {}),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
    };

    const [rows, total] = await Promise.all([
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
    force: boolean,
  ): Promise<LessonSeriesResponse> {
    const slots = dto.weekdays.map((weekday) => ({
      weekday,
      localTime: dto.localTime,
    }));
    const existing = await this.existingSchedule(auth, dto);
    if (existing) {
      // One schedule per direction: the pattern's days join it (L-23).
      const current = await this.currentSlots(existing.id);
      const merged = slots.reduce<ScheduleSlot[]>(
        (acc, slot) => mergeSlot(acc, slot),
        current,
      );
      const startDate = new Date(dto.startDate);
      await this.schedules.change(
        auth,
        existing.id,
        {
          effectiveFrom: startDate.toISOString(),
          slots: merged,
          durationMin: dto.durationMin,
        },
        force,
      );
      return this.rowFor(auth, existing.id, dto.weekdays[0]);
    }
    const schedule = await this.schedules.create(
      auth,
      {
        studentId: dto.studentId,
        enrollmentId: dto.enrollmentId,
        groupId: dto.groupId,
        teacherId: dto.teacherId,
        slots,
        durationMin: dto.durationMin,
        timezone: dto.timezone,
        startDate: dto.startDate,
        priceMinor: dto.priceMinor,
        currency: dto.currency,
        // The pattern screen keeps the horizon it has always had until the
        // Schedules tab (with its own horizon field) replaces it.
        horizonWeeks: LEGACY_PATTERN_HORIZON_WEEKS,
      },
      force,
    );
    return this.rowFor(auth, schedule.id, dto.weekdays[0]);
  }

  /**
   * Edits one pattern row: its days and time replace that row's days in the
   * schedule, the length applies to the whole schedule, and the change takes
   * effect from now (or a later start date). A price-only edit reprices the
   * rule without touching lessons already booked.
   */
  async update(
    auth: AuthenticatedUser,
    seriesId: string,
    dto: UpdateLessonSeriesDto,
    force: boolean,
  ): Promise<LessonSeriesResponse> {
    const row = await this.prisma.lessonSeries.findFirst({
      where: { id: seriesId, workspaceId: auth.workspaceId, deletedAt: null },
    });
    if (!row) {
      throw lessonSeriesNotFound();
    }
    const changesRule =
      dto.weekdays != null ||
      dto.localTime != null ||
      dto.durationMin != null ||
      dto.startDate != null;

    if (dto.priceMinor != null || dto.currency != null) {
      await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const data = {
          ...(dto.priceMinor != null ? { priceMinor: dto.priceMinor } : {}),
          ...(dto.currency != null ? { currency: dto.currency } : {}),
        };
        await tx.lessonSeries.updateMany({
          where: {
            scheduleId: row.scheduleId,
            OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          },
          data,
        });
        await this.audit.record(tx, {
          workspaceId: auth.workspaceId,
          actorId: auth.userId,
          action: 'UPDATE',
          entity: 'SCHEDULE',
          entityId: row.scheduleId,
          changes: this.audit.buildChanges(
            { priceMinor: row.priceMinor, currency: row.currency },
            data,
          ),
        });
      });
    }
    if (dto.timezone != null && dto.timezone !== row.timezone) {
      await this.prisma.schedule.update({
        where: { id: row.scheduleId },
        data: { timezone: dto.timezone },
      });
    }
    if (!changesRule) {
      return this.getDetail(auth, seriesId);
    }

    const schedule = await this.prisma.schedule.findUniqueOrThrow({
      where: { id: row.scheduleId },
    });
    const current = await this.currentSlots(row.scheduleId);
    const edited = (dto.weekdays ?? row.weekdays).map((weekday) => ({
      weekday,
      localTime: dto.localTime ?? row.localTime,
    }));
    const slots = normalizeSlots([
      ...current.filter(
        (slot) =>
          !row.weekdays.includes(slot.weekday) &&
          !edited.some((next) => next.weekday === slot.weekday),
      ),
      ...edited,
    ]);
    await this.schedules.change(
      auth,
      row.scheduleId,
      {
        effectiveFrom: dto.startDate,
        slots,
        durationMin: dto.durationMin ?? schedule.durationMin,
      },
      force,
    );
    return this.rowFor(auth, row.scheduleId, edited[0].weekday);
  }

  /**
   * Deleting a pattern row takes its days out of the schedule from now on;
   * removing the last days stops the schedule (L-24). Lessons moved by hand,
   * held, cancelled or marked stay.
   */
  async softDelete(auth: AuthenticatedUser, seriesId: string): Promise<void> {
    const row = await this.prisma.lessonSeries.findFirst({
      where: { id: seriesId, workspaceId: auth.workspaceId },
      include: { schedule: true },
    });
    if (!row) {
      throw lessonSeriesNotFound();
    }
    const now = new Date();
    const retired =
      (row.deletedAt && !row.scheduleSuspensionToken) ||
      (row.endsAt !== null && row.endsAt <= now) ||
      row.schedule.state !== 'ACTIVE';
    if (retired) {
      return; // Idempotent: this row no longer generates anything.
    }
    const remaining = (await this.currentSlots(row.scheduleId)).filter(
      (slot) => !row.weekdays.includes(slot.weekday),
    );
    if (remaining.length === 0) {
      await this.schedules.stop(auth, row.scheduleId, {});
      return;
    }
    await this.schedules.change(
      auth,
      row.scheduleId,
      { slots: remaining, durationMin: row.schedule.durationMin },
      true,
    );
  }

  private async existingSchedule(
    auth: AuthenticatedUser,
    dto: CreateLessonSeriesDto,
  ) {
    const directionWhere: Prisma.ScheduleWhereInput | null = dto.groupId
      ? { groupId: dto.groupId }
      : dto.enrollmentId
        ? { enrollmentId: dto.enrollmentId }
        : dto.studentId
          ? {
              enrollment: {
                studentId: dto.studentId,
                groupId: null,
                status: 'ACTIVE',
                deletedAt: null,
                ...(dto.teacherId ? { teacherId: dto.teacherId } : {}),
              },
            }
          : null;
    if (!directionWhere) return null;
    return this.prisma.schedule.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        state: 'ACTIVE',
        ...directionWhere,
      },
      select: { id: true },
    });
  }

  /** The days and times of the rule in force now. */
  private async currentSlots(scheduleId: string): Promise<ScheduleSlot[]> {
    const rows = await this.prisma.lessonSeries.findMany({
      where: {
        scheduleId,
        OR: [{ deletedAt: null }, { scheduleSuspensionToken: { not: null } }],
      },
    });
    return normalizeSlots(
      currentVersionRows(rows, new Date()).flatMap((row) =>
        row.weekdays.map((weekday) => ({ weekday, localTime: row.localTime })),
      ),
    );
  }

  /** The newest row of a schedule for a weekday: the pattern just saved. */
  private async rowFor(
    auth: AuthenticatedUser,
    scheduleId: string,
    weekday: number,
  ): Promise<LessonSeriesResponse> {
    const row =
      (await this.prisma.lessonSeries.findFirst({
        where: { scheduleId, weekdays: { has: weekday } },
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        include: seriesInclude,
      })) ??
      (await this.prisma.lessonSeries.findFirstOrThrow({
        where: { scheduleId, workspaceId: auth.workspaceId },
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        include: seriesInclude,
      }));
    return toSeriesResponse(row);
  }
}
