'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { TeacherListItem } from '@tutorio/validation';
import { useSession } from '@/components/app/session-provider';
import { CollectionFrame } from '@/components/shared/collection-frame';
import { DataTable } from '@/components/shared/data-table';
import { ListPagination, useUpdateSearchParams } from '@/components/shared/list-controls';
import { PageHeader, QueryErrorAlert } from '@/components/shared/page-shell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useStoredChoice } from '@/hooks/use-stored-choice';
import { errorMessageKey } from '@/lib/api/error-message';
import { parsePageParam } from '@/lib/api/filters';
import { useTeachersQuery } from '@/lib/api/teachers';
import { useUpdateWorkspaceSettingsMutation } from '@/lib/api/workspace';
import type { GatewayError } from '@/lib/auth/client';
import { subjectOptions } from '../model/presentation';
import { TeacherCard } from './teacher-card';
import { TEACHERS_ROW_LAYOUT, useTeachersListColumns } from './teachers-list-columns';
import {
  TEACHER_SORTS,
  TEACHER_TABS,
  TEACHER_VIEWS,
  TeachersListFilters,
  type TeacherSort,
  type TeacherTab,
  type TeachersView,
} from './teachers-list-filters';
import {
  NotTeachingRow,
  OnlyYouCard,
  SoloNotice,
  TeachersEmptyState,
} from './teachers-list-notices';
import { useTeacherActions } from './use-teacher-actions';

// Three cards a row on a desktop, two on a tablet: a page is always full rows.
const PAGE_SIZE = 24;

function parseTab(value: string | null): TeacherTab {
  return TEACHER_TABS.find((tab) => tab === value) ?? 'active';
}

function parseSort(value: string | null): TeacherSort {
  return TEACHER_SORTS.find((sort) => sort === value) ?? 'workload';
}

/**
 * The teachers collection (S09 board 01): the status tabs, «Предмет», the
 * search, the sort and the table or the cards (cards only below a desktop).
 * The owner comes first with «Ви» and the crown; while she does not teach,
 * her row sits above the list with «Я теж викладаю». With the owner alone the
 * list invites colleagues; in tutor mode it shows her with the way to a
 * studio. Every filter is a URL parameter answered by the API.
 */
export function TeachersList() {
  const t = useTranslations('teachers');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const session = useSession();
  const solo = session.workspace.mode === 'SOLO';
  const searchParams = useSearchParams();
  const updateParams = useUpdateSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useStoredChoice<TeachersView>(
    'tutorio.teachers.view',
    TEACHER_VIEWS,
    'rows',
  );

  const page = parsePageParam(searchParams.get('page'));
  const search = searchParams.get('search')?.trim() || undefined;
  const subject = searchParams.get('subject') || undefined;
  const tab = parseTab(searchParams.get('status'));
  const sort = parseSort(searchParams.get('sort'));

  const teachers = useTeachersQuery({
    page,
    pageSize: PAGE_SIZE,
    search,
    subject,
    status: tab === 'all' ? undefined : tab === 'active' ? 'ACTIVE' : 'ARCHIVED',
    sort,
  });
  // The subject filter offers every subject in the studio, not the page's.
  const everyone = useTeachersQuery({ page: 1, pageSize: 100 });
  const counts = teachers.data?.counts;
  const me = teachers.data?.me ?? null;
  const notTeaching = me?.status === 'ARCHIVED';
  const othersActive = (counts?.active ?? 0) - (me && !notTeaching ? 1 : 0);

  const actions = useTeacherActions({ otherActiveTeachers: othersActive });
  const columns = useTeachersListColumns(actions.commands);
  const studio = useUpdateWorkspaceSettingsMutation();
  const switchToStudio = async () => {
    try {
      await studio.mutateAsync({ mode: 'SCHOOL' });
      toast.success(t('solo.switched'));
    } catch (error) {
      toast.error(tErrors(errorMessageKey(error as GatewayError)));
    }
  };

  const items = teachers.data?.items ?? [];
  const onlyMe = counts?.all === 1 && Boolean(me) && !notTeaching;
  const simple = solo || onlyMe;
  const showEmpty = teachers.isSuccess && items.length === 0 && !notTeaching;
  // Tutor mode has nothing to switch to.
  const commands = solo ? { ...actions.commands, onSwitchToSolo: undefined } : actions.commands;

  const description = solo
    ? t('subtitleSolo')
    : onlyMe
      ? t('subtitleOnlyMe')
      : counts
        ? t('subtitleCounts', { active: counts.active, archived: counts.archived })
        : t('subtitle');

  const clearSearch = () => {
    updateParams({ search: undefined }, { resetPage: true });
    searchRef.current?.focus();
  };

  const shownTotal = teachers.data?.total ?? items.length;
  const footer = (
    <span className="text-[13px] text-muted-foreground">
      {simple
        ? t('records', { count: shownTotal })
        : t('showing', { shown: items.length, total: shownTotal })}
    </span>
  );
  const paging =
    (teachers.data?.totalPages ?? 1) > 1 ? (
      <ListPagination page={page} totalPages={teachers.data?.totalPages ?? 1} />
    ) : null;

  const cards = (rows: TeacherListItem[], withAdd: boolean) => (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((teacher) => (
        <li key={teacher.id} className="flex *:grow">
          <TeacherCard teacher={teacher} commands={commands} />
        </li>
      ))}
      {withAdd ? (
        <li className="hidden lg:flex *:grow">
          <Link
            href="/app/teachers/new"
            className="flex min-h-80 flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed border-border p-6 text-center outline-none hover:bg-surface-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span className="flex size-14 items-center justify-center rounded-tile bg-tile-indigo text-tile-indigo-foreground [&_svg]:size-6">
              <PlusIcon aria-hidden="true" />
            </span>
            <span className="text-[17px] font-semibold">{t('addCard.title')}</span>
            <span className="text-[15px] text-muted-foreground">{t('addCard.text')}</span>
          </Link>
        </li>
      ) : null}
    </ul>
  );
  const table = (
    <div className="flex flex-col rounded-card bg-card p-2">
      <DataTable
        variant="rows"
        rowHeight="auto"
        layout={TEACHERS_ROW_LAYOUT}
        columns={columns}
        data={items}
        caption={t('tableCaption')}
        loading={teachers.isFetching}
        isRowDimmed={(teacher) => teacher.status === 'ARCHIVED'}
      />
      <div className="mt-2 flex items-center justify-between border-t border-border px-4 pt-3 pb-2">
        {footer}
        {paging}
      </div>
    </div>
  );
  // The table is a desktop view; below it the cards stand in.
  const addCard = tab === 'active' && !search && !subject && !simple;
  const desktop =
    view === 'rows' || simple ? (
      <>
        <div className="hidden lg:block">{table}</div>
        <div className="flex flex-col gap-4 lg:hidden">
          {cards(items, false)}
          <div className="flex items-center justify-between px-1.5">
            {footer}
            {paging}
          </div>
        </div>
      </>
    ) : (
      <div className="flex flex-col gap-4">
        {cards(items, addCard)}
        <div className="flex items-center justify-between px-1.5">
          {footer}
          {paging}
        </div>
      </div>
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
              solo ? undefined : (
                <Button
                  asChild
                  size="xl"
                  leading={<PlusIcon />}
                  className="max-md:size-11 max-md:px-0"
                >
                  <Link href="/app/teachers/new" aria-label={t('add')}>
                    <span className="max-md:sr-only lg:hidden">{t('addShort')}</span>
                    <span className="hidden lg:inline">{t('add')}</span>
                  </Link>
                </Button>
              )
            }
          />
        }
        summary={
          solo ? (
            <SoloNotice busy={studio.isPending} onSwitch={() => void switchToStudio()} />
          ) : undefined
        }
        toolbar={
          simple || !teachers.data ? undefined : (
            <div className="flex flex-col gap-4">
              <TeachersListFilters
                tab={tab}
                counts={counts}
                search={search}
                searchRef={searchRef}
                subject={subject}
                subjects={subjectOptions(everyone.data?.items ?? [])}
                sort={sort}
                view={view}
                onTabChange={(next) =>
                  updateParams(
                    { status: next === 'active' ? undefined : next },
                    { resetPage: true },
                  )
                }
                onSearchChange={(next) =>
                  updateParams({ search: next.trim() || undefined }, { resetPage: true })
                }
                onSubjectChange={(next) => updateParams({ subject: next }, { resetPage: true })}
                onSortChange={(next) =>
                  updateParams(
                    { sort: next === 'workload' ? undefined : next },
                    { resetPage: true },
                  )
                }
                onViewChange={setView}
              />
              {notTeaching && me && tab !== 'archived' ? (
                <NotTeachingRow
                  me={me}
                  busy={actions.busyId === me.id}
                  onTeach={() => actions.commands.onRestore(me)}
                />
              ) : null}
            </div>
          )
        }
        loading={
          teachers.isPending ? (
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
                  <Skeleton className="hidden h-6 w-40 md:block" />
                  <Skeleton className="hidden h-4 w-24 md:block" />
                </div>
              ))}
            </div>
          ) : undefined
        }
        error={
          teachers.isError ? (
            <QueryErrorAlert
              error={teachers.error}
              title={t('error.title')}
              onRetry={() => void teachers.refetch()}
            />
          ) : undefined
        }
        empty={
          showEmpty ? (
            <TeachersEmptyState
              search={search}
              subject={subject}
              archive={tab === 'archived'}
              onClearSearch={clearSearch}
              onResetSubject={() => updateParams({ subject: undefined }, { resetPage: true })}
            />
          ) : undefined
        }
        mobile={
          items.length > 0
            ? items.map((teacher) => (
                <TeacherCard key={teacher.id} teacher={teacher} commands={commands} />
              ))
            : undefined
        }
        desktop={items.length > 0 ? desktop : undefined}
        pagination={
          items.length > 0 ? (
            <div className="flex flex-col items-center gap-3 md:hidden">
              {paging}
              {footer}
            </div>
          ) : undefined
        }
      />
      {onlyMe ? <OnlyYouCard /> : null}
      {actions.dialogs}
    </>
  );
}
