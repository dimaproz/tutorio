'use client';

import { useTranslations } from 'next-intl';
import { GroupForm } from './group-form';
import { ListSkeleton, QueryErrorAlert } from '@/components/app/page-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useGroupQuery } from '@/lib/api/groups';

export function GroupEditView({ groupId }: { groupId: string }) {
  const t = useTranslations('groups');
  const group = useGroupQuery(groupId);

  if (group.isPending) {
    return <ListSkeleton rows={3} />;
  }

  if (group.isError) {
    return (
      <QueryErrorAlert
        error={group.error}
        title={t('error.title')}
        onRetry={() => void group.refetch()}
      />
    );
  }

  // Deleted groups are read-only until restored.
  if (group.data.deletedAt) {
    return (
      <Alert>
        <AlertTitle>{t('detail.deletedTitle')}</AlertTitle>
        <AlertDescription>{t('detail.deletedDescription')}</AlertDescription>
      </Alert>
    );
  }

  return <GroupForm group={group.data} />;
}
