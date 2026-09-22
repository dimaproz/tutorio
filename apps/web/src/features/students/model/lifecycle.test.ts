import { describe, expect, it } from 'vitest';
import {
  studentCollectionActions,
  studentLifecyclePolicy,
  studentStatusTransition,
} from './lifecycle';

describe('student lifecycle presentation policy', () => {
  it('lets an active student be scheduled and edited', () => {
    expect(studentLifecyclePolicy('ACTIVE')).toEqual({
      hero: ['schedule', 'edit'],
      canSchedule: true,
      readOnly: false,
    });
  });

  it('pauses planning for a student on hold', () => {
    expect(studentLifecyclePolicy('ON_HOLD')).toEqual({
      hero: ['edit'],
      canSchedule: false,
      readOnly: false,
    });
  });

  it('makes restore the only archived command', () => {
    expect(studentLifecyclePolicy('ARCHIVED')).toEqual({
      hero: ['restore'],
      canSchedule: false,
      readOnly: true,
    });
    expect(studentCollectionActions('ARCHIVED')).toEqual(['restore']);
  });

  it('keeps status changes out of the row menu', () => {
    expect(studentCollectionActions('ACTIVE')).toEqual(['edit']);
    expect(studentCollectionActions('ON_HOLD')).toEqual(['edit']);
  });
});

describe('studentStatusTransition', () => {
  it.each([
    ['ACTIVE', 'ON_HOLD', 'hold'],
    ['ACTIVE', 'ARCHIVED', 'archive'],
    ['ON_HOLD', 'ACTIVE', 'reactivate'],
    ['ON_HOLD', 'ARCHIVED', 'archive'],
    ['ARCHIVED', 'ACTIVE', 'restore'],
    ['ARCHIVED', 'ON_HOLD', 'unavailable'],
    ['ACTIVE', 'ACTIVE', 'none'],
  ] as const)('%s → %s is %s', (from, to, kind) => {
    expect(studentStatusTransition(from, to)).toEqual({ kind });
  });
});
