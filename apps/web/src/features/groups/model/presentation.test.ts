import { describe, expect, it } from 'vitest';
import type { GroupAttendanceResponse, PackageResponse } from '@tutorio/validation';
import {
  attendanceSegments,
  memberPackages,
  memberPackagesPaid,
  missStreaks,
  scheduleSlots,
  shortName,
  timeRange,
  windowLessonFacts,
} from './presentation';

const NOW = Date.parse('2026-09-24T12:00:00.000Z');

describe('group schedule presentation', () => {
  it('lays the slots out Monday first, then by time', () => {
    const slots = scheduleSlots([
      { weekdays: [0, 4], localTime: '17:00', durationMin: 60, timezone: 'Europe/Kyiv' },
      { weekdays: [2], localTime: '09:00', durationMin: 45, timezone: 'Europe/Kyiv' },
    ]);
    expect(slots.map((slot) => `${slot.weekday}@${slot.localTime}`)).toEqual([
      '2@09:00',
      '4@17:00',
      '0@17:00',
    ]);
  });

  it('formats a time range across midnight', () => {
    expect(timeRange('17:00', 60)).toBe('17:00 – 18:00');
    expect(timeRange('23:30', 45)).toBe('23:30 – 00:15');
  });

  it('shortens a name to the first name and an initial', () => {
    expect(shortName('Артем Лисенко')).toBe('Артем Л.');
    expect(shortName('Madonna')).toBe('Madonna');
  });
});

function pkg(patch: Partial<PackageResponse>): PackageResponse {
  return {
    id: 'p',
    studentId: 'ann',
    student: { id: 'ann', fullName: 'Ann' },
    deletedAt: null,
    remainingCredits: 5,
    expiresAt: null,
    purchasedAt: '2026-09-01T00:00:00.000Z',
    paymentStatus: 'PENDING',
    paidMinor: 0,
    totalPriceMinorSnapshot: 1000,
    ...patch,
  } as PackageResponse;
}

describe('member packages', () => {
  it("shows each member's newest running package over a newer used-up one", () => {
    const bob = { studentId: 'bob', student: { id: 'bob', fullName: 'Bob', avatarKey: null } };
    const picked = memberPackages(
      [
        pkg({ id: 'used', remainingCredits: 0, purchasedAt: '2026-09-20T00:00:00.000Z' }),
        pkg({ id: 'running', purchasedAt: '2026-09-10T00:00:00.000Z' }),
        pkg({ id: 'expired', expiresAt: '2026-09-01T00:00:00.000Z' }),
        pkg({ id: 'bob-used', remainingCredits: 0, ...bob }),
      ],
      NOW,
    );
    expect(picked.map((row) => row.id)).toEqual(['running', 'bob-used']);
    expect(memberPackages([], NOW)).toEqual([]);
  });

  it('counts the packages paid and the money in', () => {
    expect(
      memberPackagesPaid([
        pkg({ paymentStatus: 'PAID', paidMinor: 1000 }),
        pkg({ paymentStatus: 'PARTIAL', paidMinor: 400 }),
      ]),
    ).toEqual({ paid: 1, total: 2, paidMinor: 1400, totalMinor: 2000 });
  });
});

describe('attendance segments', () => {
  it('marks a lesson somebody missed, ignoring students on hold', () => {
    const attendance = {
      lessons: [{}, {}, {}, {}],
      rows: [
        { hold: false, cells: ['present', 'absent', 'cancelled', 'unmarked'] },
        { hold: false, cells: ['present', 'present', 'cancelled', 'unmarked'] },
        { hold: true, cells: ['absent', 'present', 'cancelled', 'absent'] },
      ],
    } as unknown as GroupAttendanceResponse;
    expect(attendanceSegments(attendance)).toEqual(['ok', 'miss', 'planned', 'planned']);
  });
});

describe('attendance tooltips (S08)', () => {
  it('names who came and who missed each lesson, leaving holds out', () => {
    const attendance = {
      lessons: [{ id: 'a' }, { id: 'b' }],
      rows: [
        { hold: false, student: { fullName: 'Anna' }, cells: ['present', 'absent'] },
        { hold: false, student: { fullName: 'Artem' }, cells: ['absent', 'absent'] },
        { hold: true, student: { fullName: 'Kateryna' }, cells: ['present', 'unmarked'] },
      ],
    } as unknown as GroupAttendanceResponse;
    expect(windowLessonFacts(attendance)).toEqual([
      { lesson: { id: 'a' }, present: 1, counted: 2, missed: ['Artem'] },
      { lesson: { id: 'b' }, present: 0, counted: 2, missed: ['Anna', 'Artem'] },
    ]);
  });

  it('places a miss in its run of misses in a row, across cancelled lessons', () => {
    expect(
      missStreaks(['cancelled', 'present', 'absent', 'cancelled', 'absent', 'present', 'absent']),
    ).toEqual([null, null, { index: 1, count: 2 }, null, { index: 2, count: 2 }, null, null]);
    expect(missStreaks(['absent', 'absent', 'absent'])).toEqual([
      { index: 1, count: 3 },
      { index: 2, count: 3 },
      { index: 3, count: 3 },
    ]);
  });
});
