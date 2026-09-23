'use client';

import { useState } from 'react';
import { RotateCcwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormProvider, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type { CurrencyCode } from '@tutorio/domain';
import { useSession } from '@/components/app/session-provider';
import { ActionBar } from '@/components/shared/action-bar';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { FormPageLayout } from '@/components/shared/form-page-layout';
import { Notice } from '@/components/shared/notice';
import { useSetPageCrumb } from '@/components/shared/page-crumb';
import { ProgressMeter } from '@/components/shared/progress-meter';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { buildGroupCreateDto, emptyGroupForm } from '@/features/groups/model/form';
import { useStudentFormPicker } from '@/features/students';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { errorMessageKey } from '@/lib/api/error-message';
import { useCreateGroupMutation } from '@/lib/api/groups';
import { useTeachersQuery } from '@/lib/api/teachers';
import { scrollToFirstError } from '@/lib/forms/focus-error';
import { GroupFormSections } from './group-form-sections';
import { useGroupForm, useGroupFormState } from './group-form-state';

/**
 * Create a group on a full page. Only the name is required; the schedule,
 * price, students and notes can come now or later. Like the parent form and
 * unlike the student form, nothing is kept as a draft: leaving a dirty form
 * asks once and then discards it. Success opens the new group's page.
 */
export function GroupCreatePage() {
  const t = useTranslations('groups.form');
  const tGroups = useTranslations('groups');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const mobile = useIsMobile();
  const session = useSession();
  const school = session.workspace.mode === 'SCHOOL';
  const create = useCreateGroupMutation();
  useSetPageCrumb(t('createTitle'));
  const teachers = useTeachersQuery({ page: 1, pageSize: 100, status: 'ACTIVE' }, school);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leavingTo, setLeavingTo] = useState<string | null>(null);
  const [defaults] = useState(() =>
    emptyGroupForm(session.workspace.defaultCurrency as CurrencyCode),
  );
  const form = useGroupForm(defaults, { teacherRequired: school });
  const state = useGroupFormState(form);
  const { isDirty, isSubmitting } = form.formState;
  const saving = isSubmitting || create.isPending;
  const studentIds = useWatch({ control: form.control, name: 'studentIds' });
  const picker = useStudentFormPicker({
    linkedIds: studentIds,
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
        const group = await create.mutateAsync(buildGroupCreateDto(values));
        form.reset(values);
        toast.success(tGroups('toasts.created'));
        router.push(`/app/groups/${group.id}?created=1`);
      } catch {
        // The request error is rendered above the form with a retry.
      }
    },
    (errors) => scrollToFirstError(errors),
  );

  const leave = () => {
    form.reset(defaults);
    setLeaveOpen(false);
    router.push(leavingTo ?? '/app/groups');
  };
  const cancel = () => {
    if (!isDirty) return router.push('/app/groups');
    setLeavingTo(null);
    setLeaveOpen(true);
  };

  const primary = (
    <Button
      type="submit"
      form="group-create-form"
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

  const done = state.navItems.filter((item) => item.status === 'done').length;

  return (
    <FormProvider {...form}>
      <form id="group-create-form" noValidate onSubmit={(event) => void submit(event)}>
        <FormPageLayout
          title={t('createTitle')}
          subtitle={t('createSubtitle')}
          navItems={state.navItems}
          activeSection={state.activeSection}
          onSelectSection={state.setActiveSection}
          labels={{ sections: t('sectionsLabel'), error: t('sectionHasError'), done: t('sectionDone') }}
          navNote={t('sectionsNote')}
          navAside={
            <ProgressMeter
              value={done}
              total={state.navItems.length}
              label={t('progress', { done, total: state.navItems.length })}
              caption={t('progressReady')}
            />
          }
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
          <GroupFormSections
            status={state.status}
            picker={picker}
            teachers={(teachers.data?.items ?? []).map((teacher) => ({
              value: teacher.id,
              label: teacher.fullName,
              avatarKey: teacher.avatarKey,
            }))}
            teachersLoading={school && teachers.isPending}
            showTeacher={school}
            timezone={session.workspace.timezone}
          />
        </FormPageLayout>
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
