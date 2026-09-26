'use client';

import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { CalendarDaysIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LessonNowLine, LessonTimeRowSkeleton } from '@/components/shared/lesson-time-row';
import { cn } from '@/lib/utils';
import { BlockError } from './block-error';

/**
 * One day's lessons as a timeline (S11 decision 2): the title with its count,
 * «Календар», and the rows in time order with the red «зараз» line after
 * the ones that have started. On desktop the day sits in a card; on phones
 * its dense rows sit on the page.
 */
export function DaySection({
  title,
  meta,
  calendarHref,
  rows,
  nowLine,
  dense,
  loading = false,
  error = false,
  onRetry,
}: {
  title: string;
  meta?: string;
  calendarHref: string;
  rows: { key: string; row: ReactNode }[];
  /** The line's label and how many rows come before it. */
  nowLine?: { label: string; after: number };
  dense: boolean;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  const t = useTranslations('today.day');

  let list: ReactNode;
  if (error) {
    list = <BlockError onRetry={onRetry ?? (() => undefined)} />;
  } else if (loading) {
    list = [0, 1, 2, 3, 4].map((row) => <LessonTimeRowSkeleton key={row} dense={dense} />);
  } else {
    list = rows.map(({ key, row }, index) => (
      <Fragment key={key}>
        {nowLine && nowLine.after === index ? <LessonNowLine label={nowLine.label} /> : null}
        {row}
      </Fragment>
    ));
    if (nowLine && nowLine.after >= rows.length && rows.length > 0) {
      list = (
        <>
          {list}
          <LessonNowLine label={nowLine.label} />
        </>
      );
    }
  }

  const head = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-baseline gap-2.5">
        <h2 className={cn('font-semibold', dense ? 'text-[22px] leading-7' : 'text-lg leading-6')}>
          {title}
        </h2>
        {meta && !dense ? (
          <span className="truncate text-[13px] text-muted-foreground">{meta}</span>
        ) : null}
      </div>
      {dense ? (
        meta ? (
          <span className="shrink-0 text-sm text-muted-foreground">{meta}</span>
        ) : null
      ) : (
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href={calendarHref}>
            <CalendarDaysIcon data-icon="inline-start" />
            {t('calendar')}
          </Link>
        </Button>
      )}
    </div>
  );

  const body = <div className="flex flex-col gap-2">{list}</div>;

  return dense ? (
    <section aria-busy={loading || undefined} className="flex flex-col gap-3">
      <div className="px-1">{head}</div>
      {body}
    </section>
  ) : (
    <Card aria-busy={loading || undefined} className="gap-3 px-4.5 pt-5 pb-3.5">
      {head}
      {body}
    </Card>
  );
}
