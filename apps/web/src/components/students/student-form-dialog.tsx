'use client';

import { useTranslations } from 'next-intl';
import { EntityFormDialog } from '@/components/shared';
import { useStudentQuery } from '@/lib/api/students';
import { StudentForm } from './student-form';

/**
 * Create/edit as a Dialog rather than a page or Sheet. `studentId` absent
 * means create; present means edit — the full record is fetched on demand
 * (react-query dedupes against any detail page already holding the same
 * query, so opening this from the detail view never re-fetches).
 */
export function StudentFormDialog({
  open,
  onOpenChange,
  studentId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId?: string;
  onSuccess?: () => void;
}) {
  const t = useTranslations('students.form');
  const isEdit = Boolean(studentId);
  const student = useStudentQuery(studentId ?? '', open && isEdit);

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t('editTitle') : t('createTitle')}
      description={isEdit ? t('editSubtitle') : t('createSubtitle')}
      width="md"
      isLoading={isEdit && student.isPending}
    >
      <StudentForm
        student={student.data}
        onSuccess={() => {
          onOpenChange(false);
          onSuccess?.();
        }}
        onCancel={() => onOpenChange(false)}
      />
    </EntityFormDialog>
  );
}
