'use client';

import { useState } from 'react';
import { RotateCcwIcon, UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormProvider, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type { ParentDetail } from '@tutorio/validation';
import { ActionBar } from '@/components/shared/action-bar';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DangerZone } from '@/components/shared/danger-zone';
import { EmptyState } from '@/components/shared/empty-state';
import { Notice } from '@/components/shared/notice';
import { useSetPageCrumb } from '@/components/shared/page-crumb';
import { SectionSkeleton } from '@/components/shared/section-skeleton';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { buildParentEditDto, parentFormDefaults } from '@/features/parents/model/form';
import { StudentQuickCreateDialog } from '@/features/students';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { errorMessageKey } from '@/lib/api/error-message';
import { useParentQuery, useUpdateParentMutation } from '@/lib/api/parents';
import { scrollToFirstError } from '@/lib/forms/focus-error';
import { useParentDelete } from './parent-delete';
import { ParentFormLayout } from './parent-form-layout';
import { ParentFormSections } from './parent-form-sections';
import { useParentForm, useParentFormNavItems, useParentFormState } from './parent-form-state';
import { useParentStudentPicker } from './use-parent-student-picker';

/**
 * Edit a saved parent on a full page. The record loads first; a failed load
 * never falls back to an empty create form. The destructive block closes the
 * form, apart from the save bar, and only for the owner.
 */
export function ParentEditPage({ parentId }: { parentId: string }) {
  const t = useTranslations('parents.form');
  const tCommon = useTranslations('common');
  const parent = useParentQuery(parentId);
  const navItems = useParentFormNavItems();
  useSetPageCrumb(parent.data ? t('editCrumb', { name: parent.data.fullName }) : null);

  if (parent.isPending) {
    return (
      <ParentFormLayout
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
      </ParentFormLayout>
    );
  }

  if (!parent.data) {
    return (
      <ParentFormLayout title={t('editTitle')} subtitle={t('editSubtitle')} navItems={navItems}>
        <Notice
          tone="danger"
          title={t('loadErrorTitle')}
          text={t('loadErrorDescription')}
          action={
            <Button type="button" variant="white" size="xs" onClick={() => void parent.refetch()}>
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
      </ParentFormLayout>
    );
  }

  // Seeded once per visit, so a background refresh never wipes unsaved edits.
  return <ParentEditForm parent={parent.data} />;
}

function ParentEditForm({ parent }: { parent: ParentDetail }) {
  const t = useTranslations('parents.form');
  const tParents = useTranslations('parents');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const mobile = useIsMobile();
  const update = useUpdateParentMutation(parent.id);
  const profileHref = `/app/parents/${parent.id}`;
  const [discardOpen, setDiscardOpen] = useState(false);
  const [leavingTo, setLeavingTo] = useState<string | null>(null);
  const [studentCreateOpen, setStudentCreateOpen] = useState(false);
  const [defaults] = useState(() => parentFormDefaults(parent));
  const form = useParentForm(defaults);
  const state = useParentFormState(form);
  const { isDirty, isSubmitting } = form.formState;
  const saving = isSubmitting || update.isPending;
  const studentIds = useWatch({ control: form.control, name: 'studentIds' });
  const picker = useParentStudentPicker({
    linkedIds: studentIds,
    initial: parent.students,
    onCreate: () => setStudentCreateOpen(true),
  });
  const [deleted, setDeleted] = useState(false);
  const removal = useParentDelete({
    onDeleted: () => {
      setDeleted(true);
      router.push('/app/parents');
    },
  });

  useLeaveGuard(isDirty && !saving && !deleted, (href) => {
    setLeavingTo(href);
    setDiscardOpen(true);
  });

  const submit = form.handleSubmit(
    async (values) => {
      try {
        await update.mutateAsync(buildParentEditDto(values));
        form.reset(values);
        toast.success(tParents('toasts.updated'));
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
      ? t('fixFields', { count: state.errorCount })
      : isDirty
        ? t('unsaved', { count: state.dirtyCount })
        : t('noChanges');

  const primary = (
    <Button
      type="submit"
      form="parent-edit-form"
      disabled={saving || !isDirty}
      className={mobile ? 'w-full' : undefined}
      size={mobile ? 'xl' : 'default'}
    >
      {saving ? <Spinner data-icon="inline-start" /> : null}
      {saving ? tCommon('saving') : t('submitEdit')}
    </Button>
  );

  const bar = mobile ? (
    <div className="sticky bottom-[calc(var(--mobile-tab-bar-height)+16px)] z-10">{primary}</div>
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
            setLeavingTo(profileHref);
            setDiscardOpen(true);
          }}
        >
          {tCommon('cancel')}
        </Button>
      }
      primary={primary}
    />
  );

  return (
    <FormProvider {...form}>
      <form id="parent-edit-form" noValidate onSubmit={(event) => void submit(event)}>
        <ParentFormLayout
          title={t('editTitle')}
          subtitle={t('editSubtitle')}
          navItems={state.navItems}
          activeSection={state.activeSection}
          onSelectSection={state.setActiveSection}
          progressCaption={isDirty ? t('progressReady') : t('progressSaved')}
          notice={
            update.isError ? (
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
            ) : undefined
          }
          bar={bar}
        >
          <ParentFormSections status={state.status} picker={picker} />
          {removal.canDelete ? (
            <DangerZone
              title={t('danger.title')}
              text={t('danger.text', { name: parent.fullName })}
              action={t('danger.action')}
              disabled={saving || removal.pending}
              onAction={() => removal.request(parent)}
            />
          ) : null}
        </ParentFormLayout>
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
      {removal.dialog}
      <StudentQuickCreateDialog
        open={studentCreateOpen}
        onOpenChange={setStudentCreateOpen}
        navigateOnSuccess={false}
        onSuccess={(student) => {
          picker.remember({ id: student.id, name: student.fullName, avatarKey: student.avatarKey });
          form.setValue('studentIds', [...form.getValues('studentIds'), student.id], {
            shouldDirty: true,
          });
          picker.onOpenChange(false);
        }}
      />
    </FormProvider>
  );
}
