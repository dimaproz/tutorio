'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MoreHorizontalIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { useSession } from '@/components/app/session-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { errorMessageKey } from '@/lib/api/error-message';
import { useDeleteGroupMutation, useRestoreGroupMutation } from '@/lib/api/groups';
import type { GatewayError } from '@/lib/auth/client';

export function GroupRowActions({
  groupId,
  name,
  isDeleted,
}: {
  groupId: string;
  name: string;
  isDeleted: boolean;
}) {
  const t = useTranslations('groups');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const session = useSession();
  const isOwner = session.role === 'OWNER';

  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteGroup = useDeleteGroupMutation();
  const restoreGroup = useRestoreGroupMutation();

  async function onDelete() {
    try {
      await deleteGroup.mutateAsync(groupId);
      toast.success(t('toasts.deleted'));
      setConfirmOpen(false);
    } catch (error) {
      toast.error(tErrors(errorMessageKey(error as GatewayError)));
    }
  }

  async function onRestore() {
    try {
      await restoreGroup.mutateAsync(groupId);
      toast.success(t('toasts.restored'));
    } catch (error) {
      toast.error(tErrors(errorMessageKey(error as GatewayError)));
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 md:size-8" aria-label={tCommon('openMenu')}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isDeleted ? (
            // Deleted records cannot be edited — only restored, and only by
            // an owner. There is no permanent deletion anywhere in Stage 2.
            isOwner ? (
              <DropdownMenuItem onSelect={() => void onRestore()}>
                {tCommon('restore')}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled>{tCommon('restoreOwnerOnly')}</DropdownMenuItem>
            )
          ) : (
            <>
              <DropdownMenuItem asChild>
                <Link href={`/app/groups/${groupId}`}>{tCommon('open')}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/app/groups/${groupId}/edit`}>{tCommon('edit')}</Link>
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
                {tCommon('delete')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('deleteDialog.title')}
        description={t('deleteDialog.description', { name })}
        confirmLabel={tCommon('delete')}
        onConfirm={() => void onDelete()}
        pending={deleteGroup.isPending}
      />
    </>
  );
}
