'use client';

import { useTranslations } from 'next-intl';
import type { TeacherStatusDto } from '@tutorio/validation';
import { ArchiveIcon, CircleCheckIcon } from 'lucide-react';
import { StatusBadge } from '@/components/shared/status-badges';

/** Teacher lifecycle presentation uses the same semantic pill as students. */
export function TeacherStatusBadge({ status }: { status: TeacherStatusDto }) {
  const t = useTranslations('teachers.status');
  return (
    <StatusBadge
      label={t(status)}
      tone={status === 'ACTIVE' ? 'primary' : 'secondary'}
      icon={status === 'ACTIVE' ? CircleCheckIcon : ArchiveIcon}
    />
  );
}
