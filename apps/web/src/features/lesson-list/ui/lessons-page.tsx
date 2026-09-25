'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CircleSlashIcon, PlusIcon } from 'lucide-react';
import { useNow, useTranslations } from 'next-intl';
import { useIsSoloWorkspace } from '@/components/app/session-provider';
import { Button } from '@/components/ui/button';
import { CollectionFrame } from '@/components/shared/collection-frame';
import { DataTable } from '@/components/shared/data-table';
import { IconButton } from '@/components/shared/icon-button';
import { ListPagination, useUpdateSearchParams } from '@/components/shared/list-controls';
import { PageHeader } from '@/components/shared/page-shell';
import {
  BulkCancelDialog,
  LessonCreateDialog,
  LessonPanel,
  useLessonPanel,
  type LessonPanelIntent,
  type LessonPanelLinks,
} from '@/features/lessons';
import {
  useGroupOptionsQuery,
  useLessonCountQuery,
  useLessonPageQuery,
  useStudentQuery,
  useTeachersQuery,
} from '../api';
import {
  currentWeek,
  listQuery,
  narrowed,
  PARAM,
  periodParams,
  periodRange,
  readListState,
  resetParams,
} from '../model/filters';
import { LessonCard } from './lesson-card';
import { lessonsRowLayout, useLessonsColumns } from './lessons-columns';
import { LessonsFilterSheet } from './lessons-filter-sheet';
import { LessonsEmpty, LessonsError, LessonsNoResults, LessonsSkeleton } from './lessons-states';
import { LessonsToolbar, type ToolbarActions } from './lessons-toolbar';
import { useNoResultsSummary } from './use-no-results-summary';

const LESSON_LINKS: LessonPanelLinks = {
  studentHref: (id) => `/app/students/${id}`,
  groupHref: (id) => `/app/groups/${id}`,
};

const TEACHER_FILTERS = { page: 1, pageSize: 100, state: 'all' as const };

/**
 * The Lessons page (S04, `/app/lessons`): every lesson of the studio, paged,
 * with the quick filters and their counts, the period, teacher, student or
 * group and status filters, the search and the order — all in the URL. A row
 * opens the S01 panel (`?lesson=`), and its menu opens the panel's dialogs;
 * «Скасування занять» cancels a whole period (L-54).
 */
export function LessonsPage({ nowMs }: { nowMs?: number } = {}) {
  const t = useTranslations('lessonList');
  const tCommon = useTranslations('common');
  const params = useSearchParams();
  const updateParams = useUpdateSearchParams();
  const clock = useNow();
  const [now] = useState(() => nowMs ?? clock.getTime());
  const solo = useIsSoloWorkspace();
  const state = useMemo(() => readListState(params), [params]);
  const panel = useLessonPanel();
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);

  const lessons = useLessonPageQuery(listQuery(state, now));
  const range = periodRange(state, now);
  const periodTotal = useLessonCountQuery(range?.from.toISOString(), range?.to.toISOString());
  const week = currentWeek(now);
  const weekTotal = useLessonCountQuery(week.from.toISOString(), week.to.toISOString());
  const data = lessons.data;
  const items = data?.items ?? [];
  const filtered = narrowed(state);
  // Only an empty page asks whether the studio has any lesson at all.
  const everTotal = useLessonCountQuery(undefined, undefined, data?.total === 0);
  const studioEmpty = everTotal.data === 0;

  const teacherRows = useTeachersQuery(TEACHER_FILTERS);
  const teachers = useMemo(
    () =>
      (teacherRows.data?.items ?? [])
        .filter((teacher) => !teacher.deletedAt && teacher.status !== 'ARCHIVED')
        .map((teacher) => ({
          id: teacher.id,
          fullName: teacher.fullName,
          avatarKey: teacher.avatarKey,
        })),
    [teacherRows.data],
  );
  const teacherAvatars = useMemo(
    () =>
      new Map((teacherRows.data?.items ?? []).map((teacher) => [teacher.id, teacher.avatarKey])),
    [teacherRows.data],
  );
  const student = useStudentQuery(state.studentId ?? '', Boolean(state.studentId));
  const groups = useGroupOptionsQuery(Boolean(state.groupId));
  const whoId = state.studentId ?? state.groupId;
  const whoName =
    (picked && picked.id === whoId ? picked.name : null) ??
    (state.studentId
      ? (student.data?.fullName ?? null)
      : (groups.data?.items.find((group) => group.id === state.groupId)?.name ?? null));
  const teacherName = teachers.find((teacher) => teacher.id === state.teacherId)?.fullName ?? null;
  const summary = useNoResultsSummary({ state, now, teacherName, whoName });

  const openLesson = useCallback(
    (lessonId: string, intent?: LessonPanelIntent) => panel.open(lessonId, intent ?? null),
    [panel],
  );
  const pagePackages = data?.packages;
  const packages = useMemo(
    () => new Map((pagePackages ?? []).map((pkg) => [pkg.enrollmentId, pkg])),
    [pagePackages],
  );
  const packageOf = useCallback(
    (lesson: { enrollmentId: string | null; groupId: string | null }) =>
      lesson.enrollmentId && !lesson.groupId ? (packages.get(lesson.enrollmentId) ?? null) : null,
    [packages],
  );
  const columns = useLessonsColumns({
    solo,
    now,
    quick: state.quick,
    teacherAvatars,
    packageOf,
    onOpen: openLesson,
  });

  const set = (updates: Record<string, string | undefined>) =>
    updateParams(updates, { resetPage: true });
  const actions: ToolbarActions = {
    onQuick: (quick) => set({ [PARAM.quick]: quick === 'all' ? undefined : quick }),
    onSearch: (search) => set({ [PARAM.search]: search.trim() || undefined }),
    onPreset: (preset) => set(periodParams(preset)),
    onRange: (next) => set(periodParams(next)),
    onTeacher: (teacherId) => set({ [PARAM.teacher]: teacherId ?? undefined }),
    onWho: (who, name) => {
      if (who && name) setPicked({ id: who.id, name });
      set({
        [PARAM.student]: who?.kind === 'student' ? who.id : undefined,
        [PARAM.group]: who?.kind === 'group' ? who.id : undefined,
      });
    },
    onStatuses: (statuses) =>
      set({ [PARAM.status]: statuses.length > 0 ? statuses.join(',') : undefined }),
    onOrder: (order) => set({ [PARAM.order]: order === 'asc' ? 'asc' : undefined }),
    onReset: () => set(resetParams()),
    onOpenSheet: () => setSheetOpen(true),
  };

  const total = periodTotal.data;
  const description = !data
    ? tCommon('loading')
    : studioEmpty
      ? t('subtitle.empty')
      : filtered
        ? t('subtitle.filtered', { count: data.total, total: total ?? data.counts.all })
        : null;
  const counts = (short: boolean) =>
    short
      ? t('subtitle.short', { total: total ?? data!.counts.all, unpaid: data!.counts.unpaid })
      : t('subtitle.counts', {
          total: total ?? data!.counts.all,
          week: weekTotal.data ?? 0,
          unpaid: data!.counts.unpaid,
        });

  const showing = data ? t('showing', { shown: items.length, total: data.total }) : '';

  return (
    <>
      <CollectionFrame
        header={
          <PageHeader
            size="xl"
            title={t('title')}
            description={
              description ?? (
                <>
                  <span className="md:hidden">{counts(true)}</span>
                  <span className="hidden md:inline">{counts(false)}</span>
                </>
              )
            }
            action={
              <>
                {studioEmpty ? null : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="xl"
                      className="hidden md:inline-flex"
                      onClick={() => setCancelling(true)}
                    >
                      <CircleSlashIcon data-icon="inline-start" />
                      {t('bulkCancel')}
                    </Button>
                    <IconButton
                      icon={<CircleSlashIcon />}
                      label={t('bulkCancel')}
                      tone="paper"
                      border
                      className="md:hidden"
                      onClick={() => setCancelling(true)}
                    />
                  </>
                )}
                <Button
                  type="button"
                  size="xl"
                  leading={<PlusIcon />}
                  className="max-md:h-11"
                  onClick={() => setCreating(true)}
                >
                  <span className="md:hidden">{t('newShort')}</span>
                  <span className="hidden md:inline">{t('newLesson')}</span>
                </Button>
              </>
            }
          />
        }
        toolbar={
          studioEmpty ? undefined : (
            <LessonsToolbar
              state={state}
              now={now}
              counts={data?.counts}
              solo={solo}
              teachers={teachers}
              whoName={whoName}
              actions={actions}
            />
          )
        }
        loading={
          lessons.isPending ? <LessonsSkeleton label={tCommon('loading')} solo={solo} /> : undefined
        }
        error={
          lessons.isError && !data ? (
            <LessonsError retrying={lessons.isFetching} onRetry={() => void lessons.refetch()} />
          ) : undefined
        }
        empty={
          data && items.length === 0 ? (
            studioEmpty ? (
              <LessonsEmpty onNew={() => setCreating(true)} />
            ) : everTotal.isPending ? (
              <LessonsSkeleton label={tCommon('loading')} solo={solo} />
            ) : (
              <LessonsNoResults
                summary={summary}
                onReset={() => set({ ...resetParams(true), ...periodParams('month') })}
              />
            )
          ) : undefined
        }
        mobile={
          items.length > 0
            ? items.map((lesson) => (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  now={now}
                  solo={solo}
                  quick={state.quick}
                  pkg={packageOf(lesson)}
                  onOpen={openLesson}
                />
              ))
            : undefined
        }
        desktop={
          items.length > 0 ? (
            <div className="flex flex-col rounded-card bg-card p-2">
              <DataTable
                variant="rows"
                layout={lessonsRowLayout(solo)}
                rowHeight="auto"
                columns={columns}
                data={items}
                caption={t('tableCaption')}
                loading={lessons.isFetching && !lessons.isPending}
              />
              <div className="mt-2 flex min-h-12 items-center justify-between border-t border-border px-4 pt-3 pb-2">
                <span className="text-[13px] text-muted-foreground">{showing}</span>
                <ListPagination page={state.page} totalPages={data?.totalPages ?? 1} />
              </div>
            </div>
          ) : undefined
        }
        pagination={
          items.length > 0 ? (
            <div className="flex flex-col items-center gap-3 md:hidden">
              <ListPagination page={state.page} totalPages={data?.totalPages ?? 1} />
              <span className="text-[13px] text-muted-foreground">{showing}</span>
            </div>
          ) : undefined
        }
      />

      <LessonsFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        state={state}
        now={now}
        solo={solo}
        teachers={teachers}
        whoName={whoName}
        onApply={(draft) =>
          set({
            ...(draft.period === 'custom' && draft.from && draft.to
              ? periodParams({ from: draft.from, to: draft.to })
              : periodParams(draft.period === 'custom' ? 'month' : draft.period)),
            [PARAM.teacher]: draft.teacherId ?? undefined,
            [PARAM.student]: draft.studentId ?? undefined,
            [PARAM.group]: draft.groupId ?? undefined,
            [PARAM.status]: draft.statuses.length > 0 ? draft.statuses.join(',') : undefined,
          })
        }
      />
      <LessonCreateDialog open={creating} onOpenChange={setCreating} nowMs={nowMs} />
      <BulkCancelDialog
        open={cancelling}
        onOpenChange={setCancelling}
        nowMs={nowMs}
        onShow={(done) => set({ ...periodParams(done), ...resetParams(true) })}
      />
      <LessonPanel
        lessonId={panel.lessonId}
        intent={panel.intent}
        onClose={panel.close}
        onOpenLesson={panel.open}
        linkTo={panel.linkTo}
        links={LESSON_LINKS}
        nowMs={nowMs}
      />
    </>
  );
}
