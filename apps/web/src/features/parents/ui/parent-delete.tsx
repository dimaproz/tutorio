'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useSession } from '@/components/app/session-provider';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { errorMessageKey } from '@/lib/api/error-message';
import { useDeleteParentMutation } from '@/lib/api/parents';

type Target = { id: string; fullName: string };

/**
 * Permanent deletion of a parent record, shared by the row menu, the profile
 * menu and the edit form's danger zone. Delete is owner-only and cannot be
 * undone, so `canDelete` hides every entry point for anyone else rather than
 * letting them find out on click. The confirmation is the red one: it is
 * reserved for this, never for unlinking.
 */
export function useParentDelete({ onDeleted }: { onDeleted?: () => void } = {}) {
  const t = useTranslations('parents');
  const tErrors = useTranslations('errors');
  const session = useSession();
  const remove = useDeleteParentMutation();
  const [target, setTarget] = useState<Target | null>(null);
  const canDelete = session.role === 'OWNER';

  const confirm = () => {
    if (!target) return;
    remove.mutate(target.id, {
      onSuccess: () => {
        toast.success(t('toasts.deleted'));
        setTarget(null);
        onDeleted?.();
      },
      onError: (error) => toast.error(tErrors(errorMessageKey(error))),
    });
  };

  return {
    canDelete,
    pending: remove.isPending,
    request: (parent: Target) => (canDelete ? setTarget(parent) : undefined),
    dialog: canDelete ? (
      <ConfirmDialog
        open={target !== null}
        onOpenChange={(open) => (open || remove.isPending ? undefined : setTarget(null))}
        tone="danger"
        title={t('deleteDialog.title')}
        description={t('deleteDialog.description', { name: target?.fullName ?? '' })}
        confirmLabel={t('deleteDialog.confirm')}
        onConfirm={confirm}
        pending={remove.isPending}
      />
    ) : null,
  };
}
