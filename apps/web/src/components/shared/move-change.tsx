import { ArrowDownIcon, ArrowRightIcon } from 'lucide-react';
import { DateTile } from '@/components/shared/date-tile';
import { cn } from '@/lib/utils';

export type MoveChangeSide = {
  /** Date tile parts, already localized: weekday and day of the month. */
  date: { top: string; day: string };
  /** "Було" / "Стане". */
  label: string;
  /** The time, e.g. "17:00". */
  time: string;
  /** The line under it, e.g. "every Friday" or "from 11 September". */
  hint?: string;
};

function Side({ side, before }: { side: MoveChangeSide; before: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <DateTile
        top={side.date.top}
        day={side.date.day}
        size={52}
        state={before ? 'default' : 'highlighted'}
      />
      <div className="flex min-w-0 flex-col gap-px">
        <span className="text-xs leading-4 font-semibold tracking-[0.04em] text-muted-foreground uppercase">
          {side.label}
        </span>
        <span
          className={cn(
            'tabular-nums text-lg leading-6 font-semibold',
            before ? 'text-muted-foreground line-through' : 'text-foreground',
          )}
        >
          {side.time}
        </span>
        {side.hint ? (
          <span className="truncate text-xs leading-4 text-muted-foreground">{side.hint}</span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A move at a glance: the old date and time struck through, an arrow, and the
 * new ones on a highlighted date tile, each with a line saying how far it
 * reaches. `stacked` (phones) puts the new time under the old one with a down
 * arrow.
 */
export function MoveChange({
  from,
  to,
  stacked = false,
  className,
}: {
  from: MoveChangeSide;
  to: MoveChangeSide;
  stacked?: boolean;
  className?: string;
}) {
  const Arrow = stacked ? ArrowDownIcon : ArrowRightIcon;
  return (
    <div
      data-slot="move-change"
      className={cn(
        'flex shrink-0 gap-3 rounded-row bg-tint-sky p-3.5 text-tint-foreground',
        stacked ? 'flex-col items-stretch' : 'items-center',
        className,
      )}
    >
      <Side side={from} before />
      <span
        aria-hidden="true"
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-pill bg-card text-brand shadow-hairline [&_svg]:size-4',
          stacked && 'ml-2.5',
        )}
      >
        <Arrow />
      </span>
      <Side side={to} before={false} />
    </div>
  );
}
