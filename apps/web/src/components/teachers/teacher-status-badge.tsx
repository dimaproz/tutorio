'use client';

import { useTranslations } from 'next-intl';
import type { TeacherStatusDto } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';

/** Teacher lifecycle presentation uses the same semantic pill as students. */
export function TeacherStatusBadge({ status }: { status: TeacherStatusDto }) {
  const t = useTranslations('teachers.status');
  return <Badge variant={status === 'ACTIVE' ? 'primary' : 'secondary'}>{t(status)}</Badge>;
}
