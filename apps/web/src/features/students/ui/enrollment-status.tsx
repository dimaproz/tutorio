'use client';

import { ArchiveIcon, CircleCheckIcon, TreePalmIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { EnrollmentStatusDto } from '@tutorio/validation';
import { StatusBadge } from '@/components/shared/status-badges';
import type { StatusMeta } from '@/components/shared/status-meta';

const ENROLLMENT_STATUS_META: Record<EnrollmentStatusDto, StatusMeta> = {
  ACTIVE: { tone: 'primary', icon: CircleCheckIcon },
  PAUSED: { tone: 'warning', icon: TreePalmIcon },
  ARCHIVED: { tone: 'secondary', icon: ArchiveIcon },
};

export function EnrollmentStatusBadge({ status }: { status: EnrollmentStatusDto }) {
  const t = useTranslations('enrollmentStatus');
  return <StatusBadge label={t(status)} {...ENROLLMENT_STATUS_META[status]} />;
}
