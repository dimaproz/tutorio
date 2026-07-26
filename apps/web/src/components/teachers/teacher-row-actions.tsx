'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { errorMessageKey } from '@/lib/api/error-message';
import { useDeleteTeacherMutation } from '@/lib/api/teachers';
import type { GatewayError } from '@/lib/auth/client';
import { TeacherFormDialog } from './teacher-form-dialog';

// Row menu: open, edit, delete. Mirrors ParentRowActions.
export function TeacherRowActions({
  teacherId,
  fullName,
  showOpenLink = true,
}: {
  teacherId: string;
  fullName: string;
  showOpenLink?: boolean;
}) {
  const t = useTranslations('teachers');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const deleteTeacher = useDeleteTeacherMutation();

  async function onDelete() {
    try {
      await deleteTeacher.mutateAsync(teacherId);
      toast.success(t('toasts.deleted'));
      setConfirmOpen(false);
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
          {showOpenLink ? (
            <DropdownMenuItem asChild>
              <Link href={`/app/teachers/${teacherId}`}>{tCommon('open')}</Link>
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
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('deleteDialog.title')}
        description={t('deleteDialog.description', { name: fullName })}
        confirmLabel={t('deleteDialog.confirm')}
        onConfirm={() => void onDelete()}
        pending={deleteTeacher.isPending}
      />

      <TeacherFormDialog open={editOpen} onOpenChange={setEditOpen} teacherId={teacherId} />
    </>
  );
}
