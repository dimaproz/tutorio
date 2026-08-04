'use client';

import { useTranslations } from 'next-intl';
import type { TeacherStatusDto } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { badgeVariantForTone, TEACHER_STATUS_META } from '@/components/app/status-meta';

/** Teacher lifecycle presentation uses the same semantic pill as students. */
export function TeacherStatusBadge({ status }: { status: TeacherStatusDto }) {
  const t = useTranslations('teachers.status');
  const meta = TEACHER_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge variant={badgeVariantForTone(meta.tone)}>
      <Icon data-icon="inline-start" />
      {t(status)}
    </Badge>
  );
}
