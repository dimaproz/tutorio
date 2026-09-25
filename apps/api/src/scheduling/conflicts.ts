import { Prisma } from '@prisma/client';
import {
  findScheduleConflicts,
  toInterval,
  type ParticipantInterval,
} from '@tutorio/domain';
import type { ScheduleConflict } from '@tutorio/validation';
import { scheduleConflict } from '../common/business.errors';
import { BUSY_STATUSES, MAX_DURATION_MIN } from './scheduling.shared';

/** A lesson being booked, moved or changed. */
export interface ConflictCandidate {
  /** The lesson's id when it exists; any unique key for a new one. */
  id: string;
  startsAtUtc: Date;
  durationMin: number;
  teacherId: string;
  /** Exactly one target: an individual enrollment or a group. */
  enrollmentId?: string | null;
  groupId?: string | null;
  /**
   * A student with no direction with this teacher yet (a preview before the
   * booking opens one, L-2): checked as that student.
   */
  studentId?: string | null;
}

/**
 * The students taking part in each target: the individual lesson's student,
 * or a group's active members (paused members take no part, L-73).
 */
async function participantsOf(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  targets: { enrollmentIds: string[]; groupIds: string[] },
): Promise<{
  byEnrollment: Map<string, string>;
  byGroup: Map<string, string[]>;
}> {
  const [individual, members] = await Promise.all([
    targets.enrollmentIds.length
      ? tx.enrollment.findMany({
          where: { workspaceId, id: { in: targets.enrollmentIds } },
          select: { id: true, studentId: true },
        })
      : [],
    targets.groupIds.length
      ? tx.enrollment.findMany({
          where: {
            workspaceId,
            groupId: { in: targets.groupIds },
            ...activeMembershipWhere,
          },
          select: { groupId: true, studentId: true },
        })
      : [],
  ]);
  const byGroup = new Map<string, string[]>();
  for (const row of members) {
    byGroup.set(row.groupId!, [
      ...(byGroup.get(row.groupId!) ?? []),
      row.studentId,
    ]);
  }
  return {
    byEnrollment: new Map(individual.map((row) => [row.id, row.studentId])),
    byGroup,
  };
}

const activeMembershipWhere = {
  deletedAt: null,
  status: 'ACTIVE',
  student: { deletedAt: null, status: { not: 'ARCHIVED' } },
} satisfies Prisma.EnrollmentWhereInput;

/**
 * Every overlap of the candidates with booked lessons, or with each other
 * (product/scheduling.md L-110): the same teacher, or a student taking part
 * in both — their individual lessons and the lessons of groups they are an
 * active member of. Lessons in `excludeIds`, and each candidate itself, never
 * count as busy.
 */
export async function detectScheduleConflicts(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  candidates: readonly ConflictCandidate[],
  options: { excludeIds?: Iterable<string> } = {},
): Promise<ScheduleConflict[]> {
  if (candidates.length === 0) return [];

  const own = await participantsOf(tx, workspaceId, {
    enrollmentIds: unique(candidates.map((c) => c.enrollmentId)),
    groupIds: unique(candidates.map((c) => c.groupId)),
  });
  const studentsOf = (target: {
    enrollmentId?: string | null;
    groupId?: string | null;
    studentId?: string | null;
  }): string[] =>
    target.enrollmentId
      ? [own.byEnrollment.get(target.enrollmentId)].filter(isString)
      : target.groupId
        ? (own.byGroup.get(target.groupId) ?? [])
        : target.studentId
          ? [target.studentId]
          : [];

  const proposed: ParticipantInterval[] = candidates.map((candidate) => ({
    ...toInterval(candidate.startsAtUtc, candidate.durationMin),
    id: candidate.id,
    teacherId: candidate.teacherId,
    studentIds: studentsOf(candidate),
  }));
  const teacherIds = unique(proposed.map((c) => c.teacherId));
  const studentIds = unique(proposed.flatMap((c) => c.studentIds));

  // The groups those students attend, so their group lessons count as busy.
  const memberships = studentIds.length
    ? await tx.enrollment.findMany({
        where: {
          workspaceId,
          studentId: { in: studentIds },
          groupId: { not: null },
          ...activeMembershipWhere,
        },
        select: { groupId: true, studentId: true },
      })
    : [];
  const studentsByGroup = new Map<string, string[]>();
  for (const row of memberships) {
    studentsByGroup.set(row.groupId!, [
      ...(studentsByGroup.get(row.groupId!) ?? []),
      row.studentId,
    ]);
  }

  const earliest = Math.min(...proposed.map((c) => c.start.getTime()));
  const latest = Math.max(...proposed.map((c) => c.end.getTime()));
  const excluded = [...new Set([...(options.excludeIds ?? [])])];
  const rows = await tx.lesson.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      status: BUSY_STATUSES,
      ...(excluded.length ? { id: { notIn: excluded } } : {}),
      startsAtUtc: {
        gte: new Date(earliest - MAX_DURATION_MIN * 60_000),
        lt: new Date(latest),
      },
      OR: [
        { teacherId: { in: teacherIds } },
        ...(studentIds.length
          ? [
              { enrollment: { studentId: { in: studentIds }, groupId: null } },
              { groupId: { in: [...studentsByGroup.keys()] } },
            ]
          : []),
      ],
    },
    select: {
      id: true,
      startsAtUtc: true,
      durationMin: true,
      teacherId: true,
      groupId: true,
      teacher: { select: { id: true, fullName: true } },
      enrollment: {
        select: { student: { select: { id: true, fullName: true } } },
      },
      group: { select: { id: true, name: true } },
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const busy: ParticipantInterval[] = rows.map((row) => ({
    ...toInterval(row.startsAtUtc, row.durationMin),
    id: row.id,
    teacherId: row.teacherId,
    studentIds: row.groupId
      ? (studentsByGroup.get(row.groupId) ?? [])
      : [row.enrollment?.student.id].filter(isString),
  }));

  const matches = findScheduleConflicts(proposed, busy);
  const matchedStudents = unique(matches.flatMap((match) => match.studentIds));
  const names = matchedStudents.length
    ? await tx.student.findMany({
        where: { id: { in: matchedStudents } },
        select: { id: true, fullName: true },
      })
    : [];
  const nameOf = new Map(names.map((row) => [row.id, row]));
  const candidateById = new Map(proposed.map((c) => [c.id, c]));

  // A clash between two candidates of one request has no booked lesson to
  // point at; `assertNoScheduleConflicts` reports it separately.
  return matches.flatMap((match): ScheduleConflict[] => {
    const candidate = candidateById.get(match.candidateId)!;
    const booked = byId.get(match.busyId);
    if (!booked) return [];
    return [
      {
        candidateStartsAtUtc: candidate.start.toISOString(),
        lessonId: booked.id,
        startsAtUtc: booked.startsAtUtc.toISOString(),
        durationMin: booked.durationMin,
        reason: match.reason,
        teacher: { id: booked.teacher.id, name: booked.teacher.fullName },
        student: booked.enrollment?.student ?? null,
        group: booked.group,
        students: match.studentIds.flatMap((id) => {
          const row = nameOf.get(id);
          return row ? [row] : [];
        }),
      },
    ];
  });
}

/**
 * Throws 409 SCHEDULE_CONFLICT with the overlaps unless there are none. The
 * caller skips it when the tutor chose "save anyway" (`force`, L-111).
 */
export async function assertNoScheduleConflicts(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  candidates: readonly ConflictCandidate[],
  options: { excludeIds?: Iterable<string> } = {},
): Promise<void> {
  const conflicts = await detectScheduleConflicts(
    tx,
    workspaceId,
    candidates,
    options,
  );
  const selfOverlap = hasInternalOverlap(candidates);
  if (conflicts.length > 0 || selfOverlap) {
    throw scheduleConflict(
      [...new Set(conflicts.map((conflict) => conflict.lessonId))],
      conflicts,
    );
  }
}

/** Whether two of the candidates overlap for the same teacher. */
function hasInternalOverlap(candidates: readonly ConflictCandidate[]): boolean {
  const matches = findScheduleConflicts(
    candidates.map((candidate) => ({
      ...toInterval(candidate.startsAtUtc, candidate.durationMin),
      id: candidate.id,
      teacherId: candidate.teacherId,
      studentIds: [],
    })),
    [],
  );
  return matches.length > 0;
}

function unique(values: readonly (string | null | undefined)[]): string[] {
  return [...new Set(values.filter(isString))];
}

function isString(value: string | null | undefined): value is string {
  return typeof value === 'string';
}
