'use client';

import { ArrowUpDownIcon, ListFilterIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EntityPicker, type EntityPickerOption } from '@/components/shared/entity-picker';
import { FilterPill } from '@/components/shared/filter-pill';
import { SearchField } from '@/components/shared/search-field';

/** Name A–Z, or the newest record first. */
export const PARENT_SORT_FIELDS = ['fullName', 'createdAt'] as const;
export type ParentSortField = (typeof PARENT_SORT_FIELDS)[number];

/**
 * The collection control row: search, the student filter, the "no students"
 * toggle and the name sort. Both filters and the sort are answered by the
 * API, so they hold on every page of a paginated list.
 */
export function ParentsListFilters({
  search,
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

  return (
    <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center md:justify-between">
      <div className="flex flex-col gap-2.5 md:flex-row md:flex-wrap md:items-center">
        <SearchField
          label={t('searchLabel')}
          placeholder={t('searchPlaceholder')}
          defaultValue={search ?? ''}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
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
              <FilterPill
                menu
                pressed={Boolean(studentId)}
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
            aria-label={`${t('sort.label')}: ${t(`sort.${sort}`)}`}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            {PARENT_SORT_FIELDS.map((field) => (
              <DropdownMenuItem key={field} onSelect={() => onSortChange(field)}>
                {t(`sort.${field}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
