'use client';

import { ArrowUpDownIcon, LayoutGridIcon, ListIcon, SlidersHorizontalIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FilterPill } from '@/components/shared/filter-pill';
import { SearchField } from '@/components/shared/search-field';
import type { ListSort } from '@/components/shared/list-controls';

export const STUDENT_STATUS_TABS = ['all', 'ACTIVE', 'ON_HOLD', 'ARCHIVED'] as const;
export type StudentStatusTab = (typeof STUDENT_STATUS_TABS)[number];

const TAB_LABEL_KEY: Record<StudentStatusTab, string> = {
  all: 'all',
  ACTIVE: 'active',
  ON_HOLD: 'onHold',
  ARCHIVED: 'archived',
};

export type StudentGroupOption = { value: string; label: string };

/**
 * The collection control row: status segments with their counts, the group
 * filter, search and sort. The teacher filter, the low-credit filter and the
 * card view are part of the approved design but have no query support yet, so
 * they are rendered disabled and named as coming rather than faked.
 */
export function StudentsListFilters({
  status,
  counts,
  groupId,
  groupOptions,
  search,
  sort,
  sortFields,
  onStatusChange,
  onGroupChange,
  onSearchChange,
}: {
  status: StudentStatusTab;
  counts: Partial<Record<StudentStatusTab, number | undefined>>;
  groupId?: string;
  groupOptions: StudentGroupOption[];
  search?: string;
  sort: ListSort;
  sortFields: readonly string[];
  onStatusChange: (next: StudentStatusTab) => void;
  onGroupChange: (next?: string) => void;
  onSearchChange: (next: string) => void;
}) {
  const t = useTranslations('students.filters');
  const tSort = useTranslations('students.sort');
  const tStatus = useTranslations('students.statusTabs');

  const selectedGroup = groupOptions.find((option) => option.value === groupId);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <div className="flex max-w-full flex-wrap items-center gap-2.5">
        {/* A facet filter, not a tab set: it switches the query, not a panel.
            Four segments do not fit a phone, so the row scrolls rather than
            shrinking the touch targets. */}
        <div className="max-w-full overflow-x-auto">
        <ToggleGroup
          type="single"
          value={status}
          onValueChange={(next) => onStatusChange((next || 'all') as StudentStatusTab)}
          variant="segmented-solid"
          spacing={0.5}
          aria-label={t('statusAll')}
        >
          {STUDENT_STATUS_TABS.map((tab) => (
            <ToggleGroupItem
              key={tab}
              value={tab}
              // The count dims only on the filled segment, where 70% still
              // clears AA; on paper it stays at full muted strength.
              className="gap-2 px-3.5 data-[state=on]:[&>span]:opacity-70"
            >
              {tStatus(TAB_LABEL_KEY[tab])}
              {counts[tab] != null ? (
                <span className="font-mono text-xs">{counts[tab]}</span>
              ) : null}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <FilterPill label={selectedGroup?.label ?? t('groupAll')} menu pressed={Boolean(groupId)} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => onGroupChange(undefined)}>
              {t('groupAll')}
            </DropdownMenuItem>
            {groupOptions.map((option) => (
              <DropdownMenuItem key={option.value} onSelect={() => onGroupChange(option.value)}>
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <FilterPill
          label={t('lowCredits')}
          icon={<SlidersHorizontalIcon />}
          disabled
          title={t('comingSoon')}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="w-full sm:w-60">
          <SearchField
            label={t('searchLabel')}
            placeholder={t('searchPlaceholder')}
            defaultValue={search ?? ''}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <FilterPill label={tSort(sort.field ?? 'fullName')} icon={<ArrowUpDownIcon />} menu />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {sortFields.map((field) => (
              <DropdownMenuItem key={field} onSelect={() => sort.onSort(field)}>
                {tSort(field)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <ToggleGroup
          type="single"
          value="list"
          variant="segmented"
          size="icon"
          spacing={0.5}
          aria-label={t('view')}
        >
          <ToggleGroupItem value="list" aria-label={t('viewList')}>
            <ListIcon />
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" aria-label={t('viewGrid')} disabled title={t('comingSoon')}>
            <LayoutGridIcon />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}
