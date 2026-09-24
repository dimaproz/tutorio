import type { Prisma } from '@prisma/client';
import { isPausedAt, type PauseWindow } from '@tutorio/domain';

type Db = Prisma.TransactionClient;

/** A direction and its student: what a pause may cover. */
export interface PausableDirection {
  id: string;
  studentId: string;
}

/** Pauses of a direction or of its whole student (L-100). */
function coveringWhere(
  directions: readonly PausableDirection[],
): Prisma.PauseWhereInput {
  return {
    OR: [
      { enrollmentId: { in: directions.map((direction) => direction.id) } },
      {
        enrollmentId: null,
        studentId: { in: [...new Set(directions.map((d) => d.studentId))] },
      },
    ],
  };
}

/** Pauses still covering some instant of `[from, until)`. */
function overlappingWhere(from: Date, until: Date): Prisma.PauseWhereInput {
  return {
    startsAt: { lt: until },
    OR: [
      { endedAt: { gt: from } },
      { endedAt: null, OR: [{ endsAt: null }, { endsAt: { gt: from } }] },
    ],
  };
}

/**
 * The pause windows of one direction (its own and its student's) that touch
 * `[from, until)`: the materializer generates no individual lesson inside
 * them (L-101).
 */
export async function pauseWindowsOf(
  db: Db,
  direction: PausableDirection,
  from: Date,
  until: Date,
): Promise<PauseWindow[]> {
  return db.pause.findMany({
    where: { AND: [coveringWhere([direction]), overlappingWhere(from, until)] },
    select: { startsAt: true, endsAt: true, endedAt: true },
  });
}

/**
 * The directions paused at `at`: a paused participant takes no part in a
 * lesson and is not charged (L-73, L-101).
 */
export async function pausedDirectionIds(
  db: Db,
  directions: readonly PausableDirection[],
  at: Date,
): Promise<Set<string>> {
  if (directions.length === 0) return new Set();
  const pauses = await db.pause.findMany({
    where: {
      AND: [
        coveringWhere(directions),
        overlappingWhere(at, new Date(at.getTime() + 1)),
      ],
    },
    select: {
      enrollmentId: true,
      studentId: true,
      startsAt: true,
      endsAt: true,
      endedAt: true,
    },
  });
  const paused = new Set<string>();
  for (const direction of directions) {
    const own = pauses.filter((pause) =>
      pause.enrollmentId === null
        ? pause.studentId === direction.studentId
        : pause.enrollmentId === direction.id,
    );
    if (isPausedAt(own, at)) paused.add(direction.id);
  }
  return paused;
}
