'use client';

import { useState, type ReactNode } from 'react';
import { ArchiveIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useSession } from '@/components/app/session-provider';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { errorMessageKey } from '@/lib/api/error-message';
import {
  useArchiveGroupMutation,
  useGroupQuery,
  useRestoreGroupMutation,
} from '@/lib/api/groups';
import type { GatewayError } from '@/lib/auth/client';

type Target = { id: string; name: string };

/**
 * Archive and restore for one group, wherever the command sits (row menu,
 * page menu, the edit form's danger zone). Archive is not a delete: the
 * roster and the money stay, upcoming lessons stop, and the owner can bring
 * the group back — so the confirmation is the neutral one, and it says how
 * many upcoming lessons stop. Only the owner is offered either command.
 */
export function useGroupArchive({
  onArchived,
  returnFocus,
}: {
  onArchived?: (group: Target) => void;
  returnFocus?: () => HTMLElement | null;
} = {}) {
  const t = useTranslations('groups');
  const tErrors = useTranslations('errors');
  const session = useSession();
  const canArchive = session.role === 'OWNER';
  const [target, setTarget] = useState<Target | null>(null);
  const archive = useArchiveGroupMutation();
  const restore = useRestoreGroupMutation();
  // The count of upcoming lessons comes with the group page's own read.
  const detail = useGroupQuery(target?.id ?? '', Boolean(target));
  const upcoming = detail.data?.lessonCounts.upcoming;

  const fail = (error: unknown) => toast.error(tErrors(errorMessageKey(error as GatewayError)));

  const confirm = async () => {
    if (!target) return;
    try {
      await archive.mutateAsync(target.id);
      toast.success(t('toasts.archived'));
      setTarget(null);
      onArchived?.(target);
    } catch (error) {
      fail(error);
    }
  };

  const dialog: ReactNode = (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => (open || archive.isPending ? undefined : setTarget(null))}
      tone="neutral"
      icon={<ArchiveIcon />}
      title={t('archiveDialog.title', { name: target?.name ?? '' })}
      description={
        upcoming
          ? t('archiveDialog.description', { count: upcoming })
          : t('archiveDialog.descriptionNoLessons')
      }
      confirmLabel={t('archiveDialog.confirm')}
      pending={archive.isPending}
      onConfirm={() => void confirm()}
      returnFocus={returnFocus}
    />
  );

  return {
    canArchive,
    request: (group: Target) => (canArchive ? setTarget(group) : undefined),
    restore: async (groupId: string) => {
      if (!canArchive) return false;
      try {
        await restore.mutateAsync(groupId);
        toast.success(t('toasts.restored'));
        return true;
      } catch (error) {
        fail(error);
        return false;
      }
    },
    restoring: restore.isPending,
    archiving: archive.isPending,
    dialog,
  };
}
