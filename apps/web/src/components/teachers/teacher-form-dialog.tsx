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
import { useTeacherQuery } from '@/lib/api/teachers';
import { TeacherForm } from './teacher-form';

/**
 * Create/edit as a Dialog. `teacherId` absent means create; present means edit
 * — the record is fetched on demand (react-query dedupes against the detail
 * page's query). Mirrors ParentFormDialog.
 */
export function TeacherFormDialog({
  open,
  onOpenChange,
  teacherId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherId?: string;
  onSuccess?: (teacher: { id: string; fullName: string }) => void;
}) {
  const t = useTranslations('teachers.form');
  const isEdit = Boolean(teacherId);
  const teacher = useTeacherQuery(teacherId ?? '', open && isEdit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b bg-popover px-6 py-4 pr-12">
          <DialogTitle>{isEdit ? t('editTitle') : t('createTitle')}</DialogTitle>
          <DialogDescription>
            {isEdit ? t('editSubtitle') : t('createSubtitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-5">
          {isEdit && teacher.isPending ? (
            <div className="flex flex-col gap-3" aria-hidden="true">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <TeacherForm
              teacher={teacher.data}
              onSuccess={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
