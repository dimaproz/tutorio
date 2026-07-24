'use client';

import { useTranslations } from 'next-intl';
import { EntityFormDialog } from '@/components/shared';
import { useTeacherQuery } from '@/lib/api/teachers';
import { TeacherForm } from './teacher-form';

/**
 * Create/edit as a Dialog. `teacherId` absent means create; present means edit
 * — the record is fetched on demand (react-query dedupes against the detail
 * page's query). Mirrors ParentFormDialog.
 */
export function TeacherFormDialog({
  open,
  onOpenChange,
  teacherId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId?: string;
  onSuccess?: (teacher: { id: string; fullName: string }) => void;
}) {
  const t = useTranslations('teachers.form');
  const isEdit = Boolean(teacherId);
  const teacher = useTeacherQuery(teacherId ?? '', open && isEdit);

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t('editTitle') : t('createTitle')}
      description={isEdit ? t('editSubtitle') : t('createSubtitle')}
      isLoading={isEdit && teacher.isPending}
    >
      <TeacherForm
        teacher={teacher.data}
        onSuccess={(teacher) => {
          onOpenChange(false);
          onSuccess?.(teacher);
        }}
        onCancel={() => onOpenChange(false)}
      />
    </EntityFormDialog>
  );
}
