import type { LessonResponse, PackageResponse } from '@tutorio/validation';
import { currentCreditsByStudent, type StudentCredits } from './collection-metrics';

export { isLowOnCredits, type StudentCredits } from './collection-metrics';

export type StudentBalance =
  | { kind: 'paid' }
  | { kind: 'partial'; owedMinor: number; currency: string }
  | { kind: 'due'; owedMinor: number; currency: string };

export type StudentNextLesson = {
  startsAtUtc: string;
  durationMin: number;
  teacherName: string;
};

export type StudentRollup = {
  credits?: StudentCredits;
  balance?: StudentBalance;
  next?: StudentNextLesson;
  /** The teacher of the student's next lesson, the best "who teaches" signal. */
  teacherName?: string;
};

const SCHEDULED = 'SCHEDULED';

type Accumulator = { owedMinor: number; paidMinor: number; currency: string; mixed: boolean };

/**
 * Per-student rollups for the collection: the credits of the live package,
 * what is still owed, and the next scheduled lesson. Everything is derived
 * from the same package and lesson reads the page already makes; a student
 * missing from either source simply has no rollup, never an invented one.
 *
 * `packagesComplete` must be false when the package page did not cover every
 * package: a partial read would report a debt-free student who is not.
 */
export function deriveStudentRollups({
  packages,
  packagesComplete,
  lessons,
  now,
}: {
  packages: PackageResponse[];
  packagesComplete: boolean;
  lessons: LessonResponse[];
  now: number;
}): Map<string, StudentRollup> {
  const rollups = new Map<string, StudentRollup>();
  const rollupOf = (studentId: string) => {
    const existing = rollups.get(studentId);
    if (existing) return existing;
    const created: StudentRollup = {};
    rollups.set(studentId, created);
    return created;
  };

  if (packagesComplete) {
    const money = new Map<string, Accumulator>();
    const addMoney = (
      studentId: string,
      owedMinor: number,
      paidMinor: number,
      currency: string,
    ) => {
      const current = money.get(studentId);
      if (!current) {
        money.set(studentId, { owedMinor, paidMinor, currency, mixed: false });
        return;
      }
      current.owedMinor += owedMinor;
      current.paidMinor += paidMinor;
      current.mixed ||= current.currency !== currency;
    };

    for (const [studentId, credits] of currentCreditsByStudent(packages)) {
      rollupOf(studentId).credits = credits;
    }

    // Every package belongs to one student's direction (ADR 0007).
    for (const pkg of packages) {
      addMoney(
        pkg.studentId,
        pkg.totalPriceMinorSnapshot - pkg.paidMinor,
        pkg.paidMinor,
        pkg.currency,
      );
    }

    for (const [studentId, sum] of money) {
      // Owed amounts in different currencies cannot be added into one figure.
      if (sum.mixed) continue;
      rollupOf(studentId).balance =
        sum.owedMinor <= 0
          ? { kind: 'paid' }
          : sum.paidMinor > 0
            ? { kind: 'partial', owedMinor: sum.owedMinor, currency: sum.currency }
            : { kind: 'due', owedMinor: sum.owedMinor, currency: sum.currency };
    }
  }

  const upcoming = lessons
    .filter(
      (lesson) => lesson.status === SCHEDULED && new Date(lesson.startsAtUtc).getTime() >= now,
    )
    .sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc));
  for (const lesson of upcoming) {
    if (!lesson.student) continue;
    const rollup = rollupOf(lesson.student.id);
    if (rollup.next) continue;
    rollup.next = {
      startsAtUtc: lesson.startsAtUtc,
      durationMin: lesson.durationMin,
      teacherName: lesson.teacher.name,
    };
    rollup.teacherName = lesson.teacher.name;
  }

  return rollups;
}

/** Whether a timestamp falls on the same local calendar day as `now`. */
export function isSameLocalDay(iso: string, now: number, timeZone?: string): boolean {
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return format.format(new Date(iso)) === format.format(new Date(now));
}
