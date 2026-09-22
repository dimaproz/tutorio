import { describe, expect, it } from 'vitest';
import { studentCollectionActions, studentLifecyclePolicy } from './lifecycle';

describe('student lifecycle presentation policy', () => {
  it('keeps operational commands consistent for active and on-hold students', () => {
    for (const status of ['ACTIVE', 'ON_HOLD'] as const) {
      expect(studentLifecyclePolicy(status)).toEqual({
        primary: 'schedule', secondary: ['edit'], overflow: ['toggle-hold', 'archive'], readOnly: false,
      });
      expect(studentCollectionActions(status)).toEqual(['edit', 'toggle-hold', 'archive']);
    }
  });

  it('makes restore the only archived command', () => {
    expect(studentLifecyclePolicy('ARCHIVED')).toEqual({
      primary: 'restore', secondary: [], overflow: [], readOnly: true,
    });
    expect(studentCollectionActions('ARCHIVED')).toEqual(['restore']);
  });
});
