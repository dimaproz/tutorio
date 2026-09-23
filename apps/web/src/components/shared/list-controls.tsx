'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArchiveIcon, CircleCheckIcon, LayersIcon, SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusRow } from '@/components/shared/status-select';
import { useUrlSearchText } from '@/hooks/use-url-search-text';
import { buildPageSlots, PAGE_ELLIPSIS } from '@/lib/pagination';
import type { StatusIcon, StatusTone } from '@/components/shared/status-meta';

// Search, state filter and pagination all write to the URL, so a list view is
// shareable and the browser back button behaves as users expect.

export function useUpdateSearchParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (updates: Record<string, string | undefined>, options?: { resetPage?: boolean }) => {
    const write = planSearchParamsWrite({
      pathname,
      rendered: searchParams,
      location: typeof window === 'undefined' ? undefined : window.location,
      updates,
      resetPage: options?.resetPage,
    });
    if (write.native) {
      // The page reads its filters on the client, so there is nothing for the
      // server to render: native history keeps useSearchParams in sync
      // without an RSC request.
      window.history.replaceState(null, '', write.href);
    } else {
      router.replace(write.href, { scroll: false });
    }
  };
}

/**
 * Where a collection-control update writes. While the page on screen is the
 * one that rendered the control, the live URL is the base (an update renders
 * in a transition, so two quick updates must not both start from the params
 * the last render saw) and native history takes the write. Anywhere else —
 * a navigation in flight, a mocked router — the router does, as before.
 */
export function planSearchParamsWrite({
  pathname,
  rendered,
  location,
  updates,
  resetPage = false,
}: {
  pathname: string;
  rendered: URLSearchParams;
  location?: { pathname: string; search: string };
  updates: Record<string, string | undefined>;
  resetPage?: boolean;
}): { href: string; native: boolean } {
  const native = location !== undefined && location.pathname === pathname;
  const base = native ? new URLSearchParams(location.search) : rendered;
  const query = buildUpdatedSearchParams(base, updates, resetPage).toString();
  return { href: query ? `${pathname}?${query}` : pathname, native };
}

/** Applies URL-backed collection controls without mutating the current query. */
export function buildUpdatedSearchParams(
  current: URLSearchParams,
  updates: Record<string, string | undefined>,
  resetPage = false,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === '') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }
  if (resetPage) {
    next.delete('page');
  }
  return next;
}

export function ListSearchInput({ label, placeholder }: { label: string; placeholder: string }) {
  const searchParams = useSearchParams();
  const updateParams = useUpdateSearchParams();
  // The field follows the URL (back button, filter reset) and writes to it
  // once typing pauses.
  const [value, setValue] = useUrlSearchText(
    searchParams.get('search')?.trim() || undefined,
    (next) => updateParams({ search: next.trim() || undefined }, { resetPage: true }),
  );

  return (
    <div className="flex-1 sm:max-w-xs">
      <Label htmlFor="list-search" className="sr-only">
        {label}
      </Label>
      {/* Comfortable ~44px touch target on phones, compact on desktop. */}
      <InputGroup className="h-11 md:h-9">
        <InputGroupAddon>
          <SearchIcon aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          id="list-search"
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
        />
      </InputGroup>
    </div>
  );
}

export function ListStateFilter({ value }: { value: 'active' | 'deleted' | 'all' }) {
  const t = useTranslations('filters');
  const updateParams = useUpdateSearchParams();
  const options = [
    { value: 'active', label: t('stateActive'), icon: CircleCheckIcon, tone: 'primary' },
    { value: 'deleted', label: t('stateDeleted'), icon: ArchiveIcon, tone: 'secondary' },
    { value: 'all', label: t('stateAll'), icon: LayersIcon, tone: 'neutral' },
  ] satisfies Array<{
    value: 'active' | 'deleted' | 'all';
    label: string;
    icon: StatusIcon;
    tone: StatusTone;
  }>;

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="list-state" className="sr-only">
        {t('state')}
      </Label>
      <Select
        value={value}
        onValueChange={(next) =>
          updateParams({ state: next === 'active' ? undefined : next }, { resetPage: true })
        }
      >
        {/* The base trigger sets its height through a data-attribute variant,
            so the responsive override has to match that specificity. */}
        <SelectTrigger
          id="list-state"
          className="w-[150px] data-[size=default]:h-11 md:data-[size=default]:h-9"
          aria-label={t('state')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <StatusRow icon={option.icon} tone={option.tone} label={option.label} />
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

// Generic URL-param facet filter: a select whose first option clears the
// param. Reused for student status/group and any future facet.
const ALL = '__all__';

export interface ListFilterOption {
  value: string;
  label: string;
  /** Lifecycle facets carry the same icon + role as their badge and picker. */
  icon?: StatusIcon;
  tone?: StatusTone;
}

export function ListSelectFilter({
  paramKey,
  value,
  options,
  label,
}: {
  paramKey: string;
  value?: string;
  options: ListFilterOption[];
  /** Shown as the "no filter" option and the accessible name. */
  label: string;
}) {
  const updateParams = useUpdateSearchParams();

  return (
    <Select
      value={value ?? ALL}
      onValueChange={(next) =>
        updateParams({ [paramKey]: next === ALL ? undefined : next }, { resetPage: true })
      }
    >
      <SelectTrigger
        className="w-[170px] data-[size=default]:h-11 md:data-[size=default]:h-9"
        aria-label={label}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={ALL}>{label}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.icon ? (
                <StatusRow
                  icon={option.icon}
                  tone={option.tone ?? 'neutral'}
                  label={option.label}
                />
              ) : (
                option.label
              )}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export type SortOrder = 'asc' | 'desc';

export interface ListSort {
  field?: string;
  order: SortOrder;
  /** Toggles direction on the active column, otherwise switches column. */
  onSort: (field: string) => void;
}

/**
 * Column sorting held in the URL like every other list filter, so a sorted
 * view is shareable and survives the back button. The server owns the actual
 * ordering — the table only reports which column was clicked.
 */
export function useListSort(defaultField: string): ListSort {
  const searchParams = useSearchParams();
  const updateParams = useUpdateSearchParams();
  const field = searchParams.get('sort') ?? defaultField;
  const order: SortOrder = searchParams.get('order') === 'desc' ? 'desc' : 'asc';

  return {
    field,
    order,
    onSort: (next: string) => {
      const nextOrder: SortOrder = next === field && order === 'asc' ? 'desc' : 'asc';
      updateParams(
        {
          sort: next === defaultField && nextOrder === 'asc' ? undefined : next,
          order: nextOrder === 'asc' ? undefined : nextOrder,
        },
        { resetPage: true },
      );
    },
  };
}

/**
 * Sorting for a table whose rows are already in memory (a detail-page card,
 * an in-dialog list). Same shape as {@link useListSort} so `DataTable` cannot
 * tell the two apart — only the ordering itself is done by the caller.
 */
export function useLocalSort(defaultField: string, defaultOrder: SortOrder = 'asc'): ListSort {
  const [state, setState] = useState({ field: defaultField, order: defaultOrder });

  return {
    field: state.field,
    order: state.order,
    onSort: (next: string) =>
      setState((prev) => ({
        field: next,
        order: prev.field === next && prev.order === 'asc' ? 'desc' : 'asc',
      })),
  };
}

export function ListPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  /** Set for views that page in local state instead of the URL (audit log). */
  onPageChange?: (page: number) => void;
}) {
  const t = useTranslations('pagination');
  const updateParams = useUpdateSearchParams();

  if (totalPages <= 1) {
    return null;
  }

  const goTo = (target: number) => {
    if (onPageChange) {
      onPageChange(target);
      return;
    }
    updateParams({ page: target === 1 ? undefined : String(target) });
  };

  return (
    <Pagination aria-label={t('label')} className="mx-0 w-auto justify-end">
      {/* Round page numbers only. Previous and Next were a second way to do
          what the numbers already do, and they crowded a narrow footer. */}
      <PaginationContent className="gap-1">
        {buildPageSlots(page, totalPages).map((slot, index) =>
          slot === PAGE_ELLIPSIS ? (
            <PaginationItem key={`gap-${index}`}>
              <PaginationEllipsis className="size-9" />
            </PaginationItem>
          ) : (
            <PaginationItem key={slot}>
              <PaginationLink
                href="#"
                isActive={slot === page}
                aria-label={t('goToPage', { page: slot })}
                onClick={(event) => {
                  event.preventDefault();
                  goTo(slot);
                }}
              >
                {slot}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
      </PaginationContent>
    </Pagination>
  );
}
