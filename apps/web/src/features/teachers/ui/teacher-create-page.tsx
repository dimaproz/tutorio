'use client';

import { useState, type ReactNode } from 'react';
import { RotateCcwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormProvider } from 'react-hook-form';
import { toast } from 'sonner';
import type { CurrencyCodeDto, TeacherListItem } from '@tutorio/validation';
import { useSession } from '@/components/app/session-provider';
import { ActionBar } from '@/components/shared/action-bar';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Notice } from '@/components/shared/notice';
import { useSetPageCrumb } from '@/components/shared/page-crumb';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { errorMessageKey } from '@/lib/api/error-message';
import { useCreateTeacherMutation, useTeachersQuery } from '@/lib/api/teachers';
import { scrollToFirstError } from '@/lib/forms/focus-error';
import { buildTeacherCreateDto, emptyTeacherForm } from '../model/form';
import { freeTeacherColor, usedTeacherColors } from '../model/presentation';
import { TeacherFormSections } from './teacher-form-sections';
import { TeacherFormLayout, useTeacherForm, useTeacherFormState } from './teacher-form-state';

/**
 * The form's save bar: the note and both buttons on a desktop; on a phone
 * «Скасувати» and the primary side by side above the tab bar (S09 board 03).
 */
export function TeacherFormBar({
  mobile,
  tone,
  note,
  secondary,
  primary,
}: {
  mobile: boolean;
  tone: 'danger' | 'warning' | 'muted';
  note: ReactNode;
  secondary: ReactNode;
  primary: ReactNode;
}) {
  return mobile ? (
    // Above the fixed tab bar: at bottom-4 it sat underneath it.
    <div className="sticky bottom-[calc(var(--mobile-tab-bar-height)+16px)] z-10 grid grid-cols-2 gap-2.5">
      {secondary}
      {primary}
    </div>
  ) : (
    <ActionBar tone={tone} note={note} secondary={secondary} primary={primary} />
  );
}

/**
 * Create a teacher on a full page (S09 board 03). Only the name is required;
 * a new teacher starts with the first calendar colour nobody uses. Leaving a
 * dirty form asks once; nothing is kept as a draft.
 */
export function TeacherCreatePage() {
  const t = useTranslations('teachers.form');
  const tCommon = useTranslations('common');
  const session = useSession();
  const teachers = useTeachersQuery({ page: 1, pageSize: 100 });
  useSetPageCrumb(t('createTitle'));

  // The form opens once the studio's teachers are known: the colour depends on them.
  if (teachers.isPending) {
    return (
      <TeacherFormLayout
        title={t('createTitle')}
        subtitle={t('createSubtitle')}
        navItems={[]}
        navLoading
      >
        <span role="status" aria-label={tCommon('loading')} />
      </TeacherFormLayout>
    );
  }
  return (
    <TeacherCreateForm
      teachers={teachers.data?.items ?? []}
      currency={session.workspace.defaultCurrency as CurrencyCodeDto}
    />
  );
}

function TeacherCreateForm({
  teachers,
  currency,
}: {
  teachers: TeacherListItem[];
  currency: CurrencyCodeDto;
}) {
  const t = useTranslations('teachers.form');
  const tTeachers = useTranslations('teachers');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const mobile = useIsMobile();
  const create = useCreateTeacherMutation();
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leavingTo, setLeavingTo] = useState<string | null>(null);
  const [defaults] = useState(() =>
    emptyTeacherForm(currency, freeTeacherColor(usedTeacherColors(teachers))),
  );
  const form = useTeacherForm(defaults);
  const state = useTeacherFormState(form);
  const { isDirty, isSubmitting } = form.formState;
  const saving = isSubmitting || create.isPending;

  useLeaveGuard(isDirty && !saving, (href) => {
    setLeavingTo(href);
    setLeaveOpen(true);
  });

  const submit = form.handleSubmit(
    async (values) => {
      try {
        const teacher = await create.mutateAsync(buildTeacherCreateDto(values));
        form.reset(values);
        toast.success(tTeachers('toasts.created'));
        router.push(`/app/teachers/${teacher.id}`);
      } catch {
        // The request error is rendered above the form with a retry.
      }
    },
    (errors) => scrollToFirstError(errors),
  );

  const leave = () => {
    form.reset(defaults);
    setLeaveOpen(false);
    router.push(leavingTo ?? '/app/teachers');
  };
  const cancel = () => {
    if (!isDirty) return router.push('/app/teachers');
    setLeavingTo(null);
    setLeaveOpen(true);
  };

  return (
    <FormProvider {...form}>
      <form id="teacher-create-form" noValidate onSubmit={(event) => void submit(event)}>
        <TeacherFormLayout
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
          bar={
            <TeacherFormBar
              mobile={mobile}
              tone={state.errorCount > 0 ? 'danger' : 'muted'}
              note={
                saving
                  ? t('savingNote')
                  : state.errorCount > 0
                    ? t('fixFields', { count: state.errorCount })
                    : t('requiredNote')
              }
              secondary={
                <Button
                  type="button"
                  variant="outline"
                  size={mobile ? 'xl' : 'default'}
                  disabled={saving}
                  onClick={cancel}
                >
                  {tCommon('cancel')}
                </Button>
              }
              primary={
                <Button
                  type="submit"
                  form="teacher-create-form"
                  size={mobile ? 'xl' : 'default'}
                  disabled={saving}
                >
                  {saving ? <Spinner data-icon="inline-start" /> : null}
                  {saving ? t('creating') : t('submitCreate')}
                </Button>
              }
            />
          }
        >
          <TeacherFormSections status={state.status} teachers={teachers} />
        </TeacherFormLayout>
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
