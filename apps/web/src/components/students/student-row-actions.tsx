'use client';

import { useState } from 'react';
import { MoreHorizontalIcon, PauseIcon, PencilIcon, PlayIcon, Trash2Icon } from 'lucide-react';
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
import { errorMessageKey } from '@/lib/api/error-message';
import { useUpdateStudentMutation } from '@/lib/api/students';
import { StudentDeleteDialog } from './student-delete-dialog';
import { StudentFormDialog } from './student-form-dialog';

// Row menu: edit, the on-hold toggle (a non-destructive status flip), and a
// permanent delete that goes through the rich confirm dialog (which also offers
// archiving as the safe alternative).
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
        </DropdownMenuContent>
      </DropdownMenu>

      <StudentDeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        student={{ id: studentId, fullName, avatarKey, status }}
        onDeleted={onDeleted}
      />

      <StudentFormDialog open={editOpen} onOpenChange={setEditOpen} studentId={studentId} />
    </>
  );
}
