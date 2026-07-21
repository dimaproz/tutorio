'use client';

import { useState } from 'react';
import { MoreHorizontalIcon, PencilIcon, RotateCcwIcon, Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { useSession } from '@/components/app/session-provider';
import { errorMessageKey } from '@/lib/api/error-message';
import { useDeleteStudentMutation, useRestoreStudentMutation } from '@/lib/api/students';
import { StudentFormDialog } from './student-form-dialog';

// Deleted students can only be restored (owner) — never edited, never
// permanently erased.
export function StudentRowActions({
  studentId,
  fullName,
  isDeleted,
  onDeleted,
}: {
  studentId: string;
  fullName: string;
  isDeleted: boolean;
  onDeleted?: () => void;
}) {
  const t = useTranslations('students');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const session = useSession();
  const isOwner = session.role === 'OWNER';
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const deleteStudent = useDeleteStudentMutation();
  const restoreStudent = useRestoreStudentMutation();

  const handleDelete = () => {
    deleteStudent.mutate(studentId, {
      onSuccess: () => {
        setConfirmOpen(false);
        toast.success(t('toasts.deleted'));
        onDeleted?.();
      },
      onError: (error) => {
        setConfirmOpen(false);
        toast.error(tErrors(errorMessageKey(error)));
      },
    });
  };

  const handleRestore = () => {
    restoreStudent.mutate(studentId, {
      onSuccess: () => toast.success(t('toasts.restored')),
      onError: (error) => toast.error(tErrors(errorMessageKey(error))),
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
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
              <DropdownMenuItem onSelect={handleRestore}>
                <RotateCcwIcon data-icon />
                {tCommon('restore')}
              </DropdownMenuItem>
            ) : null
          ) : (
            <>
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
        onConfirm={handleDelete}
        pending={deleteStudent.isPending}
      />

      <StudentFormDialog open={editOpen} onOpenChange={setEditOpen} studentId={studentId} />
    </>
  );
}
