import type { LessonResponse, PackageResponse } from '@tutorio/validation';

export type AttendanceMark = 'ok' | 'miss';

export type StudentProfileMetrics = {
  /** The package in use: newest with credits left, else the newest one. */
  credits: { left: number; total: number; used: number; packageName: string | null } | null;
  /** Money received across the student's live packages. */
  paid: {
    paidMinor: number;
    owedMinor: number;
    currency: string;
    packages: number;
    lastPurchaseAt: string;
  } | null;
  /** The last finished lessons, oldest first, and what share was attended. */
  attendance: {
    marks: AttendanceMark[];
    attended: number;
    charged: number;
    percent: number;
  } | null;
  /** The nearest scheduled lesson. */
  next: LessonResponse | null;
};

const ATTENDANCE_WINDOW = 12;

/**
 * The four profile metrics from the student's own packages and lessons. A
 * metric with no underlying record is null, never zero: "no package yet" and
 * "a package with nothing left" are different things to a tutor.
 */
export function deriveStudentProfileMetrics({
  packages,
  lessons,
  now,
}: {
  packages: PackageResponse[];
  lessons: LessonResponse[];
  now: number;
}): StudentProfileMetrics {
  const byPurchase = [...packages].sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
  const current = byPurchase.find((pkg) => pkg.remainingCredits > 0) ?? byPurchase[0];
  const credits = current
    ? {
        left: Math.max(current.remainingCredits, 0),
        total: current.lessonsTotal,
        used: current.consumedCredits,
        packageName: current.name,
      }
    : null;

  const currencies = new Set(packages.map((pkg) => pkg.currency));
  const paid =
    packages.length > 0 && currencies.size === 1
      ? {
          paidMinor: packages.reduce((sum, pkg) => sum + pkg.paidMinor, 0),
          owedMinor: packages.reduce(
            (sum, pkg) => sum + Math.max(pkg.effectiveTotalMinor - pkg.paidMinor, 0),
            0,
          ),
          currency: packages[0].currency,
          packages: packages.length,
          lastPurchaseAt: byPurchase[0].purchasedAt,
        }
      : null;

  const finished = lessons
    .filter(
      (lesson) =>
        new Date(lesson.startsAtUtc).getTime() < now &&
        (lesson.status === 'COMPLETED' || lesson.status === 'CANCELLED_CHARGED'),
    )
    .sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc))
    .slice(-ATTENDANCE_WINDOW);
  const attended = finished.filter((lesson) => lesson.status === 'COMPLETED').length;
  const attendance =
    finished.length > 0
      ? {
          marks: finished.map((lesson): AttendanceMark =>
            lesson.status === 'COMPLETED' ? 'ok' : 'miss',
          ),
          attended,
          charged: finished.length - attended,
          percent: Math.round((attended / finished.length) * 100),
        }
      : null;

  const next =
    lessons
      .filter(
        (lesson) => lesson.status === 'SCHEDULED' && new Date(lesson.startsAtUtc).getTime() >= now,
      )
      .sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc))[0] ?? null;

  return { credits, paid, attendance, next };
}
