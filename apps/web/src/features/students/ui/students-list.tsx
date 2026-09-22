'use client';

import { useMemo, useState } from 'react';
import { endOfWeek, startOfWeek } from 'date-fns';
import { useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarPlusIcon, PlusIcon, UsersIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { StudentListItem } from '@tutorio/validation';
import { StudentCard } from './student-card';
import { StudentQuickCreateDialog } from './student-quick-create-dialog';
import { StudentRowActions } from './student-row-actions';
import { StudentsListSkeleton } from './students-list-skeleton';
import { StudentsListFilters, type StudentStatusTab } from './students-list-filters';
import { StudentsListMetrics } from './students-list-metrics';
import {
  StudentBalanceCell,
  StudentCreditsCell,
  StudentIdentityCell,
  StudentLearningCell,
  StudentNextLessonCell,
} from './student-row-cells';
import { CollectionFrame } from '@/components/shared/collection-frame';
import { DataTable } from '@/components/shared/data-table';
import {
  ListPagination,
  useListSort,
  useUpdateSearchParams,
} from '@/components/shared/list-controls';
import { QueryErrorAlert } from '@/components/shared/page-shell';
import { Button } from '@/components/ui/button';
import { CollectionEmptyState } from '@/components/shared/collection-empty-state';
import { parsePageParam } from '@/lib/api/filters';
import { useStudentsQuery } from '@/lib/api/students';
import { useGroupsQuery } from '@/lib/api/groups';
import { usePackagesQuery } from '@/lib/api/packages';
import { useLessonsQuery } from '@/lib/api/scheduling';
import { deriveCollectionMetrics } from '@/features/students/model/collection-metrics';

const SORT_FIELDS = ['fullName', 'status', 'createdAt'] as const;

/** Reference layout: student, learning, credits, next lesson, balance, actions. */
const ROW_LAYOUT =
  'minmax(0,2.3fr) minmax(0,1.5fr) minmax(0,1.25fr) minmax(0,1.25fr) minmax(0,1fr) 40px';

export function StudentsList() {
  const t = useTranslations('students');
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

  // The lesson window is a flat, complete list, so the weekly count is exact.
  const week = useMemo(() => {
    const now = new Date();
    return {
      from: startOfWeek(now, { weekStartsOn: 1 }).toISOString(),
      to: endOfWeek(now, { weekStartsOn: 1 }).toISOString(),
    };
  }, []);
  const weekLessons = useLessonsQuery(week);

  // Package metrics are derived client-side, so the page has to cover every
  // package for the aggregate to be true; the model rejects a partial page.
  const packages = usePackagesQuery({ page: 1, pageSize: 200, state: 'active' });
  const packageMetrics = packages.isPending
    ? undefined
    : packages.isError || !packages.data
      ? null
      : deriveCollectionMetrics(packages.data.items, packages.data.total);

  // Facet counts are their own one-row queries: a collection page can never
  // derive a total from the rows it happens to be showing.
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

  const columns = useMemo<ColumnDef<StudentListItem, unknown>[]>(
    () => [
      {
        accessorKey: 'fullName',
        header: () => t('columns.student'),
        meta: { sortField: 'fullName' },
        cell: ({ row }) => <StudentIdentityCell student={row.original} />,
      },
      {
        id: 'learning',
        header: () => t('columns.learning'),
        cell: ({ row }) => <StudentLearningCell student={row.original} />,
      },
      {
        id: 'credits',
        header: () => t('columns.credits'),
        cell: () => <StudentCreditsCell />,
      },
      {
        id: 'nextLesson',
        header: () => t('columns.nextLesson'),
        cell: () => <StudentNextLessonCell />,
      },
      {
        id: 'balance',
        header: () => t('columns.balance'),
        cell: () => <StudentBalanceCell />,
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('columns.actions')}</span>,
        cell: ({ row }) => (
          <div className="relative z-1 flex justify-end">
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
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="font-display text-[40px] leading-none font-semibold tracking-[-0.03em] md:text-[64px] md:tracking-[-0.04em]">
                {t('title')}
              </h1>
              <p className="text-base text-muted-foreground">{t('subtitle')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button size="xl" variant="outline">
                <CalendarPlusIcon data-icon="inline-start" />
                {t('scheduleLesson')}
              </Button>
              <Button size="xl" leading={<PlusIcon />} onClick={() => setCreateOpen(true)}>
                {t('add')}
              </Button>
            </div>
          </div>
        }
        summary={
          <StudentsListMetrics
            activeQuery={activeMetric}
            totalQuery={totalMetric}
            lessonsThisWeek={
              weekLessons.isPending
                ? undefined
                : weekLessons.isError || !weekLessons.data
                  ? null
                  : weekLessons.data.items.length
            }
            metrics={packageMetrics}
          />
        }
        toolbar={
          <StudentsListFilters
            status={(status ?? 'all') as StudentStatusTab}
            counts={{
              all: totalMetric.data?.total,
              ACTIVE: activeMetric.data?.total,
              ON_HOLD: onHoldMetric.data?.total,
              ARCHIVED: archivedMetric.data?.total,
            }}
            groupId={groupId}
            groupOptions={(groups.data?.items ?? []).map((group) => ({
              value: group.id,
              label: group.name,
            }))}
            search={search}
            sort={sort}
            sortFields={SORT_FIELDS}
            onStatusChange={(next) =>
              updateParams({ status: next === 'all' ? undefined : next }, { resetPage: true })
            }
            onGroupChange={(next) => updateParams({ groupId: next }, { resetPage: true })}
            onSearchChange={(next) =>
              updateParams({ search: next.trim() || undefined }, { resetPage: true })
            }
          />
        }
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
            <div className="flex flex-col rounded-card bg-card p-2">
              <DataTable
                variant="rows"
                layout={ROW_LAYOUT}
                columns={columns}
                data={items}
                caption={t('tableCaption')}
                sort={sort}
                loading={students.isFetching}
              />
              <div className="mt-2 flex items-center justify-between border-t border-border px-4 pt-3 pb-2">
                <span className="text-[13px] text-muted-foreground">
                  {t('showing', {
                    shown: items.length,
                    total: students.data?.total ?? items.length,
                  })}
                </span>
                <ListPagination page={page} totalPages={students.data?.totalPages ?? 1} />
              </div>
            </div>
          ) : undefined
        }
      />
      {createOpen ? <StudentQuickCreateDialog open onOpenChange={setCreateOpen} /> : null}
    </>
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
          <Button onClick={onCreate} leading={<PlusIcon />}>
            {t('empty.action')}
          </Button>
        )
      }
    />
  );
}
