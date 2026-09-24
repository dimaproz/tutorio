'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PlusIcon } from 'lucide-react';
import { useNow, useTranslations } from 'next-intl';
// Imported directly: the scheduling barrel also pulls in the calendar.
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
import { useGroupOptionsQuery } from '@/lib/api/groups';
import { useStudentsQuery, useStudentsSummaryQuery } from '@/lib/api/students';
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
  const searchParams = useSearchParams();
  const updateParams = useUpdateSearchParams();
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
  // The filter needs names only, not the full rows of the groups list.
  const groups = useGroupOptionsQuery();

  // Facet counts come from the server's per-status summary: a collection page
  // can never derive a total from the rows it happens to be showing.
  const summary = useStudentsSummaryQuery();
  const counts = summary.data;
  const countMetric = (total: number | undefined) => ({
    data: total === undefined ? undefined : { total },
    isPending: summary.isPending,
    isError: summary.isError,
  });
  const totalMetric = countMetric(counts?.all);
  const activeMetric = countMetric(counts?.ACTIVE);

  const { rollups, packagesState, packageMetrics, lessonsThisWeek, studentsThisWeek } =
    useStudentsCollectionInsights(now);

  const columns = useStudentsListColumns({ rollups, packagesState, now });

  const items = students.data?.items ?? [];
  const showEmpty = students.isSuccess && items.length === 0;
  const filtersActive = Boolean(search || status || groupId);
  const total = counts?.all;
  const workspaceEmpty = total === 0 && counts?.ARCHIVED === 0;
  const searchRef = useRef<HTMLInputElement>(null);
  // Both commands remove the control that ran them, so focus goes to search.
  const clearFilters = () => {
    updateParams({ search: undefined, status: undefined, groupId: undefined }, { resetPage: true });
    searchRef.current?.focus();
  };
  const resetFilters = () => {
    updateParams({ status: undefined, groupId: undefined }, { resetPage: true });
    searchRef.current?.focus();
  };

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
                    {t('subtitleShort', { total, active: counts?.ACTIVE ?? 0 })}
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
          />
        }
        toolbar={
          workspaceEmpty ? undefined : (
            <StudentsListFilters
              status={(status ?? 'all') as StudentStatusTab}
              counts={{
                all: counts?.all,
                ACTIVE: counts?.ACTIVE,
                ON_HOLD: counts?.ON_HOLD,
                ARCHIVED: counts?.ARCHIVED,
              }}
              groupId={groupId}
              groupOptions={(groups.data?.items ?? []).map((group) => ({
                value: group.id,
                label: group.name,
              }))}
              search={search}
              searchRef={searchRef}
              sort={sort}
              sortFields={SORT_FIELDS}
              onStatusChange={(next) =>
                updateParams({ status: next === 'all' ? undefined : next }, { resetPage: true })
              }
              onGroupChange={(next) => updateParams({ groupId: next }, { resetPage: true })}
              onSearchChange={(next) =>
                updateParams({ search: next.trim() || undefined }, { resetPage: true })
              }
              onReset={resetFilters}
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
    </>
  );
}
