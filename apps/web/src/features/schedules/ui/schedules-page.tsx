'use client';

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PlusIcon } from 'lucide-react';
import { useNow, useTranslations } from 'next-intl';
import { addCalendarDays, calendarWeekStart, dayStartIso, zonedDate } from '@/lib/datetime';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { useIsSoloWorkspace } from '@/components/app/session-provider';
import { Button } from '@/components/ui/button';
import { CollectionFrame } from '@/components/shared/collection-frame';
import { DataTable } from '@/components/shared/data-table';
import { ListPagination, useUpdateSearchParams } from '@/components/shared/list-controls';
import { PageHeader } from '@/components/shared/page-shell';
import {
  ScheduleChangeDialog,
  ScheduleCreateDialog,
  ScheduleHorizonDialog,
  ScheduleStopDialog,
} from '@/features/lessons';
import {
  useGroupOptionsQuery,
  useSchedulePageQuery,
  useStudentQuery,
  useTeachersQuery,
  useWeekLessonCountQuery,
} from '../api';
import { listQuery, PARAM, pillsActive, readListState, resetParams } from '../model/filters';
import { ScheduleCard } from './schedule-card';
import type { ListSchedule } from './schedule-cells';
import type { ScheduleAction } from './schedule-row-menu';
import { schedulesRowLayout, useSchedulesColumns } from './schedules-columns';
import {
  SchedulesEmpty,
  SchedulesError,
  SchedulesNoResults,
  SchedulesSkeleton,
} from './schedules-states';
import { SchedulesToolbar, type ToolbarActions } from './schedules-toolbar';

const TEACHER_FILTERS = { page: 1, pageSize: 100, state: 'all' as const };

/** Monday to Monday of the studio's week `now` is in. */
function weekOf(now: number, timeZone: string) {
  const monday = calendarWeekStart(zonedDate(now, timeZone));
  return {
    from: dayStartIso(monday, timeZone),
    to: dayStartIso(addCalendarDays(monday, 7), timeZone),
  };
}

/**
 * The Schedules page (S05, `/app/schedules`): every recurring schedule of the
 * studio by state, with the teacher, student or group and type filters, a
 * search and the order, all in the URL; a row's menu changes it, sets how
 * far ahead it books, opens its owner or stops it; «Новий розклад» creates
 * one. The change highlights its row.
 */
export function SchedulesPage({ nowMs }: { nowMs?: number } = {}) {
  const t = useTranslations('schedules');
  const tCommon = useTranslations('common');
  const params = useSearchParams();
  const updateParams = useUpdateSearchParams();
  const clock = useNow();
  const [now] = useState(() => nowMs ?? clock.getTime());
  const timeZone = useStudioTimeZone();
  const solo = useIsSoloWorkspace();
  const state = useMemo(() => readListState(params), [params]);
  const [creating, setCreating] = useState(false);
  const [dialog, setDialog] = useState<{ action: ScheduleAction; schedule: ListSchedule } | null>(
    null,
  );
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);

  const schedules = useSchedulePageQuery(listQuery(state));
  const week = weekOf(now, timeZone);
  const weekLessons = useWeekLessonCountQuery(week.from, week.to);
  const data = schedules.data;
  const items = data?.items ?? [];
  const studioEmpty = data?.counts.all === 0 && !pillsActive(state) && !state.search;

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

  const onAction = useCallback(
    (action: ScheduleAction, schedule: ListSchedule) => setDialog({ action, schedule }),
    [],
  );
  const columns = useSchedulesColumns({ solo, now, teacherAvatars, onAction });

  const set = (updates: Record<string, string | undefined>) =>
    updateParams(updates, { resetPage: true });
  const actions: ToolbarActions = {
    onTab: (tab) => set({ [PARAM.tab]: tab === 'ACTIVE' ? undefined : tab }),
    onSearch: (search) => set({ [PARAM.search]: search.trim() || undefined }),
    onTeacher: (teacherId) => set({ [PARAM.teacher]: teacherId ?? undefined }),
    onWho: (who, name) => {
      if (who && name) setPicked({ id: who.id, name });
      set({
        [PARAM.student]: who?.kind === 'student' ? who.id : undefined,
        [PARAM.group]: who?.kind === 'group' ? who.id : undefined,
      });
    },
    onKind: (kind) => set({ [PARAM.kind]: kind ?? undefined }),
    onSort: (sort) => set({ [PARAM.sort]: sort === 'next' ? undefined : sort }),
    onReset: () => set(resetParams()),
  };

  const counts = data?.counts;
  const subtitle = !counts ? tCommon('loading') : studioEmpty ? t('subtitle.empty') : null;
  const summary = [
    teacherName,
    whoName,
    state.kind ? t(`toolbar.kind.${state.kind}`).toLocaleLowerCase() : null,
    state.search ? `«${state.search}»` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const showing = data ? t('list.showing', { shown: items.length, total: data.total }) : '';
  const closeDialog = () => setDialog(null);

  return (
    <>
      <CollectionFrame
        header={
          <PageHeader
            size="xl"
            title={t('title')}
            description={
              subtitle ?? (
                <>
                  <span className="md:hidden">
                    {t('subtitle.short', { active: counts!.active, changing: counts!.changing })}
                  </span>
                  <span className="hidden md:inline">
                    {t('subtitle.counts', {
                      active: counts!.active,
                      changing: counts!.changing,
                      week: weekLessons.data ?? 0,
                    })}
                  </span>
                </>
              )
            }
            action={
              <Button
                type="button"
                size="xl"
                leading={<PlusIcon />}
                className="max-md:h-11"
                onClick={() => setCreating(true)}
              >
                <span className="md:hidden">{t('newShort')}</span>
                <span className="hidden md:inline">{t('new')}</span>
              </Button>
            }
          />
        }
        toolbar={
          studioEmpty ? undefined : (
            <SchedulesToolbar
              state={state}
              counts={counts}
              solo={solo}
              teachers={teachers}
              whoName={whoName}
              actions={actions}
            />
          )
        }
        loading={
          schedules.isPending ? (
            <SchedulesSkeleton label={tCommon('loading')} solo={solo} />
          ) : undefined
        }
        error={
          schedules.isError && !data ? (
            <SchedulesError
              retrying={schedules.isFetching}
              onRetry={() => void schedules.refetch()}
            />
          ) : undefined
        }
        empty={
          data && items.length === 0 ? (
            studioEmpty ? (
              <SchedulesEmpty onNew={() => setCreating(true)} />
            ) : (
              <SchedulesNoResults summary={summary} onReset={() => set(resetParams(true))} />
            )
          ) : undefined
        }
        mobile={
          items.length > 0
            ? items.map((schedule) => (
                <ScheduleCard
                  key={schedule.id}
                  schedule={schedule}
                  now={now}
                  solo={solo}
                  onAction={onAction}
                />
              ))
            : undefined
        }
        desktop={
          items.length > 0 ? (
            <div className="flex flex-col rounded-card bg-card p-2">
              <DataTable
                variant="rows"
                layout={schedulesRowLayout(solo)}
                rowHeight="auto"
                columns={columns}
                data={items}
                caption={t('list.caption')}
                loading={schedules.isFetching && !schedules.isPending}
                isRowDimmed={(schedule) => schedule.state === 'ENDED'}
                isRowHighlighted={(schedule) => schedule.id === highlighted}
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

      <ScheduleCreateDialog
        open={creating}
        onOpenChange={setCreating}
        nowMs={nowMs}
        onCreated={(schedule) => setHighlighted(schedule.id)}
      />
      {dialog ? (
        <>
          <ScheduleChangeDialog
            open={dialog.action === 'change'}
            onOpenChange={closeDialog}
            schedule={dialog.schedule}
            nowMs={nowMs}
            onChanged={(result) => setHighlighted(result.schedule.id)}
          />
          <ScheduleHorizonDialog
            open={dialog.action === 'horizon'}
            onOpenChange={closeDialog}
            schedule={dialog.schedule}
          />
          <ScheduleStopDialog
            open={dialog.action === 'stop'}
            onOpenChange={closeDialog}
            schedule={dialog.schedule}
            nowMs={nowMs}
          />
        </>
      ) : null}
    </>
  );
}
