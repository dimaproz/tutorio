'use client';

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useStudentQuery } from '@/lib/api/students';
import { StudentForm } from './student-form';

/**
 * Create/edit as a Dialog rather than a page or Sheet. `studentId` absent
 * means create; present means edit — the full record is fetched on demand
 * (react-query dedupes against any detail page already holding the same
 * query, so opening this from the detail view never re-fetches).
 */
export function StudentFormDialog({
  open,
  onOpenChange,
  studentId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId?: string;
  onSuccess?: () => void;
}) {
  const t = useTranslations('students.form');
  const isEdit = Boolean(studentId);
  const student = useStudentQuery(studentId ?? '', open && isEdit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('editTitle') : t('createTitle')}</DialogTitle>
          <DialogDescription>{isEdit ? t('editSubtitle') : t('createSubtitle')}</DialogDescription>
        </DialogHeader>

        {isEdit && student.isPending ? (
          <div className="flex flex-col gap-3" aria-hidden="true">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <StudentForm
            student={student.data}
            onSuccess={() => {
              onOpenChange(false);
              onSuccess?.();
            }}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
