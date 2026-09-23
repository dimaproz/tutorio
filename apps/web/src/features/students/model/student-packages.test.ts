import { describe, expect, it } from 'vitest';
import { studentPackagesFilters, visibleStudentPackages } from './student-packages';

const live = { id: 'live', deletedAt: null };
const deleted = { id: 'deleted', deletedAt: '2026-09-01T10:00:00.000Z' };

describe('studentPackagesFilters', () => {
  it('reads every package of the student, independent of the record state', () => {
    expect(studentPackagesFilters('student-1')).toEqual({
      page: 1,
      pageSize: 100,
      studentId: 'student-1',
      state: 'all',
    });
  });
});

describe('visibleStudentPackages', () => {
  it('shows a live profile only its live packages', () => {
    expect(visibleStudentPackages([live, deleted], false)).toEqual([live]);
  });

  it('keeps the deleted packages in an archived profile history', () => {
    expect(visibleStudentPackages([live, deleted], true)).toEqual([live, deleted]);
  });
});
