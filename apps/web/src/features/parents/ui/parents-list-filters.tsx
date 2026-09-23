'use client';

import type { Ref } from 'react';
import { ArrowUpDownIcon, ListFilterIcon, XIcon } from 'lucide-react';
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
import { useUrlSearchText } from '@/hooks/use-url-search-text';
import { cn } from '@/lib/utils';

/** Name A–Z, or the newest record first. */
export const PARENT_SORT_FIELDS = ['fullName', 'createdAt'] as const;
export type ParentSortField = (typeof PARENT_SORT_FIELDS)[number];

/**
 * The collection control row: search, the student filter, the "no students"
 * toggle and the sort. Both filters and the sort are answered by the API, so
 * they hold on every page of a paginated list. The search text follows the
 * URL, so a command that clears the search clears the field too.
 */
export function ParentsListFilters({
  search,
  searchRef,
  studentId,
  studentName,
  studentOptions,
  studentsLoading = false,
  unlinked,
  sort,
  onSearchChange,
  onStudentChange,
  onUnlinkedChange,
  onSortChange,
  onReset,
}: {
  search?: string;
  searchRef?: Ref<HTMLInputElement>;
  studentId?: string;
  /** The filtered student's name, when known. */
  studentName?: string;
  studentOptions: EntityPickerOption[];
  studentsLoading?: boolean;
  unlinked: boolean;
  sort: ParentSortField;
  onSearchChange: (next: string) => void;
  onStudentChange: (next?: string) => void;
  onUnlinkedChange: (next: boolean) => void;
  onSortChange: (next: ParentSortField) => void;
  onReset: () => void;
}) {
  const t = useTranslations('parents');
  // The field answers every key; the URL, and so the query, once typing pauses.
  const [text, setText] = useUrlSearchText(search, onSearchChange);

  return (
    <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center md:justify-between">
      <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center">
        <SearchField
          ref={searchRef}
          label={t('searchLabel')}
          placeholder={t('searchPlaceholder')}
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
          className="md:w-110"
        />
        <div className="flex flex-wrap items-center gap-2.5">
          <EntityPicker
            aria-label={t('filters.student')}
            value={studentId}
            onChange={onStudentChange}
            options={studentOptions}
            placeholder={t('filters.student')}
            clearLabel={t('filters.allStudents')}
            searchPlaceholder={t('filters.studentSearch')}
            emptyLabel={t('filters.studentEmpty')}
            isLoading={studentsLoading}
            trigger={
              // A menu opener, not a toggle: the chosen name is in the label.
              <FilterPill
                menu
                className={cn(studentId && 'border-primary')}
                label={
                  studentId && studentName ? (
                    t('filters.studentValue', { name: studentName })
                  ) : (
                    <>
                      <span className="md:hidden">{t('filters.allStudents')}</span>
                      <span className="hidden md:inline">{t('filters.student')}</span>
                    </>
                  )
                }
              />
            }
          />
          <FilterPill
            icon={<ListFilterIcon />}
            label={t('filters.noStudents')}
            pressed={unlinked}
            onClick={() => onUnlinkedChange(!unlinked)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <FilterPill
                className="md:hidden"
                icon={<ArrowUpDownIcon />}
                label={t(`sort.${sort}`)}
                aria-label={t('sort.current', { value: t(`sort.${sort}`) })}
              />
            </DropdownMenuTrigger>
            <SortMenu sort={sort} onSortChange={onSortChange} />
          </DropdownMenu>
          {studentId || unlinked ? (
            <Button type="button" variant="ghost" onClick={onReset}>
              <XIcon data-icon="inline-start" />
              {t('filters.reset')}
            </Button>
          ) : null}
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <FilterPill
            className="hidden md:inline-flex"
            icon={<ArrowUpDownIcon />}
            label={t(`sort.${sort}`)}
            aria-label={t('sort.current', { value: t(`sort.${sort}`) })}
          />
        </DropdownMenuTrigger>
        <SortMenu sort={sort} onSortChange={onSortChange} />
      </DropdownMenu>
    </div>
  );
}

/** The sort choices, with the current one checked. */
function SortMenu({
  sort,
  onSortChange,
}: {
  sort: ParentSortField;
  onSortChange: (next: ParentSortField) => void;
}) {
  const t = useTranslations('parents.sort');
  return (
    <DropdownMenuContent align="end">
      <DropdownMenuRadioGroup
        value={sort}
        onValueChange={(next) => onSortChange(next as ParentSortField)}
      >
        {PARENT_SORT_FIELDS.map((field) => (
          <DropdownMenuRadioItem key={field} value={field}>
            {t(field)}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  );
}
