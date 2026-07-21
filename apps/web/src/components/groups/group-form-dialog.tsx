'use client';

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('editTitle') : t('createTitle')}</DialogTitle>
          <DialogDescription>{isEdit ? t('editSubtitle') : t('createSubtitle')}</DialogDescription>
        </DialogHeader>

        {isEdit && group.isPending ? (
          <div className="flex flex-col gap-3" aria-hidden="true">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <GroupForm
            group={group.data}
            onSuccess={() => {
              onOpenChange(false);
              onSuccess?.();
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
