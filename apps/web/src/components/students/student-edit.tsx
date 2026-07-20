'use client';

import { useTranslations } from 'next-intl';
import { StudentForm } from './student-form';
import { ListSkeleton, QueryErrorAlert } from '@/components/app/page-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useStudentQuery } from '@/lib/api/students';

export function StudentEditView({ studentId }: { studentId: string }) {
  const t = useTranslations('students');
  const student = useStudentQuery(studentId);

  if (student.isPending) {
    return <ListSkeleton rows={3} />;
  }

  if (student.isError) {
    return (
      <QueryErrorAlert
        error={student.error}
        title={t('error.title')}
        onRetry={() => void student.refetch()}
      />
    );
  }

  // Deleted students are read-only: they must be restored before editing.
  if (student.data.deletedAt) {
    return (
      <Alert>
        <AlertTitle>{t('detail.deletedTitle')}</AlertTitle>
        <AlertDescription>{t('detail.deletedDescription')}</AlertDescription>
      </Alert>
    );
  }

  return <StudentForm student={student.data} />;
}
