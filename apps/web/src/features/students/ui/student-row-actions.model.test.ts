import { describe, expect, it } from 'vitest';
import { studentRowActions } from './student-row-actions.model';

describe('studentRowActions', () => {
  it('offers only Restore for an archived student', () => {
    expect(studentRowActions('ARCHIVED')).toEqual(['restore']);
  });

  it.each(['ACTIVE', 'ON_HOLD'] as const)('keeps operational actions for %s students', (status) => {
    expect(studentRowActions(status)).toEqual(['edit', 'toggle-hold', 'archive']);
  });
});
