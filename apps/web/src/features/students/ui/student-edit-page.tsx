'use client';

import { useEffect, useState } from 'react';
import { RotateCcwIcon, UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormProvider } from 'react-hook-form';
import { toast } from 'sonner';
import type { StudentDetail } from '@tutorio/validation';
import { ActionBar } from '@/components/shared/action-bar';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { Notice } from '@/components/shared/notice';
import { useSetPageCrumb } from '@/components/shared/page-crumb';
import { SectionSkeleton } from '@/components/shared/section-skeleton';
import { useSession } from '@/components/app/session-provider';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  buildStudentEditDto,
  studentEditDefaults,
  studentFormSectionStatus,
} from '@/features/students/model/form';
import { useIsMobile } from '@/hooks/use-mobile';
import { errorMessageKey } from '@/lib/api/error-message';
import {
  useRestoreStudentMutation,
  useStudentQuery,
  useUpdateStudentMutation,
} from '@/lib/api/students';
import { scrollToFirstError } from '@/lib/forms/focus-error';
import { StudentFormLayout, useStudentFormNavItems } from './student-form-layout';
import { StudentFormSections } from './student-form-sections';
import { useLeaveGuard, useStudentForm, useStudentFormState } from './student-form-state';
import { StudentStatusControl } from './student-status-control';

/**
 * Edit a saved student on a full page. The record loads first; a failed load
 * never falls back to an empty create form. An archived student opens
 * read-only with the way back to restore it.
 */
export function StudentEditPage({ studentId }: { studentId: string }) {
  const t = useTranslations('students.form');
  const tCommon = useTranslations('common');
  const student = useStudentQuery(studentId);
  const navItems = useStudentFormNavItems();
  useSetPageCrumb(student.data ? t('editCrumb', { name: student.data.fullName }) : null);

  if (student.isPending) {
    return (
      <StudentFormLayout
        title={<span className="sr-only">{tCommon('loading')}</span>}
        subtitle={t('editSubtitle')}
        navItems={navItems}
        navLoading
      >
        <div role="status" aria-label={tCommon('loading')} className="flex flex-col gap-4">
          <SectionSkeleton fields={2} />
          <SectionSkeleton fields={3} />
          <SectionSkeleton fields={2} />
        </div>
      </StudentFormLayout>
    );
  }

  // A failed background refresh (after a status change, say) must not unmount
  // the form and its unsaved edits; only a load that never succeeded is shown.
  if (!student.data) {
    return (
      <StudentFormLayout title={t('editTitle')} subtitle={t('editSubtitle')} navItems={navItems}>
        <Notice
          tone="danger"
          title={t('loadErrorTitle')}
          text={t('loadErrorDescription')}
          action={
            <Button type="button" variant="white" size="xs" onClick={() => void student.refetch()}>
              <RotateCcwIcon data-icon="inline-start" />
              {tCommon('retry')}
            </Button>
          }
        />
        <EmptyState
          icon={<UserIcon />}
          title={t('unavailableTitle')}
          text={t('unavailableDescription')}
          minHeight={420}
        />
      </StudentFormLayout>
    );
  }

  // Not keyed by revision: a status change saves on its own and must leave the
  // tutor's unsaved edits in place, so the form is seeded once per visit.
  return <StudentEditForm student={student.data} />;
}

function StudentEditForm({ student }: { student: StudentDetail }) {
  const t = useTranslations('students.form');
  const tStudents = useTranslations('students');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const session = useSession();
  const router = useRouter();
  const mobile = useIsMobile();
  const update = useUpdateStudentMutation(student.id);
  const restore = useRestoreStudentMutation();
  const [discardOpen, setDiscardOpen] = useState(false);
  // Where the tutor was heading when the discard prompt stopped them, if a
  // link was the reason; the Discard button leaves the tutor on the page.
  const [leavingTo, setLeavingTo] = useState<string | null>(null);
  const [defaults] = useState(() =>
    studentEditDefaults(student, session.workspace.defaultCurrency),
  );
  const form = useStudentForm(defaults);
  const state = useStudentFormState(form);
  const { isDirty, isSubmitting } = form.formState;
  const saving = isSubmitting || update.isPending;
  const archived = student.status === 'ARCHIVED';
  const profileHref = `/app/students/${student.id}`;

  useLeaveGuard(isDirty && !saving && !archived, (href) => {
    setLeavingTo(href);
    setDiscardOpen(true);
  });
  // An archived record is shown as saved: every section reads as complete.
  const status = archived ? studentFormSectionStatus(defaults, []) : state.status;
  const navItems = useStudentFormNavItems(status);
  useEffect(() => {
    if (archived) form.clearErrors();
  }, [archived, form]);

  const submit = form.handleSubmit(
    async (values) => {
      try {
        await update.mutateAsync(buildStudentEditDto(values));
        form.reset(values);
        toast.success(tStudents('toasts.updated'));
        router.push(profileHref);
      } catch {
        // The request error is rendered above the form with a retry.
      }
    },
    (errors) => scrollToFirstError(errors),
  );

  const discard = () => {
    form.reset(defaults);
    setDiscardOpen(false);
    if (leavingTo) router.push(leavingTo);
  };

  const note = saving
    ? t('savingNote')
    : state.errorCount > 0
      ? isDirty
        ? t('unsavedWithErrors', { count: state.dirtyCount, errors: state.errorCount })
        : t('fixFields', { count: state.errorCount })
      : isDirty
        ? t('unsaved', { count: state.dirtyCount })
        : t('noChanges');

  const primary = (
    <Button
      type="submit"
      form="student-edit-form"
      disabled={saving || !isDirty}
      className={mobile ? 'w-full' : undefined}
      size={mobile ? 'xl' : 'default'}
    >
      {saving ? <Spinner data-icon="inline-start" /> : null}
      {saving ? tCommon('saving') : t('submitEdit')}
    </Button>
  );

  const bar = archived ? undefined : mobile ? (
    <div className="sticky bottom-4 z-10">{primary}</div>
  ) : (
    <ActionBar
      tone={state.errorCount > 0 ? 'danger' : isDirty ? 'warning' : 'muted'}
      note={note}
      secondary={
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => {
            if (!isDirty) return router.push(profileHref);
            setLeavingTo(null);
            setDiscardOpen(true);
          }}
        >
          {isDirty ? t('discard') : tCommon('cancel')}
        </Button>
      }
      primary={primary}
    />
  );

  const notice = archived ? (
    <Notice
      tone="warning"
      title={t('archivedTitle')}
      text={t('archivedDescription')}
      action={
        <Button
          type="button"
          variant="white"
          size="xs"
          disabled={restore.isPending}
          onClick={() =>
            restore.mutate(student.id, {
              onSuccess: () => toast.success(tStudents('toasts.restored')),
              onError: (error) => toast.error(tErrors(errorMessageKey(error))),
            })
          }
        >
          {restore.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RotateCcwIcon data-icon="inline-start" />
          )}
          {tCommon('restore')}
        </Button>
      }
    />
  ) : update.isError ? (
    <Notice
      tone="danger"
      title={t('requestErrorTitle')}
      text={tErrors(errorMessageKey(update.error))}
      action={
        <Button type="submit" variant="white" size="xs" disabled={saving}>
          <RotateCcwIcon data-icon="inline-start" />
          {tCommon('retry')}
        </Button>
      }
    />
  ) : undefined;

  return (
    <FormProvider {...form}>
      <form id="student-edit-form" noValidate onSubmit={(event) => void submit(event)}>
        <StudentFormLayout
          title={student.fullName}
          subtitle={archived ? t('archivedSubtitle') : t('editSubtitle')}
          headerAction={
            <StudentStatusControl student={student} size="md" note={t('statusIndependent')} />
          }
          navItems={navItems}
          activeSection={state.activeSection}
          onSelectSection={state.setActiveSection}
          notice={notice}
          bar={bar}
        >
          <StudentFormSections status={status} readOnly={archived} />
        </StudentFormLayout>
      </form>
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        tone="danger"
        title={t('discardTitle')}
        description={t('discardDescription')}
        confirmLabel={t('discardAction')}
        onConfirm={discard}
      />
    </FormProvider>
  );
}
