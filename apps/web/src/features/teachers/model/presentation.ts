import type {
  LessonResponse,
  ScheduleResponse,
  TeacherListItem,
  TeacherResponse,
  TeacherSummary,
} from '@tutorio/validation';
import { addCalendarDays, calendarWeekStart, zonedDate, zonedTime } from '@/lib/datetime';
import { DEFAULT_TEACHER_COLOR, TEACHER_COLORS } from '@/lib/theme/user-colors';

export { TEACHER_COLORS };

/** The teacher's calendar colour, or the studio default. */
export function teacherColor(teacher: Pick<TeacherResponse, 'color'>): string {
  return teacher.color ?? DEFAULT_TEACHER_COLOR;
}

/** Colours other live, active teachers already use, upper-case. */
export function usedTeacherColors(
  teachers: readonly Pick<TeacherResponse, 'id' | 'color' | 'status' | 'deletedAt'>[],
  selfId?: string,
): Set<string> {
  return new Set(
    teachers
      .filter(
        (teacher) =>
          teacher.id !== selfId &&
          teacher.status === 'ACTIVE' &&
          !teacher.deletedAt &&
          teacher.color,
      )
      .map((teacher) => teacher.color!.toUpperCase()),
  );
}

/**
 * The first palette colour nobody uses yet, for a new teacher: two teachers
 * start apart in the calendar unless the tutor picks otherwise.
 */
export function freeTeacherColor(used: ReadonlySet<string>): string {
  return TEACHER_COLORS.find((color) => !used.has(color)) ?? TEACHER_COLORS[0];
}

export type StudioSubject = {
  subject: string;
  /** The other teachers who teach it. */
  teachers: { id: string; fullName: string }[];
  /** Picked in the form. */
  selected: boolean;
  /** Typed in this form, not taught by anyone yet. */
  isNew: boolean;
};

const subjectKey = (subject: string) => subject.trim().toLocaleLowerCase();

/**
 * The studio's subjects for the form's popover: what this teacher picked
 * first (in the order picked), then everything the other active teachers teach, the
 * most taught first. Spelling follows the first teacher who has the subject.
 */
export function studioSubjects(
  teachers: readonly Pick<
    TeacherResponse,
    'id' | 'fullName' | 'subjects' | 'status' | 'deletedAt'
  >[],
  selected: readonly string[],
  selfId?: string,
): StudioSubject[] {
  const known = new Map<
    string,
    { subject: string; teachers: { id: string; fullName: string }[] }
  >();
  for (const teacher of teachers) {
    // Who teaches it now: an archived teacher no longer does.
    if (teacher.id === selfId || teacher.deletedAt || teacher.status !== 'ACTIVE') continue;
    for (const subject of teacher.subjects) {
      const entry = known.get(subjectKey(subject)) ?? { subject, teachers: [] };
      entry.teachers.push({ id: teacher.id, fullName: teacher.fullName });
      known.set(subjectKey(subject), entry);
    }
  }
  const picked = selected.map((subject) => {
    const entry = known.get(subjectKey(subject));
    return {
      subject: entry?.subject ?? subject,
      teachers: entry?.teachers ?? [],
      selected: true,
      isNew: !entry,
    };
  });
  const pickedKeys = new Set(selected.map(subjectKey));
  const others = [...known.entries()]
    .filter(([key]) => !pickedKeys.has(key))
    .map(([, entry]) => ({ ...entry, selected: false, isNew: false }))
    .sort((a, b) => b.teachers.length - a.teachers.length);
  return [...picked, ...others];
}

/** Every subject a live teacher teaches, for the list's subject filter. */
export function subjectOptions(
  teachers: readonly Pick<TeacherResponse, 'subjects' | 'deletedAt'>[],
): string[] {
  const seen = new Map<string, string>();
  for (const teacher of teachers) {
    if (teacher.deletedAt) continue;
    for (const subject of teacher.subjects) {
      if (!seen.has(subjectKey(subject))) seen.set(subjectKey(subject), subject);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** Adds a subject unless it is there already in any case. */
export function withSubject(subjects: readonly string[], subject: string): string[] {
  const trimmed = subject.trim();
  if (!trimmed || subjects.some((item) => subjectKey(item) === subjectKey(trimmed))) {
    return [...subjects];
  }
  return [...subjects, trimmed];
}

export function withoutSubject(subjects: readonly string[], subject: string): string[] {
  return subjects.filter((item) => subjectKey(item) !== subjectKey(subject));
}

/** "Anna Shevchenko" → "Anna S.", how the week names a student. */
export function shortName(fullName: string): string {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]}.` : (first ?? '');
}

export type WeekLessonState = 'done' | 'miss' | 'next' | 'planned';

export type WeekLesson = {
  id: string;
  time: string;
  title: string;
  group: boolean;
  state: WeekLessonState;
};

export type WeekDay = {
  date: string;
  today: boolean;
  lessons: WeekLesson[];
};

export type TeacherWeek = {
  monday: string;
  days: WeekDay[];
  total: number;
  held: number;
  ahead: number;
};

const CANCELLED = new Set(['CANCELLED_CHARGED', 'CANCELLED_UNCHARGED']);

/**
 * The teacher's week on the studio's clock, Monday to Sunday: lessons that
 * were not cancelled, each held (✓), missed (a no-show, ✗), the next one
 * coming (filled) or planned; «15 занять · 7 проведено · 8 попереду».
 */
export function teacherWeek(
  lessons: readonly LessonResponse[],
  monday: string,
  now: number,
  timeZone: string,
): TeacherWeek {
  const today = zonedDate(now, timeZone);
  const live = lessons
    .filter((lesson) => !CANCELLED.has(lesson.status) && !lesson.deletedAt)
    .sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc));
  const nextId = live.find(
    (lesson) => lesson.status === 'SCHEDULED' && Date.parse(lesson.startsAtUtc) >= now,
  )?.id;
  const days: WeekDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = addCalendarDays(monday, index);
    return { date, today: date === today, lessons: [] };
  });
  for (const lesson of live) {
    const day = days.find((item) => item.date === zonedDate(lesson.startsAtUtc, timeZone));
    if (!day) continue;
    day.lessons.push({
      id: lesson.id,
      time: zonedTime(lesson.startsAtUtc, timeZone),
      title: lesson.group?.name ?? shortName(lesson.student?.fullName ?? ''),
      group: Boolean(lesson.groupId),
      state:
        lesson.status === 'NO_SHOW'
          ? 'miss'
          : lesson.status === 'COMPLETED'
            ? 'done'
            : lesson.id === nextId
              ? 'next'
              : 'planned',
    });
  }
  const held = live.filter((lesson) => lesson.status !== 'SCHEDULED').length;
  return { monday, days, total: live.length, held, ahead: live.length - held };
}

/** The Monday of the week holding `now` on the studio's clock. */
export function currentMonday(now: number, timeZone: string): string {
  return calendarWeekStart(zonedDate(now, timeZone));
}

/** «Навантаження»: this week's whole hours, the six-week average and the bars. */
export function workload(summary: Pick<TeacherSummary, 'weeks'>): {
  hours: number;
  averageHours: number;
  bars: number[];
} {
  const minutes = summary.weeks.map((week) => week.minutes);
  const total = minutes.reduce((sum, value) => sum + value, 0);
  return {
    hours: Math.round((minutes.at(-1) ?? 0) / 60),
    averageHours: minutes.length ? Math.round(total / minutes.length / 60) : 0,
    bars: minutes,
  };
}

export type ScheduleMark = { tone: 'info'; from: string } | { tone: 'warning'; until: string };

/**
 * The one status a schedule row shows, only when it is needed: a planned
 * change (its date), or an end date (the last day, not the exclusive end).
 */
export function scheduleMark(
  schedule: Pick<ScheduleResponse, 'nextChange' | 'endsAt'>,
  timeZone: string,
): ScheduleMark | null {
  if (schedule.nextChange) {
    return { tone: 'info', from: zonedDate(schedule.nextChange.effectiveFrom, timeZone) };
  }
  if (schedule.endsAt) {
    return { tone: 'warning', until: addCalendarDays(zonedDate(schedule.endsAt, timeZone), -1) };
  }
  return null;
}

/** A schedule's slots Monday first, the way the weekday badges read. */
export function mondayFirstSlots<T extends { weekday: number; localTime: string }>(
  slots: readonly T[],
): T[] {
  const order = (weekday: number) => (weekday + 6) % 7;
  return [...slots].sort(
    (a, b) => order(a.weekday) - order(b.weekday) || a.localTime.localeCompare(b.localTime),
  );
}

/** The owner first, then the list's order — the API already puts them first. */
export function ownerFirst<T extends Pick<TeacherListItem, 'isMe'>>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => Number(b.isMe) - Number(a.isMe));
}
