'use client';

import { ArchiveIcon, Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { StudentStatusDto } from '@tutorio/validation';
import { PersonMiniCard } from '@/components/app/person-mini-card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { errorMessageKey } from '@/lib/api/error-message';
import { useDeleteStudentMutation, useUpdateStudentMutation } from '@/lib/api/students';
import type { GatewayError } from '@/lib/auth/client';

// Delete confirmation that shows WHO is being removed (a student card), spells
// out that it is permanent, and offers archiving as the non-destructive way
// out. Deleting hits the hard-delete endpoint; archiving just flips the status.
export function StudentDeleteDialog({
  open,
  onOpenChange,
  student,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: {
    id: string;
    fullName: string;
    avatarKey?: string | null;
    status: StudentStatusDto;
  };
  /** Called after a successful delete — e.g. navigate away from the profile. */
  onDeleted?: () => void;
}) {
  const t = useTranslations('students');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');

  const deleteStudent = useDeleteStudentMutation();
  const archive = useUpdateStudentMutation(student.id);
  const pending = deleteStudent.isPending || archive.isPending;
  const canArchive = student.status !== 'ARCHIVED';

  async function onArchive() {
    try {
      await archive.mutateAsync({ status: 'ARCHIVED' });
      toast.success(t('toasts.archived'));
      onOpenChange(false);
    } catch (error) {
      toast.error(tErrors(errorMessageKey(error as GatewayError)));
    }
  }

  async function onDelete() {
    try {
      await deleteStudent.mutateAsync(student.id);
      toast.success(t('toasts.deleted'));
      onOpenChange(false);
      onDeleted?.();
    } catch (error) {
      toast.error(tErrors(errorMessageKey(error as GatewayError)));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('deleteDialog.title')}</DialogTitle>
          <DialogDescription>{t('deleteDialog.warning')}</DialogDescription>
        </DialogHeader>

        <PersonMiniCard avatarKey={student.avatarKey} fullName={student.fullName} />

        {canArchive ? (
          <p className="text-sm text-muted-foreground">{t('deleteDialog.archiveHint')}</p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {tCommon('cancel')}
          </Button>
          {canArchive ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void onArchive()}
              disabled={pending}
            >
              {archive.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <ArchiveIcon data-icon="inline-start" />
              )}
              {t('deleteDialog.archiveAction')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="destructive"
            onClick={() => void onDelete()}
            disabled={pending}
          >
            {deleteStudent.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Trash2Icon data-icon="inline-start" />
            )}
            {t('deleteDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
