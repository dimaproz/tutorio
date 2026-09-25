import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, type Pause } from '@prisma/client';
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
  PauseEndPreviewResponse,
  PauseEndQueryDto,
  PauseListResponse,
  PausePreviewDto,
  PausePreviewResponse,
  PauseResponse,
  UpdatePauseDto,
} from '@tutorio/validation';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  enrollmentNotFound,
  pauseEnded,
  pauseNotFound,
  pauseOverlap,
  pauseRunning,
  scheduleConflict,
  studentArchivedRequiresRestore,
  studentNotFound,
} from '../common/business.errors';
import { buildPaginatedResponse, toSkipTake } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import {
  detectScheduleConflictMatches,
  detectScheduleConflicts,
  type ConflictCandidate,
} from '../scheduling/conflicts';
import {
  lockStudentLifecycles,
  lockTeacherSchedules,
} from '../scheduling/lifecycle-suspension';
import { MaterializerService } from '../scheduling/materializer.service';

type Db = Prisma.TransactionClient;

/**
 * How the lessons a pause gives back are checked for overlaps (L-103,
 * L-110): `check` refuses the whole change with the overlaps described,
 * `force` brings every lesson back anyway (L-111), `skip` brings back only the
 * free ones and leaves the overlapping ones off.
 */
export type PauseEndMode = 'check' | 'force' | 'skip';

/** The mode a `?force` / `?skipConflicts` query asks for; `force` wins. */
export function endModeOf(query: PauseEndQueryDto): PauseEndMode {
  if (query.force) return 'force';
  return query.skipConflicts ? 'skip' : 'check';
}

const pauseInclude = {
  student: { select: { id: true, fullName: true } },
  extensions: { select: { packageId: true, extendedBySeconds: true } },
} satisfies Prisma.PauseInclude;

type PauseRow = Prisma.PauseGetPayload<{ include: typeof pauseInclude }>;

const returningLessonSelect = {
  id: true,
  teacherId: true,
  startsAtUtc: true,
  durationMin: true,
  enrollmentId: true,
  groupId: true,
} satisfies Prisma.LessonSelect;

type ReturningLesson = Prisma.LessonGetPayload<{
  select: typeof returningLessonSelect;
}>;

/** What releasing a pause did: when it ended and which lessons came back. */
interface Release {
  /** SCHEDULED: it was cancelled before it began; ACTIVE: it ended now. */
  state: 'SCHEDULED' | 'ACTIVE';
  endedAt: Date;
  /** Every lesson that came back: the ones it took out and the top-up's new ones. */
  returningIds: string[];
}

/** A package's end, before or after a change. */
type PackageEnds = Map<string, { name: string | null; expiresAt: Date }>;

/** Thrown to roll a preview's transaction back once it has been read. */
class PausePreviewRollback extends Error {}

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
   * What a pause would do, found by saving it (after releasing the pause it
   * replaces, as a change does) in a transaction that is then rolled back,
   * so the preview can never drift from the save.
   */
  async preview(
    auth: AuthenticatedUser,
    dto: PausePreviewDto,
  ): Promise<PausePreviewResponse> {
    const result: { preview?: PausePreviewResponse } = {};
    try {
      await this.prisma.$transaction(async (tx) => {
        await lockStudentLifecycles(tx, auth.workspaceId, [dto.studentId]);
        const { replacesPauseId, ...body } = dto;
        const packagesOfStudent = {
          workspaceId: auth.workspaceId,
          studentId: dto.studentId,
        };
        const before = await this.packageEnds(tx, packagesOfStudent);

        let pauseId: string;
        if (replacesPauseId) {
          const replaced = await this.lockedPause(tx, auth, replacesPauseId);
          if (replaced.studentId !== dto.studentId) throw pauseNotFound();
          const { enrollmentId, startsAt, endsAt, reason } = body;
          ({ pauseId } = await this.replaceInTx(tx, auth, replaced, {
            enrollmentId,
            startsAt,
            endsAt,
            reason,
          }));
        } else {
          pauseId = await this.createInTx(tx, auth, body);
        }

        const pause = await tx.pause.findUniqueOrThrow({
          where: { id: pauseId },
        });
        const directionIds = await this.directionsOf(tx, pause);
        const [directions, removed] = await Promise.all([
          tx.enrollment.findMany({
            where: { id: { in: directionIds }, status: { not: 'ARCHIVED' } },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            select: { id: true, groupId: true },
          }),
          tx.lesson.groupBy({
            by: ['enrollmentId'],
            where: { scheduleSuspensionToken: pause.suspensionToken },
            _count: { _all: true },
          }),
        ]);
        const groupIds = directions.flatMap((row) =>
          row.groupId ? [row.groupId] : [],
        );
        const groupLessons = groupIds.length
          ? await tx.lesson.groupBy({
              by: ['groupId'],
              where: {
                groupId: { in: groupIds },
                status: 'SCHEDULED',
                deletedAt: null,
                startsAtUtc: {
                  gte: pause.startsAt,
                  ...(pause.endsAt ? { lt: pause.endsAt } : {}),
                },
              },
              _count: { _all: true },
            })
          : [];
        const after = await this.packageEnds(tx, packagesOfStudent);

        result.preview = {
          startsAt: pause.startsAt.toISOString(),
          endsAt: pause.endsAt?.toISOString() ?? null,
          directions: directions.map((row) => ({
            enrollmentId: row.id,
            removedLessons:
              removed.find((count) => count.enrollmentId === row.id)?._count
                ._all ?? 0,
            groupLessons: row.groupId
              ? (groupLessons.find((count) => count.groupId === row.groupId)
                  ?._count._all ?? 0)
              : 0,
          })),
          extensions: extensionChanges(before, after),
          holdsStudent: pause.enrollmentId === null,
        };
        throw new PausePreviewRollback();
      });
    } catch (error) {
      if (!(error instanceof PausePreviewRollback)) throw error;
    }
    return result.preview!;
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
    mode: PauseEndMode,
  ): Promise<PauseResponse> {
    await this.prisma.$transaction(async (tx) => {
      const pause = await this.lockedPause(tx, auth, pauseId);
      await this.endInTx(tx, auth, pause.id, mode);
    });
    return this.getDetail(auth, pauseId);
  }

  /**
   * What ending (or cancelling) a pause now would do: found by ending it in a
   * transaction that is then rolled back.
   */
  async endPreview(
    auth: AuthenticatedUser,
    pauseId: string,
  ): Promise<PauseEndPreviewResponse> {
    const result: { preview?: PauseEndPreviewResponse } = {};
    try {
      await this.prisma.$transaction(async (tx) => {
        const pause = await this.lockedPause(tx, auth, pauseId);
        const now = new Date();
        const packagesOfPause = {
          enrollmentId: { in: await this.directionsOf(tx, pause) },
        };
        const before = await this.packageEnds(tx, packagesOfPause);
        const release = await this.releaseInTx(tx, pause, now);
        const lessons = await tx.lesson.findMany({
          where: { id: { in: release.returningIds } },
          orderBy: [{ startsAtUtc: 'asc' }, { id: 'asc' }],
          select: returningLessonSelect,
        });
        const conflicts = await detectScheduleConflicts(
          tx,
          pause.workspaceId,
          lessons.map(toCandidate),
          { excludeIds: release.returningIds },
        );
        const after = await this.packageEnds(tx, packagesOfPause);
        result.preview = {
          action: release.state === 'SCHEDULED' ? 'CANCEL' : 'END',
          lessons: lessons.map((lesson) => ({
            startsAtUtc: lesson.startsAtUtc.toISOString(),
            durationMin: lesson.durationMin,
            enrollmentId: lesson.enrollmentId,
            groupId: lesson.groupId,
          })),
          conflicts,
          extensions: extensionChanges(before, after),
        };
        throw new PausePreviewRollback();
      });
    } catch (error) {
      if (!(error instanceof PausePreviewRollback)) throw error;
    }
    return result.preview!;
  }

  /**
   * Ends a running pause now, or cancels one that has not begun: its
   * lessons from now on come back, checked for conflicts as `mode` says
   * (L-103, L-110), and the packages keep only the extension the pause
   * actually used (L-102).
   */
  async endInTx(
    tx: Db,
    auth: AuthenticatedUser,
    pauseId: string,
    mode: PauseEndMode,
  ): Promise<void> {
    const pause = await tx.pause.findUniqueOrThrow({ where: { id: pauseId } });
    const now = new Date();
    const release = await this.releaseInTx(tx, pause, now);
    const settled = await this.settleInTx(
      tx,
      pause,
      release.returningIds,
      mode,
      now,
    );
    await this.audit.record(tx, {
      workspaceId: pause.workspaceId,
      actorId: auth.userId,
      action: 'UPDATE',
      entity: 'PAUSE',
      entityId: pause.id,
      changes: this.audit.buildChanges(
        { endedAt: null },
        {
          endedAt: release.endedAt,
          cancelled: release.state === 'SCHEDULED',
          restoredLessons: settled.kept,
          skippedLessons: settled.skipped,
        },
      ),
    });
  }

  /**
   * Changes a pause: the old one ends now (or is cancelled) and a new one
   * with the merged values starts in the same transaction, so the lessons and
   * packages follow the new window. A running pause keeps its start and
   * direction. The lessons that come back and stay out of the new window are
   * checked as `mode` says.
   */
  async update(
    auth: AuthenticatedUser,
    pauseId: string,
    dto: UpdatePauseDto,
    mode: PauseEndMode,
  ): Promise<PauseResponse> {
    const nextId = await this.prisma.$transaction(async (tx) => {
      const pause = await this.lockedPause(tx, auth, pauseId);
      const now = new Date();
      const { pauseId: replacementId, release } = await this.replaceInTx(
        tx,
        auth,
        pause,
        dto,
        now,
      );
      const settled = await this.settleInTx(
        tx,
        pause,
        release.returningIds,
        mode,
        now,
      );
      await this.audit.record(tx, {
        workspaceId: pause.workspaceId,
        actorId: auth.userId,
        action: 'UPDATE',
        entity: 'PAUSE',
        entityId: pause.id,
        changes: this.audit.buildChanges(
          { endedAt: null, replacedByPauseId: null },
          {
            endedAt: release.endedAt,
            cancelled: release.state === 'SCHEDULED',
            replacedByPauseId: replacementId,
            restoredLessons: settled.kept,
            skippedLessons: settled.skipped,
          },
        ),
      });
      return replacementId;
    });
    return this.getDetail(auth, nextId);
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

  /** A pause of the workspace, read after its student's lifecycle lock. */
  private async lockedPause(
    tx: Db,
    auth: AuthenticatedUser,
    pauseId: string,
  ): Promise<Pause> {
    const found = await tx.pause.findFirst({
      where: { id: pauseId, workspaceId: auth.workspaceId },
      select: { id: true, studentId: true },
    });
    if (!found) throw pauseNotFound();
    await lockStudentLifecycles(tx, auth.workspaceId, [found.studentId]);
    return tx.pause.findUniqueOrThrow({ where: { id: found.id } });
  }

  /**
   * Releases `pause` and starts its replacement with the merged values: a
   * scheduled pause may change anything, a running one only its end and
   * reason (it restarts from now, so what it already used stays used).
   */
  private async replaceInTx(
    tx: Db,
    auth: AuthenticatedUser,
    pause: Pause,
    dto: UpdatePauseDto,
    now: Date = new Date(),
  ): Promise<{ pauseId: string; release: Release }> {
    const state = pauseStateAt(pause, now);
    if (state === 'ENDED' || state === 'CANCELLED') throw pauseEnded();
    const running = state === 'ACTIVE';
    if (running) {
      const movesStart =
        dto.startsAt !== undefined &&
        new Date(dto.startsAt).getTime() !== pause.startsAt.getTime();
      const movesDirection =
        dto.enrollmentId !== undefined &&
        (dto.enrollmentId ?? null) !== pause.enrollmentId;
      if (movesStart || movesDirection) throw pauseRunning();
    }

    const release = await this.releaseInTx(tx, pause, now);
    const pauseId = await this.createInTx(tx, auth, {
      studentId: pause.studentId,
      enrollmentId: running
        ? pause.enrollmentId
        : dto.enrollmentId !== undefined
          ? dto.enrollmentId
          : pause.enrollmentId,
      // A running pause goes on from now.
      startsAt: running
        ? undefined
        : (dto.startsAt ?? pause.startsAt.toISOString()),
      endsAt:
        dto.endsAt !== undefined
          ? dto.endsAt
          : (pause.endsAt?.toISOString() ?? null),
      reason: dto.reason !== undefined ? dto.reason : pause.reason,
    });
    return { pauseId, release };
  }

  /**
   * Ends a running pause now, or cancels one that has not begun, and brings
   * back every lesson it holds from now on: the ones it took out, and the
   * ones its directions' schedules generate into the freed time. Nothing is
   * checked for overlaps here — see `settleInTx`.
   */
  private async releaseInTx(tx: Db, pause: Pause, now: Date): Promise<Release> {
    const state = pauseStateAt(pause, now);
    if (state === 'ENDED' || state === 'CANCELLED') throw pauseEnded();
    const endedAt = state === 'SCHEDULED' ? pause.startsAt : now;
    const directions = await this.directionsOf(tx, pause);

    const suspended = await tx.lesson.findMany({
      where: {
        scheduleSuspensionToken: pause.suspensionToken,
        status: 'SCHEDULED',
        startsAtUtc: { gte: now },
      },
      select: { id: true, teacherId: true },
    });
    await lockTeacherSchedules(
      tx,
      pause.workspaceId,
      suspended.map((lesson) => lesson.teacherId),
    );
    if (suspended.length > 0) {
      await tx.lesson.updateMany({
        where: { id: { in: suspended.map((lesson) => lesson.id) } },
        data: { deletedAt: null, scheduleSuspensionToken: null },
      });
    }
    await tx.pause.update({ where: { id: pause.id }, data: { endedAt } });

    // The extension follows what the pause actually used.
    const used = pauseLengthSeconds({ ...pause, endedAt }) ?? 0;
    await this.extendPackages(tx, pause.id, directions, pause.startsAt, used);
    await this.syncStudentStatus(tx, pause.studentId, now);
    const created = await this.topUp(tx, directions, now);
    return {
      state,
      endedAt,
      returningIds: [
        ...new Set([...suspended.map((lesson) => lesson.id), ...created]),
      ],
    };
  }

  /**
   * Checks the lessons that came back and are still live for overlaps
   * (L-110): refuses with them described (`check`), keeps them all
   * (`force`), or takes the overlapping ones out again under the pause's
   * token (`skip`). Overlaps among the returning lessons themselves are not
   * reported: they stood side by side before the pause.
   */
  private async settleInTx(
    tx: Db,
    pause: Pause,
    returningIds: readonly string[],
    mode: PauseEndMode,
    now: Date,
  ): Promise<{ kept: number; skipped: number }> {
    if (returningIds.length === 0) return { kept: 0, skipped: 0 };
    const lessons = await tx.lesson.findMany({
      where: {
        id: { in: [...returningIds] },
        deletedAt: null,
        status: 'SCHEDULED',
      },
      select: returningLessonSelect,
    });
    if (mode === 'force' || lessons.length === 0) {
      return { kept: lessons.length, skipped: 0 };
    }
    const matches = await detectScheduleConflictMatches(
      tx,
      pause.workspaceId,
      lessons.map(toCandidate),
      { excludeIds: returningIds },
    );
    if (matches.length === 0) return { kept: lessons.length, skipped: 0 };
    if (mode === 'check') {
      const conflicts = matches.map((match) => match.conflict);
      throw scheduleConflict(
        [...new Set(conflicts.map((conflict) => conflict.lessonId))],
        conflicts,
      );
    }
    const skipped = [...new Set(matches.map((match) => match.candidateId))];
    await tx.lesson.updateMany({
      where: { id: { in: skipped } },
      data: { deletedAt: now, scheduleSuspensionToken: pause.suspensionToken },
    });
    return { kept: lessons.length - skipped.length, skipped: skipped.length };
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

  /** The ends of the live packages that have one, oldest purchase first. */
  private async packageEnds(
    tx: Db,
    where: Prisma.LessonPackageWhereInput,
  ): Promise<PackageEnds> {
    const rows = await tx.lessonPackage.findMany({
      where: { ...where, deletedAt: null, expiresAt: { not: null } },
      orderBy: [{ purchasedAt: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, expiresAt: true },
    });
    return new Map(
      rows.map((row) => [
        row.id,
        { name: row.name, expiresAt: row.expiresAt! },
      ]),
    );
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

  /**
   * Lessons after a pause come back: its directions' schedules top up, never
   * refusing on an overlap (the caller settles those). Returns the ids of the
   * lessons it created.
   */
  private async topUp(
    tx: Db,
    directions: readonly string[],
    now: Date,
  ): Promise<string[]> {
    const series = await tx.lessonSeries.findMany({
      where: {
        enrollmentId: { in: [...directions] },
        deletedAt: null,
        schedule: { state: 'ACTIVE' },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
    });
    const created: string[] = [];
    for (const row of series) {
      const horizon = await this.materializer.horizonFor(tx, row, now);
      const starts = await this.materializer.materializeSeries(
        tx,
        row,
        horizon,
        row.startDate > now ? row.startDate : now,
        true,
      );
      if (starts.length === 0) continue;
      const lessons = await tx.lesson.findMany({
        where: {
          seriesId: row.id,
          startsAtUtc: { in: starts },
          deletedAt: null,
        },
        select: { id: true },
      });
      created.push(...lessons.map((lesson) => lesson.id));
    }
    return created;
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

/** A returning lesson as a conflict candidate: its teacher and its students (L-110). */
function toCandidate(lesson: ReturningLesson): ConflictCandidate {
  return {
    id: lesson.id,
    startsAtUtc: lesson.startsAtUtc,
    durationMin: lesson.durationMin,
    teacherId: lesson.teacherId,
    enrollmentId: lesson.enrollmentId,
    groupId: lesson.groupId,
  };
}

/** The packages whose end moved between two reads, in the first read's order. */
function extensionChanges(
  before: PackageEnds,
  after: PackageEnds,
): PausePreviewResponse['extensions'] {
  return [...before].flatMap(([packageId, was]) => {
    const now = after.get(packageId);
    if (!now || now.expiresAt.getTime() === was.expiresAt.getTime()) return [];
    return [
      {
        packageId,
        name: was.name,
        expiresAt: was.expiresAt.toISOString(),
        nextExpiresAt: now.expiresAt.toISOString(),
      },
    ];
  });
}
