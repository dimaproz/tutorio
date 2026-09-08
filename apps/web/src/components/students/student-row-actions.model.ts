import type { StudentStatusDto } from '@tutorio/validation';

export type StudentRowAction = 'edit' | 'toggle-hold' | 'archive' | 'restore';

/** The archive lifecycle intentionally has no generic edit bypass. */
export function studentRowActions(status: StudentStatusDto): StudentRowAction[] {
  if (status === 'ARCHIVED') {
    return ['restore'];
  }
  return ['edit', 'toggle-hold', 'archive'];
}
