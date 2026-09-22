'use client';

import { useState } from 'react';
import {
  ArrowUpDownIcon,
  LayoutGridIcon,
  ListIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FilterPill } from '@/components/shared/filter-pill';
import { IconButton } from '@/components/shared/icon-button';
import { SearchField } from '@/components/shared/search-field';
import { Segmented } from '@/components/shared/segmented';
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

  // On desktop the search folds into an icon, so the facet row stays one line
  // as in the reference; it opens on demand and stays open while it filters.
  const [searchOpen, setSearchOpen] = useState(Boolean(search));
  const searchField = (autoFocus = false) => (
    <SearchField
      label={t('searchLabel')}
      placeholder={t('searchPlaceholder')}
      defaultValue={search ?? ''}
      autoFocus={autoFocus}
      onChange={(event) => onSearchChange(event.currentTarget.value)}
      onBlur={(event) => {
        if (!event.currentTarget.value) setSearchOpen(false);
      }}
    />
  );

  return (
    <div className="flex flex-col gap-2.5">
      {/* Phones search first: the list below is what the search narrows. */}
      <div className="md:hidden">{searchField()}</div>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex max-w-full flex-wrap items-center gap-2.5">
          {/* A facet filter, not a tab set: it switches the query, not a panel.
              Four segments do not fit a phone, so the row scrolls rather than
              shrinking the touch targets. */}
          <div className="no-scrollbar -mx-4 max-w-[100vw] overflow-x-auto px-4 md:mx-0 md:max-w-full md:px-0">
            <Segmented
              label={t('statusAll')}
              value={status}
              onValueChange={onStatusChange}
              items={STUDENT_STATUS_TABS.map((tab) => ({
                value: tab,
                label: tStatus(TAB_LABEL_KEY[tab]),
                count: counts[tab],
              }))}
            />
          </div>

          <div className="flex items-center gap-2.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <FilterPill
                  label={selectedGroup?.label ?? t('group')}
                  menu
                  pressed={Boolean(groupId)}
                />
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
              className="hidden md:inline-flex"
            />
          </div>
        </div>

        <div className="hidden flex-wrap items-center gap-2.5 md:flex">
          {searchOpen ? (
            <div className="w-60">{searchField(true)}</div>
          ) : (
            <IconButton
              border
              icon={<SearchIcon />}
              label={t('searchLabel')}
              onClick={() => setSearchOpen(true)}
            />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <FilterPill label={tSort(sort.field ?? 'fullName')} icon={<ArrowUpDownIcon />} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {sortFields.map((field) => (
                <DropdownMenuItem key={field} onSelect={() => sort.onSort(field)}>
                  {tSort(field)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Segmented
            label={t('view')}
            value="list"
            onValueChange={() => undefined}
            items={[
              { value: 'list', icon: <ListIcon />, ariaLabel: t('viewList') },
              {
                value: 'grid',
                icon: <LayoutGridIcon />,
                ariaLabel: t('viewGrid'),
                disabled: true,
                title: t('comingSoon'),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
