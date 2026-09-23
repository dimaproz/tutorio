import { describe, expect, it } from 'vitest';
import type { GroupAttendanceResponse, LessonResponse, PackageResponse } from '@tutorio/validation';
import {
  attendanceSegments,
  lessonBuckets,
  pickGroupPackage,
  scheduleSlots,
  shortName,
  timeRange,
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

function lesson(id: string, iso: string, status: LessonResponse['status'] = 'SCHEDULED') {
  return { id, startsAtUtc: iso, status } as LessonResponse;
}

describe('group lesson buckets', () => {
  it('splits at now and highlights the next lesson that will take place', () => {
    const buckets = lessonBuckets(
      [
        lesson('past-old', '2026-09-10T14:00:00.000Z', 'COMPLETED'),
        lesson('cancelled-next', '2026-09-25T14:00:00.000Z', 'CANCELLED_UNCHARGED'),
        lesson('later', '2026-09-30T14:00:00.000Z'),
        lesson('soon', '2026-09-26T14:00:00.000Z'),
        lesson('past-recent', '2026-09-20T14:00:00.000Z', 'COMPLETED'),
      ],
      NOW,
    );
    expect(buckets.upcoming.map((row) => row.id)).toEqual(['cancelled-next', 'soon', 'later']);
    expect(buckets.past.map((row) => row.id)).toEqual(['past-recent', 'past-old']);
    expect(buckets.nextId).toBe('soon');
  });
});

function pkg(patch: Partial<PackageResponse>): PackageResponse {
  return {
    id: 'p',
    deletedAt: null,
    remainingCredits: 5,
    expiresAt: null,
    purchasedAt: '2026-09-01T00:00:00.000Z',
    ...patch,
  } as PackageResponse;
}

describe('group package', () => {
  it('prefers the newest running package over a newer used-up one', () => {
    const picked = pickGroupPackage(
      [
        pkg({ id: 'used', remainingCredits: 0, purchasedAt: '2026-09-20T00:00:00.000Z' }),
        pkg({ id: 'running', purchasedAt: '2026-09-10T00:00:00.000Z' }),
        pkg({ id: 'expired', expiresAt: '2026-09-01T00:00:00.000Z' }),
      ],
      NOW,
    );
    expect(picked?.id).toBe('running');
  });

  it('falls back to the newest live package, and to none', () => {
    expect(pickGroupPackage([pkg({ id: 'used', remainingCredits: 0 })], NOW)?.id).toBe('used');
    expect(pickGroupPackage([], NOW)).toBeNull();
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
