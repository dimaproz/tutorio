import type {
  AttendanceStatusDto,
  GroupEnrollmentSummary,
  LessonAttendanceResponse,
  LessonDetailResponse,
  PackageResponse,
} from '@tutorio/validation';

/** Credits-left tone for group members and the package card (S01 decision 6). */
export type CreditTone = 'danger' | 'warning' | 'neutral';

export function creditTone(left: number): CreditTone {
  if (left <= 1) return 'danger';
  if (left === 2) return 'warning';
  return 'neutral';
}

export type MemberBadge =
  | { kind: 'paused' }
  | { kind: 'package'; left: number; total: number; tone: CreditTone }
  | { kind: 'perLesson'; amountMinor: number; currency: string }
  | { kind: 'charged'; left: number; tone: CreditTone }
  | { kind: 'exhausted' }
  | { kind: 'debt'; amountMinor: number; currency: string }
  | { kind: 'paid'; amountMinor: number; currency: string }
  | { kind: 'notCharged' };

export type MemberNote =
  | { kind: 'mark'; mark: AttendanceStatusDto }
  | { kind: 'paused' }
  | { kind: 'runningOut' }
  | { kind: 'lastCredit' };

export type MemberRow = {
  enrollmentId: string;
  student: { id: string; fullName: string; avatarKey: string | null };
  mark: AttendanceStatusDto | null;
  paused: boolean;
  note: MemberNote | null;
  badge: MemberBadge | null;
};

/** The package a member's next lesson draws on: the oldest valid one with a credit (L-81). */
function currentPackage(packages: PackageResponse[], enrollmentId: string, at: number) {
  return packages
    .filter(
      (pkg) =>
        pkg.enrollmentId === enrollmentId &&
        pkg.deletedAt === null &&
        pkg.remainingCredits > 0 &&
        (pkg.expiresAt === null || Date.parse(pkg.expiresAt) > at),
    )
    .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt) || a.id.localeCompare(b.id))[0];
}

/**
 * Every member of a group lesson with their mark and what the lesson costs
 * them (L-70…L-73). Before the lesson a member shows how they pay ("Package ·
 * 4 of 8", "Per lesson · 400 ₴") with a note when their package runs out;
 * once held, the charge ("Charged · 3 left", "Debt 400 ₴", "Not charged" for
 * an excused mark). A paused member is shown on pause and takes no part.
 */
export function memberRows({
  lesson,
  sheet,
  enrollments,
  packages,
}: {
  lesson: Pick<LessonDetailResponse, 'status' | 'charges' | 'startsAtUtc'>;
  sheet: LessonAttendanceResponse | undefined;
  enrollments: GroupEnrollmentSummary[];
  packages: PackageResponse[];
}): MemberRow[] {
  const at = Date.parse(lesson.startsAtUtc);
  const held = lesson.status === 'COMPLETED';
  const participants =
    sheet?.participants ??
    enrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      student: {
        id: enrollment.student.id,
        fullName: enrollment.student.fullName,
        avatarKey: enrollment.student.avatarKey,
      },
      status: null,
      markedAt: null,
      paused: false,
    }));

  return participants.map((participant) => {
    const enrollment = enrollments.find((row) => row.id === participant.enrollmentId);
    const charge = lesson.charges.find((row) => row.enrollmentId === participant.enrollmentId);
    const pkg = currentPackage(packages, participant.enrollmentId, at);
    const base = {
      enrollmentId: participant.enrollmentId,
      student: {
        id: participant.student.id,
        fullName: participant.student.fullName,
        avatarKey: participant.student.avatarKey,
      },
      mark: participant.status,
      paused: participant.paused,
    };

    if (participant.paused) {
      return { ...base, note: held ? { kind: 'paused' } : null, badge: { kind: 'paused' } };
    }

    if (held) {
      const note: MemberNote | null = participant.status
        ? { kind: 'mark', mark: participant.status }
        : null;
      if (!charge) return { ...base, note, badge: { kind: 'notCharged' } };
      if (charge.source === 'DEBT') return { ...base, note, badge: { kind: 'exhausted' } };
      if (charge.source === 'BALANCE') {
        const money = { amountMinor: charge.amountMinor, currency: charge.currency };
        return {
          ...base,
          note,
          badge: charge.paid ? { kind: 'paid', ...money } : { kind: 'debt', ...money },
        };
      }
      const paying = packages.find((row) => row.id === charge.packageId);
      const left = Math.max(paying?.remainingCredits ?? 0, 0);
      return { ...base, note, badge: { kind: 'charged', left, tone: creditTone(left) } };
    }

    const note: MemberNote | null = participant.status
      ? { kind: 'mark', mark: participant.status }
      : null;
    if (enrollment?.billingType === 'PER_LESSON') {
      return {
        ...base,
        note,
        badge: {
          kind: 'perLesson',
          amountMinor: enrollment.priceMinor,
          currency: enrollment.currency,
        },
      };
    }
    if (!pkg) return { ...base, note, badge: enrollment ? { kind: 'exhausted' } : null };
    const left = pkg.remainingCredits;
    const tone = creditTone(left);
    return {
      ...base,
      note:
        note ??
        (tone === 'danger'
          ? { kind: 'lastCredit' }
          : tone === 'warning'
            ? { kind: 'runningOut' }
            : null),
      badge: { kind: 'package', left, total: pkg.lessonsTotal, tone },
    };
  });
}

/** Attendance counts for the summary tiles; paused members are their own tile (L-73). */
export function attendanceCounts(rows: MemberRow[]) {
  const counts = { present: 0, absent: 0, excused: 0, paused: 0 };
  for (const row of rows) {
    if (row.paused) counts.paused += 1;
    else if (row.mark === 'PRESENT') counts.present += 1;
    else if (row.mark === 'ABSENT') counts.absent += 1;
    else if (row.mark === 'EXCUSED') counts.excused += 1;
  }
  return counts;
}

/** Members a held lesson charged: present and absent, not excused or paused (L-71). */
export function chargedCount(rows: MemberRow[]): number {
  return rows.filter((row) => !row.paused && (row.mark === 'PRESENT' || row.mark === 'ABSENT'))
    .length;
}

/** Active members who take part: everyone who is not paused. */
export function activeCount(rows: MemberRow[]): number {
  return rows.filter((row) => !row.paused).length;
}
