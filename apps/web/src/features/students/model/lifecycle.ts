import type { StudentStatusDto } from '@tutorio/validation';

export type StudentLifecycleAction = 'schedule' | 'edit' | 'restore';

export interface StudentLifecyclePolicy {
  /** Hero commands in order; the first is the primary one. */
  hero: StudentLifecycleAction[];
  /** Whether new lessons may be planned. Paused and archived students cannot. */
  canSchedule: boolean;
  readOnly: boolean;
}

/**
 * One presentation policy for the profile hero, the collection rows and the
 * edit page. Status changes are not actions here: they live only in the status
 * control, so the same command never appears in two menus.
 */
export function studentLifecyclePolicy(status: StudentStatusDto): StudentLifecyclePolicy {
  if (status === 'ARCHIVED') {
    return { hero: ['restore'], canSchedule: false, readOnly: true };
  }
  if (status === 'ON_HOLD') {
    return { hero: ['edit'], canSchedule: false, readOnly: false };
  }
  return { hero: ['schedule', 'edit'], canSchedule: true, readOnly: false };
}

export function studentCollectionActions(status: StudentStatusDto): StudentLifecycleAction[] {
  return status === 'ARCHIVED' ? ['restore'] : ['edit'];
}

/** What choosing a status in the status control does from the current one. */
export type StudentStatusTransition =
  | { kind: 'none' }
  /** Pause with the hold dialog: optional lesson cancellation. */
  | { kind: 'hold' }
  /** Archive after a destructive confirmation. */
  | { kind: 'archive' }
  /** Resume from a pause immediately. */
  | { kind: 'reactivate' }
  /** Restore from the archive immediately. */
  | { kind: 'restore' }
  /** Not offered: an archived student is restored before anything else. */
  | { kind: 'unavailable' };

export function studentStatusTransition(
  from: StudentStatusDto,
  to: StudentStatusDto,
): StudentStatusTransition {
  if (from === to) return { kind: 'none' };
  if (to === 'ARCHIVED') return { kind: 'archive' };
  if (from === 'ARCHIVED') return to === 'ACTIVE' ? { kind: 'restore' } : { kind: 'unavailable' };
  return to === 'ON_HOLD' ? { kind: 'hold' } : { kind: 'reactivate' };
}
