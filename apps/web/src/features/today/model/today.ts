import type { AttentionCategory, LessonResponse } from '@tutorio/validation';
import {
  addCalendarDays,
  dayEndIso,
  dayStartIso,
  zonedDate,
  zonedMinutesOfDay,
} from '@/lib/datetime';

// ---------------------------------------------------------------------------
// Whose day (S11 brief, «Whose day: the scope»)
// ---------------------------------------------------------------------------

/**
 * `solo`: the tutor's day — tutor mode, or the owner is the studio's only
 * active teacher; no switch, no teacher marks. `studio`: the owner does not
 * teach; the studio's day with each lesson's teacher. `switch`: the owner
 * teaches with colleagues — «Мої · Студія».
 */
export type ScopeMode = 'solo' | 'studio' | 'switch';

export const SCOPE_CHOICES = ['mine', 'studio'] as const;
export type ScopeChoice = (typeof SCOPE_CHOICES)[number];

export function scopeMode(input: {
  solo: boolean;
  /** The owner's own teaching profile. */
  me: { id: string; status: string } | null;
  /** Active teachers besides the owner. */
  others: number;
}): ScopeMode {
  if (input.solo) return 'solo';
  if (!input.me || input.me.status !== 'ACTIVE') return 'studio';
  return input.others > 0 ? 'switch' : 'solo';
}

export type ScopeView = {
  /** Only this teacher's lessons and exceptions; null for everything. */
  teacherId: string | null;
  /** Each lesson shows its teacher. */
  showTeacher: boolean;
};

/** «Мої» filters the day and the exceptions; money is never filtered. */
export function scopeView(mode: ScopeMode, choice: ScopeChoice, meId: string | null): ScopeView {
  if (mode === 'switch' && choice === 'mine' && meId)
    return { teacherId: meId, showTeacher: false };
  return { teacherId: null, showTeacher: mode !== 'solo' };
}

// ---------------------------------------------------------------------------
// The day
// ---------------------------------------------------------------------------

export type PartOfDay = 'morning' | 'day' | 'evening';

/** «Доброго ранку / дня / вечора» by the studio's clock. */
export function partOfDay(now: number, timeZone: string): PartOfDay {
  const minutes = zonedMinutesOfDay(new Date(now), timeZone);
  if (minutes >= 5 * 60 && minutes < 12 * 60) return 'morning';
  if (minutes >= 12 * 60 && minutes < 18 * 60) return 'day';
  return 'evening';
}

export type StudioDays = {
  today: string;
  tomorrow: string;
  /** Today's window. */
  day: { from: string; to: string };
  /** From tomorrow two weeks ahead: «Завтра» and the nearest day of a free day. */
  ahead: { from: string; to: string };
};

/** How far a free day looks for the next lessons. */
export const LOOKAHEAD_DAYS = 14;

export function studioDays(now: number, timeZone: string): StudioDays {
  return daysFrom(zonedDate(new Date(now), timeZone), timeZone);
}

/** The same windows from the studio's date. */
export function daysFrom(today: string, timeZone: string): StudioDays {
  const tomorrow = addCalendarDays(today, 1);
  return {
    today,
    tomorrow,
    day: { from: dayStartIso(today, timeZone), to: dayEndIso(today, timeZone) },
    ahead: {
      from: dayStartIso(tomorrow, timeZone),
      to: dayEndIso(addCalendarDays(today, LOOKAHEAD_DAYS), timeZone),
    },
  };
}

type DayLesson = Pick<LessonResponse, 'id' | 'startsAtUtc' | 'durationMin' | 'status'>;

const cancelled = (lesson: DayLesson) =>
  lesson.status === 'CANCELLED_CHARGED' || lesson.status === 'CANCELLED_UNCHARGED';
const endOf = (lesson: DayLesson) => Date.parse(lesson.startsAtUtc) + lesson.durationMin * 60_000;

export type DayOverview<T extends DayLesson> = {
  /** Every lesson of the day, cancelled ones included, earliest first. */
  lessons: T[];
  cancelled: number;
  /** Lessons that took or take place. */
  taking: number;
  /** The lesson running now (the earliest, if several). */
  running: T | null;
  /** The next lesson to start today. */
  next: T | null;
  /** Every lesson that takes place is over: «На сьогодні все». */
  over: boolean;
  /** How many rows come before the «зараз» line: those that started by now. */
  nowAfter: number;
};

export function dayOverview<T extends DayLesson>(input: readonly T[], now: number): DayOverview<T> {
  const lessons = [...input].sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc));
  const live = lessons.filter((lesson) => !cancelled(lesson));
  const running =
    live.find((lesson) => Date.parse(lesson.startsAtUtc) <= now && now < endOf(lesson)) ?? null;
  const next = live.find((lesson) => Date.parse(lesson.startsAtUtc) > now) ?? null;
  return {
    lessons,
    cancelled: lessons.length - live.length,
    taking: live.length,
    running,
    next,
    over: live.length > 0 && live.every((lesson) => endOf(lesson) <= now),
    nowAfter: lessons.filter((lesson) => Date.parse(lesson.startsAtUtc) <= now).length,
  };
}

/** The first day with lessons among `lessons` (already after today), by the studio's date. */
export function nearestDay<T extends Pick<LessonResponse, 'startsAtUtc'>>(
  lessons: readonly T[],
  timeZone: string,
): { date: string; lessons: T[] } | null {
  const sorted = [...lessons].sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc));
  const first = sorted[0];
  if (!first) return null;
  const date = zonedDate(new Date(first.startsAtUtc), timeZone);
  return {
    date,
    lessons: sorted.filter((lesson) => zonedDate(new Date(lesson.startsAtUtc), timeZone) === date),
  };
}

/** The lessons of one studio date. */
export function lessonsOn<T extends Pick<LessonResponse, 'startsAtUtc'>>(
  lessons: readonly T[],
  date: string,
  timeZone: string,
): T[] {
  return lessons.filter((lesson) => zonedDate(new Date(lesson.startsAtUtc), timeZone) === date);
}

// ---------------------------------------------------------------------------
// «Потребує уваги»
// ---------------------------------------------------------------------------

/** The category open at first: the first one with something in it. */
export function firstOpen(categories: readonly AttentionCategory[]): string {
  return categories.find((category) => category.count > 0)?.kind ?? '';
}

/** Where «Усі N →» of a category leads. */
export function categoryHref(
  kind: AttentionCategory['kind'],
  teacherId: string | null,
): string | null {
  // The lessons list opens on this month; the exceptions span every date.
  const teacher = `&period=all${teacherId ? `&teacher=${teacherId}` : ''}`;
  switch (kind) {
    case 'attendance':
      return `/app/lessons?quick=unconfirmed${teacher}`;
    case 'makeups':
      return `/app/lessons?quick=needs_makeup${teacher}`;
    case 'debtors':
      return `/app/lessons?quick=unpaid${teacher}`;
    case 'unpaidPackages':
      return '/app/packages?tab=UNPAID';
    case 'endingPackages':
    case 'expiringPackages':
      return '/app/packages?tab=ENDING';
    case 'pauses':
      return '/app/students?status=ON_HOLD';
  }
}
