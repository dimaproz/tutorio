'use client';

import { ArchiveIcon } from 'lucide-react';
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
import { useDeleteStudentMutation } from '@/lib/api/students';
import type { GatewayError } from '@/lib/auth/client';

// Archive confirmation that removes a student from daily operations without
// destroying their lesson or finance history.
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
  const pending = deleteStudent.isPending;

  async function onArchive() {
    try {
      await deleteStudent.mutateAsync(student.id);
      toast.success(t('toasts.archived'));
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

        <p className="text-sm text-muted-foreground">{t('deleteDialog.archiveHint')}</p>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void onArchive()}
            disabled={pending}
          >
            {deleteStudent.isPending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ArchiveIcon data-icon="inline-start" />
            )}
            {t('deleteDialog.archiveAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
