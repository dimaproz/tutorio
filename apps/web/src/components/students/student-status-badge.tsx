'use client';

import { useTranslations } from 'next-intl';
import type { StudentStatusDto } from '@tutorio/validation';
import { StatusPill } from '@/components/app/status-badges';

// ON_HOLD ("на канікулах") reuses the paused wash — a temporary, non-destructive
// pause, mirroring the enrollment PAUSED look in the design lab.
const STATUS_TOKEN: Record<StudentStatusDto, 'active' | 'paused'> = {
  ACTIVE: 'active',
  ON_HOLD: 'paused',
};

export function StudentStatusBadge({ status }: { status: StudentStatusDto }) {
  const t = useTranslations('studentStatus');
  return <StatusPill token={STATUS_TOKEN[status]}>{t(status)}</StatusPill>;
}
