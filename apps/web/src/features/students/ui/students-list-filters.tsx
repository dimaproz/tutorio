'use client';

import { useState, type Ref } from 'react';
import {
  ArrowUpDownIcon,
  LayoutGridIcon,
  ListIcon,
  SlidersHorizontalIcon,
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
import { FilterPill } from '@/components/shared/filter-pill';
import { SearchField } from '@/components/shared/search-field';
import { Segmented } from '@/components/shared/segmented';
import type { ListSort } from '@/components/shared/list-controls';
import { cn } from '@/lib/utils';

export const STUDENT_STATUS_TABS = ['all', 'ACTIVE', 'ON_HOLD', 'ARCHIVED'] as const;
export type StudentStatusTab = (typeof STUDENT_STATUS_TABS)[number];

const TAB_LABEL_KEY: Record<StudentStatusTab, string> = {
  all: 'all',
  ACTIVE: 'active',
  ON_HOLD: 'onHold',
  ARCHIVED: 'archived',
};

/** Radix radio groups cannot hold an empty value, so "every group" has a token. */
const ALL_GROUPS = '__all';

export type StudentGroupOption = { value: string; label: string };

/**
 * The collection control row, on the same pattern as the parents list: the
 * search field, the status segments with their counts, the group filter, a
 * "Reset" that appears once a filter is set, and the sort on the right. The
 * search text follows the URL, so clearing it anywhere clears the field. The
 * low-credit filter and the card view have no query support yet, so they are
 * rendered disabled and named as coming rather than faked.
 */
export function StudentsListFilters({
  status,
  counts,
  groupId,
  groupOptions,
  search,
  searchRef,
  sort,
  sortFields,
  onStatusChange,
  onGroupChange,
  onSearchChange,
  onReset,
}: {
  status: StudentStatusTab;
  counts: Partial<Record<StudentStatusTab, number | undefined>>;
  groupId?: string;
  groupOptions: StudentGroupOption[];
  search?: string;
  searchRef?: Ref<HTMLInputElement>;
  sort: ListSort;
  sortFields: readonly string[];
  onStatusChange: (next: StudentStatusTab) => void;
  onGroupChange: (next?: string) => void;
  onSearchChange: (next: string) => void;
  onReset: () => void;
}) {
  const t = useTranslations('students.filters');
  const tSort = useTranslations('students.sort');
  const tStatus = useTranslations('students.statusTabs');
  const selectedGroup = groupOptions.find((option) => option.value === groupId);
  const filtered = status !== 'all' || Boolean(groupId);
  const sortLabel = tSort(sort.field ?? 'fullName');

  const [text, setText] = useState(search ?? '');
  const [seen, setSeen] = useState(search);
  // The URL changed without the field: a cleared search, back/forward.
  if (search !== seen) {
    setSeen(search);
    if ((search ?? '') !== text.trim()) setText(search ?? '');
  }

  const sortMenu = (className: string) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterPill
          className={className}
          icon={<ArrowUpDownIcon />}
          label={sortLabel}
          aria-label={tSort('current', { value: sortLabel })}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={sort.field ?? 'fullName'} onValueChange={sort.onSort}>
          {sortFields.map((field) => (
            <DropdownMenuRadioItem key={field} value={field}>
              {tSort(field)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center md:justify-between">
      <div className="flex min-w-0 flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center">
        <SearchField
          ref={searchRef}
          label={t('searchLabel')}
          placeholder={t('searchPlaceholder')}
          value={text}
          onChange={(event) => {
            setText(event.currentTarget.value);
            onSearchChange(event.currentTarget.value);
          }}
          className="md:w-72"
        />
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
        <div className="flex flex-wrap items-center gap-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {/* A menu opener, not a toggle: the chosen group is in its name. */}
              <FilterPill
                menu
                className={cn(groupId && 'border-primary')}
                label={selectedGroup ? t('groupValue', { name: selectedGroup.label }) : t('group')}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup
                value={groupId ?? ALL_GROUPS}
                onValueChange={(next) => onGroupChange(next === ALL_GROUPS ? undefined : next)}
              >
                <DropdownMenuRadioItem value={ALL_GROUPS}>{t('groupAll')}</DropdownMenuRadioItem>
                {groupOptions.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <FilterPill
            label={t('lowCredits')}
            icon={<SlidersHorizontalIcon />}
            disabled
            title={t('comingSoon')}
            className="hidden md:inline-flex"
          />

          {sortMenu('md:hidden')}

          {filtered ? (
            <Button type="button" variant="ghost" onClick={onReset}>
              <XIcon data-icon="inline-start" />
              {t('reset')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="hidden flex-wrap items-center gap-2.5 md:flex">
        {sortMenu('')}
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
  );
}
