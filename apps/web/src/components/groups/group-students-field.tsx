'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { StudentResponse } from '@tutorio/validation';
import { StudentStatusBadge } from '@/components/app/status-badges';
import { EntityMultiSelect } from '@/components/shared';
import { useStudentsQuery } from '@/lib/api/students';

export function GroupStudentsField({
  selectedIds,
  onChange,
  enabled,
  extraStudents = [],
}: {
  selectedIds: string[];
  onChange: (next: string[]) => void;
  enabled: boolean;
  extraStudents?: StudentResponse[];
}) {
  const t = useTranslations('groups.form.students');
  const tCommon = useTranslations('common');
  const students = useStudentsQuery({ page: 1, pageSize: 100 }, enabled);

  const options = useMemo(() => {
    const byId = new Map(
      [...extraStudents, ...(students.data?.items ?? [])].map((student) => [student.id, student]),
    );
    return [...byId.values()].map((student) => ({
      value: student.id,
      label: student.fullName,
      avatarKey: student.avatarKey,
      badges: [<StudentStatusBadge key="status" status={student.status} />],
    }));
  }, [extraStudents, students.data]);

  return (
    <EntityMultiSelect
      options={options}
      selectedIds={selectedIds}
      onChange={onChange}
      placeholder={t('pickStudent')}
      searchPlaceholder={t('studentSearch')}
      emptyLabel={t('studentEmpty')}
      removeLabel={(name) => `${tCommon('remove')} ${name}`}
      disabled={students.isPending}
      isLoading={students.isPending}
    />
  );
}
