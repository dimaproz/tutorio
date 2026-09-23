import { describe, expect, it } from 'vitest';
import type { UpdateStudentDto } from '@tutorio/validation';
import {
  parentInvalidations,
  studentInvalidations,
  teacherInvalidations,
  workspaceSettingsInvalidations,
  type Invalidation,
} from './invalidation';

/** Reads a plan as `domain` (refetched now) or `domain~` (only marked stale). */
const summary = (invalidations: Invalidation[]) =>
  invalidations.map(
    ({ queryKey, refetchType }) => `${queryKey.join('.')}${refetchType === 'none' ? '~' : ''}`,
  );

const studentEdit = {
  fullName: 'Anna Shevchenko',
  avatarKey: 'user-1',
  notes: null,
} as UpdateStudentDto;

describe('studentInvalidations', () => {
  it('refreshes the student once and only marks what a profile edit outdates elsewhere', () => {
    expect(summary(studentInvalidations({ kind: 'update', dto: studentEdit }))).toEqual([
      'students',
      'parents~',
      'groups~',
      'packages~',
      'audit~',
    ]);
  });

  it('refreshes the parents when the links change', () => {
    expect(
      summary(studentInvalidations({ kind: 'update', dto: { parentIds: ['parent-1'] } })),
    ).toEqual(['students', 'parents', 'audit~']);
  });

  it('touches nothing else for a notes edit', () => {
    expect(
      summary(studentInvalidations({ kind: 'update', dto: { notes: 'Likes songs' } })),
    ).toEqual(['students', 'audit~']);
  });

  it('refreshes the enrollments when the lifecycle changes', () => {
    expect(summary(studentInvalidations({ kind: 'update', dto: { status: 'ON_HOLD' } }))).toEqual([
      'students',
      'parents~',
      'enrollments',
      'groups~',
      'packages~',
      'audit~',
    ]);
  });

  it('refreshes the schedule on archive and restore, which drop and bring back lessons', () => {
    for (const kind of ['archive', 'restore'] as const) {
      expect(summary(studentInvalidations({ kind }))).toEqual([
        'students',
        'parents~',
        'enrollments',
        'lessons',
        'series',
        'groups~',
        'packages~',
        'audit~',
      ]);
    }
  });

  it('refreshes parents after a create only when the student was linked to one', () => {
    const dto = { fullName: 'Maksym', timezone: 'Europe/Kyiv', status: 'ACTIVE' } as const;
    expect(summary(studentInvalidations({ kind: 'create', dto }))).toContain('parents~');
    expect(
      summary(studentInvalidations({ kind: 'create', dto: { ...dto, parentIds: ['parent-1'] } })),
    ).toContain('parents');
  });

  it('never invalidates the profile separately from the students root', () => {
    for (const plan of [
      studentInvalidations({ kind: 'update', dto: studentEdit }),
      studentInvalidations({ kind: 'archive' }),
    ]) {
      expect(plan.filter(({ queryKey }) => queryKey[0] === 'students')).toHaveLength(1);
    }
  });
});

describe('parentInvalidations', () => {
  it('refreshes the students when the links change or a parent is deleted', () => {
    expect(
      summary(parentInvalidations({ kind: 'update', dto: { studentIds: ['student-1'] } })),
    ).toEqual(['parents', 'students', 'audit~']);
    expect(summary(parentInvalidations({ kind: 'delete' }))).toEqual([
      'parents',
      'students',
      'audit~',
    ]);
  });

  it('only marks students stale for a contact edit and leaves them alone for notes', () => {
    expect(summary(parentInvalidations({ kind: 'update', dto: { phone: '+380' } }))).toEqual([
      'parents',
      'students~',
      'audit~',
    ]);
    expect(
      summary(parentInvalidations({ kind: 'update', dto: { notes: 'Call after 6' } })),
    ).toEqual(['parents', 'audit~']);
  });
});

describe('teacherInvalidations', () => {
  it('marks the places a teacher name shows as stale without reading them now', () => {
    expect(summary(teacherInvalidations({ kind: 'update', dto: { fullName: 'Olena' } }))).toEqual([
      'teachers',
      'enrollments~',
      'groups~',
      'lessons~',
      'audit~',
    ]);
    expect(summary(teacherInvalidations({ kind: 'create' }))).toEqual(['teachers', 'audit~']);
  });
});

describe('workspaceSettingsInvalidations', () => {
  it('refreshes the session and the audit log on the settings page', () => {
    expect(summary(workspaceSettingsInvalidations({ mode: 'SOLO' }))).toEqual([
      'session',
      'workspace.current~',
      'audit',
    ]);
  });

  it('marks enrollments and students stale when the cancellation deadline changes', () => {
    expect(summary(workspaceSettingsInvalidations({ cancellationDeadlineHours: 12 }))).toEqual([
      'session',
      'workspace.current~',
      'enrollments~',
      'students~',
      'audit',
    ]);
  });
});
