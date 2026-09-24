'use client';

import {
  CalendarClockIcon,
  CircleCheckIcon,
  CircleSlashIcon,
  CircleXIcon,
  UserXIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LessonStatusDto } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/status-badges';
import type { StatusMeta } from '@/components/shared/status-meta';

const LESSON_STATUS_META: Record<LessonStatusDto, StatusMeta> = {
  SCHEDULED: { tone: 'info', icon: CalendarClockIcon },
  COMPLETED: { tone: 'success', icon: CircleCheckIcon },
  CANCELLED_CHARGED: { tone: 'destructive', icon: CircleXIcon },
  CANCELLED_UNCHARGED: { tone: 'warning', icon: CircleSlashIcon },
  NO_SHOW: { tone: 'destructive', icon: UserXIcon },
};

export function LessonStatusBadge({ status }: { status: LessonStatusDto }) {
  const t = useTranslations('scheduling.status');
  return <StatusBadge label={t(status)} {...LESSON_STATUS_META[status]} />;
}

/** Stands in for the status chip while a scheduled lesson is under way. */
export function LessonRunningBadge() {
  const t = useTranslations('lessons.panel');
  return (
    <Badge variant="brand" dot dotTone="danger">
      {t('runningNow')}
    </Badge>
  );
}
