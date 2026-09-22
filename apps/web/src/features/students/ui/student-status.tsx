'use client';

import { ArchiveIcon, CircleCheckIcon, TreePalmIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { StudentStatusDto } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/status-badges';
import type { StatusMeta } from '@/components/shared/status-meta';

export const STUDENT_STATUS_META: Record<StudentStatusDto, StatusMeta> = {
  ACTIVE: { tone: 'primary', icon: CircleCheckIcon },
  ON_HOLD: { tone: 'warning', icon: TreePalmIcon },
  ARCHIVED: { tone: 'secondary', icon: ArchiveIcon },
};

const STATUS_DOT_TONE = {
  ACTIVE: 'success',
  ON_HOLD: 'warning',
  ARCHIVED: 'archived',
} as const;

export function StudentStatusBadge({
  status,
  onTint = false,
}: {
  status: StudentStatusDto;
  /**
   * Renders the chip for a painted surface: an indigo tint on an indigo hero
   * would disappear, so the status reads as a white chip with a status dot.
   */
  onTint?: boolean;
}) {
  const t = useTranslations('studentStatus');

  if (onTint) {
    return (
      <Badge variant="surface" size="lg" dot dotTone={STATUS_DOT_TONE[status]}>
        {t(status)}
      </Badge>
    );
  }

  return <StatusBadge label={t(status)} {...STUDENT_STATUS_META[status]} />;
}
