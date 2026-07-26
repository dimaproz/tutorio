'use client';

import { useTranslations } from 'next-intl';
import { EntityPicker } from '@/components/shared';
import { useStudentsQuery } from '@/lib/api/students';

/** Parent-list filter backed by the shared avatar-aware entity picker. */
export function StudentFilterCombobox({
  value,
  onChange,
}: {
  value?: string;
  onChange: (studentId?: string) => void;
}) {
  const t = useTranslations('parents.filters');
  const students = useStudentsQuery({ page: 1, pageSize: 100 });

  return (
    <div className="w-full sm:w-[220px]">
      <EntityPicker
        value={value}
        onChange={onChange}
        options={(students.data?.items ?? []).map((student) => ({
          value: student.id,
          label: student.fullName,
          avatarKey: student.avatarKey,
        }))}
        placeholder={t('byStudent')}
        clearLabel={t('allStudents')}
        searchPlaceholder={t('studentSearch')}
        emptyLabel={t('studentEmpty')}
      />
    </div>
  );
}
