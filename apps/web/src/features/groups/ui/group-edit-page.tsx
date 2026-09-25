'use client';

import { useMemo, useState } from 'react';
import { ArchiveIcon, LayersIcon, RotateCcwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormProvider, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type { CurrencyCode } from '@tutorio/domain';
import type { GroupDetail } from '@tutorio/validation';
import { useSession } from '@/components/app/session-provider';
import { ActionBar } from '@/components/shared/action-bar';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DangerZone } from '@/components/shared/danger-zone';
import { EmptyState } from '@/components/shared/empty-state';
import { FormPageLayout } from '@/components/shared/form-page-layout';
import { Notice } from '@/components/shared/notice';
import { useSetPageCrumb } from '@/components/shared/page-crumb';
import { ProgressMeter } from '@/components/shared/progress-meter';
import { SectionSkeleton } from '@/components/shared/section-skeleton';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { buildGroupEditDto, groupFormDefaults } from '@/features/groups/model/form';
import { useStudentFormPicker } from '@/features/students';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLeaveGuard } from '@/hooks/use-leave-guard';
import { errorMessageKey } from '@/lib/api/error-message';
import { useGroupQuery, useUpdateGroupMutation } from '@/lib/api/groups';
import { useTeachersQuery } from '@/lib/api/teachers';
import { scrollToFirstError } from '@/lib/forms/focus-error';
import { useGroupArchive } from './group-archive';
import { GroupFormSections } from './group-form-sections';
import { useGroupForm, useGroupFormNavItems, useGroupFormState } from './group-form-state';

/**
 * Edit a saved group on a full page. The group loads first; a failed load
 * never falls back to an empty create form, and an archived group is not
 * editable. The form ends with the owner's archive block.
 */
export function GroupEditPage({ groupId }: { groupId: string }) {
  const t = useTranslations('groups.form');
  const tCommon = useTranslations('common');
  const group = useGroupQuery(groupId);
  const navItems = useGroupFormNavItems();
  const labels = {
    sections: t('sectionsLabel'),
    error: t('sectionHasError'),
    done: t('sectionDone'),
  };
  useSetPageCrumb(t('editTitle'));

  if (group.isPending) {
    return (
      <FormPageLayout
        title={<span className="sr-only">{tCommon('loading')}</span>}
        subtitle={t('editSubtitle')}
        navItems={navItems}
        labels={labels}
        navLoading
      >
        <div role="status" aria-label={tCommon('loading')} className="flex flex-col gap-4">
          <SectionSkeleton fields={2} />
          <SectionSkeleton fields={2} />
          <SectionSkeleton fields={2} />
        </div>
      </FormPageLayout>
    );
  }

  if (!group.data || group.data.deletedAt) {
    return (
      <FormPageLayout
        title={t('editTitle')}
        subtitle={t('editSubtitle')}
        navItems={navItems}
        labels={labels}
      >
        {group.data ? (
          <Notice tone="warning" icon={<ArchiveIcon />} text={t('archivedNotice')} />
        ) : (
          <Notice
            tone="danger"
            title={t('loadErrorTitle')}
            text={t('loadErrorDescription')}
            action={
              <Button type="button" variant="white" size="xs" onClick={() => void group.refetch()}>
                <RotateCcwIcon data-icon="inline-start" />
                {tCommon('retry')}
              </Button>
            }
          />
        )}
        <EmptyState
          icon={<LayersIcon />}
          title={t('unavailableTitle')}
          text={t('unavailableDescription')}
          minHeight={420}
        />
      </FormPageLayout>
    );
  }

  // Seeded once per visit, so a background refresh never wipes unsaved edits.
  return <GroupEditForm group={group.data} />;
}

function GroupEditForm({ group }: { group: GroupDetail }) {
  const t = useTranslations('groups.form');
  const tGroups = useTranslations('groups');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const mobile = useIsMobile();
  const session = useSession();
  const school = session.workspace.mode === 'SCHOOL';
  const update = useUpdateGroupMutation(group.id);
  const teachers = useTeachersQuery({ page: 1, pageSize: 100, status: 'ACTIVE' }, school);
  const pageHref = `/app/groups/${group.id}`;
  const scheduleLocked = group.schedules.length > 0;
  const [discardOpen, setDiscardOpen] = useState(false);
  const [leavingTo, setLeavingTo] = useState<string | null>(null);
  const [defaults] = useState(() =>
    groupFormDefaults(group, session.workspace.defaultCurrency as CurrencyCode),
  );
  const form = useGroupForm(defaults, { teacherRequired: school });
  const state = useGroupFormState(form, { scheduleLocked });
  const { isDirty, isSubmitting } = form.formState;
  const saving = isSubmitting || update.isPending;
  const studentIds = useWatch({ control: form.control, name: 'studentIds' });
  const roster = useMemo(() => group.enrollments.map((enrollment) => enrollment.student), [group]);
  const picker = useStudentFormPicker({
    linkedIds: studentIds,
    initial: roster,
    onCreate: () => {
      if (!form.formState.isDirty) return router.push('/app/students/new');
      setLeavingTo('/app/students/new');
      setDiscardOpen(true);
    },
  });
  const [archived, setArchived] = useState(false);
  const archiving = useGroupArchive({
    onArchived: () => {
      setArchived(true);
      router.push('/app/groups');
    },
  });

  // The teacher on file, else the roster's: the one a teacher change moves from.
  const teacherOptions = useMemo(() => {
    const options = (teachers.data?.items ?? []).map((teacher) => ({
      value: teacher.id,
      label: teacher.fullName,
      avatarKey: teacher.avatarKey,
    }));
    if (group.teacher && !options.some((option) => option.value === group.teacher?.id)) {
      options.unshift({
        value: group.teacher.id,
        label: group.teacher.name,
        avatarKey: group.teacher.avatarKey,
      });
    }
    return options;
  }, [teachers.data, group.teacher]);

  useLeaveGuard(isDirty && !saving && !archived, (href) => {
    setLeavingTo(href);
    setDiscardOpen(true);
  });

  const submit = form.handleSubmit(
    async (values) => {
      try {
        await update.mutateAsync(
          buildGroupEditDto(
            values,
            // Against what the form started with: a group without its own
            // teacher opens with the roster's, and keeping it must not send
            // a teacher change that moves every upcoming lesson.
            { teacherId: defaults.teacherId, studentIds: defaults.studentIds },
            { scheduleLocked },
          ),
        );
        form.reset(values);
        toast.success(tGroups('toasts.updated'));
        router.push(pageHref);
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
      form="group-edit-form"
      disabled={saving || !isDirty}
      className={mobile ? 'w-full' : undefined}
      size={mobile ? 'xl' : 'default'}
    >
      {saving ? <Spinner data-icon="inline-start" /> : null}
      {saving ? t('saving') : t('submitEdit')}
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
            if (!isDirty) return router.push(pageHref);
            setLeavingTo(pageHref);
            setDiscardOpen(true);
          }}
        >
          {tCommon('cancel')}
        </Button>
      }
      primary={primary}
    />
  );

  const done = state.navItems.filter((item) => item.status === 'done').length;

  return (
    <FormProvider {...form}>
      <form id="group-edit-form" noValidate onSubmit={(event) => void submit(event)}>
        <FormPageLayout
          title={t('editTitle')}
          subtitle={t('editSubtitle')}
          navItems={state.navItems}
          activeSection={state.activeSection}
          onSelectSection={state.setActiveSection}
          labels={{
            sections: t('sectionsLabel'),
            error: t('sectionHasError'),
            done: t('sectionDone'),
          }}
          navAside={
            <ProgressMeter
              value={done}
              total={state.navItems.length}
              label={t('progress', { done, total: state.navItems.length })}
              caption={isDirty ? t('progressReady') : t('progressSaved')}
            />
          }
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
          <GroupFormSections
            status={state.status}
            picker={picker}
            teachers={teacherOptions}
            teachersLoading={school && teachers.isPending}
            showTeacher={school}
            teacherHint={t('teacherHint')}
            lockedSchedules={scheduleLocked ? group.schedules : undefined}
            timezone={session.workspace.timezone}
            priceImpact={{
              members: group.enrollments,
              initialPriceMinor: group.pricePerLesson,
              nextLessonAt: group.nextLesson?.startsAtUtc ?? null,
            }}
          />
          {archiving.canArchive ? (
            <DangerZone
              title={t('danger.title')}
              text={t('danger.text')}
              action={t('danger.action')}
              disabled={saving || archiving.archiving}
              onAction={() => archiving.request(group)}
            />
          ) : null}
        </FormPageLayout>
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
      {archiving.dialog}
    </FormProvider>
  );
}
