import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Small tiles use the tile pair for indigo (a tint would vanish in dark) and
// the tint pairs for the rest.
const TILE_TONE = {
  indigo: 'bg-tile-indigo text-tile-indigo-foreground',
  info: 'bg-tint-info text-tint-info-foreground',
  success: 'bg-tint-success text-tint-success-foreground',
  warning: 'bg-tint-warning text-tint-warning-foreground',
  danger: 'bg-tint-danger text-tint-danger-foreground',
  neutral: 'bg-secondary text-foreground',
} as const;

export type ImpactTone = keyof typeof TILE_TONE;

export type ImpactItem = {
  /** Stable key within the list. */
  id: string;
  icon: ReactNode;
  tone: ImpactTone;
  /** What changes, with its number: "14 lessons will be rebuilt". */
  title: ReactNode;
  /** Which ones or why, e.g. "Fri 18 Sep · Fri 2 Oct". */
  text?: ReactNode;
};

/**
 * "What will change" before a consequential action: one bordered list, each
 * row a tinted icon tile, a title that carries the number and an optional
 * muted line. Dividers start past the icon so the tiles read as one column.
 */
export function ImpactList({
  items,
  label,
  className,
}: {
  items: ImpactItem[];
  /** Accessible name of the list, when a visible heading does not name it. */
  label?: string;
  className?: string;
}) {
  return (
    <ul
      aria-label={label}
      data-slot="impact-list"
      className={cn(
        'flex flex-col rounded-tile border border-border bg-card px-3.5 py-1',
        className,
      )}
    >
      {items.map((item, index) => (
        <li key={item.id} className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={cn(
              'mt-2.5 flex size-9 shrink-0 items-center justify-center rounded-control [&_svg]:size-4.5',
              TILE_TONE[item.tone],
            )}
          >
            {item.icon}
          </span>
          <div
            className={cn(
              'flex min-h-14 min-w-0 grow flex-col justify-center gap-0.5 py-2.5',
              index > 0 && 'border-t border-border',
            )}
          >
            <span className="text-sm leading-5 font-semibold text-foreground">{item.title}</span>
            {item.text ? (
              <span className="text-[13px] leading-[18px] text-muted-foreground">{item.text}</span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
