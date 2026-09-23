'use client';

import { useMemo, useState } from 'react';
import { RotateCcwIcon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormProvider, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { ActionBar } from '@/components/shared/action-bar';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Notice } from '@/components/shared/notice';
import { useSetPageCrumb } from '@/components/shared/page-crumb';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { buildParentCreateDto, EMPTY_PARENT_FORM } from '@/features/parents/model/form';
import { useStudentQuery } from '@/lib/api/students';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { errorMessageKey } from '@/lib/api/error-message';
import { useCreateParentMutation } from '@/lib/api/parents';
import { scrollToFirstError } from '@/lib/forms/focus-error';
import { ParentFormLayout } from './parent-form-layout';
import { ParentFormSections } from './parent-form-sections';
import { useParentForm, useParentFormState } from './parent-form-state';
import { useParentStudentPicker } from './use-parent-student-picker';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Create a parent on a full page. Only the name is required. Unlike the
 * student form, nothing is kept as a local draft: leaving a dirty form asks
 * once and then discards it, and nothing is written to browser storage.
 * Opened from a student's profile (`?studentId=`), that student is linked
 * from the start.
 */
export function ParentCreatePage() {
  const t = useTranslations('parents.form');
  const tParents = useTranslations('parents');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const mobile = useIsMobile();
  const create = useCreateParentMutation();
  useSetPageCrumb(t('createTitle'));
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leavingTo, setLeavingTo] = useState<string | null>(null);
  const requested = useSearchParams().get('studentId') ?? '';
  const prelinkedId = UUID.test(requested) ? requested : '';
  const prelinked = useStudentQuery(prelinkedId, Boolean(prelinkedId));
  const [defaults] = useState(() =>
    prelinkedId ? { ...EMPTY_PARENT_FORM, studentIds: [prelinkedId] } : EMPTY_PARENT_FORM,
  );
  const form = useParentForm(defaults);
  const state = useParentFormState(form);
  const { isDirty, isSubmitting } = form.formState;
  const saving = isSubmitting || create.isPending;
  const studentIds = useWatch({ control: form.control, name: 'studentIds' });
  const prelinkedStudents = useMemo(
    () =>
      prelinked.data
        ? [
            {
              id: prelinked.data.id,
              fullName: prelinked.data.fullName,
              avatarKey: prelinked.data.avatarKey,
              status: prelinked.data.status,
              languageLevel: prelinked.data.languageLevel,
            },
          ]
        : [],
    [prelinked.data],
  );
  const picker = useParentStudentPicker({
    linkedIds: studentIds,
    initial: prelinkedStudents,
    // Creating a student is its own page; leaving asks first if anything was typed.
    onCreate: () => {
      if (!form.formState.isDirty) return router.push('/app/students/new');
      setLeavingTo('/app/students/new');
      setLeaveOpen(true);
    },
  });

  useLeaveGuard(isDirty && !saving, (href) => {
    setLeavingTo(href);
    setLeaveOpen(true);
  });

  const submit = form.handleSubmit(
    async (values) => {
      try {
        const parent = await create.mutateAsync(buildParentCreateDto(values));
        form.reset(values);
        toast.success(tParents('toasts.created'));
        router.push(`/app/parents/${parent.id}`);
      } catch {
        // The request error is rendered above the form with a retry.
      }
    },
    (errors) => scrollToFirstError(errors),
  );

  const leave = () => {
    form.reset(defaults);
    setLeaveOpen(false);
    router.push(leavingTo ?? '/app/parents');
  };
  const cancel = () => {
    if (!isDirty) return router.push('/app/parents');
    setLeavingTo(null);
    setLeaveOpen(true);
  };

  const primary = (
    <Button
      type="submit"
      form="parent-create-form"
      disabled={saving}
      className={mobile ? 'w-full' : undefined}
      size={mobile ? 'xl' : 'default'}
    >
      {saving ? <Spinner data-icon="inline-start" /> : null}
      {saving ? t('creating') : t('submitCreate')}
    </Button>
  );

  const bar = mobile ? (
    // Above the fixed tab bar: at bottom-4 it sat underneath it.
    <div className="sticky bottom-[calc(var(--mobile-tab-bar-height)+16px)] z-10">{primary}</div>
  ) : (
    <ActionBar
      tone={state.errorCount > 0 ? 'danger' : 'muted'}
      note={
        saving
          ? t('savingNote')
          : state.errorCount > 0
            ? t('fixFields', { count: state.errorCount })
            : t('requiredNote')
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
      <form id="parent-create-form" noValidate onSubmit={(event) => void submit(event)}>
        <ParentFormLayout
          title={t('createTitle')}
          subtitle={t('createSubtitle')}
          navItems={state.navItems}
          activeSection={state.activeSection}
          onSelectSection={state.setActiveSection}
          navNote={t('sectionsNote')}
          progressCaption={t('progressReady')}
          notice={
            create.isError ? (
              <Notice
                tone="danger"
                title={t('requestErrorTitle')}
                text={tErrors(errorMessageKey(create.error))}
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
          <ParentFormSections status={state.status} picker={picker} />
        </ParentFormLayout>
      </form>
      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        tone="danger"
        title={t('leaveTitle')}
        description={t('leaveDescription')}
        confirmLabel={t('leaveAction')}
        onConfirm={leave}
      />
    </FormProvider>
  );
}
