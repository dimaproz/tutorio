'use client';

import { useState } from 'react';
import { RotateCcwIcon, UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormProvider } from 'react-hook-form';
import { toast } from 'sonner';
import type { CurrencyCodeDto, TeacherListItem, TeacherResponse } from '@tutorio/validation';
import { useSession } from '@/components/app/session-provider';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { Notice } from '@/components/shared/notice';
import { useSetPageCrumb } from '@/components/shared/page-crumb';
import { SectionSkeleton } from '@/components/shared/section-skeleton';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { errorMessageKey } from '@/lib/api/error-message';
import { useTeacherQuery, useTeachersQuery, useUpdateTeacherMutation } from '@/lib/api/teachers';
import { scrollToFirstError } from '@/lib/forms/focus-error';
import { buildTeacherEditDto, teacherFormDefaults } from '../model/form';
import { TEACHER_COLORS } from '../model/presentation';
import { TeacherFormBar } from './teacher-create-page';
import { TeacherFormSections } from './teacher-form-sections';
import {
  TeacherFormLayout,
  useTeacherForm,
  useTeacherFormNavItems,
  useTeacherFormState,
} from './teacher-form-state';
import { useTeacherActions } from './use-teacher-actions';

/**
 * Edit a teacher on a full page. The record loads first; a failed load never
 * falls back to an empty form. The owner's own profile reads «Мій профіль
 * викладача» and carries «Я викладаю» (S09 board 03-04); there is no progress
 * meter on an edit.
 */
export function TeacherEditPage({ teacherId }: { teacherId: string }) {
  const t = useTranslations('teachers.form');
  const tCommon = useTranslations('common');
  const teacher = useTeacherQuery(teacherId);
  const teachers = useTeachersQuery({ page: 1, pageSize: 100 });
  const navItems = useTeacherFormNavItems();
  useSetPageCrumb(teacher.data ? t('editCrumb', { name: teacher.data.fullName }) : null);

  if (teacher.isPending || teachers.isPending) {
    return (
      <TeacherFormLayout
        title={<span className="sr-only">{tCommon('loading')}</span>}
        subtitle={t('editSubtitle')}
        navItems={navItems}
        navLoading
      >
        <div role="status" aria-label={tCommon('loading')} className="flex flex-col gap-4">
          <SectionSkeleton fields={2} />
          <SectionSkeleton fields={3} />
          <SectionSkeleton fields={4} />
        </div>
      </TeacherFormLayout>
    );
  }

  if (!teacher.data) {
    return (
      <TeacherFormLayout title={t('editTitle')} subtitle={t('editSubtitle')} navItems={navItems}>
        <Notice
          tone="danger"
          title={t('loadErrorTitle')}
          text={t('loadErrorDescription')}
          action={
            <Button type="button" variant="white" size="xs" onClick={() => void teacher.refetch()}>
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
      </TeacherFormLayout>
    );
  }

  // Seeded once per visit, so a background refresh never wipes unsaved edits.
  return <TeacherEditForm teacher={teacher.data} teachers={teachers.data?.items ?? []} />;
}

function TeacherEditForm({
  teacher,
  teachers,
}: {
  teacher: TeacherResponse;
  teachers: TeacherListItem[];
}) {
  const t = useTranslations('teachers.form');
  const tTeachers = useTranslations('teachers');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const mobile = useIsMobile();
  const session = useSession();
  const update = useUpdateTeacherMutation(teacher.id);
  const actions = useTeacherActions();
  const profileHref = `/app/teachers/${teacher.id}`;
  const own = teacher.isMe;
  const [discardOpen, setDiscardOpen] = useState(false);
  const [leavingTo, setLeavingTo] = useState<string | null>(null);
  const [defaults] = useState(() =>
    teacherFormDefaults(teacher, {
      currency: session.workspace.defaultCurrency as CurrencyCodeDto,
      color: TEACHER_COLORS[0],
    }),
  );
  const form = useTeacherForm(defaults);
  const state = useTeacherFormState(form);
  const { isDirty, isSubmitting } = form.formState;
  const saving = isSubmitting || update.isPending;
  // The switch acts on the saved profile, which the list keeps current.
  const current = teachers.find((item) => item.id === teacher.id) ?? teacher;

  useLeaveGuard(isDirty && !saving, (href) => {
    setLeavingTo(href);
    setDiscardOpen(true);
  });

  const submit = form.handleSubmit(
    async (values) => {
      try {
        await update.mutateAsync(buildTeacherEditDto(values));
        form.reset(values);
        toast.success(tTeachers('toasts.updated'));
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
        : t('requiredNote');

  return (
    <FormProvider {...form}>
      <form id="teacher-edit-form" noValidate onSubmit={(event) => void submit(event)}>
        <TeacherFormLayout
          title={own ? t('ownTitle') : t('editTitle')}
          subtitle={own ? t('ownSubtitle') : t('editSubtitle')}
          navItems={state.navItems}
          activeSection={state.activeSection}
          onSelectSection={state.setActiveSection}
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
          bar={
            <TeacherFormBar
              mobile={mobile}
              tone={state.errorCount > 0 ? 'danger' : isDirty ? 'warning' : 'muted'}
              note={note}
              secondary={
                <Button
                  type="button"
                  variant="outline"
                  size={mobile ? 'xl' : 'default'}
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
              primary={
                <Button
                  type="submit"
                  form="teacher-edit-form"
                  size={mobile ? 'xl' : 'default'}
                  disabled={saving || !isDirty}
                >
                  {saving ? <Spinner data-icon="inline-start" /> : null}
                  {saving ? tCommon('saving') : t('submitEdit')}
                </Button>
              }
            />
          }
        >
          <TeacherFormSections
            status={state.status}
            teachers={teachers}
            selfId={teacher.id}
            teachingSwitch={
              own && session.workspace.mode === 'SCHOOL'
                ? {
                    teaching: current.status === 'ACTIVE',
                    busy: actions.busyId === teacher.id,
                    onChange: (next) =>
                      next
                        ? actions.commands.onRestore(current)
                        : actions.commands.onStopTeaching?.(current),
                  }
                : undefined
            }
          />
        </TeacherFormLayout>
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
      {actions.dialogs}
    </FormProvider>
  );
}
