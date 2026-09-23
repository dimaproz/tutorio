'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarIcon, PlusIcon } from 'lucide-react';
import { useNow, useTranslations } from 'next-intl';
import { LessonFormDialog } from '@/features/scheduling';
import { CollectionFrame } from '@/components/shared/collection-frame';
import { DataTable } from '@/components/shared/data-table';
import {
  ListPagination,
  useListSort,
  useUpdateSearchParams,
} from '@/components/shared/list-controls';
import { PageHeader, QueryErrorAlert } from '@/components/shared/page-shell';
import { Button } from '@/components/ui/button';
import { parsePageParam } from '@/lib/api/filters';
import { useGroupsQuery } from '@/lib/api/groups';
import { useStudentsQuery } from '@/lib/api/students';
import { StudentCard } from './student-card';
import { STUDENTS_ROW_LAYOUT, useStudentsListColumns } from './students-list-columns';
import { useStudentsCollectionInsights } from './students-list-insights';
import { StudentsEmptyState } from './students-empty-state';
import { StudentsListFilters, type StudentStatusTab } from './students-list-filters';
import { StudentsListMetrics } from './students-list-metrics';
import { StudentsListSkeleton } from './students-list-skeleton';

export { StudentsEmptyState } from './students-empty-state';

const SORT_FIELDS = ['fullName', 'status', 'createdAt'] as const;

export function StudentsList({ nowMs }: { nowMs?: number } = {}) {
  const t = useTranslations('students');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const searchParams = useSearchParams();
  const updateParams = useUpdateSearchParams();
  const [lessonOpen, setLessonOpen] = useState(false);
  // The page reads one pinned clock, so every window it queries lines up.
  const clock = useNow();
  const [now] = useState(() => nowMs ?? clock.getTime());

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

  const { rollups, packagesState, packageMetrics, lessonsThisWeek, studentsThisWeek } =
    useStudentsCollectionInsights(now);

  const columns = useStudentsListColumns({ rollups, packagesState, now });

  const items = students.data?.items ?? [];
  const showEmpty = students.isSuccess && items.length === 0;
  const filtersActive = Boolean(search || status || groupId);
  const total = totalMetric.data?.total;
  const workspaceEmpty = total === 0 && archivedMetric.data?.total === 0;
  const clearFilters = () =>
    updateParams({ search: undefined, status: undefined, groupId: undefined }, { resetPage: true });

  return (
    <>
      <CollectionFrame
        header={
          <PageHeader
            size="xl"
            title={t('title')}
            description={
              total && studentsThisWeek !== undefined ? (
                <>
                  <span className="md:hidden">
                    {t('subtitleShort', { total, active: activeMetric.data?.total ?? 0 })}
                  </span>
                  <span className="hidden md:inline">
                    {t('subtitleCounts', { total, week: studentsThisWeek })}
                  </span>
                </>
              ) : (
                t('subtitle')
              )
            }
            action={
              <>
                {workspaceEmpty ? null : (
                  <Button
                    size="xl"
                    variant="outline"
                    className="hidden md:inline-flex"
                    onClick={() => setLessonOpen(true)}
                  >
                    <CalendarIcon data-icon="inline-start" />
                    {t('scheduleLesson')}
                  </Button>
                )}
                <Button asChild size="xl" leading={<PlusIcon />} className="max-md:h-11">
                  <Link href="/app/students/new">
                    <span className="md:hidden">{t('newShort')}</span>
                    <span className="hidden md:inline">{workspaceEmpty ? t('add') : t('new')}</span>
                  </Link>
                </Button>
              </>
            }
          />
        }
        summary={
          <StudentsListMetrics
            activeQuery={activeMetric}
            totalQuery={totalMetric}
            lessonsThisWeek={lessonsThisWeek}
            metrics={packageMetrics}
            onTopUp={() => router.push('/app/packages')}
          />
        }
        toolbar={
          workspaceEmpty ? undefined : (
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
          )
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
            <StudentsEmptyState filtered={filtersActive} onClearFilters={clearFilters} />
          ) : undefined
        }
        mobile={
          items.length > 0
            ? items.map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  rollup={rollups.get(student.id)}
                  packages={packagesState}
                  now={now}
                />
              ))
            : undefined
        }
        desktop={
          items.length > 0 ? (
            <div className="flex flex-col rounded-card bg-card p-2">
              <DataTable
                variant="rows"
                layout={STUDENTS_ROW_LAYOUT}
                columns={columns}
                data={items}
                caption={t('tableCaption')}
                sort={sort}
                loading={students.isFetching}
                isRowDimmed={(student) => student.status === 'ARCHIVED'}
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
        // Desktop pages from the table card's footer; phones need the same
        // control under the cards, or later pages are reachable only by search.
        pagination={
          items.length > 0 ? (
            <div className="flex flex-col items-center gap-3 md:hidden">
              <ListPagination page={page} totalPages={students.data?.totalPages ?? 1} />
              <span className="text-[13px] text-muted-foreground">
                {t('showing', {
                  shown: items.length,
                  total: students.data?.total ?? items.length,
                })}
              </span>
            </div>
          ) : undefined
        }
      />
      <LessonFormDialog open={lessonOpen} onOpenChange={setLessonOpen} />
    </>
  );
}
