'use client';

import { useTranslations } from 'next-intl';
import { EntityFormDialog } from '@/components/shared';
import { useGroupQuery } from '@/lib/api/groups';
import { GroupForm } from './group-form';

/**
 * Create/edit as a Dialog rather than a page or Sheet. `groupId` absent
 * means create; present means edit — the full record is fetched on demand
 * (react-query dedupes against any detail page already holding the same
 * query, so opening this from the detail view never re-fetches).
 */
export function GroupFormDialog({
  open,
  onOpenChange,
  groupId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId?: string;
  onSuccess?: () => void;
}) {
  const t = useTranslations('groups.form');
  const isEdit = Boolean(groupId);
  const group = useGroupQuery(groupId ?? '', open && isEdit);

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t('editTitle') : t('createTitle')}
      description={isEdit ? t('editSubtitle') : t('createSubtitle')}
      width="md"
      isLoading={isEdit && group.isPending}
    >
      <GroupForm
        group={group.data}
        onSuccess={() => {
          onOpenChange(false);
          onSuccess?.();
        }}
        onCancel={() => onOpenChange(false)}
      />
    </EntityFormDialog>
  );
}
