'use client';

import { ArchiveIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { StudentStatusDto } from '@tutorio/validation';
import { PersonMiniCard } from '@/components/shared/person-mini-card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { errorMessageKey } from '@/lib/api/error-message';
import { useArchiveStudentMutation } from '@/lib/api/students';
import type { GatewayError } from '@/lib/auth/client';

export function StudentArchiveDialog({
  open,
  onOpenChange,
  student,
  onArchived,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: { id: string; fullName: string; avatarKey?: string | null; status: StudentStatusDto };
  onArchived?: () => void;
}) {
  const t = useTranslations('students.archiveDialog');
  const tStudents = useTranslations('students');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const archiveStudent = useArchiveStudentMutation();

  async function archive() {
    try {
      await archiveStudent.mutateAsync(student.id);
      toast.success(tStudents('toasts.archived'));
      onOpenChange(false);
      onArchived?.();
    } catch (error) {
      toast.error(tErrors(errorMessageKey(error as GatewayError)));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{t('title')}</DialogTitle><DialogDescription>{t('warning')}</DialogDescription></DialogHeader>
        <PersonMiniCard avatarKey={student.avatarKey} fullName={student.fullName} />
        <p className="text-sm text-muted-foreground">{t('effects')}</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={archiveStudent.isPending}>{tCommon('cancel')}</Button>
          <Button type="button" variant="secondary" onClick={() => void archive()} disabled={archiveStudent.isPending}>
            {archiveStudent.isPending ? <Spinner data-icon="inline-start" /> : <ArchiveIcon data-icon="inline-start" />}
            {t('action')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
