'use client';

import Link from 'next/link';
import {
  AlertCircleIcon,
  PackageIcon,
  RotateCcwIcon,
  SearchIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { PACKAGES_ROW_LAYOUT } from './packages-columns';

/** A studio with no package yet (board 04, state 05). */
export function PackagesEmpty() {
  const t = useTranslations('packages.list.empty');
  return (
    <div className="rounded-card bg-card">
      <EmptyState
        framed={false}
        minHeight={0}
        icon={<PackageIcon />}
        title={t('title')}
        text={t('text')}
        action={
          <Button asChild variant="outline">
            <Link href="/app/students">
              <UsersIcon data-icon="inline-start" />
              {t('students')}
            </Link>
          </Button>
        }
        className="py-12"
      />
    </div>
  );
}

/** Nothing matches the tab and filters. */
export function PackagesNoResults({ summary, onReset }: { summary: string; onReset: () => void }) {
  const t = useTranslations('packages.list.noResults');
  return (
    <div className="rounded-card bg-card">
      <EmptyState
        framed={false}
        minHeight={0}
        icon={<SearchIcon />}
        title={t('title')}
        text={summary ? t('textWith', { summary }) : t('text')}
        action={
          <Button type="button" variant="outline" onClick={onReset}>
            <XIcon data-icon="inline-start" />
            {t('reset')}
          </Button>
        }
        className="py-12"
      />
    </div>
  );
}

/** The failed read. */
export function PackagesError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const t = useTranslations('packages.list.error');
  return (
    <div role="alert" className="rounded-card bg-card">
      <EmptyState
        framed={false}
        minHeight={0}
        media={
          <span
            aria-hidden="true"
            className="flex size-14 items-center justify-center rounded-tile bg-tint-danger text-tint-danger-foreground [&_svg]:size-6"
          >
            <AlertCircleIcon />
          </span>
        }
        title={t('title')}
        text={t('text')}
        action={
          <Button type="button" disabled={retrying} onClick={onRetry}>
            <RotateCcwIcon data-icon="inline-start" />
            {t('retry')}
          </Button>
        }
        className="py-12"
      />
    </div>
  );
}

const ROWS = Array.from({ length: 6 });

/** The first load: rows shaped like the table, cards on phones. */
export function PackagesSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="flex flex-col gap-3 md:hidden" aria-hidden="true">
        {ROWS.slice(0, 3).map((_, index) => (
          <div key={index} className="flex flex-col gap-3 rounded-card bg-card p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-pill" />
              <div className="flex grow flex-col gap-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3.5 w-44" />
              </div>
            </div>
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3.5 w-24" />
          </div>
        ))}
      </div>
      <div className="hidden rounded-card bg-card p-2 md:block" aria-hidden="true">
        <div className="mx-4 mt-3 mb-2 h-4 border-b border-border" />
        {ROWS.map((_, index) => (
          <div
            key={index}
            className="grid h-19 items-center gap-4 px-4"
            style={{ gridTemplateColumns: PACKAGES_ROW_LAYOUT }}
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-pill" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="ml-auto h-4 w-14" />
            <span />
          </div>
        ))}
      </div>
    </div>
  );
}
