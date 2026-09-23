'use client';

import Link from 'next/link';
import { ArchiveIcon, LayersIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';

/**
 * The empty collection, in its four shapes. A workspace without groups gets
 * the one command it needs; a search that matches nothing offers to clear
 * the search — a secondary button with an ✕, never a second create; filters
 * that match nothing reset themselves; an empty archive only explains.
 */
export function GroupsEmptyState({
  search,
  filtered,
  archive,
  onClearSearch,
  onResetFilters,
}: {
  search?: string;
  filtered: boolean;
  archive: boolean;
  onClearSearch: () => void;
  onResetFilters: () => void;
}) {
  const t = useTranslations('groups');

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
            {t('emptySearch.clear')}
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
            {t('emptyFiltered.reset')}
          </Button>
        }
      />
    );
  }

  if (archive) {
    return (
      <EmptyState
        icon={<ArchiveIcon />}
        title={t('emptyArchive.title')}
        text={t('emptyArchive.description')}
        minHeight={500}
      />
    );
  }

  return (
    <EmptyState
      icon={<LayersIcon />}
      title={t('empty.title')}
      text={t('empty.description')}
      minHeight={500}
      action={
        <Button asChild leading={<PlusIcon />}>
          <Link href="/app/groups/new">{t('empty.action')}</Link>
        </Button>
      }
    />
  );
}
