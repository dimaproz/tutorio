import { cn } from '@/lib/utils';

const SIZE_CLASS = {
  60: 'size-15',
  52: 'size-13',
} as const;

const DAY_CLASS = {
  60: 'text-2xl',
  52: 'text-xl',
} as const;

// The reference dims a past tile to 75%, which pushes its 11px weekday label
// under 4.5:1 once the row around it dims too. A past tile therefore keeps its
// default fill and the row's status chip carries "this already happened".
const STATE_CLASS = {
  default: 'bg-background text-foreground',
  highlighted: 'bg-primary text-primary-foreground',
  past: 'bg-background text-foreground',
} as const;

export type DateTileState = keyof typeof STATE_CLASS;
export type DateTileSize = keyof typeof SIZE_CLASS;

/**
 * The compact date marker used by lesson lists and, later, the calendar agenda.
 * Decorative on its own: the row beside it carries the full, readable date.
 */
export function DateTile({
  top,
  day,
  state = 'default',
  size = 60,
  className,
}: {
  /** Weekday or month abbreviation, already localized by the caller. */
  top: string;
  day: string;
  state?: DateTileState;
  size?: DateTileSize;
  className?: string;
}) {
  return (
    <div
      data-slot="date-tile"
      data-state={state}
      aria-hidden="true"
      className={cn(
        'flex shrink-0 flex-col items-center justify-center rounded-tile',
        SIZE_CLASS[size],
        STATE_CLASS[state],
        className,
      )}
    >
      <span className="text-[11px] leading-[14px] font-medium tracking-[0.06em] uppercase opacity-70">
        {top}
      </span>
      <span
        className={cn(
          'leading-[26px] font-semibold tracking-[-0.02em] tabular-nums',
          DAY_CLASS[size],
        )}
      >
        {day}
      </span>
    </div>
  );
}
