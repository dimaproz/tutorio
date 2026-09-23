import type { ReactNode } from 'react';
import { DateTile, type DateTileState } from '@/components/shared/date-tile';
import { cn } from '@/lib/utils';

// The reference dims a past row to 75%. That drops its meta line and its
// status chip below 4.5:1, so the row keeps full strength and reads as past
// through its status chip instead.
const STATE_CLASS = {
  next: 'bg-surface-hover',
  default: '',
  past: '',
} as const;

const TILE_STATE: Record<keyof typeof STATE_CLASS, DateTileState> = {
  next: 'highlighted',
  default: 'default',
  past: 'default',
};

export type LessonItemState = keyof typeof STATE_CLASS;

/**
 * One lesson in a list: date tile, title and meta, a status chip and row
 * actions. With `onSelect` the whole row is one button (the title is a
 * stretched button, as `PersonItem` stretches its link): the phone row, which
 * has no room for a menu.
 */
export function LessonItem({
  date,
  title,
  meta,
  status,
  actions,
  state = 'default',
  compact = false,
  onSelect,
  selectLabel,
  className,
}: {
  date: { top: string; day: string };
  title: ReactNode;
  meta?: ReactNode;
  /** Status chip, supplied by the feature that owns the lifecycle copy. */
  status?: ReactNode;
  actions?: ReactNode;
  state?: LessonItemState;
  /** Phone density: the 52px date tile and tighter spacing. */
  compact?: boolean;
  /** Makes the whole row one button. */
  onSelect?: () => void;
  /** The button's name when the title alone does not say what it does. */
  selectLabel?: string;
  className?: string;
}) {
  return (
    <div
      data-slot="lesson-item"
      data-state={state}
      className={cn(
        'flex w-full items-center rounded-row text-foreground',
        compact ? 'gap-3 p-2' : 'gap-4 p-2.5',
        STATE_CLASS[state],
        onSelect &&
          'relative transition-colors duration-150 hover:bg-surface-hover has-[button:focus-visible]:bg-surface-hover',
        className,
      )}
    >
      <DateTile top={date.top} day={date.day} state={TILE_STATE[state]} size={compact ? 52 : 60} />
      <div className="flex min-w-0 grow flex-col gap-0.5">
        <span className="truncate text-[15px] leading-5 font-semibold">
          {onSelect ? (
            <button
              type="button"
              onClick={onSelect}
              aria-label={selectLabel}
              className="text-left outline-none after:absolute after:inset-0 after:rounded-row focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
            >
              {title}
            </button>
          ) : (
            title
          )}
        </span>
        {meta ? (
          <span className="truncate text-[13px] leading-[18px] text-muted-foreground">{meta}</span>
        ) : null}
      </div>
      {status}
      {actions}
    </div>
  );
}
