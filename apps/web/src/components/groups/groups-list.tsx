'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { LayersIcon, PlusIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { GroupListItem } from '@tutorio/validation';
import { GroupCard } from './group-card';
import { GroupFormDialog } from './group-form-dialog';
import { GroupRowActions } from './group-row-actions';
import { DataTable } from '@/components/app/data-table';
import { EmptyCell } from '@/components/app/table-cells';
import {
  ListPagination,
  ListSearchInput,
  ListSelectFilter,
  ListStateFilter,
  useListSort,
} from '@/components/app/list-controls';
import { PageHeader, QueryErrorAlert } from '@/components/app/page-shell';
import { useSession } from '@/components/app/session-provider';
import { CURRENCY_META } from '@/components/app/currency-option';
import { GroupStatusBadge } from '@/components/app/status-badges';
import { AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { CollectionEmptyState, CollectionToolbar, LoadingPanel } from '@/components/shared';
import { EntityAvatar } from '@/components/app/entity-avatar';
import { parsePageParam, parseStateParam } from '@/lib/api/filters';
import { useGroupsQuery } from '@/lib/api/groups';
import { useStudentsQuery } from '@/lib/api/students';
import { useWeekdayLabels } from '@/lib/i18n/weekdays';
import { formatAmountDisplay } from '@/lib/money';

const GROUP_STATUSES = ['ACTIVE', 'EMPTY'] as const;
const SCHEDULE_FILTERS = ['WITH_SCHEDULE', 'WITHOUT_SCHEDULE'] as const;
const ROSTER_LIMIT = 4;

export function GroupsList() {
  const t = useTranslations('groups');
  const tStatus = useTranslations('groups.status');
  const tFilters = useTranslations('groups.filters');
  const locale = useLocale();
  const weekdayLabels = useWeekdayLabels('short');
  const searchParams = useSearchParams();
  const session = useSession();
  const isOwner = session.role === 'OWNER';
  const [createOpen, setCreateOpen] = useState(false);

  const page = parsePageParam(searchParams.get('page'));
  const search = searchParams.get('search')?.trim() || undefined;
  const state = parseStateParam(searchParams.get('state'), isOwner);
  const status = searchParams.get('status') || undefined;
  const schedule = searchParams.get('schedule') || undefined;
  const studentId = searchParams.get('studentId') || undefined;
  const sort = useListSort('name');

  const groups = useGroupsQuery({
    page,
    search,
    state,
    status,
    schedule,
    studentId,
    sort: sort.field,
    order: sort.order,
  });
  const students = useStudentsQuery({ page: 1, pageSize: 100 });

  const statusOptions = GROUP_STATUSES.map((value) => ({
    value,
    label: tStatus(value),
  }));
  const scheduleOptions = SCHEDULE_FILTERS.map((value) => ({
    value,
    label: tFilters(value),
  }));
  const studentOptions = (students.data?.items ?? []).map((student) => ({
    value: student.id,
    label: student.fullName,
  }));

  const columns = useMemo<ColumnDef<GroupListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: () => t('columns.group'),
        meta: { sortField: 'name' },
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col gap-1">
            {row.original.deletedAt ? (
              <span className="truncate font-medium">{row.original.name}</span>
            ) : (
              <Link
                href={`/app/groups/${row.original.id}`}
                className="truncate font-medium underline-offset-4 transition-colors hover:text-primary hover:underline"
              >
                {row.original.name}
              </Link>
            )}
            {row.original.notes ? (
              <span className="line-clamp-1 text-xs text-muted-foreground">
                {row.original.notes}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'schedule',
        header: () => t('columns.schedule'),
        meta: { sortField: 'schedule' },
        cell: ({ row }) => (
          <ScheduleCell schedules={row.original.schedules} weekdayLabels={weekdayLabels} />
        ),
      },
      {
        id: 'students',
        header: () => t('columns.students'),
        meta: { sortField: 'activeStudentCount' },
        cell: ({ row }) => <GroupRosterCell group={row.original} />,
      },
      {
        id: 'price',
        header: () => t('columns.price'),
        meta: { sortField: 'pricePerLesson' },
        cell: ({ row }) =>
          row.original.pricePerLesson != null && row.original.currency ? (
            <span className="tabular font-medium whitespace-nowrap">
              {formatAmountDisplay(row.original.pricePerLesson, locale)}{' '}
              <span className="text-muted-foreground">
                {CURRENCY_META[row.original.currency]?.symbol ?? row.original.currency}
              </span>
            </span>
          ) : (
            <EmptyCell />
          ),
      },
      {
        id: 'status',
        header: () => t('columns.status'),
        cell: ({ row }) => <GroupStatusBadge status={row.original.status} />,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('columns.actions')}</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <GroupRowActions
              groupId={row.original.id}
              name={row.original.name}
              isDeleted={Boolean(row.original.deletedAt)}
            />
          </div>
        ),
      },
    ],
    [locale, t, weekdayLabels],
  );

  const items = groups.data?.items ?? [];
  const showEmpty = groups.isSuccess && items.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          <Button className="h-11 md:h-9" onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon />
            {t('add')}
          </Button>
        }
      />

      <CollectionToolbar>
        <ListSearchInput label={t('searchLabel')} placeholder={t('searchPlaceholder')} />
        <ListSelectFilter
          paramKey="status"
          value={status}
          options={statusOptions}
          label={tFilters('statusAll')}
        />
        <ListSelectFilter
          paramKey="schedule"
          value={schedule}
          options={scheduleOptions}
          label={tFilters('scheduleAll')}
        />
        <ListSelectFilter
          paramKey="studentId"
          value={studentId}
          options={studentOptions}
          label={tFilters('studentAll')}
        />
        {isOwner ? <ListStateFilter value={state} /> : null}
      </CollectionToolbar>

      {groups.isPending ? <LoadingPanel size="lg" /> : null}

      {groups.isError ? (
        <QueryErrorAlert
          error={groups.error}
          title={t('error.title')}
          onRetry={() => void groups.refetch()}
        />
      ) : null}

      {showEmpty ? (
        <GroupsEmptyState search={search} state={state} onCreate={() => setCreateOpen(true)} />
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="flex flex-col gap-3 md:hidden">
            {items.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              data={items}
              caption={t('tableCaption')}
              sort={sort}
              loading={groups.isFetching}
            />
          </div>
          <ListPagination page={page} totalPages={groups.data?.totalPages ?? 1} />
        </>
      ) : null}

      <GroupFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function ScheduleCell({
  schedules,
  weekdayLabels,
}: {
  schedules: GroupListItem['schedules'];
  weekdayLabels: string[];
}) {
  const t = useTranslations('groups');
  if (schedules.length === 0) {
    return <EmptyCell />;
  }
  const visible = schedules.slice(0, 2);
  const overflow = schedules.length - visible.length;
  return (
    <div className="flex min-w-36 flex-col gap-1 text-sm">
      {visible.map((schedule) => (
        <span key={`${schedule.localTime}-${schedule.weekdays.join('-')}-${schedule.timezone}`}>
          <span className="font-medium">
            {schedule.weekdays.map((weekday) => weekdayLabels[weekday]).join(', ')}
          </span>{' '}
          <span className="tabular text-muted-foreground">{schedule.localTime}</span>
        </span>
      ))}
      {overflow > 0 ? (
        <span className="text-xs text-muted-foreground">
          {t('scheduleMore', { count: overflow })}
        </span>
      ) : null}
    </div>
  );
}

function GroupRosterCell({ group }: { group: GroupListItem }) {
  const t = useTranslations('groups');
  const students = group.students ?? [];
  const visible = students.slice(0, ROSTER_LIMIT);
  const overflow = students.length - visible.length;

  if (students.length === 0) {
    return <EmptyCell />;
  }

  return (
    <div className="flex items-center gap-3">
      <AvatarGroup aria-label={students.map((student) => student.fullName).join(', ')}>
        {visible.map((student) => (
          <EntityAvatar
            key={student.id}
            avatarKey={student.avatarKey}
            fullName={student.fullName}
            size="xs"
          />
        ))}
        {overflow > 0 ? (
          <AvatarGroupCount className="size-7 text-xs">+{overflow}</AvatarGroupCount>
        ) : null}
      </AvatarGroup>
      <span className="tabular text-sm text-muted-foreground">
        {t('studentCount', { count: group.activeStudentCount })}
      </span>
    </div>
  );
}

function GroupsEmptyState({
  search,
  state,
  onCreate,
}: {
  search?: string;
  state: 'active' | 'deleted' | 'all';
  onCreate: () => void;
}) {
  const t = useTranslations('groups');
  const scope = search ? 'emptySearch' : state === 'deleted' ? 'emptyDeleted' : 'empty';

  return (
    <CollectionEmptyState
      icon={LayersIcon}
      title={t(`${scope}.title`)}
      description={t(`${scope}.description`)}
      action={
        scope === 'empty' ? (
          <Button onClick={onCreate}>
            <PlusIcon data-icon />
            {t('empty.action')}
          </Button>
        ) : undefined
      }
    />
  );
}
