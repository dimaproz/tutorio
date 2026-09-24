import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// One colour per attendance mark everywhere. "Excused" is a white tile with
// the info foreground: the info tint would sink into the indigo card.
const TILE_TONE = {
  success: 'bg-tint-success text-tint-success-foreground',
  danger: 'bg-tint-danger text-tint-danger-foreground',
  info: 'bg-card text-tint-info-foreground',
  warning: 'bg-tint-warning text-tint-warning-foreground',
} as const;

export type AttendanceTileTone = keyof typeof TILE_TONE;

export type AttendanceTile = {
  id: string;
  label: string;
  count: number;
  tone: AttendanceTileTone;
};

function Rings() {
  const dots = Array.from({ length: 24 }, (_, index) => ({
    cx: 190 + (index % 6) * 16,
    cy: 24 + Math.floor(index / 6) * 16,
  }));
  return (
    <svg
      viewBox="0 0 300 160"
      aria-hidden="true"
      className="pointer-events-none absolute -top-5 -right-10 h-40 w-75 text-brand opacity-18"
    >
      <circle cx="250" cy="110" r="70" fill="none" stroke="currentColor" strokeWidth="18" />
      <g fill="currentColor">
        {dots.map((dot) => (
          <circle key={`${dot.cx}-${dot.cy}`} cx={dot.cx} cy={dot.cy} r="3" />
        ))}
      </g>
    </svg>
  );
}

/**
 * Who came to a group lesson, at the top of the lesson panel's right column.
 *
 * - `indigo`: the markable lesson — an overline, a title ("Marked", "Not
 *   marked yet"), a white action, then either four mark tiles or a sentence,
 *   and a footnote. A zero tile is half transparent.
 * - `plain`: a bordered note with an icon for when there is nothing to mark
 *   yet or any more ("After the start", "Not kept for a cancelled lesson").
 */
export function AttendanceSummaryCard({
  tone,
  label,
  title,
  icon,
  action,
  tiles,
  text,
  note,
  className,
}: {
  tone: 'indigo' | 'plain';
  /** The indigo card's overline, e.g. "Присутність". */
  label?: string;
  title: ReactNode;
  /** The plain note's leading icon. */
  icon?: ReactNode;
  /** A white button on the indigo card, e.g. "Mark" or "Change". */
  action?: ReactNode;
  tiles?: AttendanceTile[];
  text?: ReactNode;
  /** The footnote under the tiles, e.g. who marked it and when. */
  note?: ReactNode;
  className?: string;
}) {
  if (tone === 'plain') {
    return (
      <div
        data-slot="attendance-summary-card"
        data-tone="plain"
        className={cn(
          'flex shrink-0 items-start gap-3 rounded-row border border-border bg-card p-4',
          className,
        )}
      >
        {icon ? (
          <span aria-hidden="true" className="flex pt-px text-muted-foreground [&_svg]:size-5">
            {icon}
          </span>
        ) : null}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] leading-5 font-semibold text-foreground">{title}</span>
          {text ? (
            <span className="text-[13px] leading-[18px] text-muted-foreground">{text}</span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label={label}
      data-slot="attendance-summary-card"
      data-tone="indigo"
      className={cn(
        'relative flex shrink-0 flex-col gap-3.5 overflow-hidden rounded-block bg-tint-indigo p-5 text-tint-foreground',
        className,
      )}
    >
      <Rings />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {label ? (
            <span className="text-xs font-semibold tracking-[0.04em] text-tint-indigo-meta uppercase">
              {label}
            </span>
          ) : null}
          <span className="text-xl leading-7 font-semibold">{title}</span>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {tiles && tiles.length > 0 ? (
        <ul className="relative grid grid-cols-4 gap-2">
          {tiles.map((tile) => (
            <li
              key={tile.id}
              className={cn(
                'flex min-h-19 min-w-0 flex-col justify-between gap-1 rounded-field px-2.5 py-2.5',
                TILE_TONE[tile.tone],
                tile.count === 0 && 'opacity-55',
              )}
            >
              <span className="truncate text-[13px] leading-[18px] font-semibold">
                {tile.label}
              </span>
              <span className="text-[28px] leading-8 font-semibold tabular-nums">{tile.count}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {text ? <p className="relative text-sm leading-5">{text}</p> : null}
      {note ? (
        <p className="relative text-[13px] leading-[18px] text-tint-indigo-meta">{note}</p>
      ) : null}
    </section>
  );
}
