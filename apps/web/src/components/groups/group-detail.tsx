'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BanknoteIcon,
  CalendarDaysIcon,
  CircleDollarSignIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UsersRoundIcon,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { GroupEnrollmentSummary } from '@tutorio/validation';
import { BackButton } from '@/components/app/back-button';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { MetricCard } from '@/components/app/metric-card';
import { ProfileHeader, ProfileTag, SectionTitle } from '@/components/app/detail-view';
import { QueryErrorAlert } from '@/components/app/page-shell';
import { useSession } from '@/components/app/session-provider';
import { GroupStatusBadge } from '@/components/app/status-badges';
import { EnrollmentDialog } from '@/components/enrollments/enrollment-dialog';
import { PackageSummaryCard } from '@/components/packages/package-summary-card';
import { ScheduleSlotCard } from '@/components/scheduling/schedule-slot-card';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { errorMessageKey } from '@/lib/api/error-message';
import { useDeleteGroupMutation, useGroupQuery, useRestoreGroupMutation } from '@/lib/api/groups';
import { usePackagesQuery } from '@/lib/api/packages';
import { useLessonsQuery, useSeriesListQuery } from '@/lib/api/scheduling';
import type { GatewayError } from '@/lib/auth/client';
import { useDateFormatters } from '@/lib/i18n/format';
import { formatMoneyDisplay } from '@/lib/money';
import { LoadingPanel } from '@/components/shared';
import { GroupAttendanceChart, type GroupAnalyticsPeriod } from './group-attendance-chart';
import { GroupLessonsCard } from './group-lessons-card';
import { GroupMembersTable } from './group-members-table';
import { GroupFormDialog } from './group-form-dialog';

function scheduleTimeRange(localTime: string, durationMin: number) {
  const [hours, minutes] = localTime.split(':').map(Number);
  const endMinutes = (hours * 60 + minutes + durationMin) % (24 * 60);
  const endHours = Math.floor(endMinutes / 60);
  const endMinute = endMinutes % 60;
  return `${localTime} – ${String(endHours).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
}

function analyticsRange(period: GroupAnalyticsPeriod) {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - (period === 'sixWeeks' ? 42 : 91));
  const to = new Date(now);
  to.setDate(to.getDate() + 90);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function GroupDetailView({ groupId }: { groupId: string }) {
  const t = useTranslations('groups');
  const tDetail = useTranslations('groups.detail');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const format = useDateFormatters();
  const router = useRouter();
  const session = useSession();
  const isOwner = session.role === 'OWNER';

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<GroupEnrollmentSummary | undefined>();
  const [period, setPeriod] = useState<GroupAnalyticsPeriod>('sixWeeks');

  const group = useGroupQuery(groupId);
  const series = useSeriesListQuery({ page: 1, pageSize: 100, groupId });
  const packages = usePackagesQuery({ page: 1, pageSize: 6, groupId });
  const lessonRange = useMemo(() => analyticsRange(period), [period]);
  const lessons = useLessonsQuery({ ...lessonRange, groupId });
  const deleteGroup = useDeleteGroupMutation();
  const restoreGroup = useRestoreGroupMutation();

  if (group.isPending) {
    return <LoadingPanel size="lg" />;
  }
  if (group.isError) {
    return (
      <QueryErrorAlert
        error={group.error}
        title={t('error.title')}
        onRetry={() => void group.refetch()}
      />
    );
  }

  const data = group.data;
  const isDeleted = Boolean(data.deletedAt);
  const activeEnrollments = data.enrollments.filter((item) => item.status === 'ACTIVE');
  const archivedEnrollments = data.enrollments.filter((item) => item.status === 'ARCHIVED');
  const status = activeEnrollments.length > 0 ? 'ACTIVE' : 'EMPTY';
  const eligibleRevenue = (lessons.data?.items ?? []).filter(
    (lesson) => lesson.status === 'COMPLETED' || lesson.status === 'CANCELLED_CHARGED',
  );
  const canShowRevenue =
    eligibleRevenue.length > 0 &&
    eligibleRevenue.every((lesson) => lesson.currency === data.currency);
  const revenue = canShowRevenue
    ? eligibleRevenue.reduce((total, lesson) => total + lesson.priceMinor, 0)
    : null;
  const schedules = (series.data?.items ?? []).flatMap((item) =>
    item.weekdays.map((weekday) => ({
      id: `${item.id}-${weekday}`,
      weekday,
      localTime: item.localTime,
      durationMin: item.durationMin,
      timezone: item.timezone,
    })),
  );
  const activePackages = (packages.data?.items ?? []).filter((pkg) => pkg.remainingCredits > 0);

  function openCreate() {
    setEditing(undefined);
    setSheetOpen(true);
  }

  function openEdit(summary: GroupEnrollmentSummary) {
    setEditing(summary);
    setSheetOpen(true);
  }

  async function onDelete() {
    try {
      await deleteGroup.mutateAsync(groupId);
      toast.success(t('toasts.deleted'));
      setDeleteOpen(false);
      router.push('/app/groups');
    } catch (error) {
      toast.error(tErrors(errorMessageKey(error as GatewayError)));
    }
  }

  async function onRestore() {
    try {
      await restoreGroup.mutateAsync(groupId);
      toast.success(t('toasts.restored'));
    } catch (error) {
      toast.error(tErrors(errorMessageKey(error as GatewayError)));
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <BackButton href="/app/groups" />
        {isDeleted ? (
          isOwner ? (
            <Button
              type="button"
              onClick={() => void onRestore()}
              disabled={restoreGroup.isPending}
            >
              {tCommon('restore')}
            </Button>
          ) : null
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setEditOpen(true)}>
              <PencilIcon data-icon="inline-start" />
              {tCommon('edit')}
            </Button>
            <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2Icon data-icon="inline-start" />
              {tCommon('delete')}
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <ProfileHeader
          fullName={data.name}
          badge={<GroupStatusBadge status={status} />}
          subtitle={tDetail('createdOn', { date: format.longDate(data.createdAt) })}
          tags={
            <>
              <ProfileTag icon={UsersRoundIcon}>
                {t('studentCount', { count: activeEnrollments.length })}
              </ProfileTag>
              {data.currency ? <ProfileTag>{data.currency}</ProfileTag> : null}
            </>
          }
        />
        {data.notes ? (
          <p className="max-w-3xl text-sm text-muted-foreground">{data.notes}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={BanknoteIcon}
          tone="success"
          label={tDetail('metrics.price')}
          value={
            data.pricePerLesson != null && data.currency
              ? formatMoneyDisplay(data.pricePerLesson, data.currency, locale)
              : tDetail('unavailable')
          }
          description={tDetail('metrics.priceDescription')}
        />
        <MetricCard
          icon={CircleDollarSignIcon}
          tone="primary"
          label={tDetail('metrics.revenue')}
          value={
            revenue != null && data.currency
              ? formatMoneyDisplay(revenue, data.currency, locale)
              : tDetail('unavailable')
          }
          description={tDetail('metrics.revenueDescription')}
        />
        <MetricCard
          icon={UsersRoundIcon}
          tone="primary"
          label={tDetail('metrics.students')}
          value={activeEnrollments.length}
          description={tDetail('metrics.studentsDescription', {
            archived: archivedEnrollments.length,
          })}
        />
        <MetricCard
          icon={CalendarDaysIcon}
          tone="warning"
          label={tDetail('metrics.attendance')}
          value={tDetail('unavailable')}
          description={tDetail('metrics.attendanceDescription')}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <SectionTitle icon={UsersRoundIcon} tone="primary">
                {tDetail('membersTitle')}
              </SectionTitle>
              <CardDescription>{tDetail('membersDescription')}</CardDescription>
              {!isDeleted ? (
                <CardAction>
                  <Button type="button" size="sm" onClick={openCreate}>
                    <PlusIcon data-icon="inline-start" />
                    {tDetail('addStudent')}
                  </Button>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent>
              {data.enrollments.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>{tDetail('noMembers')}</EmptyTitle>
                    <EmptyDescription>{tDetail('noMembersDescription')}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <GroupMembersTable
                  enrollments={data.enrollments}
                  disabled={isDeleted}
                  onEdit={openEdit}
                />
              )}
            </CardContent>
          </Card>

          <GroupAttendanceChart period={period} onPeriodChange={setPeriod} />
          <GroupLessonsCard
            groupId={data.id}
            lessons={lessons.data?.items ?? []}
            pending={lessons.isPending}
          />
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <SectionTitle icon={CalendarDaysIcon} tone="warning">
                {tDetail('scheduleTitle')}
              </SectionTitle>
              <CardDescription>{tDetail('scheduleDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              {series.isPending ? (
                <p className="text-sm text-muted-foreground">{tDetail('loadingSchedule')}</p>
              ) : schedules.length === 0 ? (
                <Empty className="border border-dashed py-6">
                  <EmptyHeader>
                    <EmptyTitle>{tDetail('noSchedule')}</EmptyTitle>
                    <EmptyDescription>{tDetail('noScheduleDescription')}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ul className="flex flex-col gap-3">
                  {schedules.map((schedule) => (
                    <li key={schedule.id}>
                      <ScheduleSlotCard
                        weekday={tDetail(`weekdays.${schedule.weekday}`)}
                        timeRange={scheduleTimeRange(schedule.localTime, schedule.durationMin)}
                        duration={tDetail('durationMinutes', { minutes: schedule.durationMin })}
                        timezone={schedule.timezone}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionTitle icon={PackageIcon} tone="success">
                {tDetail('packagesTitle')}
              </SectionTitle>
              <CardDescription>{tDetail('packagesDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              {packages.isPending ? (
                <p className="text-sm text-muted-foreground">{tDetail('loadingPackages')}</p>
              ) : activePackages.length === 0 ? (
                <Empty className="border border-dashed py-6">
                  <EmptyHeader>
                    <EmptyTitle>{tDetail('noPackages')}</EmptyTitle>
                    <EmptyDescription>{tDetail('noPackagesDescription')}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ul className="flex flex-col gap-3">
                  {activePackages.map((pkg) => (
                    <li key={pkg.id}>
                      <PackageSummaryCard package={pkg} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('deleteDialog.title')}
        description={t('deleteDialog.description', { name: data.name })}
        confirmLabel={tCommon('delete')}
        onConfirm={() => void onDelete()}
        pending={deleteGroup.isPending}
      />

      <EnrollmentDialog
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        enrollment={editing}
        lockedGroupId={data.id}
      />

      <GroupFormDialog open={editOpen} onOpenChange={setEditOpen} groupId={data.id} />
    </>
  );
}
