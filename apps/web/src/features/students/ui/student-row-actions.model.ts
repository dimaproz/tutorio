import type { StudentStatusDto } from '@tutorio/validation';
import { studentCollectionActions } from '@/features/students/model/lifecycle';

export type StudentRowAction = 'edit' | 'restore';

/** The archive lifecycle intentionally has no generic edit bypass. */
export function studentRowActions(status: StudentStatusDto): StudentRowAction[] {
  return studentCollectionActions(status).filter(
    (action): action is StudentRowAction => action === 'edit' || action === 'restore',
  );
}
