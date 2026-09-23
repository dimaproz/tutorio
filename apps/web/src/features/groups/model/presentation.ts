import type {
  GroupAttendanceResponse,
  GroupDetail,
  GroupSchedule,
  LessonResponse,
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
 * The package the group page shows: the newest live one that still has
 * lessons and has not expired, else the newest live one, else none.
 */
export function pickGroupPackage(
  packages: readonly PackageResponse[],
  now: number,
): PackageResponse | null {
  const live = packages
    .filter((pkg) => pkg.deletedAt === null)
    .sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
  const running = live.find(
    (pkg) =>
      pkg.remainingCredits > 0 && (pkg.expiresAt === null || Date.parse(pkg.expiresAt) > now),
  );
  return running ?? live[0] ?? null;
}

export type LessonBuckets = {
  /** From now on, soonest first. */
  upcoming: LessonResponse[];
  /** Before now, most recent first. */
  past: LessonResponse[];
  /** The next lesson that will take place: the highlighted row. */
  nextId: string | null;
};

export function lessonBuckets(lessons: readonly LessonResponse[], now: number): LessonBuckets {
  const upcoming = lessons
    .filter((lesson) => Date.parse(lesson.startsAtUtc) >= now)
    .sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc));
  const past = lessons
    .filter((lesson) => Date.parse(lesson.startsAtUtc) < now)
    .sort((a, b) => b.startsAtUtc.localeCompare(a.startsAtUtc));
  const next = upcoming.find((lesson) => lesson.status === 'SCHEDULED');
  return { upcoming, past, nextId: next?.id ?? null };
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
