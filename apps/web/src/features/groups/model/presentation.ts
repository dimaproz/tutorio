import type {
  GroupAttendanceResponse,
  GroupDetail,
  GroupSchedule,
  PackageResponse,
} from '@tutorio/validation';
import type { StatBlockSegment } from '@/components/shared/stat-block';

export type ScheduleSlot = {
  weekday: number;
  localTime: string;
  durationMin: number;
  timezone: string;
};

/** Monday first: 1 … 6, then Sunday (0). */
function mondayFirst(weekday: number): number {
  return (weekday + 6) % 7;
}

/**
 * One slot per weekday of every live pattern, in week order then by time: the
 * weekday pills on a row and the rows of the schedule card.
 */
export function scheduleSlots(schedules: readonly GroupSchedule[]): ScheduleSlot[] {
  return schedules
    .flatMap((schedule) =>
      schedule.weekdays.map((weekday) => ({
        weekday,
        localTime: schedule.localTime,
        durationMin: schedule.durationMin,
        timezone: schedule.timezone,
      })),
    )
    .sort(
      (a, b) =>
        mondayFirst(a.weekday) - mondayFirst(b.weekday) || a.localTime.localeCompare(b.localTime),
    );
}

/** "17:00 – 18:00" from a wall-clock start and a length, wrapping at midnight. */
export function timeRange(localTime: string, durationMin: number): string {
  const [hours = 0, minutes = 0] = localTime.split(':').map(Number);
  const end = (hours * 60 + minutes + durationMin) % (24 * 60);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${localTime} – ${pad(Math.floor(end / 60))}:${pad(end % 60)}`;
}

/** "Артем Л." — a phone row keeps the first name and the surname's initial. */
export function shortName(fullName: string): string {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last.charAt(0)}.` : (first ?? '');
}

/** Students of the roster on a break: a paused membership or a student on hold. */
export function onHoldCount(enrollments: GroupDetail['enrollments']): number {
  return enrollments.filter(
    (enrollment) => enrollment.status === 'PAUSED' || enrollment.student.status === 'ON_HOLD',
  ).length;
}

/**
 * The package each member pays the group with (ADR 0007: every member has
 * their own): per student, the newest live one that still has lessons and has
 * not expired, else their newest live one. Sorted by the student's name.
 */
export function memberPackages(
  packages: readonly PackageResponse[],
  now: number,
): PackageResponse[] {
  const live = packages
    .filter((pkg) => pkg.deletedAt === null)
    .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
  const byStudent = new Map<string, PackageResponse>();
  for (const pkg of live) {
    const current = byStudent.get(pkg.studentId);
    const running =
      pkg.remainingCredits > 0 && (pkg.expiresAt === null || Date.parse(pkg.expiresAt) > now);
    const currentRunning =
      current !== undefined &&
      current.remainingCredits > 0 &&
      (current.expiresAt === null || Date.parse(current.expiresAt) > now);
    if (!current || (running && !currentRunning)) byStudent.set(pkg.studentId, pkg);
  }
  return [...byStudent.values()].sort((a, b) =>
    a.student.fullName.localeCompare(b.student.fullName),
  );
}

/** How many member packages are paid, and the money paid of their total. */
export function memberPackagesPaid(packages: readonly PackageResponse[]) {
  return {
    paid: packages.filter((pkg) => pkg.paymentStatus === 'PAID').length,
    total: packages.length,
    paidMinor: packages.reduce((sum, pkg) => sum + pkg.paidMinor, 0),
    totalMinor: packages.reduce((sum, pkg) => sum + pkg.totalPriceMinorSnapshot, 0),
  };
}

/**
 * The attendance metric's cells, one per window lesson: a cancelled or
 * unmarked lesson is a plain track, a lesson somebody missed is a miss, and
 * one where everybody marked came is fine. Participants on hold do not count.
 */
export function attendanceSegments(
  attendance: Pick<GroupAttendanceResponse, 'lessons' | 'rows'>,
): StatBlockSegment[] {
  const counted = attendance.rows.filter((row) => !row.hold);
  return attendance.lessons.map((_, index) => {
    const cells = counted.map((row) => row.cells[index]);
    if (cells.some((cell) => cell === 'absent')) return 'miss';
    if (cells.some((cell) => cell === 'present')) return 'ok';
    return 'planned';
  });
}

/** Share of `part` in `total` as a whole percent; 0 for an empty total. */
export function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** Who came to one window lesson, for the metric's tooltip (S08 decision 7). */
export type WindowLessonFacts = {
  lesson: GroupAttendanceResponse['lessons'][number];
  /** Participants not on hold who came, of those counted (came or missed). */
  present: number;
  counted: number;
  /** Who missed it, by name. */
  missed: string[];
};

/** Per window lesson: who came and who missed; participants on hold do not count. */
export function windowLessonFacts(
  attendance: Pick<GroupAttendanceResponse, 'lessons' | 'rows'>,
): WindowLessonFacts[] {
  const counted = attendance.rows.filter((row) => !row.hold);
  return attendance.lessons.map((lesson, index) => {
    const cells = counted.map((row) => ({ name: row.student.fullName, cell: row.cells[index] }));
    const present = cells.filter((item) => item.cell === 'present').length;
    const missed = cells.filter((item) => item.cell === 'absent').map((item) => item.name);
    return { lesson, present, counted: present + missed.length, missed };
  });
}

/**
 * For each cell of a participant's row, its place in a run of two or more
 * absences in a row — cancelled lessons are nobody's, so they neither break
 * nor extend a run —, else null: «Пропуск 1 з 2 поспіль».
 */
export function missStreaks(
  cells: readonly GroupAttendanceResponse['rows'][number]['cells'][number][],
): ({ index: number; count: number } | null)[] {
  const result: ({ index: number; count: number } | null)[] = cells.map(() => null);
  let run: number[] = [];
  const close = () => {
    if (run.length >= 2)
      run.forEach((cell, index) => (result[cell] = { index: index + 1, count: run.length }));
    run = [];
  };
  cells.forEach((cell, index) => {
    if (cell === 'absent') run.push(index);
    else if (cell !== 'cancelled') close();
  });
  close();
  return result;
}
