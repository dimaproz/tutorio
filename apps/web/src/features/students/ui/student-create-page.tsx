'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormProvider } from 'react-hook-form';
import { toast } from 'sonner';
import { ActionBar } from '@/components/shared/action-bar';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Notice } from '@/components/shared/notice';
import { useSetPageCrumb } from '@/components/shared/page-crumb';
import { detectTimezone } from '@/components/shared/timezone-combobox';
import { useSession } from '@/components/app/session-provider';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  STUDENT_DRAFT_KEY,
  buildStudentCreateDto,
  emptyStudentForm,
  parseStudentDraft,
  type StudentFormValues,
} from '@/features/students/model/form';
import { useIsMobile } from '@/hooks/use-mobile';
import { errorMessageKey } from '@/lib/api/error-message';
import { useCreateStudentMutation } from '@/lib/api/students';
import { scrollToFirstError } from '@/lib/forms/focus-error';
import { StudentFormLayout } from './student-form-layout';
import { StudentFormSections } from './student-form-sections';
import { useLeaveGuard, useStudentForm, useStudentFormState } from './student-form-state';

function readDraft(): Partial<StudentFormValues> | null {
  try {
    return parseStudentDraft(window.localStorage.getItem(STUDENT_DRAFT_KEY));
  } catch {
    return null;
  }
}

function writeDraft(values: StudentFormValues | null) {
  try {
    if (values) window.localStorage.setItem(STUDENT_DRAFT_KEY, JSON.stringify(values));
    else window.localStorage.removeItem(STUDENT_DRAFT_KEY);
  } catch {
    // Private mode or a full quota: the draft is a convenience, never a requirement.
  }
}

/**
 * Create a student on a full page. Only the name and the timezone are
 * required; the rest can be filled in now or later. An unfinished form is
 * kept as a local draft in this browser until it is created or discarded.
 */
export function StudentCreatePage() {
  const t = useTranslations('students.form');
  const tStudents = useTranslations('students');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const session = useSession();
  const router = useRouter();
  const mobile = useIsMobile();
  const createStudent = useCreateStudentMutation();
  useSetPageCrumb(t('createTitle'));
  const [discardOpen, setDiscardOpen] = useState(false);
  const [defaults] = useState(() =>
    emptyStudentForm({ currency: session.workspace.defaultCurrency, timezone: detectTimezone() }),
  );
  const form = useStudentForm(defaults);
  const state = useStudentFormState(form);
  const { isDirty, isSubmitting } = form.formState;
  const saving = isSubmitting || createStudent.isPending;
  const restored = useRef(false);

  // The draft is read after mount: the server render cannot see this browser.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const draft = readDraft();
    if (draft) form.reset({ ...defaults, ...draft }, { keepDefaultValues: true });
  }, [defaults, form]);

  useEffect(() => {
    if (!restored.current) return;
    writeDraft(isDirty ? state.values : null);
  }, [isDirty, state.values]);

  useLeaveGuard(isDirty && !saving);

  const submit = form.handleSubmit(
    async (values) => {
      try {
        const student = await createStudent.mutateAsync(buildStudentCreateDto(values));
        writeDraft(null);
        form.reset(values);
        toast.success(tStudents('toasts.created'));
        router.push(`/app/students/${student.id}?setup=1`);
      } catch {
        // The request error is rendered above the form with a retry.
      }
    },
    (errors) => scrollToFirstError(errors),
  );

  const leave = () => {
    writeDraft(null);
    router.push('/app/students');
  };
  const cancel = () => (isDirty ? setDiscardOpen(true) : leave());

  const primary = (
    <Button
      type="submit"
      form="student-create-form"
      disabled={saving}
      className={mobile ? 'w-full' : undefined}
      size={mobile ? 'xl' : 'default'}
    >
      {saving ? <Spinner data-icon="inline-start" /> : null}
      {saving ? t('creating') : t('submitCreate')}
    </Button>
  );

  const bar = mobile ? (
    <div className="sticky bottom-4 z-10">{primary}</div>
  ) : (
    <ActionBar
      tone={state.errorCount > 0 ? 'danger' : 'muted'}
      note={
        saving
          ? t('savingNote')
          : state.errorCount > 0
            ? t('fixFields', { count: state.errorCount })
            : isDirty
              ? t('draftSaved')
              : undefined
      }
      secondary={
        <Button type="button" variant="outline" disabled={saving} onClick={cancel}>
          {tCommon('cancel')}
        </Button>
      }
      primary={primary}
    />
  );

  return (
    <FormProvider {...form}>
      <form id="student-create-form" noValidate onSubmit={(event) => void submit(event)}>
        <StudentFormLayout
          title={t('createTitle')}
          subtitle={t('createSubtitle')}
          navItems={state.navItems}
          activeSection={state.activeSection}
          onSelectSection={state.setActiveSection}
          showProgress
          notice={
            createStudent.isError ? (
              <Notice
                tone="danger"
                title={t('requestErrorTitle')}
                text={tErrors(errorMessageKey(createStudent.error))}
                action={
                  <Button type="submit" variant="white" size="xs" disabled={saving}>
                    <RotateCcwIcon data-icon="inline-start" />
                    {tCommon('retry')}
                  </Button>
                }
              />
            ) : undefined
          }
          bar={bar}
        >
          <StudentFormSections
            status={state.status}
            timezoneFromBrowser={state.values.timezone === defaults.timezone}
          />
        </StudentFormLayout>
      </form>
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        tone="danger"
        title={t('discardTitle')}
        description={t('discardDescription')}
        confirmLabel={t('discardAction')}
        onConfirm={() => {
          setDiscardOpen(false);
          leave();
        }}
      />
    </FormProvider>
  );
}
