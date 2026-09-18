import { describe, expect, it } from 'vitest';
import { studentLearningFormat } from './student-card';

describe('studentLearningFormat', () => {
  it('prefers named groups over the enrollment count', () => {
    expect(studentLearningFormat({ groupNames: ['B1 English'], activeEnrollmentCount: 2 })).toBe(
      'groups',
    );
  });

  it('shows Individual only for an active enrollment without a group', () => {
    expect(studentLearningFormat({ groupNames: [], activeEnrollmentCount: 1 })).toBe('individual');
  });

  it('does not infer individual learning from a missing group alone', () => {
    expect(studentLearningFormat({ groupNames: [], activeEnrollmentCount: 0 })).toBe(
      'notConfigured',
    );
  });
});
