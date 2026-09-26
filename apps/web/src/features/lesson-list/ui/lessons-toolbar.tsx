'use client';

import { SlidersHorizontalIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LessonPageResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { FilterPill } from '@/components/shared/filter-pill';
import { SearchField } from '@/components/shared/search-field';
import { Segmented } from '@/components/shared/segmented';
import { useUrlSearchText } from '@/hooks/use-url-search-text';
import {
  pillsActive,
  QUICK_FILTERS,
  sheetFilterCount,
  type LessonListState,
  type ListOrder,
  type PeriodPreset,
  type QuickFilter,
  type StatusOption,
} from '../model/filters';
import { PeriodMenu } from './period-menu';
import { TeacherMenu, WhoPicker, type TeacherOption, type WhoValue } from './people-menus';
import { SortMenu, StatusMenu } from './status-menu';

const COUNT_OF: Record<QuickFilter, keyof LessonPageResponse['counts']> = {
  all: 'all',
  unpaid: 'unpaid',
  cancelled: 'cancelled',
  no_show: 'noShow',
  needs_makeup: 'needsMakeup',
  unconfirmed: 'unconfirmed',
};

export type ToolbarActions = {
  onQuick: (quick: QuickFilter) => void;
  onSearch: (search: string) => void;
  onPreset: (preset: PeriodPreset) => void;
  onRange: (range: { from: string; to: string }) => void;
  onTeacher: (teacherId: string | null) => void;
  onWho: (who: WhoValue | null, name: string | null) => void;
  onStatuses: (statuses: StatusOption[]) => void;
  onOrder: (order: ListOrder) => void;
  onReset: () => void;
  onOpenSheet: () => void;
};

/**
 * The control rows of the Lessons page (S04 decisions 3–4): the quick
 * filters with their counts and the search; then the period, teacher,
 * student or group and status pills, «Скинути» once a pill is set, and the
 * sort on the right. Phones search first, scroll the quick filters, and keep
 * the period, «Фільтри» (the sheet) and the sort in one row.
 */
export function LessonsToolbar({
  state,
  now,
  counts,
  solo,
  teachers,
  whoName,
  actions,
}: {
  state: LessonListState;
  now: number;
  counts: LessonPageResponse['counts'] | undefined;
  solo: boolean;
  teachers: readonly TeacherOption[];
  whoName: string | null;
  actions: ToolbarActions;
}) {
  const t = useTranslations('lessonList');
  const [text, setText] = useUrlSearchText(state.search ?? undefined, actions.onSearch);
  const who: WhoValue | null = state.studentId
    ? { kind: 'student', id: state.studentId }
    : state.groupId
      ? { kind: 'group', id: state.groupId }
      : null;
  const sheetCount = sheetFilterCount(state);

  const quick = (
    <div className="no-scrollbar -mx-4 max-w-[100vw] overflow-x-auto px-4 md:mx-0 md:max-w-full md:px-0">
      <Segmented
        label={t('quick.label')}
        value={state.quick}
        onValueChange={actions.onQuick}
        items={QUICK_FILTERS.map((filter) => ({
          value: filter,
          label: t(`quick.${filter}`),
          count: counts?.[COUNT_OF[filter]],
        }))}
      />
    </div>
  );
  const search = (className: string) => (
    <SearchField
      label={t('search')}
      placeholder={t('search')}
      value={text}
      onChange={(event) => setText(event.currentTarget.value)}
      className={className}
    />
  );

  return (
    <>
      <div className="flex flex-col gap-3 md:hidden">
        {search('')}
        {quick}
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <PeriodMenu
            state={state}
            now={now}
            short
            onPreset={actions.onPreset}
            onRange={actions.onRange}
          />
          <FilterPill
            icon={<SlidersHorizontalIcon />}
            label={t('filters.open')}
            aria-label={
              sheetCount > 0 ? t('filters.openWithCount', { count: sheetCount }) : undefined
            }
            count={sheetCount > 0 ? sheetCount : undefined}
            pressed={sheetCount > 0}
            onClick={actions.onOpenSheet}
          />
          <SortMenu order={state.order} onChange={actions.onOrder} short />
        </div>
      </div>

      <div className="hidden flex-col gap-3 md:flex">
        <div className="flex items-center justify-between gap-4">
          {quick}
          {search('w-[390px] shrink')}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <PeriodMenu
            state={state}
            now={now}
            onPreset={actions.onPreset}
            onRange={actions.onRange}
          />
          {solo ? null : (
            <TeacherMenu
              teachers={teachers}
              selected={state.teacherId}
              onChange={actions.onTeacher}
            />
          )}
          <WhoPicker selected={who} name={whoName} onChange={actions.onWho} />
          <StatusMenu value={state.statuses} onChange={actions.onStatuses} />
          {pillsActive(state) ? (
            <Button type="button" variant="ghost" onClick={actions.onReset}>
              <XIcon data-icon="inline-start" />
              {t('filters.reset')}
            </Button>
          ) : null}
          <div className="ml-auto">
            <SortMenu order={state.order} onChange={actions.onOrder} />
          </div>
        </div>
      </div>
    </>
  );
}
