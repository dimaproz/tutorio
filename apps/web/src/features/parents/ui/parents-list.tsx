'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CollectionFrame } from '@/components/shared/collection-frame';
import { DataTable } from '@/components/shared/data-table';
import { ListPagination, useUpdateSearchParams } from '@/components/shared/list-controls';
import { PageHeader, QueryErrorAlert } from '@/components/shared/page-shell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { parsePageParam } from '@/lib/api/filters';
import { useParentsQuery } from '@/lib/api/parents';
import { useStudentQuery, useStudentsQuery } from '@/lib/api/students';
import { ParentCard } from './parent-card';
import { useParentDelete } from './parent-delete';
import { PARENTS_ROW_LAYOUT, useParentsListColumns } from './parents-list-columns';
import { ParentsEmptyState } from './parents-empty-state';
import { ParentsListFilters, type ParentSortField } from './parents-list-filters';

const PAGE_SIZE = 20;

/**
 * The parents collection: search, the student and "no students" filters, the
 * name sort, a table of parent rows (cards on phones) and pagination. Every
 * control is a URL parameter answered by the API, so a filter never lies on
 * the second page.
 */
export function ParentsList() {
  const t = useTranslations('parents');
  const tCommon = useTranslations('common');
  const searchParams = useSearchParams();
  const updateParams = useUpdateSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);

  const page = parsePageParam(searchParams.get('page'));
  const search = searchParams.get('search')?.trim() || undefined;
  const studentId = searchParams.get('studentId') || undefined;
  const unlinked = searchParams.get('linked') === 'none';
  const sort: ParentSortField = searchParams.get('sort') === 'createdAt' ? 'createdAt' : 'fullName';

  const parents = useParentsQuery({
    page,
    pageSize: PAGE_SIZE,
    search,
    studentId,
    linked: unlinked ? 'none' : undefined,
    sort: sort === 'createdAt' ? 'createdAt' : undefined,
    order: sort === 'createdAt' ? 'desc' : undefined,
  });
  // The headline counts are their own one-row queries: a page of rows can
  // never tell how many records the workspace holds.
  const totalQuery = useParentsQuery({ page: 1, pageSize: 1 });
  const unlinkedQuery = useParentsQuery({ page: 1, pageSize: 1, linked: 'none' });
  const students = useStudentsQuery({ page: 1, pageSize: 100 });
  const studentOptions = (students.data?.items ?? []).map((student) => ({
    value: student.id,
    label: student.fullName,
    avatarKey: student.avatarKey,
  }));
  const listedStudent = studentOptions.find((option) => option.value === studentId);
  const filteredStudent = useStudentQuery(studentId ?? '', Boolean(studentId) && !listedStudent);
  const studentName = listedStudent?.label ?? filteredStudent.data?.fullName;

  const removal = useParentDelete({
    // Deleting the last row of a later page steps back to a page that exists.
    onDeleted: () => {
      if (page > 1 && (parents.data?.items.length ?? 0) <= 1) {
        updateParams({ page: page - 1 > 1 ? String(page - 1) : undefined });
      }
    },
  });
  const columns = useParentsListColumns({
    canDelete: removal.canDelete,
    onDelete: removal.request,
  });

  const items = parents.data?.items ?? [];
  const total = totalQuery.data?.total;
  const workspaceEmpty = total === 0;
  const filtersActive = Boolean(studentId || unlinked);
  const showEmpty = parents.isSuccess && items.length === 0;

  // A page past the end (a stale link, a shrunken list) shows the last page.
  const totalPages = parents.data?.totalPages;
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
    updateParams({ studentId: undefined, linked: undefined }, { resetPage: true });
    searchRef.current?.focus();
  };

  const description = workspaceEmpty
    ? t('subtitleEmpty')
    : studentId && studentName
      ? t('subtitleFiltered', { name: studentName })
      : unlinked
        ? t('subtitleUnlinked')
        : total === undefined
          ? t('subtitle')
          : search && showEmpty
            ? t('subtitleNoMatch', { total })
            : unlinkedQuery.data
              ? t('subtitleCounts', { total, linked: total - unlinkedQuery.data.total })
              : t('subtitle');

  const shownTotal = parents.data?.total ?? items.length;
  // The rows shown may still be the previous page's while the next one loads.
  const from = ((parents.data?.page ?? page) - 1) * PAGE_SIZE + 1;
  const footer =
    shownTotal > items.length
      ? t('showing', { from, to: from + items.length - 1, total: shownTotal })
      : t('records', { count: shownTotal });

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
                <Link href="/app/parents/new">
                  <span className="md:hidden">{t('addShort')}</span>
                  <span className="hidden md:inline">{t('add')}</span>
                </Link>
              </Button>
            }
          />
        }
        toolbar={
          workspaceEmpty ? undefined : (
            <ParentsListFilters
              search={search}
              searchRef={searchRef}
              studentId={studentId}
              studentName={studentName}
              studentOptions={studentOptions}
              studentsLoading={students.isPending}
              unlinked={unlinked}
              sort={sort}
              onSearchChange={(next) =>
                updateParams({ search: next.trim() || undefined }, { resetPage: true })
              }
              onStudentChange={(next) =>
                updateParams({ studentId: next, linked: undefined }, { resetPage: true })
              }
              onUnlinkedChange={(next) =>
                updateParams(
                  { linked: next ? 'none' : undefined, studentId: undefined },
                  { resetPage: true },
                )
              }
              onSortChange={(next) =>
                updateParams({ sort: next === 'fullName' ? undefined : next }, { resetPage: true })
              }
              onReset={resetFilters}
            />
          )
        }
        loading={
          parents.isPending ? (
            <div
              role="status"
              aria-label={tCommon('loading')}
              className="flex flex-col gap-2 rounded-card bg-card p-4"
            >
              {Array.from({ length: 5 }, (_, index) => (
                <div key={index} className="flex items-center gap-3.5 px-2 py-3">
                  <Skeleton className="size-11 rounded-pill" />
                  <div className="flex grow flex-col gap-1.5">
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="hidden h-4 w-32 md:block" />
                  <Skeleton className="hidden h-4 w-48 md:block" />
                </div>
              ))}
            </div>
          ) : undefined
        }
        error={
          parents.isError ? (
            <QueryErrorAlert
              error={parents.error}
              title={t('error.title')}
              onRetry={() => void parents.refetch()}
            />
          ) : undefined
        }
        empty={
          showEmpty ? (
            <ParentsEmptyState
              search={search}
              filtered={filtersActive}
              onClearSearch={clearSearch}
              onResetFilters={resetFilters}
            />
          ) : undefined
        }
        mobile={
          items.length > 0
            ? items.map((parent) => <ParentCard key={parent.id} parent={parent} />)
            : undefined
        }
        desktop={
          items.length > 0 ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-card bg-card p-2">
                <DataTable
                  variant="rows"
                  layout={PARENTS_ROW_LAYOUT}
                  columns={columns}
                  data={items}
                  caption={t('tableCaption')}
                  loading={parents.isFetching}
                />
              </div>
              <div className="flex items-center justify-between px-1.5">
                <span className="text-[13px] text-muted-foreground">{footer}</span>
                <ListPagination page={page} totalPages={parents.data?.totalPages ?? 1} />
              </div>
            </div>
          ) : undefined
        }
        pagination={
          items.length > 0 ? (
            <div className="flex flex-col items-center gap-3 md:hidden">
              <ListPagination page={page} totalPages={parents.data?.totalPages ?? 1} />
              <span className="text-[13px] text-muted-foreground">{footer}</span>
            </div>
          ) : undefined
        }
      />
      {removal.dialog}
    </>
  );
}
