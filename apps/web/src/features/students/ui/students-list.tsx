'use client';

import { useMemo, useState } from 'react';
import { endOfWeek, startOfWeek } from 'date-fns';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarIcon, PlusIcon } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import type { StudentListItem } from '@tutorio/validation';
import { LessonFormDialog } from '@/components/scheduling/lesson-form-dialog';
import { CollectionFrame } from '@/components/shared/collection-frame';
import { DataTable } from '@/components/shared/data-table';
import {
  ListPagination,
  useListSort,
  useUpdateSearchParams,
} from '@/components/shared/list-controls';
import { PageHeader, QueryErrorAlert } from '@/components/shared/page-shell';
import { Button } from '@/components/ui/button';
import { deriveCollectionMetrics } from '@/features/students/model/collection-metrics';
import { deriveStudentRollups } from '@/features/students/model/rollups';
import { parsePageParam } from '@/lib/api/filters';
import { useGroupsQuery } from '@/lib/api/groups';
import { usePackagesQuery } from '@/lib/api/packages';
import { useLessonsQuery } from '@/lib/api/scheduling';
import { useStudentsQuery } from '@/lib/api/students';
import { StudentCard } from './student-card';
import { StudentRowActions } from './student-row-actions';
import {
  StudentBalanceCell,
  StudentCreditsCell,
  StudentIdentityCell,
  StudentLearningCell,
  StudentNextLessonCell,
} from './student-row-cells';
import { StudentsEmptyState } from './students-empty-state';
import { StudentsListFilters, type StudentStatusTab } from './students-list-filters';
import { StudentsListMetrics } from './students-list-metrics';
import { StudentsListSkeleton } from './students-list-skeleton';

export { StudentsEmptyState } from './students-empty-state';

const SORT_FIELDS = ['fullName', 'status', 'createdAt'] as const;
const DAY_MS = 24 * 60 * 60 * 1000;
/** How far ahead the collection looks for each student's next lesson. */
const UPCOMING_DAYS = 60;

/** Reference layout: student, learning, credits, next lesson, balance, actions. */
const ROW_LAYOUT =
  'minmax(0,2.3fr) minmax(0,1.5fr) minmax(0,1.25fr) minmax(0,1.25fr) minmax(0,1fr) 40px';

export function StudentsList({ nowMs }: { nowMs?: number } = {}) {
  const t = useTranslations('students');
  const tCommon = useTranslations('common');
  const format = useFormatter();
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

  // The lesson window is a flat, complete list, so the weekly count is exact.
  const week = useMemo(
    () => ({
      from: startOfWeek(now, { weekStartsOn: 1 }),
      to: endOfWeek(now, { weekStartsOn: 1 }),
    }),
    [now],
  );
  const weekLessons = useLessonsQuery({
    from: week.from.toISOString(),
    to: week.to.toISOString(),
  });
  const upcomingLessons = useLessonsQuery({
    from: new Date(now).toISOString(),
    to: new Date(now + UPCOMING_DAYS * DAY_MS).toISOString(),
    status: 'SCHEDULED',
  });

  // Package metrics are derived client-side, so the page has to cover every
  // package for the aggregate to be true; the model rejects a partial page.
  const packages = usePackagesQuery({ page: 1, pageSize: 200, state: 'active' });
  const packageMetrics = packages.isPending
    ? undefined
    : packages.isError || !packages.data
      ? null
      : deriveCollectionMetrics(packages.data.items, packages.data.total);
  const rollups = useMemo(
    () =>
      deriveStudentRollups({
        packages: packages.data?.items ?? [],
        packagesComplete: Boolean(
          packages.data && packages.data.items.length >= packages.data.total,
        ),
        lessons: upcomingLessons.data?.items ?? [],
        now,
      }),
    [packages.data, upcomingLessons.data, now],
  );

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

  const weekItems = weekLessons.data?.items;
  const lessonsThisWeek = weekLessons.isPending
    ? undefined
    : !weekItems
      ? null
      : {
          total: weekItems.length,
          individual: weekItems.filter((lesson) => lesson.groupId === null).length,
          group: weekItems.filter((lesson) => lesson.groupId !== null).length,
          range: format.dateTimeRange(week.from, week.to, { day: 'numeric', month: 'short' }),
        };
  const studentsThisWeek = weekItems
    ? new Set(weekItems.flatMap((lesson) => (lesson.student ? [lesson.student.id] : []))).size
    : undefined;

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
        cell: ({ row }) => (
          <StudentLearningCell
            student={row.original}
            teacher={rollups.get(row.original.id)?.teacherName}
          />
        ),
      },
      {
        id: 'credits',
        header: () => t('columns.credits'),
        cell: ({ row }) => <StudentCreditsCell credits={rollups.get(row.original.id)?.credits} />,
      },
      {
        id: 'nextLesson',
        header: () => t('columns.nextLesson'),
        cell: ({ row }) => (
          <StudentNextLessonCell
            status={row.original.status}
            next={rollups.get(row.original.id)?.next}
            now={now}
          />
        ),
      },
      {
        id: 'balance',
        header: () => t('columns.balance'),
        cell: ({ row }) => (
          <StudentBalanceCell
            balance={rollups.get(row.original.id)?.balance}
            status={row.original.status}
          />
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('columns.actions')}</span>,
        cell: ({ row }) => (
          <div className="relative z-1 flex justify-end">
            <StudentRowActions
              studentId={row.original.id}
              fullName={row.original.fullName}
              status={row.original.status}
            />
          </div>
        ),
      },
    ],
    [t, rollups, now],
  );

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
                layout={ROW_LAYOUT}
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
      />
      <LessonFormDialog open={lessonOpen} onOpenChange={setLessonOpen} />
    </>
  );
}
