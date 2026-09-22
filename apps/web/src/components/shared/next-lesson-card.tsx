import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArchiveArt, EmptyArt, PauseArt } from '@/components/shared/next-lesson-art';
import { cn } from '@/lib/utils';

const ART = { empty: EmptyArt, pause: PauseArt, archive: ArchiveArt } as const;

export type NextLessonArt = keyof typeof ART;

/**
 * The ink "next lesson" ticket. Shows the next scheduled lesson with its two
 * commands, or an empty state. The empty state either offers an action or,
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
  loading = false,
  className,
}: {
  /** Uppercase eyebrow, e.g. "Next lesson". */
  heading: string;
  /** Relative chip beside the eyebrow, e.g. "in 2 days". */
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
  loading?: boolean;
  className?: string;
}) {
  const Art = ART[art];

  return (
    <Card
      tone="ink"
      radius="hero"
      data-slot="next-lesson-card"
      className={cn('gap-4.5 p-6.5 md:h-80', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold tracking-[0.06em] text-brand-soft uppercase">
          {heading}
        </span>
        {!loading && date && relative ? <Badge variant="on-ink">{relative}</Badge> : null}
      </div>

      {loading ? (
        <div className="flex grow flex-col gap-4.5">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-48 bg-ink-soft" />
            <Skeleton className="h-5 w-56 bg-ink-soft" />
          </div>
          <Skeleton className="h-14 w-full rounded-tile bg-ink-soft" />
        </div>
      ) : date ? (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-[40px] leading-[44px] font-semibold tracking-[-0.03em]">
              {date}
            </span>
            {time ? <span className="font-mono text-[15px] text-ink-muted">{time}</span> : null}
          </div>
          {teacher}
        </>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-[28px] leading-[34px] font-semibold tracking-[-0.02em]">
            {emptyTitle}
          </span>
          {emptyDescription ? (
            <span className="text-sm leading-5 text-ink-muted">{emptyDescription}</span>
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
