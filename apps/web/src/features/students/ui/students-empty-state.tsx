'use client';

import Link from 'next/link';
import { PlusIcon, SearchIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AVATAR_KEYS } from '@tutorio/validation';
import { EmptyState } from '@/components/shared/empty-state';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { Button } from '@/components/ui/button';

/**
 * The empty collection. A workspace without students gets the avatar stack
 * and the one command it needs; a filter that matches nobody offers to clear
 * itself and never claims the workspace is empty.
 */
export function StudentsEmptyState({
  filtered,
  onClearFilters,
}: {
  filtered: boolean;
  onClearFilters: () => void;
}) {
  const t = useTranslations('students');
  const tFilters = useTranslations('filters');

  if (filtered) {
    return (
      <EmptyState
        icon={<SearchIcon />}
        title={t('emptyFiltered.title')}
        text={t('emptyFiltered.description')}
        action={
          <Button type="button" variant="outline" onClick={onClearFilters}>
            {tFilters('clear')}
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      pattern
      framed={false}
      minHeight={520}
      media={
        <div aria-hidden="true" className="flex items-center -space-x-2.5">
          {AVATAR_KEYS.slice(2, 6).map((key) => (
            <EntityAvatar
              key={key}
              avatarKey={key}
              fullName=""
              className="size-14 ring-4 ring-card"
            />
          ))}
          <span className="relative flex size-14 items-center justify-center rounded-pill bg-brand-soft text-brand-soft-foreground ring-4 ring-card">
            <PlusIcon className="size-6" />
          </span>
        </div>
      }
      title={
        <span className="text-[28px] leading-[34px] tracking-[-0.02em]">{t('empty.title')}</span>
      }
      text={t('empty.description')}
      action={
        <Button asChild leading={<PlusIcon />}>
          <Link href="/app/students/new">{t('empty.action')}</Link>
        </Button>
      }
    />
  );
}
