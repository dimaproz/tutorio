'use client';

import Link from 'next/link';
import { HeartIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';

/**
 * The empty collection, in its three shapes. A workspace without parents gets
 * the one command it needs; a search that matches nobody offers to clear the
 * search, never a second create; a filter that matches nobody resets itself.
 * None of the filtered shapes claims the workspace is empty.
 */
export function ParentsEmptyState({
  search,
  filtered,
  onClearSearch,
  onResetFilters,
}: {
  search?: string;
  filtered: boolean;
  onClearSearch: () => void;
  onResetFilters: () => void;
}) {
  const t = useTranslations('parents');

  if (search) {
    return (
      <EmptyState
        icon={<SearchIcon />}
        title={t('emptySearch.title')}
        text={t('emptySearch.description', { query: search })}
        minHeight={500}
        action={
          <Button type="button" variant="outline" onClick={onClearSearch}>
            <XIcon data-icon="inline-start" />
            {t('filters.clearSearch')}
          </Button>
        }
      />
    );
  }

  if (filtered) {
    return (
      <EmptyState
        icon={<SearchIcon />}
        title={t('emptyFiltered.title')}
        text={t('emptyFiltered.description')}
        minHeight={500}
        action={
          <Button type="button" variant="outline" onClick={onResetFilters}>
            <XIcon data-icon="inline-start" />
            {t('emptyFiltered.action')}
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      icon={<HeartIcon />}
      title={t('empty.title')}
      text={t('empty.description')}
      minHeight={500}
      action={
        <Button asChild leading={<PlusIcon />}>
          <Link href="/app/parents/new">{t('empty.action')}</Link>
        </Button>
      }
    />
  );
}
