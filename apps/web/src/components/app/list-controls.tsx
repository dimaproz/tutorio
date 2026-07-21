'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Search, state filter and pagination all write to the URL, so a list view is
// shareable and the browser back button behaves as users expect.

function useUpdateSearchParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (updates: Record<string, string | undefined>, options?: { resetPage?: boolean }) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === '') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    if (options?.resetPage) {
      next.delete('page');
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
}

export function ListSearchInput({ label, placeholder }: { label: string; placeholder: string }) {
  const searchParams = useSearchParams();
  const updateParams = useUpdateSearchParams();
  const urlSearch = searchParams.get('search') ?? '';
  const [value, setValue] = useState(urlSearch);
  const [syncedSearch, setSyncedSearch] = useState(urlSearch);

  // Keep the field in sync when the URL changes from elsewhere (back button,
  // filter reset) without fighting the user while they type. Adjusting state
  // during render is the supported pattern here — an effect would cause an
  // extra render pass.
  if (urlSearch !== syncedSearch) {
    setSyncedSearch(urlSearch);
    setValue(urlSearch);
  }

  useEffect(() => {
    if (value === urlSearch) {
      return;
    }
    const timeout = setTimeout(() => {
      updateParams({ search: value.trim() || undefined }, { resetPage: true });
    }, 300);
    return () => clearTimeout(timeout);
    // updateParams is recreated per render; the debounce only depends on input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, urlSearch]);

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
          className="w-[150px] data-[size=default]:h-11 md:data-[size=default]:h-8"
          aria-label={t('state')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="active">{t('stateActive')}</SelectItem>
            <SelectItem value="deleted">{t('stateDeleted')}</SelectItem>
            <SelectItem value="all">{t('stateAll')}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
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
    <Pagination aria-label={t('label')}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            aria-disabled={page <= 1}
            className={page <= 1 ? 'pointer-events-none opacity-50' : undefined}
            onClick={(event) => {
              event.preventDefault();
              if (page > 1) {
                goTo(page - 1);
              }
            }}
          >
            {t('previous')}
          </PaginationPrevious>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#" aria-current="page" onClick={(event) => event.preventDefault()}>
            {t('summary', { page, totalPages })}
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationNext
            href="#"
            aria-disabled={page >= totalPages}
            className={page >= totalPages ? 'pointer-events-none opacity-50' : undefined}
            onClick={(event) => {
              event.preventDefault();
              if (page < totalPages) {
                goTo(page + 1);
              }
            }}
          >
            {t('next')}
          </PaginationNext>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
