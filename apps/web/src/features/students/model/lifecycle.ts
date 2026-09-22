import type { StudentStatusDto } from '@tutorio/validation';

export type StudentLifecycleAction =
  | 'schedule'
  | 'edit'
  | 'toggle-hold'
  | 'archive'
  | 'restore';

export interface StudentLifecyclePolicy {
  primary: StudentLifecycleAction;
  secondary: StudentLifecycleAction[];
  overflow: StudentLifecycleAction[];
  readOnly: boolean;
}

/** One presentation policy for collection rows, cards, and the detail header. */
export function studentLifecyclePolicy(status: StudentStatusDto): StudentLifecyclePolicy {
  if (status === 'ARCHIVED') {
    return { primary: 'restore', secondary: [], overflow: [], readOnly: true };
  }
  return {
    primary: 'schedule',
    secondary: ['edit'],
    overflow: ['toggle-hold', 'archive'],
    readOnly: false,
  };
}

export function studentCollectionActions(status: StudentStatusDto): StudentLifecycleAction[] {
  const policy = studentLifecyclePolicy(status);
  return policy.readOnly ? [policy.primary] : [...policy.secondary, ...policy.overflow];
}
