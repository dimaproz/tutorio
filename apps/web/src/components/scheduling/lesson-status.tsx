'use client';

import { CalendarClockIcon, CircleCheckIcon, CircleSlashIcon, CircleXIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LessonStatusDto } from '@tutorio/validation';
import { StatusBadge } from '@/components/shared/status-badges';
import type { StatusMeta } from '@/components/shared/status-meta';
import type { StatusOption } from '@/components/shared/status-select';

const LESSON_STATUS_META: Record<LessonStatusDto, StatusMeta> = {
  SCHEDULED: { tone: 'primary', icon: CalendarClockIcon },
  COMPLETED: { tone: 'success', icon: CircleCheckIcon },
  CANCELLED_CHARGED: { tone: 'destructive', icon: CircleXIcon },
  CANCELLED_UNCHARGED: { tone: 'warning', icon: CircleSlashIcon },
};

export function LessonStatusBadge({ status }: { status: LessonStatusDto }) {
  const t = useTranslations('scheduling.status');
  return <StatusBadge label={t(status)} {...LESSON_STATUS_META[status]} />;
}

export function useLessonStatusOptions(): StatusOption[] {
  const t = useTranslations('scheduling.status');
  return (Object.keys(LESSON_STATUS_META) as LessonStatusDto[]).map((value) => ({
    value,
    label: t(value),
    ...LESSON_STATUS_META[value],
  }));
}
