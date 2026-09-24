import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import {
  extendsPackage,
  pauseCovers,
  pauseLengthSeconds,
  pauseStateAt,
  pausesOverlap,
} from '@tutorio/domain';
import type {
  CreatePauseDto,
  ListPausesQueryDto,
  PauseListResponse,
  PauseResponse,
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  enrollmentNotFound,
  pauseEnded,
  pauseNotFound,
  pauseOverlap,
  studentArchivedRequiresRestore,
  studentNotFound,
} from '../common/business.errors';
import { buildPaginatedResponse, toSkipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertLessonsAreFree,
  lockStudentLifecycles,
  lockTeacherSchedules,
} from '../scheduling/lifecycle-suspension';
import { MaterializerService } from '../scheduling/materializer.service';

type Db = Prisma.TransactionClient;

const pauseInclude = {
  student: { select: { id: true, fullName: true } },
  extensions: { select: { packageId: true, extendedBySeconds: true } },
} satisfies Prisma.PauseInclude;

type PauseRow = Prisma.PauseGetPayload<{ include: typeof pauseInclude }>;

/**
 * Pauses (freeze) — product/scheduling.md L-100…L-104. A pause of the whole
 * student or of one direction takes the individual lessons in its window out
 * (they come back if it ends early), keeps the student out of group lessons
 * and charges (see `pause-windows.ts`), extends every package valid at its
 * start by its length, and is what "on hold" means for a student.
 */
@Injectable()
export class PausesService {
  private readonly logger = new Logger(PausesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly materializer: MaterializerService,
  ) {}

  async list(
    auth: AuthenticatedUser,
    query: ListPausesQueryDto,
  ): Promise<PauseListResponse> {
    const now = new Date();
    const where: Prisma.PauseWhereInput = {
      workspaceId: auth.workspaceId,
      ...(query.studentId ? { studentId: query.studentId } : {}),
      // Current: scheduled or running.
      ...(query.state === 'current'
        ? {
            OR: [
              { endedAt: { gt: now } },
              {
                endedAt: null,
                OR: [{ endsAt: null }, { endsAt: { gt: now } }],
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.pause.findMany({
        where,
        orderBy: [{ startsAt: 'desc' }, { id: 'desc' }],
        ...toSkipTake(query),
        include: pauseInclude,
      }),
      this.prisma.pause.count({ where }),
    ]);
    const items = await Promise.all(
      rows.map((row) => this.toResponse(this.prisma, row)),
    );
    return buildPaginatedResponse(items, total, query);
  }

  async getDetail(
    auth: AuthenticatedUser,
    pauseId: string,
  ): Promise<PauseResponse> {
    const row = await this.prisma.pause.findFirst({
      where: { id: pauseId, workspaceId: auth.workspaceId },
      include: pauseInclude,
    });
    if (!row) throw pauseNotFound();
    return this.toResponse(this.prisma, row);
  }

  async create(
    auth: AuthenticatedUser,
    dto: CreatePauseDto,
  ): Promise<PauseResponse> {
    const id = await this.prisma.$transaction((tx) =>
      this.createInTx(tx, auth, dto),
    );
    return this.getDetail(auth, id);
  }

  /**
   * Starts a pause (from now or a later date): takes the individual lessons
   * in its window out, pushes the packages valid at its start by its length
   * (an open pause does that when it ends) and puts the student on hold when a
   * whole-student pause is running.
   */
  async createInTx(
    tx: Db,
    auth: AuthenticatedUser,
    dto: CreatePauseDto,
  ): Promise<string> {
    await lockStudentLifecycles(tx, auth.workspaceId, [dto.studentId]);
    const student = await tx.student.findFirst({
      where: {
        id: dto.studentId,
        workspaceId: auth.workspaceId,
        deletedAt: null,
      },
      select: { id: true, status: true },
    });
    if (!student) throw studentNotFound();
    if (student.status === 'ARCHIVED') throw studentArchivedRequiresRestore();
    const enrollmentId = dto.enrollmentId ?? null;
    if (enrollmentId) {
      const direction = await tx.enrollment.findFirst({
        where: {
          id: enrollmentId,
          workspaceId: auth.workspaceId,
          studentId: student.id,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!direction) throw enrollmentNotFound();
    }

    const now = new Date();
    const requested = dto.startsAt ? new Date(dto.startsAt) : now;
    const startsAt = requested > now ? requested : now;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (endsAt && endsAt <= startsAt) throw pauseEnded();
    const window = { startsAt, endsAt };

    // One pause at a time for the same lessons: a whole-student pause
    // overlaps any other of the student's pauses.
    const others = await tx.pause.findMany({
      where: { studentId: student.id },
      select: {
        enrollmentId: true,
        startsAt: true,
        endsAt: true,
        endedAt: true,
      },
    });
    const clash = others.some(
      (other) =>
        pauseStateAt(other, now) !== 'CANCELLED' &&
        (other.enrollmentId === null ||
          enrollmentId === null ||
          other.enrollmentId === enrollmentId) &&
        pausesOverlap(other, window),
    );
    if (clash) throw pauseOverlap();

    const pause = await tx.pause.create({
      data: {
        workspaceId: auth.workspaceId,
        studentId: student.id,
        enrollmentId,
        startsAt,
        endsAt,
        reason: dto.reason?.trim() || null,
        suspensionToken: randomUUID(),
        createdById: auth.userId,
      },
    });
    const directions = await this.directionsOf(tx, pause);

    // The individual lessons in the window are taken out (L-101); group
    // lessons stay and leave the student out.
    const removed = await tx.lesson.updateMany({
      where: {
        enrollmentId: { in: directions },
        groupId: null,
        status: 'SCHEDULED',
        deletedAt: null,
        startsAtUtc: {
          gte: startsAt,
          ...(endsAt ? { lt: endsAt } : {}),
        },
      },
      data: { deletedAt: now, scheduleSuspensionToken: pause.suspensionToken },
    });

    const length = pauseLengthSeconds(window);
    if (length !== null) {
      await this.extendPackages(tx, pause.id, directions, startsAt, length);
    }
    await this.syncStudentStatus(tx, student.id, now);
    await this.audit.record(tx, {
      workspaceId: auth.workspaceId,
      actorId: auth.userId,
      action: 'CREATE',
      entity: 'PAUSE',
      entityId: pause.id,
      changes: this.audit.buildChanges(
        {},
        {
          studentId: student.id,
          enrollmentId,
          startsAt,
          endsAt,
          removedLessons: removed.count,
        },
      ),
    });
    return pause.id;
  }

  async end(
    auth: AuthenticatedUser,
    pauseId: string,
    force: boolean,
  ): Promise<PauseResponse> {
    await this.prisma.$transaction(async (tx) => {
      const pause = await tx.pause.findFirst({
        where: { id: pauseId, workspaceId: auth.workspaceId },
        select: { id: true, studentId: true },
      });
      if (!pause) throw pauseNotFound();
      await lockStudentLifecycles(tx, auth.workspaceId, [pause.studentId]);
      await this.endInTx(tx, auth, pause.id, force);
    });
    return this.getDetail(auth, pauseId);
  }

  /**
   * Ends a running pause now, or cancels one that has not begun: its
   * lessons from now on come back, checked for conflicts unless `force`
   * (L-103), and the packages keep only the extension the pause actually
   * used (L-102).
   */
  async endInTx(
    tx: Db,
    auth: AuthenticatedUser,
    pauseId: string,
    force: boolean,
  ): Promise<void> {
    const pause = await tx.pause.findUniqueOrThrow({ where: { id: pauseId } });
    const now = new Date();
    const state = pauseStateAt(pause, now);
    if (state === 'ENDED' || state === 'CANCELLED') throw pauseEnded();
    const endedAt = state === 'SCHEDULED' ? pause.startsAt : now;
    const directions = await this.directionsOf(tx, pause);

    const lessons = await tx.lesson.findMany({
      where: {
        scheduleSuspensionToken: pause.suspensionToken,
        status: 'SCHEDULED',
        startsAtUtc: { gte: now },
      },
      select: {
        id: true,
        teacherId: true,
        startsAtUtc: true,
        durationMin: true,
      },
    });
    if (!force) {
      await lockTeacherSchedules(
        tx,
        pause.workspaceId,
        lessons.map((lesson) => lesson.teacherId),
      );
      await assertLessonsAreFree(tx, pause.workspaceId, lessons);
    }
    if (lessons.length > 0) {
      await tx.lesson.updateMany({
        where: { id: { in: lessons.map((lesson) => lesson.id) } },
        data: { deletedAt: null, scheduleSuspensionToken: null },
      });
    }
    await tx.pause.update({ where: { id: pause.id }, data: { endedAt } });

    // The extension follows what the pause actually used.
    const used = pauseLengthSeconds({ ...pause, endedAt }) ?? 0;
    await this.extendPackages(tx, pause.id, directions, pause.startsAt, used);
    await this.syncStudentStatus(tx, pause.studentId, now);
    await this.topUp(tx, directions, now, force);
    await this.audit.record(tx, {
      workspaceId: pause.workspaceId,
      actorId: auth.userId,
      action: 'UPDATE',
      entity: 'PAUSE',
      entityId: pause.id,
      changes: this.audit.buildChanges(
        { endedAt: null },
        {
          endedAt,
          cancelled: state === 'SCHEDULED',
          restoredLessons: lessons.length,
        },
      ),
    });
  }

  /** The running whole-student pause, if the student is on one. */
  async activeWholePause(tx: Db, studentId: string): Promise<string | null> {
    const now = new Date();
    const pauses = await tx.pause.findMany({
      where: { studentId, enrollmentId: null },
      select: { id: true, startsAt: true, endsAt: true, endedAt: true },
    });
    return pauses.find((pause) => pauseCovers(pause, now))?.id ?? null;
  }

  /**
   * The student is "on hold" while a whole-student pause runs (L-104), and
   * back when none does. Archived students are left alone.
   */
  async syncStudentStatus(tx: Db, studentId: string, now: Date): Promise<void> {
    const [student, pauses] = await Promise.all([
      tx.student.findUniqueOrThrow({
        where: { id: studentId },
        select: { status: true },
      }),
      tx.pause.findMany({
        where: { studentId, enrollmentId: null },
        select: { startsAt: true, endsAt: true, endedAt: true },
      }),
    ]);
    if (student.status === 'ARCHIVED') return;
    const onHold = pauses.some((pause) => pauseCovers(pause, now));
    const next = onHold ? 'ON_HOLD' : 'ACTIVE';
    if (next !== student.status) {
      await tx.student.update({
        where: { id: studentId },
        data: { status: next },
      });
    }
  }

  /**
   * Every 10 minutes: students whose whole-student pause began or ended since
   * the last runs go on hold or come back (L-103, L-104).
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async run(now: Date = new Date()): Promise<void> {
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const pauses = await this.prisma.pause.findMany({
      where: {
        enrollmentId: null,
        OR: [
          { startsAt: { gt: since, lte: now } },
          { endsAt: { gt: since, lte: now } },
          { endedAt: { gt: since, lte: now } },
        ],
      },
      select: { studentId: true },
      distinct: ['studentId'],
    });
    for (const { studentId } of pauses) {
      try {
        await this.prisma.$transaction((tx) =>
          this.syncStudentStatus(tx, studentId, now),
        );
      } catch (error) {
        this.logger.error(`Failed to sync the pause of ${studentId}`, error);
      }
    }
  }

  /** The directions a pause covers: one, or every live one of the student. */
  private async directionsOf(
    tx: Db,
    pause: { studentId: string; enrollmentId: string | null },
  ): Promise<string[]> {
    if (pause.enrollmentId) return [pause.enrollmentId];
    const rows = await tx.enrollment.findMany({
      where: { studentId: pause.studentId, deletedAt: null },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  /**
   * Sets how far this pause pushes each package valid at its start (L-102):
   * a first call extends, a later one (an early end) adjusts by the
   * difference.
   */
  private async extendPackages(
    tx: Db,
    pauseId: string,
    directions: readonly string[],
    startsAt: Date,
    seconds: number,
  ): Promise<void> {
    const [packages, previous] = await Promise.all([
      tx.lessonPackage.findMany({
        where: { enrollmentId: { in: [...directions] }, deletedAt: null },
        select: { id: true, validFrom: true, expiresAt: true, endDate: true },
      }),
      tx.pausePackageExtension.findMany({ where: { pauseId } }),
    ]);
    const already = new Map(
      previous.map((row) => [row.packageId, row.extendedBySeconds]),
    );
    for (const pkg of packages) {
      const before = already.get(pkg.id);
      // A package the pause already pushed is adjusted; a new one is pushed
      // only if it was valid at the pause start (before any extension).
      if (before === undefined && !extendsPackage(pkg, startsAt)) continue;
      if (!pkg.expiresAt) continue;
      const delta = seconds - (before ?? 0);
      if (delta === 0) continue;
      const expiresAt = new Date(pkg.expiresAt.getTime() + delta * 1000);
      await tx.lessonPackage.update({
        where: { id: pkg.id },
        data: {
          expiresAt,
          ...(pkg.endDate
            ? { endDate: new Date(expiresAt.getTime() - 1) }
            : {}),
        },
      });
      await tx.pausePackageExtension.upsert({
        where: { pauseId_packageId: { pauseId, packageId: pkg.id } },
        create: { pauseId, packageId: pkg.id, extendedBySeconds: seconds },
        update: { extendedBySeconds: seconds },
      });
    }
  }

  /** Lessons after a pause come back: its directions' schedules top up. */
  private async topUp(
    tx: Db,
    directions: readonly string[],
    now: Date,
    force: boolean,
  ): Promise<void> {
    const series = await tx.lessonSeries.findMany({
      where: {
        enrollmentId: { in: [...directions] },
        deletedAt: null,
        schedule: { state: 'ACTIVE' },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
    });
    for (const row of series) {
      const horizon = await this.materializer.horizonFor(tx, row, now);
      await this.materializer.materializeSeries(
        tx,
        row,
        horizon,
        row.startDate > now ? row.startDate : now,
        force,
      );
    }
  }

  private async toResponse(db: Db, row: PauseRow): Promise<PauseResponse> {
    const removedLessons = await db.lesson.count({
      where: { scheduleSuspensionToken: row.suspensionToken },
    });
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      studentId: row.studentId,
      enrollmentId: row.enrollmentId,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString() ?? null,
      endedAt: row.endedAt?.toISOString() ?? null,
      state: pauseStateAt(row, new Date()),
      reason: row.reason,
      removedLessons,
      extensions: row.extensions,
      student: row.student,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
