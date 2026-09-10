'use client';

import { CircleCheckIcon, UsersRoundIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { GroupStatusDto } from '@tutorio/validation';
import { StatusBadge } from '@/components/shared/status-badges';
import type { StatusMeta } from '@/components/shared/status-meta';

const GROUP_STATUS_META: Record<GroupStatusDto, StatusMeta> = {
  ACTIVE: { tone: 'primary', icon: CircleCheckIcon },
  EMPTY: { tone: 'warning', icon: UsersRoundIcon },
};

export function GroupStatusBadge({ status }: { status: GroupStatusDto }) {
  const t = useTranslations('groups.status');
  return <StatusBadge label={t(status)} {...GROUP_STATUS_META[status]} />;
}
