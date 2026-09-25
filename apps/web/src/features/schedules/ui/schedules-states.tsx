'use client';

import {
  AlertCircleIcon,
  PlusIcon,
  RepeatIcon,
  RotateCcwIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { schedulesRowLayout } from './schedules-columns';

/** A studio with no schedule yet (S05 board 06). */
export function SchedulesEmpty({ onNew }: { onNew: () => void }) {
  const t = useTranslations('schedules.empty');
  return (
    <div className="rounded-card bg-card">
      <EmptyState
        framed={false}
        minHeight={0}
        icon={<RepeatIcon />}
        title={t('title')}
        text={t('text')}
        action={
          <Button type="button" onClick={onNew}>
            <PlusIcon data-icon="inline-start" />
            {t('new')}
          </Button>
        }
        className="py-12"
      />
    </div>
  );
}

/** Nothing matches (S05 board 05). */
export function SchedulesNoResults({ summary, onReset }: { summary: string; onReset: () => void }) {
  const t = useTranslations('schedules.noResults');
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

/** The failed read (S05 board 08). */
export function SchedulesError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const t = useTranslations('schedules.error');
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

/** The first load (S05 board 07): rows shaped like the table, cards on phones. */
export function SchedulesSkeleton({ label, solo }: { label: string; solo: boolean }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="flex flex-col gap-3 md:hidden" aria-hidden="true">
        {ROWS.slice(0, 3).map((_, index) => (
          <div key={index} className="flex flex-col gap-3 rounded-card bg-card p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-pill" />
              <div className="flex grow flex-col gap-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3.5 w-44" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded-item" />
              <Skeleton className="h-8 w-24 rounded-item" />
            </div>
          </div>
        ))}
      </div>
      <div className="hidden rounded-card bg-card p-2 md:block" aria-hidden="true">
        <div className="mx-4 mt-3 mb-2 h-4 border-b border-border" />
        {ROWS.map((_, index) => (
          <div
            key={index}
            className="grid h-24 items-center gap-4 px-4"
            style={{ gridTemplateColumns: schedulesRowLayout(solo) }}
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-pill" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            {solo ? null : <Skeleton className="h-4 w-28" />}
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded-item" />
              <Skeleton className="h-8 w-24 rounded-item" />
            </div>
            <Skeleton className="h-6 w-28 rounded-pill" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <span />
          </div>
        ))}
      </div>
    </div>
  );
}
