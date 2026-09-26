'use client';

import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** The quiet rings in the corner, drawn in the card's own ink. */
function TicketArt() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 360 200"
      className="pointer-events-none absolute top-0 right-0 h-50 w-90 opacity-14"
    >
      <circle
        cx="300"
        cy="20"
        r="90"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".35"
        strokeWidth="18"
      />
      <circle cx="80" cy="196" r="30" fill="currentColor" fillOpacity=".18" />
    </svg>
  );
}

/**
 * The «Зараз» ticket (S11 decision 7): a stub with the start and «до
 * 13:30», a dashed tear line, then the eyebrow with its chip, who with the
 * avatar, the meta line, the progress and a white «Відкрити заняття». The
 * same card reads «Наступне» between lessons and «На сьогодні все» at the end
 * of the day. On phones it is compact (82px stub, 18px name) and the whole
 * card opens the lesson.
 */
export function NowTicket({
  stubTop,
  stubBottom,
  eyebrow,
  chip,
  media,
  title,
  meta,
  progress,
  action,
  onOpen,
  openLabel,
}: {
  /** The start time, or tomorrow's first time at the end of the day. */
  stubTop: string;
  stubBottom: string;
  eyebrow: string;
  chip?: string;
  media?: ReactNode;
  title: string;
  meta?: string;
  /** How far the running lesson has got, in percent. */
  progress?: { value: number; label: string };
  action: { label: string; onClick: () => void };
  /** Phones: the whole card opens the lesson. */
  onOpen?: () => void;
  openLabel?: string;
}) {
  return (
    <section
      data-slot="now-ticket"
      className="relative flex items-stretch overflow-hidden rounded-card bg-primary text-primary-foreground"
    >
      <TicketArt />
      <div className="relative flex w-20.5 shrink-0 flex-col items-center justify-center gap-0.5 bg-stub-shade px-1 md:w-32">
        <span className="text-xl leading-6 font-bold tabular-nums md:text-[26px] md:leading-8">
          {stubTop}
        </span>
        <span className="text-center text-xs leading-4 opacity-90">{stubBottom}</span>
      </div>
      <span
        aria-hidden="true"
        className="relative my-3 w-0 border-l-2 border-dashed border-primary-foreground/35"
      />
      <div className="relative flex min-w-0 grow items-center gap-5 px-4 py-4 md:px-6.5 md:py-5.5">
        <div className="flex min-w-0 grow flex-col gap-2 md:gap-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-xs leading-4 font-bold tracking-[0.08em] uppercase opacity-90">
              {eyebrow}
            </span>
            {chip ? (
              <Badge className="bg-primary-foreground/18 text-primary-foreground">{chip}</Badge>
            ) : null}
          </div>
          <div className="flex min-w-0 items-center gap-3">
            {media ? <span className="hidden md:flex">{media}</span> : null}
            <div className="flex min-w-0 flex-col">
              <h2 className="text-lg leading-6 font-bold md:text-[26px] md:leading-[30px]">
                {onOpen ? (
                  <button
                    type="button"
                    onClick={onOpen}
                    aria-label={openLabel}
                    className="text-left outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring md:after:hidden"
                  >
                    {title}
                  </button>
                ) : (
                  title
                )}
              </h2>
              {meta ? <span className="text-sm leading-5 opacity-90">{meta}</span> : null}
            </div>
          </div>
          {progress ? (
            <Progress
              value={progress.value}
              aria-label={progress.label}
              className="h-1.5 max-w-78 bg-primary-foreground/20 *:data-[slot=progress-indicator]:bg-primary-foreground"
            />
          ) : null}
        </div>
        <Button
          type="button"
          variant="white"
          className="relative z-1 hidden shrink-0 md:inline-flex"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      </div>
    </section>
  );
}

export function NowTicketSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton aria-hidden="true" className={cn('h-35 w-full rounded-card md:h-48', className)} />
  );
}
