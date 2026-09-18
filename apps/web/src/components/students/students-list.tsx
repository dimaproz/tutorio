'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { PlusIcon, UsersIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { StudentListItem } from '@tutorio/validation';
import { StudentAddedDate, StudentCard, StudentLearningFormat } from './student-card';
import { StudentFormDialog } from './student-form-dialog';
import { StudentRowActions } from './student-row-actions';
import { StudentsListSkeleton } from './students-list-skeleton';
import { StudentStatusBadge } from '@/components/students/student-status';
import { STUDENT_STATUS_META } from '@/components/students/student-status';
import { CollectionFrame } from '@/components/shared/collection-frame';
import { DataTable } from '@/components/shared/data-table';
import { MetricCard } from '@/components/shared/metric-card';
import { PersonCell } from '@/components/shared/table-cells';
import {
  ListPagination,
  ListSearchInput,
  ListSelectFilter,
  useListSort,
  useUpdateSearchParams,
} from '@/components/shared/list-controls';
import { PageHeader, QueryErrorAlert, QueryRefreshIndicator } from '@/components/shared/page-shell';
import { Button } from '@/components/ui/button';
import { CollectionEmptyState } from '@/components/shared/collection-empty-state';
import { CollectionToolbar } from '@/components/shared/collection-toolbar';
import { Skeleton } from '@/components/ui/skeleton';
import { parsePageParam } from '@/lib/api/filters';
import { useStudentsQuery } from '@/lib/api/students';
import { useGroupsQuery } from '@/lib/api/groups';

const STUDENT_STATUSES = ['ACTIVE', 'ON_HOLD', 'ARCHIVED'] as const;

export function StudentsList() {
  const t = useTranslations('students');
  const tStatus = useTranslations('studentStatus');
  const tFilters = useTranslations('students.filters');
  const tListFilters = useTranslations('filters');
  const tCommon = useTranslations('common');
  const searchParams = useSearchParams();
  const updateParams = useUpdateSearchParams();
  const [createOpen, setCreateOpen] = useState(false);

  const page = parsePageParam(searchParams.get('page'));
  const search = searchParams.get('search')?.trim() || undefined;
  const status = searchParams.get('status') || undefined;
  const groupId = searchParams.get('groupId') || undefined;
  const state = status === 'ARCHIVED' ? 'deleted' : 'active';

  // `fullName` matches the API default, so an unsorted URL stays clean.
  const sort = useListSort('fullName');
  const students = useStudentsQuery({
    page,
    search,
    status,
    groupId,
    state,
    sort: sort.field,
    order: sort.order,
  });
  const groups = useGroupsQuery({ page: 1, pageSize: 100 });
  const totalMetric = useStudentsQuery({ page: 1, pageSize: 1, state: 'active' });
  const activeMetric = useStudentsQuery({
    page: 1,
    pageSize: 1,
    state: 'active',
    status: 'ACTIVE',
  });
  const onHoldMetric = useStudentsQuery({
    page: 1,
    pageSize: 1,
    state: 'active',
    status: 'ON_HOLD',
  });
  const archivedMetric = useStudentsQuery({
    page: 1,
    pageSize: 1,
    state: 'deleted',
    status: 'ARCHIVED',
  });

  const statusOptions = STUDENT_STATUSES.map((value) => ({
    value,
    label: tStatus(value),
    ...STUDENT_STATUS_META[value],
  }));
  const groupOptions = (groups.data?.items ?? []).map((group) => ({
    value: group.id,
    label: group.name,
  }));

  const columns = useMemo<ColumnDef<StudentListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: () => t('columns.student'),
        meta: { sortField: 'fullName' },
        cell: ({ row }) => (
          <PersonCell
            avatarKey={row.original.avatarKey}
            fullName={row.original.fullName}
            href={`/app/students/${row.original.id}`}
          />
        ),
      },
      {
        id: 'status',
        header: () => t('columns.status'),
        meta: { sortField: 'status' },
        cell: ({ row }) => <StudentStatusBadge status={row.original.status} />,
      },
      {
        id: 'learningFormat',
        header: () => t('columns.learningFormat'),
        cell: ({ row }) => <StudentLearningFormat student={row.original} />,
      },
      {
        accessorKey: 'createdAt',
        header: () => t('columns.added'),
        meta: { sortField: 'createdAt' },
        cell: ({ row }) => <StudentAddedDate createdAt={row.original.createdAt} />,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('columns.actions')}</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <StudentRowActions
              studentId={row.original.id}
              fullName={row.original.fullName}
              avatarKey={row.original.avatarKey}
              status={row.original.status}
            />
          </div>
        ),
      },
    ],
    [t],
  );

  const items = students.data?.items ?? [];
  const showEmpty = students.isSuccess && items.length === 0;
  const filtersActive = Boolean(search || status || groupId);
  const clearFilters = () =>
    updateParams({ search: undefined, status: undefined, groupId: undefined }, { resetPage: true });

  return (
    <>
      <CollectionFrame
        header={
          <PageHeader
            title={t('title')}
            description={t('subtitle')}
            action={
              <Button className="h-11 md:h-9" onClick={() => setCreateOpen(true)}>
                <PlusIcon data-icon="inline-start" />
                {t('add')}
              </Button>
            }
          />
        }
        summary={
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StudentMetricCard label={t('metrics.total')} query={totalMetric} />
            <StudentMetricCard label={t('metrics.active')} query={activeMetric} />
            <StudentMetricCard label={t('metrics.onHold')} query={onHoldMetric} />
            <StudentMetricCard label={t('metrics.archived')} query={archivedMetric} />
          </div>
        }
        toolbar={
          <CollectionToolbar>
            <ListSearchInput label={t('searchLabel')} placeholder={t('searchPlaceholder')} />
            <ListSelectFilter
              paramKey="status"
              value={status}
              options={statusOptions}
              label={tFilters('statusAll')}
            />
            <ListSelectFilter
              paramKey="groupId"
              value={groupId}
              options={groupOptions}
              label={tFilters('groupAll')}
            />
            {filtersActive ? (
              <Button type="button" variant="ghost" onClick={clearFilters}>
                {tListFilters('clear')}
              </Button>
            ) : null}
          </CollectionToolbar>
        }
        refresh={<QueryRefreshIndicator isFetching={students.isFetching && !students.isPending} />}
        loading={
          students.isPending ? (
            <StudentsListSkeleton caption={t('tableCaption')} loadingLabel={tCommon('loading')} />
          ) : undefined
        }
        error={
          students.isError ? (
            <QueryErrorAlert
              error={students.error}
              title={t('error.title')}
              onRetry={() => void students.refetch()}
            />
          ) : undefined
        }
        empty={
          showEmpty ? (
            <StudentsEmptyState
              filtered={filtersActive}
              onClearFilters={clearFilters}
              onCreate={() => setCreateOpen(true)}
            />
          ) : undefined
        }
        mobile={
          items.length > 0
            ? items.map((student) => <StudentCard key={student.id} student={student} />)
            : undefined
        }
        desktop={
          items.length > 0 ? (
            <DataTable
              columns={columns}
              data={items}
              caption={t('tableCaption')}
              sort={sort}
              loading={students.isFetching}
            />
          ) : undefined
        }
        pagination={
          items.length > 0 ? (
            <ListPagination page={page} totalPages={students.data?.totalPages ?? 1} />
          ) : undefined
        }
      />
      <StudentFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

export function StudentMetricCard({
  label,
  query,
}: {
  label: string;
  query: { data?: { total: number }; isPending: boolean; isError: boolean };
}) {
  const t = useTranslations('students.metrics');
  const value = query.isPending ? (
    <Skeleton className="h-8 w-12" />
  ) : query.isError ? (
    t('unavailable')
  ) : (
    (query.data?.total ?? 0)
  );

  return (
    <MetricCard label={label} value={value} description={query.isError ? t('error') : undefined} />
  );
}

export function StudentsEmptyState({
  filtered,
  onClearFilters,
  onCreate,
}: {
  filtered: boolean;
  onClearFilters: () => void;
  onCreate: () => void;
}) {
  const t = useTranslations('students');
  const tFilters = useTranslations('filters');
  const scope = filtered ? 'emptyFiltered' : 'empty';

  return (
    <CollectionEmptyState
      icon={UsersIcon}
      title={t(`${scope}.title`)}
      description={t(`${scope}.description`)}
      action={
        filtered ? (
          <Button type="button" variant="outline" onClick={onClearFilters}>
            {tFilters('clear')}
          </Button>
        ) : (
          <Button onClick={onCreate}>
            <PlusIcon data-icon="inline-start" />
            {t('empty.action')}
          </Button>
        )
      }
    />
  );
}
