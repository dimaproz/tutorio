'use client';

import { ArchiveIcon, CircleCheckIcon, TreePalmIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { StudentStatusDto } from '@tutorio/validation';
import { StatusBadge } from '@/components/shared/status-badges';
import type { StatusMeta } from '@/components/shared/status-meta';
import type { StatusOption } from '@/components/shared/status-select';

export const STUDENT_STATUS_META: Record<StudentStatusDto, StatusMeta> = {
  ACTIVE: { tone: 'primary', icon: CircleCheckIcon },
  ON_HOLD: { tone: 'warning', icon: TreePalmIcon },
  ARCHIVED: { tone: 'secondary', icon: ArchiveIcon },
};

export function StudentStatusBadge({ status }: { status: StudentStatusDto }) {
  const t = useTranslations('studentStatus');
  return <StatusBadge label={t(status)} {...STUDENT_STATUS_META[status]} />;
}

export function useStudentStatusOptions(): StatusOption[] {
  const t = useTranslations('studentStatus');
  return (Object.keys(STUDENT_STATUS_META) as StudentStatusDto[]).map((value) => ({
    value,
    label: t(value),
    ...STUDENT_STATUS_META[value],
  }));
}
