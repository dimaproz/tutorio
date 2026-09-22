import type { StudentListItem } from '@tutorio/validation';

/** One rule for how a student learns, shared by the table and the phone card. */
export function studentLearningFormat(
  student: Pick<StudentListItem, 'groupNames' | 'activeEnrollmentCount'>,
): 'groups' | 'individual' | 'notConfigured' {
  if (student.groupNames.length > 0) {
    return 'groups';
  }
  return student.activeEnrollmentCount > 0 ? 'individual' : 'notConfigured';
}
