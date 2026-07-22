'use client';

import { useState } from 'react';
import {
  MoreHorizontalIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  RotateCcwIcon,
  Trash2Icon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { StudentStatusDto } from '@tutorio/validation';
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
import {
  useDeleteStudentMutation,
  useRestoreStudentMutation,
  useUpdateStudentMutation,
} from '@/lib/api/students';
import { StudentFormDialog } from './student-form-dialog';

// Deleted students can only be restored (owner) — never edited, never
// permanently erased. On-hold is a separate, non-destructive status toggle
// (hides from active lists without soft-deleting).
export function StudentRowActions({
  studentId,
  fullName,
  isDeleted,
  status = 'ACTIVE',
  onDeleted,
}: {
  studentId: string;
  fullName: string;
  isDeleted: boolean;
  status?: StudentStatusDto;
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
  const updateStudent = useUpdateStudentMutation(studentId);

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

  const handleToggleHold = () => {
    updateStudent.mutate(
      { status: status === 'ON_HOLD' ? 'ACTIVE' : 'ON_HOLD' },
      {
        onSuccess: () =>
          toast.success(status === 'ON_HOLD' ? t('toasts.reactivated') : t('toasts.onHold')),
        onError: (error) => toast.error(tErrors(errorMessageKey(error))),
      },
    );
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
              <DropdownMenuItem onSelect={handleToggleHold}>
                {status === 'ON_HOLD' ? (
                  <>
                    <PlayIcon data-icon />
                    {t('reactivate')}
                  </>
                ) : (
                  <>
                    <PauseIcon data-icon />
                    {t('putOnHold')}
                  </>
                )}
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
