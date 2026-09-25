'use client';

import { ArrowUpDownIcon, LayersIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ScheduleListResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FilterPill } from '@/components/shared/filter-pill';
import { SearchField } from '@/components/shared/search-field';
import { Segmented } from '@/components/shared/segmented';
import { TeacherMenu, WhoPicker, type TeacherOption, type WhoValue } from '@/features/lesson-list';
import { useUrlSearchText } from '@/hooks/use-url-search-text';
import {
  pillsActive,
  STATE_TABS,
  type Kind,
  type ScheduleListState,
  type SortOrder,
  type StateTab,
} from '../model/filters';

const COUNT_OF: Record<StateTab, keyof ScheduleListResponse['counts']> = {
  ACTIVE: 'active',
  CHANGING: 'changing',
  ENDED: 'ended',
  all: 'all',
};

const ALL_KINDS = '__all';

export type ToolbarActions = {
  onTab: (tab: StateTab) => void;
  onSearch: (search: string) => void;
  onTeacher: (teacherId: string | null) => void;
  onWho: (who: WhoValue | null, name: string | null) => void;
  onKind: (kind: Kind | null) => void;
  onSort: (sort: SortOrder) => void;
  onReset: () => void;
};

/**
 * The Schedules controls (S05 board 01): the state tabs with counts and the
 * search; then teacher, student or group and type, «Скинути» once one is
 * set, and the order on the right. Phones search first and scroll the rows.
 */
export function SchedulesToolbar({
  state,
  counts,
  solo,
  teachers,
  whoName,
  actions,
}: {
  state: ScheduleListState;
  counts: ScheduleListResponse['counts'] | undefined;
  solo: boolean;
  teachers: readonly TeacherOption[];
  whoName: string | null;
  actions: ToolbarActions;
}) {
  const t = useTranslations('schedules.toolbar');
  const [text, setText] = useUrlSearchText(state.search ?? undefined, actions.onSearch);
  const who: WhoValue | null = state.studentId
    ? { kind: 'student', id: state.studentId }
    : state.groupId
      ? { kind: 'group', id: state.groupId }
      : null;

  const tabs = (
    <div className="no-scrollbar -mx-4 max-w-[100vw] overflow-x-auto px-4 md:mx-0 md:max-w-full md:px-0">
      <Segmented
        label={t('tabs')}
        value={state.tab}
        onValueChange={actions.onTab}
        items={STATE_TABS.map((tab) => ({
          value: tab,
          label: t(`tab.${tab}`),
          count: counts?.[COUNT_OF[tab]],
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
  const kindMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterPill
          menu
          pressed={Boolean(state.kind)}
          icon={<LayersIcon />}
          label={state.kind ? t(`kind.${state.kind}`) : t('kindLabel')}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={state.kind ?? ALL_KINDS}
          onValueChange={(next) => actions.onKind(next === ALL_KINDS ? null : (next as Kind))}
        >
          <DropdownMenuRadioItem value={ALL_KINDS}>{t('kind.all')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="individual">{t('kind.individual')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="group">{t('kind.group')}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const sortMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterPill
          menu
          icon={<ArrowUpDownIcon />}
          label={t(`sort.${state.sort}`)}
          aria-label={t('sort.current', { value: t(`sort.${state.sort}`) })}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={state.sort}
          onValueChange={(next) => actions.onSort(next as SortOrder)}
        >
          <DropdownMenuRadioItem value="next">{t('sort.next')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="created">{t('sort.created')}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const pills = (
    <>
      {solo ? null : (
        <TeacherMenu teachers={teachers} selected={state.teacherId} onChange={actions.onTeacher} />
      )}
      <WhoPicker selected={who} name={whoName} onChange={actions.onWho} />
      {kindMenu}
    </>
  );

  return (
    <>
      <div className="flex flex-col gap-3 md:hidden">
        {search('')}
        {tabs}
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {pills}
          {sortMenu}
        </div>
      </div>
      <div className="hidden flex-col gap-3 md:flex">
        <div className="flex items-center justify-between gap-4">
          {tabs}
          {search('w-[390px] shrink')}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {pills}
          {pillsActive(state) ? (
            <Button type="button" variant="ghost" onClick={actions.onReset}>
              <XIcon data-icon="inline-start" />
              {t('reset')}
            </Button>
          ) : null}
          <div className="ml-auto">{sortMenu}</div>
        </div>
      </div>
    </>
  );
}
