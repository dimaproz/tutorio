'use client';

import { useTranslations } from 'next-intl';
import { EntityFormDialog } from '@/components/shared';
import { useParentQuery } from '@/lib/api/parents';
import { ParentForm } from './parent-form';

/**
 * Create/edit as a Dialog rather than a page. `parentId` absent means create;
 * present means edit — the full record is fetched on demand (react-query
 * dedupes against any detail page already holding the same query).
 */
export function ParentFormDialog({
  open,
  onOpenChange,
  parentId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId?: string;
  onSuccess?: (parent: { id: string; fullName: string }) => void;
}) {
  const t = useTranslations('parents.form');
  const isEdit = Boolean(parentId);
  const parent = useParentQuery(parentId ?? '', open && isEdit);

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t('editTitle') : t('createTitle')}
      description={isEdit ? t('editSubtitle') : t('createSubtitle')}
      isLoading={isEdit && parent.isPending}
    >
      <ParentForm
        parent={parent.data}
        onSuccess={(created) => {
          onOpenChange(false);
          onSuccess?.(created);
        }}
        onCancel={() => onOpenChange(false)}
      />
    </EntityFormDialog>
  );
}
