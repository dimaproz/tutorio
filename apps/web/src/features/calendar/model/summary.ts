import { isCancelled, lessonTime, type CalendarLesson } from './lessons';
import { minutesOfDay } from './period';

/** The shortest free stretch between lessons worth naming. */
const MIN_GAP = 30;

export type DaySummary = {
  count: number;
  minutes: number;
  held: number;
  running: number;
  upcoming: number;
  /** The day's makeup, with the lesson it replaces when the calendar has it. */
  makeup: { lesson: CalendarLesson; original: CalendarLesson | null } | null;
  /**
   * Free stretches between the day's lessons. Teacher working hours are out
   * of scope (L-121), so nothing before the first or after the last lesson.
   */
  gaps: { startMin: number; endMin: number }[];
};

/**
 * The day's summary on the day view: its lessons (cancelled ones left out),
 * their hours, how many passed, run and wait, the makeup and the free windows.
 */
export function daySummary(
  dayLessons: readonly CalendarLesson[],
  nowMs: number,
  timeZone: string,
  all: readonly CalendarLesson[] = dayLessons,
): DaySummary {
  const live = dayLessons
    .filter((lesson) => !isCancelled(lesson.status))
    .sort((left, right) => Date.parse(left.startsAtUtc) - Date.parse(right.startsAtUtc));
  const times = live.map((lesson) => lessonTime(lesson, nowMs));
  const makeupLesson = live.find((lesson) => lesson.kind === 'MAKEUP') ?? null;

  const gaps: DaySummary['gaps'] = [];
  let busyUntil: number | null = null;
  for (const lesson of live) {
    const start = minutesOfDay(new Date(lesson.startsAtUtc), timeZone);
    const end = Math.min(1440, start + lesson.durationMin);
    if (busyUntil !== null && start - busyUntil >= MIN_GAP) {
      gaps.push({ startMin: busyUntil, endMin: start });
    }
    busyUntil = busyUntil === null ? end : Math.max(busyUntil, end);
  }

  return {
    count: live.length,
    minutes: live.reduce((sum, lesson) => sum + lesson.durationMin, 0),
    held: times.filter((time) => time === 'past').length,
    running: times.filter((time) => time === 'running').length,
    upcoming: times.filter((time) => time === 'upcoming').length,
    makeup: makeupLesson
      ? {
          lesson: makeupLesson,
          original: all.find((lesson) => lesson.id === makeupLesson.originalLessonId) ?? null,
        }
      : null,
    gaps,
  };
}
