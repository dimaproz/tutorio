'use client';

import { useMemo } from 'react';
import type { GroupDetail, PauseResponse, ScheduleResponse } from '@tutorio/validation';
import { useSession } from '@/components/app/session-provider';
import {
  TEACHER_OPTIONS_FILTERS,
  useCurrentPausesQuery,
  useGroupQuery,
  usePackageQuery,
  useSchedulesQuery,
  useStudentBillingQuery,
  useStudentQuery,
  useTeachersQuery,
} from '../../api';
import {
  pauseAt,
  payingPackage,
  primaryDirection,
  resolveStudentBooking,
  type Direction,
  type StudentBooking,
} from '../../model/create-context';
import type { LessonTarget, PriceMode } from '../../model/create';

export type GroupBooking = {
  group: GroupDetail;
  target: LessonTarget;
  /** Live members (active or paused enrollments). */
  members: GroupDetail['enrollments'];
  /** Members on a pause at the first lesson (L-3, L-73). */
  paused: { name: string; endsAt: string | null }[];
  /** Members who pay their own price instead of the group's (L-11). */
  ownPrices: { name: string; priceMinor: number; currency: string }[];
  rateMinor: number;
  currency: string;
};

/**
 * Everything the lesson form reads for what is picked: the studio's mode,
 * currency and horizon; the teachers with their rates; for a student the
 * profile, the directions and their billing, the package that pays next,
 * the schedule with the teacher and a pause; for a group its roster, price,
 * schedule and paused members. Resolves where the lessons go and how the
 * price behaves (`model/create-context`).
 */
export function useCreateData({
  who,
  studentId,
  groupId,
  teacherId,
  firstStart,
  now,
}: {
  who: 'student' | 'group';
  studentId: string;
  groupId: string;
  teacherId: string;
  /** The first lesson's start, for pauses (L-3, L-100). */
  firstStart: number | null;
  /** The form's pinned clock, when there is no start yet. */
  now: number;
}) {
  const session = useSession();
  const workspace = session.workspace;
  const forStudent = who === 'student' && Boolean(studentId);
  const forGroup = who === 'group' && Boolean(groupId);

  const teachers = useTeachersQuery(TEACHER_OPTIONS_FILTERS);
  const student = useStudentQuery(studentId, forStudent);
  const billing = useStudentBillingQuery(forStudent ? studentId : null);
  const group = useGroupQuery(groupId, forGroup);
  const pauses = useCurrentPausesQuery(forStudent || forGroup);

  const primary = primaryDirection(billing.data);
  const regularTeacherId = forGroup
    ? (group.data?.teacherId ?? null)
    : forStudent
      ? (primary?.teacher.id ?? null)
      : null;
  const schedules = useSchedulesQuery(
    forGroup ? { groupId } : { studentId, teacherId: teacherId || undefined },
    (forGroup || forStudent) && (forGroup || Boolean(teacherId)),
  );
  const schedule: ScheduleResponse | null =
    schedules.data?.items.find((item) => item.state === 'ACTIVE') ?? null;

  const teacherRows = useMemo(() => teachers.data?.items ?? [], [teachers.data]);
  const teacherRate = (id: string) => {
    const row = teacherRows.find((item) => item.id === id);
    return row ? { amountMinor: row.defaultRateMinor, currency: row.currency } : null;
  };

  const booking: StudentBooking | null =
    forStudent && billing.data && teacherId
      ? resolveStudentBooking({
          studentId,
          teacherId,
          billing: billing.data,
          teacherRate: teacherRate(teacherId),
          studentRate: student.data
            ? { amountMinor: student.data.hourlyRateMinor, currency: student.data.currency }
            : null,
          defaultCurrency: workspace.defaultCurrency,
        })
      : null;

  const paying = payingPackage(booking?.direction ?? null);
  const pkg = usePackageQuery(paying?.id ?? '', Boolean(paying));
  const pauseList: PauseResponse[] = useMemo(() => pauses.data?.items ?? [], [pauses.data]);
  const at = firstStart ?? now;

  const studentPause =
    forStudent && booking
      ? pauseAt(pauseList, studentId, at, booking.direction?.enrollmentId)
      : null;

  const groupBooking: GroupBooking | null = useMemo(() => {
    if (!forGroup || !group.data) return null;
    const members = group.data.enrollments.filter((item) => item.status !== 'ARCHIVED');
    const paused = members
      .map((member) => {
        const pause = pauseAt(pauseList, member.studentId, at, member.id);
        if (pause) return { name: member.student.fullName, endsAt: pause.endsAt };
        return member.status === 'PAUSED' || member.student.status === 'ON_HOLD'
          ? { name: member.student.fullName, endsAt: null }
          : null;
      })
      .filter((item): item is { name: string; endsAt: string | null } => item !== null);
    return {
      group: group.data,
      target: { kind: 'group', groupId: group.data.id },
      members,
      paused,
      ownPrices: members
        .filter((member) => member.ownPrice)
        .map((member) => ({
          name: member.student.fullName,
          priceMinor: member.priceMinor,
          currency: member.currency,
        })),
      rateMinor: group.data.pricePerLesson ?? 0,
      currency: group.data.currency ?? workspace.defaultCurrency,
    };
  }, [at, forGroup, group.data, pauseList, workspace.defaultCurrency]);

  const priceMode: PriceMode = forGroup ? 'group' : booking ? booking.priceMode : 'none';

  return {
    solo: workspace.mode === 'SOLO',
    horizonWeeks: workspace.scheduleHorizonWeeks,
    defaultCurrency: workspace.defaultCurrency,
    teachers: teacherRows,
    firstTeacherId:
      teacherRows.find((row) => row.status !== 'ARCHIVED' && !row.deletedAt)?.id ?? null,
    student: forStudent ? (student.data ?? null) : null,
    billing: billing.data ?? null,
    primary,
    regularTeacherId,
    booking,
    credits:
      booking?.priceMode === 'package' && booking.direction
        ? {
            left: booking.direction.creditsLeft,
            total: pkg.data?.lessonsTotal ?? null,
            name: pkg.data?.name ?? paying?.name ?? null,
          }
        : null,
    studentPause,
    group: groupBooking,
    schedule,
    priceMode,
    loading:
      (forStudent && (billing.isPending || student.isPending)) || (forGroup && group.isPending),
  };
}

export type CreateData = ReturnType<typeof useCreateData>;
export type { Direction };
