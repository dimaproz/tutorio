'use client';

import type { Ref } from 'react';
import {
  ArrowUpDownIcon,
  BookOpenIcon,
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
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FilterPill } from '@/components/shared/filter-pill';
import { IconButton } from '@/components/shared/icon-button';
import { SearchField } from '@/components/shared/search-field';
import { Segmented } from '@/components/shared/segmented';
import { useUrlSearchText } from '@/hooks/use-url-search-text';
import { cn } from '@/lib/utils';

export const TEACHER_TABS = ['active', 'archived', 'all'] as const;
export type TeacherTab = (typeof TEACHER_TABS)[number];

export const TEACHER_SORTS = ['workload', 'name', 'created'] as const;
export type TeacherSort = (typeof TEACHER_SORTS)[number];

export const TEACHER_VIEWS = ['rows', 'grid'] as const;
export type TeachersView = (typeof TEACHER_VIEWS)[number];

/** Radix radio groups cannot hold an empty value, so "any subject" has a token. */
const ANY = '__any';

/**
 * The collection controls, one set for every width, reordered by it: on a
 * desktop the status tabs, «Предмет» and the search, then the sort and the
 * table/cards switch; on a tablet (the S09 board) the tabs with the sort, then
 * the search with «Предмет»; on a phone the tabs, then the search with a
 * filters button holding the subject and the sort. Cards are the only view
 * below a desktop (`lg`), so the switch shows there only.
 */
export function TeachersListFilters({
  tab,
  counts,
  search,
  searchRef,
  subject,
  subjects,
  sort,
  view,
  onTabChange,
  onSearchChange,
  onSubjectChange,
  onSortChange,
  onViewChange,
}: {
  tab: TeacherTab;
  counts?: Record<TeacherTab, number>;
  search?: string;
  searchRef?: Ref<HTMLInputElement>;
  subject?: string;
  subjects: readonly string[];
  sort: TeacherSort;
  view: TeachersView;
  onTabChange: (next: TeacherTab) => void;
  onSearchChange: (next: string) => void;
  onSubjectChange: (next?: string) => void;
  onSortChange: (next: TeacherSort) => void;
  onViewChange: (next: TeachersView) => void;
}) {
  const t = useTranslations('teachers');
  const [text, setText] = useUrlSearchText(search, onSearchChange);

  const subjectItems = (
    <DropdownMenuRadioGroup
      value={subject ?? ANY}
      onValueChange={(next) => onSubjectChange(next === ANY ? undefined : next)}
    >
      <DropdownMenuRadioItem value={ANY}>{t('filters.subjectAll')}</DropdownMenuRadioItem>
      {subjects.map((item) => (
        <DropdownMenuRadioItem key={item} value={item}>
          {item}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
  const sortItems = (
    <DropdownMenuRadioGroup
      value={sort}
      onValueChange={(next) => onSortChange(next as TeacherSort)}
    >
      {TEACHER_SORTS.map((field) => (
        <DropdownMenuRadioItem key={field} value={field}>
          {t(`sort.${field}`)}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* A facet filter, not a tab set: it switches the query, not a panel. */}
      <div className="no-scrollbar order-1 -mx-4 max-w-[100vw] overflow-x-auto px-4 max-md:w-full md:mx-0 md:max-w-full md:px-0">
        <Segmented
          label={t('tabsLabel')}
          value={tab}
          onValueChange={onTabChange}
          items={TEACHER_TABS.map((item) => ({
            value: item,
            label: t(`tabs.${item}`),
            count: counts?.[item],
          }))}
        />
      </div>

      <SearchField
        ref={searchRef}
        label={t('searchLabel')}
        placeholder={t('searchPlaceholder')}
        value={text}
        onChange={(event) => setText(event.currentTarget.value)}
        className="order-3 max-md:w-auto max-md:grow md:w-auto md:grow lg:w-80 lg:grow-0"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton
            icon={<SlidersHorizontalIcon />}
            label={t('filters.label')}
            border
            indicator={Boolean(subject)}
            className="order-4 md:hidden"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-60">
          <DropdownMenuLabel>{t('filters.subject')}</DropdownMenuLabel>
          {subjectItems}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t('sort.label')}</DropdownMenuLabel>
          {sortItems}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* A menu opener, not a toggle: the chosen subject is in its name. */}
          <FilterPill
            menu
            icon={<BookOpenIcon />}
            className={cn('order-4 hidden md:inline-flex lg:order-2', subject && 'border-primary')}
            label={subject ? t('filters.subjectValue', { name: subject }) : t('filters.subject')}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">{subjectItems}</DropdownMenuContent>
      </DropdownMenu>

      {subject ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => onSubjectChange(undefined)}
          className="order-4 hidden md:inline-flex"
        >
          <XIcon data-icon="inline-start" />
          {t('filters.reset')}
        </Button>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <FilterPill
            menu
            icon={<ArrowUpDownIcon />}
            className="order-2 ml-auto hidden md:inline-flex lg:order-5"
            label={t(`sort.${sort}`)}
            aria-label={t('sort.current', { value: t(`sort.${sort}`) })}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">{sortItems}</DropdownMenuContent>
      </DropdownMenu>

      <Segmented
        label={t('filters.view')}
        value={view}
        onValueChange={onViewChange}
        className="order-6 hidden lg:inline-flex"
        items={[
          { value: 'rows', icon: <ListIcon />, ariaLabel: t('filters.viewList') },
          { value: 'grid', icon: <LayoutGridIcon />, ariaLabel: t('filters.viewGrid') },
        ]}
      />
    </div>
  );
}
