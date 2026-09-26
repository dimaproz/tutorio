import type { CSSProperties, ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { readableFill } from '@/lib/theme/user-colors';
import { cn } from '@/lib/utils';

/** Where a lesson is in its day: still to come, under way, over, or cancelled. */
export type LessonTimeRowState = 'ahead' | 'now' | 'past' | 'cancelled';

// The time column by state. A past row inside a card is quiet text on the
// row's own fill; on the page background (dense) the column keeps a light
// grey so the row does not vanish (S11 decision: grey on grey disappeared).
const TIME_CLASS: Record<LessonTimeRowState, string> = {
  ahead: 'bg-muted text-foreground',
  now: 'bg-primary text-primary-foreground',
  past: 'text-muted-foreground',
  cancelled: 'bg-muted text-muted-foreground',
};

// A teacher's colour (user data, `--row-tint`) tints the column: 13% over the
// card, 8% when past, the text mixed 60% into the foreground. «Now» is filled
// with the colour itself through `readableFill`; a cancelled row stays neutral.
const TINT_CLASS: Partial<Record<LessonTimeRowState, string>> = {
  ahead:
    'bg-[color-mix(in_oklab,var(--row-tint)_13%,var(--card))] text-[color-mix(in_oklab,var(--row-tint)_60%,var(--foreground))]',
  past: 'bg-[color-mix(in_oklab,var(--row-tint)_8%,var(--card))] text-[color-mix(in_oklab,var(--row-tint)_60%,var(--foreground))]',
};

/**
 * One lesson of a day by its time (S11): the time column, a dashed divider,
 * then the body with media, name, meta and the right side — one badge and the
 * `⋯` on desktop, a mark on a `dense` (phone) row. The outline wraps the body
 * only. Today, the free day, «Завтра», the phone calendar and a teacher's
 * day list use it; a list across dates is `LessonItem`.
 *
 * With `onSelect` the whole row is one button (the name is a stretched
 * button); `trailing` sits above it and keeps its own clicks.
 */
export function LessonTimeRow({
  start,
  end,
  state,
  dense = false,
  tint,
  media,
  name,
  meta,
  trailing,
  onSelect,
  selectLabel,
  className,
}: {
  /** "10:00". */
  start: string;
  /** "11:00", under the start on desktop; a dense row shows the start only. */
  end?: string;
  state: LessonTimeRowState;
  /** The phone density: 64px column, 56px rows, no media, marks on the right. */
  dense?: boolean;
  /** Several teachers are shown: the teacher's colour (user data) tints the time. */
  tint?: string | null;
  /** A 36px avatar or group tile; desktop only. */
  media?: ReactNode;
  name: ReactNode;
  meta?: ReactNode;
  /** The badge and the `⋯` on desktop, or the mark on a dense row. */
  trailing?: ReactNode;
  onSelect?: () => void;
  selectLabel?: string;
  className?: string;
}) {
  const past = state === 'past';
  const cancelled = state === 'cancelled';
  const tinted = Boolean(tint) && !cancelled;
  const fill = tinted && state === 'now' ? readableFill(tint!) : null;
  // A past row on the page background (the phone calendar) keeps a white
  // body and a light grey column; inside a white card (desktop) the whole
  // row takes the light fill instead.
  const pastInCard = past && !dense;

  return (
    <div
      data-slot="lesson-time-row"
      data-state={state}
      style={tinted ? ({ '--row-tint': tint } as CSSProperties) : undefined}
      className={cn(
        'flex w-full min-w-0 text-foreground',
        dense ? 'min-h-14 rounded-item' : 'min-h-16 rounded-field',
        pastInCard && 'bg-[color-mix(in_oklab,var(--muted)_65%,var(--card))]',
        onSelect &&
          'relative transition-[filter] duration-150 hover:brightness-[0.985] has-[button[data-row-select]:focus-visible]:outline-2 has-[button[data-row-select]:focus-visible]:outline-offset-2 has-[button[data-row-select]:focus-visible]:outline-ring',
        className,
      )}
    >
      <span
        style={fill ? { backgroundColor: fill.fill, color: fill.ink } : undefined}
        className={cn(
          'flex shrink-0 flex-col justify-center border-r-2 border-dashed border-border px-3 tabular-nums',
          dense ? 'w-16 rounded-l-item' : 'w-19 rounded-l-field',
          TIME_CLASS[state],
          past && dense && 'bg-[color-mix(in_oklab,var(--muted-foreground)_13%,var(--card))]',
          tinted && TINT_CLASS[state],
          state === 'now' && 'border-transparent',
        )}
      >
        <span
          className={cn(
            'text-[15px] leading-5 font-bold',
            cancelled && 'line-through decoration-1',
          )}
        >
          {start}
        </span>
        {end && !dense ? (
          <span
            className={cn(
              'text-[11px] leading-4',
              state === 'now' ? null : 'text-muted-foreground',
              cancelled && 'line-through decoration-1',
            )}
          >
            {end}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          'flex min-w-0 grow items-center gap-3 border border-l-0 py-2',
          dense ? 'rounded-r-item pr-3.5 pl-3.5' : 'rounded-r-field pr-2.5 pl-3',
          pastInCard ? 'border-transparent' : 'border-border bg-card',
          past && dense && 'border-transparent',
        )}
      >
        {media && !dense ? media : null}
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span
            className={cn(
              'truncate text-[15px] leading-5 font-semibold',
              cancelled && 'text-muted-foreground',
            )}
          >
            {onSelect ? (
              <button
                type="button"
                data-row-select=""
                onClick={onSelect}
                aria-label={selectLabel}
                className="text-left outline-none after:absolute after:inset-0"
              >
                {name}
              </button>
            ) : (
              name
            )}
          </span>
          {meta ? (
            <span className="flex min-w-0 items-center gap-1.5 truncate text-[13px] leading-[18px] text-muted-foreground">
              {meta}
            </span>
          ) : null}
        </span>
        {trailing ? (
          <span
            className={cn(
              'flex shrink-0 items-center',
              dense ? 'gap-2 [&_svg]:size-4.5' : 'gap-1.5',
              onSelect && 'relative z-1',
            )}
          >
            {trailing}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** The red «13:05» badge and line under the running lesson (the day as one timeline). */
export function LessonNowLine({ label, className }: { label: string; className?: string }) {
  return (
    <div
      data-slot="lesson-now-line"
      role="separator"
      aria-label={label}
      className={cn('flex items-center gap-2', className)}
    >
      <span className="rounded-md bg-destructive px-1.5 text-[11px] leading-4.5 font-bold text-destructive-foreground tabular-nums">
        {label}
      </span>
      <span aria-hidden="true" className="h-0.5 grow rounded-pill bg-destructive" />
    </div>
  );
}

/** The round warning «₴»: a lesson not paid for yet, or cancelled with payment. */
export function CoinMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-3.5 shrink-0 items-center justify-center rounded-full bg-status-hold text-[9px] leading-none font-bold text-ink-foreground',
        className,
      )}
    >
      ₴
    </span>
  );
}

/** The running dot of a dense row. */
export function RunningMark() {
  return (
    <span aria-hidden="true" className="relative flex size-3 shrink-0">
      <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-40" />
      <span className="relative size-3 rounded-full border-2 border-card bg-primary ring-1 ring-border" />
    </span>
  );
}

/** A row's placeholder while the day loads. */
export function LessonTimeRowSkeleton({ dense = false }: { dense?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn('flex w-full', dense ? 'min-h-14 rounded-item' : 'min-h-16 rounded-field')}
    >
      <span
        className={cn(
          'shrink-0 border-r-2 border-dashed border-border bg-muted',
          dense ? 'w-16 rounded-l-item' : 'w-19 rounded-l-field',
        )}
      />
      <span
        className={cn(
          'flex grow items-center gap-3 border border-l-0 border-border bg-card px-3',
          dense ? 'rounded-r-item' : 'rounded-r-field',
        )}
      >
        {dense ? null : <Skeleton className="size-9 rounded-full" />}
        <span className="flex grow flex-col gap-2">
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-2.5 w-3/5" />
        </span>
        {dense ? null : <Skeleton className="h-6 w-18 rounded-pill" />}
      </span>
    </div>
  );
}
