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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b bg-popover px-6 py-4 pr-12">
          <DialogTitle>{isEdit ? t('editTitle') : t('createTitle')}</DialogTitle>
          <DialogDescription>{isEdit ? t('editSubtitle') : t('createSubtitle')}</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-5">
          {isEdit && parent.isPending ? (
            <div className="flex flex-col gap-3" aria-hidden="true">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <ParentForm
              parent={parent.data}
              onSuccess={(created) => {
                onOpenChange(false);
                onSuccess?.(created);
              }}
              onCancel={() => onOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
