'use client';

import Link from 'next/link';
import {
  AlertCircleIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { lessonsRowLayout } from './lessons-columns';

/** A studio with no lessons yet (S04 board 11): open the calendar or book one. */
export function LessonsEmpty({ onNew }: { onNew: () => void }) {
  const t = useTranslations('lessonList.empty');
  return (
    <div className="rounded-card bg-card">
      <EmptyState
        framed={false}
        minHeight={0}
        icon={<ClipboardListIcon />}
        title={t('title')}
        text={
          <>
            <span className="md:hidden">{t('textShort')}</span>
            <span className="hidden md:inline">{t('text')}</span>
          </>
        }
        action={
          <div className="flex flex-wrap justify-center gap-2.5">
            <Button asChild variant="outline">
              <Link href="/app/calendar">
                <CalendarDaysIcon data-icon="inline-start" />
                {t('openCalendar')}
              </Link>
            </Button>
            <Button type="button" onClick={onNew}>
              <PlusIcon data-icon="inline-start" />
              {t('newLesson')}
            </Button>
          </div>
        }
        className="py-12"
      />
    </div>
  );
}

/** Nothing matches (S04 board 10): what was asked for, and «Скинути фільтри». */
export function LessonsNoResults({ summary, onReset }: { summary: string; onReset: () => void }) {
  const t = useTranslations('lessonList.noResults');
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

/** The failed read (S04 board 13). */
export function LessonsError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  const t = useTranslations('lessonList.error');
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

/** The first load (S04 board 12): rows shaped like the table, cards on phones. */
export function LessonsSkeleton({ label, solo }: { label: string; solo: boolean }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="flex flex-col gap-3 md:hidden" aria-hidden="true">
        {ROWS.slice(0, 3).map((_, index) => (
          <div key={index} className="flex flex-col gap-3 rounded-card bg-card p-4">
            <div className="flex items-center gap-3.5">
              <Skeleton className="size-13 rounded-tile" />
              <div className="flex grow flex-col gap-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3.5 w-48" />
              </div>
            </div>
            <Skeleton className="h-6 w-28 rounded-pill" />
          </div>
        ))}
      </div>
      <div className="hidden rounded-card bg-card p-2 md:block" aria-hidden="true">
        <div className="mx-4 mt-3 mb-2 h-4 border-b border-border" />
        {ROWS.map((_, index) => (
          <div
            key={index}
            className="grid h-19 items-center gap-4 px-4"
            style={{ gridTemplateColumns: lessonsRowLayout(solo) }}
          >
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-pill" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            {solo ? null : <Skeleton className="h-4 w-28" />}
            <Skeleton className="h-6 w-28 rounded-pill" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-14" />
            <span />
          </div>
        ))}
      </div>
    </div>
  );
}
