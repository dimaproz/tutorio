'use client';

import type { Ref } from 'react';
import {
  ArrowUpDownIcon,
  CalendarDaysIcon,
  LayoutGridIcon,
  ListIcon,
  WalletIcon,
  XIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EntityPicker, type EntityPickerOption } from '@/components/shared/entity-picker';
import { FilterPill } from '@/components/shared/filter-pill';
import { SearchField } from '@/components/shared/search-field';
import { Segmented } from '@/components/shared/segmented';
import { useUrlSearchText } from '@/hooks/use-url-search-text';
import { useWeekdayLabels } from '@/lib/i18n/weekdays';
import { cn } from '@/lib/utils';

export const GROUP_TABS = ['all', 'ACTIVE', 'EMPTY', 'archived'] as const;
export type GroupTab = (typeof GROUP_TABS)[number];

export const GROUP_SORT_FIELDS = ['name', 'activeStudentCount', 'pricePerLesson', 'createdAt'] as const;
export type GroupSortField = (typeof GROUP_SORT_FIELDS)[number];

export type GroupsView = 'rows' | 'grid';

/** Monday first, the way the schedule pills read. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];
/** Radix radio groups cannot hold an empty value, so "any" has a token. */
const ANY = '__any';

/**
 * The collection control row: the state tabs with their counts, the search,
 * the teacher and weekday filters, "Reset" once a filter is set, the sort and
 * the cards/rows switch. Every filter is answered by the API. The archive tab
 * is the owner's only; a solo tutor has no teacher filter.
 */
export function GroupsListFilters({
  tab,
  counts,
  showArchive,
  search,
  searchRef,
  teacherId,
  teacherName,
  teacherOptions,
  teachersLoading = false,
  showTeacher,
  weekday,
  unpaid,
  sort,
  view,
  onTabChange,
  onSearchChange,
  onTeacherChange,
  onWeekdayChange,
  onUnpaidChange,
  onSortChange,
  onViewChange,
  onReset,
}: {
  tab: GroupTab;
  counts: Partial<Record<GroupTab, number>>;
  showArchive: boolean;
  search?: string;
  searchRef?: Ref<HTMLInputElement>;
  teacherId?: string;
  teacherName?: string;
  teacherOptions: EntityPickerOption[];
  teachersLoading?: boolean;
  showTeacher: boolean;
  weekday?: number;
  unpaid: boolean;
  sort: GroupSortField;
  view: GroupsView;
  onTabChange: (next: GroupTab) => void;
  onSearchChange: (next: string) => void;
  onTeacherChange: (next?: string) => void;
  onWeekdayChange: (next?: number) => void;
  onUnpaidChange: (next: boolean) => void;
  onSortChange: (next: GroupSortField) => void;
  onViewChange: (next: GroupsView) => void;
  onReset: () => void;
}) {
  const t = useTranslations('groups');
  const weekdays = useWeekdayLabels();
  const longWeekdays = useWeekdayLabels('long');
  const [text, setText] = useUrlSearchText(search, onSearchChange);
  const filtered = Boolean(teacherId) || weekday !== undefined || unpaid;
  const tabs = GROUP_TABS.filter((item) => item !== 'archived' || showArchive);

  const sortMenu = (className: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterPill
          className={className}
          icon={<ArrowUpDownIcon />}
          label={t(`sort.${sort}`)}
          aria-label={t('sort.current', { value: t(`sort.${sort}`) })}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={sort}
          onValueChange={(next) => onSortChange(next as GroupSortField)}
        >
          {GROUP_SORT_FIELDS.map((field) => (
            <DropdownMenuRadioItem key={field} value={field}>
              {t(`sort.${field}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center md:justify-between">
      <div className="flex min-w-0 flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center">
        {/* A facet filter, not a tab set: it switches the query, not a panel.
            On a phone the segments scroll rather than shrink their targets. */}
        <div className="no-scrollbar -mx-4 max-w-[100vw] overflow-x-auto px-4 md:mx-0 md:max-w-full md:px-0">
          <Segmented
            label={t('tabsLabel')}
            value={tab}
            onValueChange={onTabChange}
            items={tabs.map((item) => ({
              value: item,
              label: t(`tabs.${item}`),
              count: counts[item],
            }))}
          />
        </div>
        <SearchField
          ref={searchRef}
          label={t('searchLabel')}
          placeholder={t('searchPlaceholder')}
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
          // Phones search first: the cards below are what the search narrows.
          className="max-md:order-first md:w-64"
        />
        <div className="flex flex-wrap items-center gap-2.5">
          {showTeacher ? (
            <EntityPicker
              aria-label={t('filters.teacher')}
              value={teacherId}
              onChange={onTeacherChange}
              options={teacherOptions}
              placeholder={t('filters.teacher')}
              clearLabel={t('filters.teacherAll')}
              searchPlaceholder={t('filters.teacherSearch')}
              emptyLabel={t('filters.teacherEmpty')}
              isLoading={teachersLoading}
              trigger={
                // A menu opener, not a toggle: the chosen name is in the label.
                <FilterPill
                  menu
                  className={cn(teacherId && 'border-primary')}
                  label={
                    teacherId && teacherName
                      ? t('filters.teacherValue', { name: teacherName })
                      : t('filters.teacher')
                  }
                />
              }
            />
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <FilterPill
                menu
                icon={<CalendarDaysIcon />}
                className={cn(weekday !== undefined && 'border-primary')}
                label={
                  weekday !== undefined
                    ? t('filters.weekdayValue', { day: longWeekdays[weekday] ?? '' })
                    : t('filters.weekday')
                }
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup
                value={weekday === undefined ? ANY : String(weekday)}
                onValueChange={(next) => onWeekdayChange(next === ANY ? undefined : Number(next))}
              >
                <DropdownMenuRadioItem value={ANY}>{t('filters.weekdayAll')}</DropdownMenuRadioItem>
                {WEEK.map((day) => (
                  <DropdownMenuRadioItem key={day} value={String(day)}>
                    <span className="w-8 font-semibold uppercase">{weekdays[day]}</span>
                    {longWeekdays[day]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {unpaid ? (
            <FilterPill
              icon={<WalletIcon />}
              label={t('filters.unpaid')}
              pressed
              onClick={() => onUnpaidChange(false)}
            />
          ) : null}
          {sortMenu('md:hidden')}
          {filtered ? (
            <Button type="button" variant="ghost" onClick={onReset} className="max-md:h-11">
              <XIcon data-icon="inline-start" />
              {t('filters.reset')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="hidden flex-wrap items-center gap-2.5 md:flex">
        {sortMenu('')}
        <Segmented
          label={t('filters.view')}
          value={view}
          onValueChange={onViewChange}
          items={[
            { value: 'rows', icon: <ListIcon />, ariaLabel: t('filters.viewList') },
            { value: 'grid', icon: <LayoutGridIcon />, ariaLabel: t('filters.viewGrid') },
          ]}
        />
      </div>
    </div>
  );
}
