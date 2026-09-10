'use client';

import { useState } from 'react';
import { PauseIcon, PencilIcon, PlayIcon, RotateCcwIcon, Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { StudentStatusDto } from '@tutorio/validation';
import { RowActionsTrigger } from '@/components/shared/row-actions-trigger';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { errorMessageKey } from '@/lib/api/error-message';
import { useRestoreStudentMutation, useUpdateStudentMutation } from '@/lib/api/students';
import { StudentDeleteDialog } from './student-delete-dialog';
import { StudentFormDialog } from './student-form-dialog';
import { studentRowActions } from './student-row-actions.model';

// Archived students receive only the dedicated restore command. Operational
// students retain edit, on-hold, and archive actions.
export function StudentRowActions({
  studentId,
  fullName,
  avatarKey,
  status = 'ACTIVE',
  onDeleted,
}: {
  studentId: string;
  fullName: string;
  avatarKey?: string | null;
  status?: StudentStatusDto;
  onDeleted?: () => void;
}) {
  const t = useTranslations('students');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const updateStudent = useUpdateStudentMutation(studentId);
  const restoreStudent = useRestoreStudentMutation();
  const actions = studentRowActions(status);

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

  const handleRestore = () => {
    restoreStudent.mutate(studentId, {
      onSuccess: () => toast.success(t('toasts.restored')),
      onError: (error) => toast.error(tErrors(errorMessageKey(error))),
    });
  };

  return (
    <>
      <DropdownMenu>
        <RowActionsTrigger busy={updateStudent.isPending || restoreStudent.isPending} />
        <DropdownMenuContent align="end">
          {actions.includes('restore') ? (
            <DropdownMenuItem onSelect={handleRestore}>
              <RotateCcwIcon data-icon />
              {tCommon('restore')}
            </DropdownMenuItem>
          ) : null}
          {actions.includes('edit') ? (
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              <PencilIcon data-icon />
              {tCommon('edit')}
            </DropdownMenuItem>
          ) : null}
          {actions.includes('toggle-hold') ? (
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
          ) : null}
          {actions.includes('archive') ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
              <Trash2Icon data-icon />
              {tCommon('delete')}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {actions.includes('archive') ? (
        <StudentDeleteDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          student={{ id: studentId, fullName, avatarKey, status }}
          onDeleted={onDeleted}
        />
      ) : null}

      {actions.includes('edit') ? (
        <StudentFormDialog open={editOpen} onOpenChange={setEditOpen} studentId={studentId} />
      ) : null}
    </>
  );
}
