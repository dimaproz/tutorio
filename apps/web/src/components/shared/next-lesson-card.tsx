import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ArchiveArt, EmptyArt, PauseArt } from '@/components/shared/next-lesson-art';
import { cn } from '@/lib/utils';

const ART = { empty: EmptyArt, pause: PauseArt, archive: ArchiveArt } as const;

export type NextLessonArt = keyof typeof ART;

/** How far a running lesson has got; every string is the caller's copy. */
export type NextLessonProgress = {
  /** Elapsed minutes, clamped to `total`. */
  value: number;
  total: number;
  /** Start and end times under the bar, e.g. "18:00" and "19:30". */
  start: string;
  end: string;
  /** The elapsed caption, e.g. "65 of 90 min"; also the bar's spoken value. */
  label: string;
  /** Accessible name of the bar, e.g. "Lesson progress". */
  name: string;
};

/**
 * The "next lesson" highlight ticket. Shows the next scheduled lesson with its two
 * commands, or an empty state. A lesson under way passes `progress`: the chip
 * turns live, `date` carries the end ("until 19:30") and a bar shows how
 * much of it has passed. The empty state either offers an action or,
 * where the action already lives elsewhere on the page, shows an illustration
 * of why nothing is planned: a fresh calendar, a pause, or the archive.
 * Every string is supplied by the caller.
 */
export function NextLessonCard({
  heading,
  relative,
  date,
  time,
  teacher,
  primaryAction,
  secondaryAction,
  emptyTitle,
  emptyDescription,
  emptyAction,
  art = 'empty',
  progress,
  loading = false,
  className,
}: {
  /** Uppercase eyebrow, e.g. "Next lesson". */
  heading: string;
  /** Chip beside the eyebrow, e.g. "in 2 days", or "In progress" with `progress`. */
  relative?: ReactNode;
  /** Absolute date. When absent the card renders its empty state. */
  date?: ReactNode;
  time?: ReactNode;
  /** Teacher row, typically a `PersonItem` with `tone="ink"`. */
  teacher?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  /** Illustration for an empty card without an action. */
  art?: NextLessonArt;
  /** The lesson is under way. */
  progress?: NextLessonProgress;
  loading?: boolean;
  className?: string;
}) {
  const Art = ART[art];

  return (
    <Card
      tone="feature"
      radius="hero"
      data-slot="next-lesson-card"
      className={cn('gap-4.5 p-6.5 md:min-h-80', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold tracking-[0.06em] text-feature-heading uppercase">
          {heading}
        </span>
        {!loading && date && relative ? (
          progress ? (
            <Badge variant="brand" dot dotTone="danger">
              {relative}
            </Badge>
          ) : (
            <Badge variant="on-ink">{relative}</Badge>
          )
        ) : null}
      </div>

      {loading ? (
        <div className="flex grow flex-col gap-4.5">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-48 bg-feature-soft" />
            <Skeleton className="h-5 w-56 bg-feature-soft" />
          </div>
          <Skeleton className="h-14 w-full rounded-tile bg-feature-soft" />
        </div>
      ) : date ? (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-[40px] leading-[44px] font-semibold tracking-[-0.03em]">
              {date}
            </span>
            {time ? (
              <span className={cn('text-[15px] text-feature-muted', progress ? null : 'font-mono')}>
                {time}
              </span>
            ) : null}
          </div>
          {progress ? (
            <div className="flex flex-col gap-2">
              <Progress
                // The indicator reads its value as a percentage.
                value={progress.total > 0 ? (progress.value / progress.total) * 100 : 0}
                aria-valuetext={progress.label}
                aria-label={progress.name}
                className="h-2 bg-feature-soft *:data-[slot=progress-indicator]:bg-brand-soft"
              />
              <div className="flex items-center justify-between gap-3 text-[13px] text-feature-muted">
                <span>{progress.start}</span>
                <span>{progress.label}</span>
                <span>{progress.end}</span>
              </div>
            </div>
          ) : null}
          {teacher}
        </>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-[28px] leading-[34px] font-semibold tracking-[-0.02em]">
            {emptyTitle}
          </span>
          {emptyDescription ? (
            <span className="text-sm leading-5 text-feature-muted">{emptyDescription}</span>
          ) : null}
        </div>
      )}

      {loading ? null : date ? (
        <div className="mt-auto flex gap-2 *:min-w-0 *:grow">
          {primaryAction}
          {secondaryAction}
        </div>
      ) : emptyAction ? (
        <div className="mt-auto flex *:min-w-0 *:grow">{emptyAction}</div>
      ) : (
        <div className="mt-auto">
          <Art />
        </div>
      )}
    </Card>
  );
}
