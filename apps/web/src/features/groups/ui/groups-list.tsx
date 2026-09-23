'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { GroupListItem } from '@tutorio/validation';
import { useSession } from '@/components/app/session-provider';
import { CollectionFrame } from '@/components/shared/collection-frame';
import { DataTable } from '@/components/shared/data-table';
import { ListPagination, useUpdateSearchParams } from '@/components/shared/list-controls';
import { PageHeader, QueryErrorAlert } from '@/components/shared/page-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LessonFormDialog } from '@/features/scheduling';
import { parsePageParam } from '@/lib/api/filters';
import { useGroupsQuery, useGroupsSummaryQuery } from '@/lib/api/groups';
import { useTeachersQuery } from '@/lib/api/teachers';
import { useGroupArchive } from './group-archive';
import { GroupCard } from './group-card';
import { GROUPS_ROW_LAYOUT, useGroupsListColumns } from './groups-list-columns';
import { GroupsEmptyState } from './groups-empty-state';
import {
  GROUP_SORT_FIELDS,
  GroupsListFilters,
  type GroupSortField,
  type GroupTab,
  type GroupsView,
} from './groups-list-filters';
import { GroupsListMetrics } from './groups-list-metrics';

// Three cards a row on desktop, two on a tablet: a page is always full rows.
const PAGE_SIZE = 18;

function parseTab(value: string | null, archive: boolean): GroupTab {
  if (archive) return 'archived';
  return value === 'ACTIVE' || value === 'EMPTY' ? value : 'all';
}

function parseSort(value: string | null): GroupSortField {
  return GROUP_SORT_FIELDS.find((field) => field === value) ?? 'name';
}

function parseWeekday(value: string | null): number | undefined {
  const day = Number(value);
  return value !== null && Number.isInteger(day) && day >= 0 && day <= 6 ? day : undefined;
}

/**
 * The groups collection: four metrics, the state tabs, search, the teacher
 * and weekday filters, the sort, and the groups as cards or rows (cards on
 * phones). Every control is a URL parameter answered by the API, so a filter
 * never lies on the second page. The cards/rows choice is not remembered, the
 * same as the students list.
 */
export function GroupsList() {
  const t = useTranslations('groups');
  const tCommon = useTranslations('common');
  const session = useSession();
  const searchParams = useSearchParams();
  const updateParams = useUpdateSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<GroupsView>('grid');
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);
  const isOwner = session.role === 'OWNER';
  const school = session.workspace.mode === 'SCHOOL';

  const page = parsePageParam(searchParams.get('page'));
  const search = searchParams.get('search')?.trim() || undefined;
  const archive = isOwner && searchParams.get('archive') === '1';
  const tab = parseTab(searchParams.get('status'), archive);
  const teacherId = searchParams.get('teacherId') || undefined;
  const weekday = parseWeekday(searchParams.get('weekday'));
  const unpaid = searchParams.get('payment') === 'unpaid';
  const sort = parseSort(searchParams.get('sort'));

  const groups = useGroupsQuery({
    page,
    pageSize: PAGE_SIZE,
    search,
    state: archive ? 'deleted' : 'active',
    status: tab === 'ACTIVE' || tab === 'EMPTY' ? tab : undefined,
    teacherId,
    weekday,
    payment: unpaid ? 'unpaid' : undefined,
    sort: sort === 'name' ? undefined : sort,
    order: sort === 'createdAt' || sort === 'activeStudentCount' ? 'desc' : undefined,
  });
  const summary = useGroupsSummaryQuery();
  const teachers = useTeachersQuery({ page: 1, pageSize: 100 }, school);
  const teacherOptions = (teachers.data?.items ?? []).map((teacher) => ({
    value: teacher.id,
    label: teacher.fullName,
    avatarKey: teacher.avatarKey,
  }));
  const teacherName = teacherOptions.find((option) => option.value === teacherId)?.label;

  const archiving = useGroupArchive({ returnFocus: () => searchRef.current });
  const [restoringId, setRestoringId] = useState<string>();
  const onRestore = (group: GroupListItem) => {
    setRestoringId(group.id);
    void archiving.restore(group.id).finally(() => setRestoringId(undefined));
  };
  const columns = useGroupsListColumns({
    canArchive: archiving.canArchive,
    onSchedule: (group) => setScheduleFor(group.id),
    onArchive: archiving.request,
    onRestore,
    restoringId,
  });

  const items = groups.data?.items ?? [];
  const counts = summary.data
    ? {
        all: summary.data.total,
        ACTIVE: summary.data.active,
        EMPTY: summary.data.empty,
        archived: summary.data.archived,
      }
    : {};
  const workspaceEmpty = summary.data?.total === 0 && summary.data.archived === 0;
  const filtered = Boolean(teacherId) || weekday !== undefined || unpaid;
  const showEmpty = groups.isSuccess && items.length === 0;

  // A page past the end (a stale link, a shrunken list) shows the last page.
  const totalPages = groups.data?.totalPages;
  useEffect(() => {
    if (totalPages && page > totalPages) {
      updateParams({ page: totalPages > 1 ? String(totalPages) : undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs on the page and its bound only
  }, [page, totalPages]);

  // Both commands remove the control that ran them, so focus goes to search.
  const clearSearch = () => {
    updateParams({ search: undefined }, { resetPage: true });
    searchRef.current?.focus();
  };
  const resetFilters = () => {
    updateParams(
      { teacherId: undefined, weekday: undefined, payment: undefined },
      { resetPage: true },
    );
    searchRef.current?.focus();
  };

  const description = workspaceEmpty
    ? t('subtitleEmpty')
    : archive
      ? t('subtitleArchive')
      : search && showEmpty && summary.data
        ? t('subtitleNoMatch', { total: summary.data.total })
        : summary.data
          ? t('subtitleCounts', {
              groups: summary.data.total,
              students: summary.data.studentsInGroups,
              lessons: summary.data.lessonsThisWeek,
            })
          : t('subtitle');

  const shownTotal = groups.data?.total ?? items.length;
  const footer = (
    <span className="text-[13px] text-muted-foreground">
      {t('showing', { shown: items.length, total: shownTotal })}
    </span>
  );

  return (
    <>
      <CollectionFrame
        header={
          <PageHeader
            size="xl"
            title={t('title')}
            description={description}
            action={
              <Button asChild size="xl" leading={<PlusIcon />} className="max-md:h-11">
                <Link href="/app/groups/new">
                  <span className="md:hidden">{t('addShort')}</span>
                  <span className="hidden md:inline">{t('add')}</span>
                </Link>
              </Button>
            }
          />
        }
        summary={
          workspaceEmpty ? undefined : (
            <GroupsListMetrics
              summary={summary.data}
              loading={summary.isPending}
              onShowUnpaid={() =>
                updateParams({ payment: 'unpaid', archive: undefined }, { resetPage: true })
              }
            />
          )
        }
        toolbar={
          workspaceEmpty ? undefined : (
            <GroupsListFilters
              tab={tab}
              counts={counts}
              showArchive={isOwner}
              search={search}
              searchRef={searchRef}
              teacherId={teacherId}
              teacherName={teacherName}
              teacherOptions={teacherOptions}
              teachersLoading={teachers.isPending && school}
              showTeacher={school}
              weekday={weekday}
              unpaid={unpaid}
              sort={sort}
              view={view}
              onTabChange={(next) =>
                updateParams(
                  {
                    status: next === 'ACTIVE' || next === 'EMPTY' ? next : undefined,
                    archive: next === 'archived' ? '1' : undefined,
                  },
                  { resetPage: true },
                )
              }
              onSearchChange={(next) =>
                updateParams({ search: next.trim() || undefined }, { resetPage: true })
              }
              onTeacherChange={(next) => updateParams({ teacherId: next }, { resetPage: true })}
              onWeekdayChange={(next) =>
                updateParams(
                  { weekday: next === undefined ? undefined : String(next) },
                  { resetPage: true },
                )
              }
              onUnpaidChange={(next) =>
                updateParams({ payment: next ? 'unpaid' : undefined }, { resetPage: true })
              }
              onSortChange={(next) =>
                updateParams({ sort: next === 'name' ? undefined : next }, { resetPage: true })
              }
              onViewChange={setView}
              onReset={resetFilters}
            />
          )
        }
        loading={
          groups.isPending ? (
            <div
              role="status"
              aria-label={tCommon('loading')}
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
              {Array.from({ length: 6 }, (_, index) => (
                <Card key={index} className="gap-4 p-7">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-9 w-40" />
                  <Skeleton className="h-9 w-56" />
                </Card>
              ))}
            </div>
          ) : undefined
        }
        error={
          groups.isError ? (
            <QueryErrorAlert
              error={groups.error}
              title={t('error.title')}
              onRetry={() => void groups.refetch()}
            />
          ) : undefined
        }
        empty={
          showEmpty ? (
            <GroupsEmptyState
              search={search}
              filtered={filtered || tab === 'ACTIVE' || tab === 'EMPTY'}
              archive={archive}
              onClearSearch={clearSearch}
              onResetFilters={() => {
                resetFilters();
                updateParams({ status: undefined }, { resetPage: true });
              }}
            />
          ) : undefined
        }
        mobile={
          items.length > 0
            ? items.map((group) => <GroupCard key={group.id} group={group} variant="phone" />)
            : undefined
        }
        desktop={
          items.length > 0 ? (
            <div className="flex flex-col gap-4">
              {view === 'grid' ? (
                <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((group) => (
                    <li key={group.id} className="flex *:grow">
                      <GroupCard group={group} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-card bg-card p-2">
                  <DataTable
                    variant="rows"
                    rowHeight="auto"
                    layout={GROUPS_ROW_LAYOUT}
                    columns={columns}
                    data={items}
                    caption={t('tableCaption')}
                    loading={groups.isFetching}
                    isRowDimmed={(group) => Boolean(group.deletedAt)}
                  />
                </div>
              )}
              <div className="flex items-center justify-between px-1.5">
                {footer}
                <ListPagination page={page} totalPages={groups.data?.totalPages ?? 1} />
              </div>
            </div>
          ) : undefined
        }
        pagination={
          items.length > 0 ? (
            <div className="flex flex-col items-center gap-3 md:hidden">
              <ListPagination page={page} totalPages={groups.data?.totalPages ?? 1} />
              {footer}
            </div>
          ) : undefined
        }
      />
      {archiving.dialog}
      <LessonFormDialog
        open={scheduleFor !== null}
        onOpenChange={(open) => (open ? undefined : setScheduleFor(null))}
        lockedGroupId={scheduleFor ?? undefined}
      />
    </>
  );
}
