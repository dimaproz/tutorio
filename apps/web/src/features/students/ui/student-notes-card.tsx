'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { StudentDetail } from '@tutorio/validation';
import { NotesCard } from '@/components/shared/notes-card';
import { errorMessageKey } from '@/lib/api/error-message';
import type { GatewayError } from '@/lib/auth/client';
import { useUpdateStudentMutation } from '@/lib/api/students';

const NOTES_MAX_LENGTH = 4000;

/**
 * The tutor's own notes about a student, on the shared `NotesCard`. An
 * archived student with no notes shows no card at all.
 */
export function StudentNotesCard({
  student,
  readOnly = false,
}: {
  student: StudentDetail;
  readOnly?: boolean;
}) {
  const t = useTranslations('students.notes');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const update = useUpdateStudentMutation(student.id);
  const format = useFormatter();

  if (readOnly && !student.notes) {
    return null;
  }

  return (
    <NotesCard
      notes={student.notes}
      updatedLabel={t('updated', {
        date: format.dateTime(new Date(student.updatedAt), { day: 'numeric', month: 'short' }),
      })}
      labels={{
        title: t('title'),
        edit: t('edit'),
        add: t('add'),
        empty: t('empty'),
        placeholder: t('placeholder'),
        save: tCommon('save'),
        cancel: tCommon('cancel'),
      }}
      maxLength={NOTES_MAX_LENGTH}
      readOnly={readOnly}
      pending={update.isPending}
      onSave={async (notes) => {
        try {
          await update.mutateAsync({ notes });
          toast.success(t('saved'));
          return true;
        } catch (error) {
          toast.error(tErrors(errorMessageKey(error as GatewayError)));
          return false;
        }
      }}
    />
  );
}
