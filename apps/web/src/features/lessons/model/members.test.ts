import { describe, expect, it } from 'vitest';
import type {
  GroupEnrollmentSummary,
  LessonAttendanceResponse,
  LessonChargeResponse,
  PackageResponse,
} from '@tutorio/validation';
import { attendanceCounts, chargedCount, creditTone, memberRows } from './members';
import { lessonFixture } from './testing';

const member = (n: number, billingType: 'PACKAGE' | 'PER_LESSON' = 'PACKAGE') =>
  ({
    id: `e${n}`,
    studentId: `s${n}`,
    billingType,
    priceMinor: 40000,
    currency: 'UAH',
    student: { id: `s${n}`, fullName: `Student ${n}`, avatarKey: null, status: 'ACTIVE' },
  }) as GroupEnrollmentSummary;

const pkg = (n: number, remainingCredits: number): PackageResponse =>
  ({
    id: `p${n}`,
    enrollmentId: `e${n}`,
    lessonsTotal: 8,
    remainingCredits,
    purchasedAt: '2026-09-01T10:00:00.000Z',
    expiresAt: null,
    deletedAt: null,
  }) as PackageResponse;

const sheet = (
  marks: Array<[number, LessonAttendanceResponse['participants'][number]['status'], boolean?]>,
): LessonAttendanceResponse => ({
  lessonId: 'l1',
  startsAtUtc: '2026-09-15T15:00:00.000Z',
  status: 'COMPLETED',
  markable: true,
  participants: marks.map(([n, status, paused = false]) => ({
    enrollmentId: `e${n}`,
    student: { id: `s${n}`, fullName: `Student ${n}`, avatarKey: null },
    status,
    markedAt: null,
    paused,
  })),
});

const charge = (n: number, fields: Partial<LessonChargeResponse>): LessonChargeResponse => ({
  id: `c${n}`,
  enrollmentId: `e${n}`,
  source: 'PACKAGE',
  packageId: `p${n}`,
  amountMinor: 40000,
  currency: 'UAH',
  paid: true,
  student: { id: `s${n}`, fullName: `Student ${n}` },
  ...fields,
});

describe('credit tone', () => {
  it('is danger at one or none, warning at two (S01 decision 6)', () => {
    expect([0, 1, 2, 3].map(creditTone)).toEqual(['danger', 'danger', 'warning', 'neutral']);
  });
});

describe('group member rows', () => {
  const enrollments = [member(1), member(2), member(3, 'PER_LESSON'), member(4), member(5)];

  it('shows how each member pays before the lesson', () => {
    const rows = memberRows({
      lesson: lessonFixture({ groupId: 'g1', startsAtUtc: '2026-09-15T15:00:00.000Z' }),
      sheet: sheet([
        [1, null],
        [2, null],
        [3, null],
        [4, null],
        [5, null, true],
      ]),
      enrollments,
      packages: [pkg(1, 4), pkg(2, 2), pkg(4, 1)],
    });
    expect(rows.map((row) => [row.badge, row.note])).toEqual([
      [{ kind: 'package', left: 4, total: 8, tone: 'neutral' }, null],
      [{ kind: 'package', left: 2, total: 8, tone: 'warning' }, { kind: 'runningOut' }],
      [{ kind: 'perLesson', amountMinor: 40000, currency: 'UAH' }, null],
      [{ kind: 'package', left: 1, total: 8, tone: 'danger' }, { kind: 'lastCredit' }],
      [{ kind: 'paused' }, null],
    ]);
  });

  it('shows the mark and the charge of each member once held', () => {
    const rows = memberRows({
      lesson: lessonFixture({
        groupId: 'g1',
        status: 'COMPLETED',
        charges: [
          charge(1, {}),
          charge(2, { source: 'DEBT', packageId: null, paid: false }),
          charge(3, { source: 'BALANCE', packageId: null, paid: false }),
        ],
      }),
      sheet: sheet([
        [1, 'PRESENT'],
        [2, 'PRESENT'],
        [3, 'ABSENT'],
        [4, 'EXCUSED'],
        [5, null, true],
      ]),
      enrollments,
      packages: [pkg(1, 3)],
    });
    expect(rows.map((row) => row.badge)).toEqual([
      { kind: 'charged', left: 3, tone: 'neutral' },
      { kind: 'exhausted' },
      { kind: 'debt', amountMinor: 40000, currency: 'UAH' },
      { kind: 'notCharged' },
      { kind: 'paused' },
    ]);
    expect(rows[3]!.note).toEqual({ kind: 'mark', mark: 'EXCUSED' });
    expect(rows[4]!.note).toEqual({ kind: 'paused' });
    expect(attendanceCounts(rows)).toEqual({ present: 2, absent: 1, excused: 1, paused: 1 });
    expect(chargedCount(rows)).toBe(3);
  });
});
