'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MoreHorizontalIcon, PencilIcon, RotateCcwIcon, Trash2Icon } from 'lucide-react';
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
import { useDeleteParentMutation, useRestoreParentMutation } from '@/lib/api/parents';
import type { GatewayError } from '@/lib/auth/client';
import { ParentFormDialog } from './parent-form-dialog';

// Deleted parents can only be restored (owner) — never edited, never
// permanently erased. Mirrors StudentRowActions/GroupRowActions.
export function ParentRowActions({
  parentId,
  fullName,
  isDeleted,
  showOpenLink = true,
}: {
  parentId: string;
  fullName: string;
  isDeleted: boolean;
  showOpenLink?: boolean;
}) {
  const t = useTranslations('parents');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const session = useSession();
  const isOwner = session.role === 'OWNER';

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const deleteParent = useDeleteParentMutation();
  const restoreParent = useRestoreParentMutation();

  async function onDelete() {
    try {
      await deleteParent.mutateAsync(parentId);
      toast.success(t('toasts.deleted'));
      setConfirmOpen(false);
    } catch (error) {
      toast.error(tErrors(errorMessageKey(error as GatewayError)));
    }
  }

  async function onRestore() {
    try {
      await restoreParent.mutateAsync(parentId);
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
            className="size-11 md:size-8"
            aria-label={tCommon('openMenu')}
          >
            <MoreHorizontalIcon data-icon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isDeleted ? (
            isOwner ? (
              <DropdownMenuItem onSelect={() => void onRestore()}>
                <RotateCcwIcon data-icon />
                {tCommon('restore')}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled>{tCommon('restoreOwnerOnly')}</DropdownMenuItem>
            )
          ) : (
            <>
              {showOpenLink ? (
                <DropdownMenuItem asChild>
                  <Link href={`/app/parents/${parentId}`}>{tCommon('open')}</Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <PencilIcon data-icon />
                {tCommon('edit')}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
                <Trash2Icon data-icon />
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
        description={t('deleteDialog.description', { name: fullName })}
        confirmLabel={t('deleteDialog.confirm')}
        onConfirm={() => void onDelete()}
        pending={deleteParent.isPending}
      />

      <ParentFormDialog open={editOpen} onOpenChange={setEditOpen} parentId={parentId} />
    </>
  );
}
