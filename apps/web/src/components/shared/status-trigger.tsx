'use client';

import type { ComponentProps, ReactNode } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Lifecycle tones every status control shares: dot, icon tile and tile ink. */
export const STATUS_TONE = {
  active: { dot: 'bg-status-active', tile: 'bg-tint-success text-tint-success-foreground' },
  hold: { dot: 'bg-status-hold', tile: 'bg-tint-warning text-tint-warning-foreground' },
  archived: { dot: 'bg-status-archived', tile: 'bg-background text-muted-foreground' },
} as const;

export type LifecycleTone = keyof typeof STATUS_TONE;

const SIZE = {
  sm: 'h-6.5 gap-1.5 pr-2 pl-2.5 text-[13px] [&_[data-slot=chevron]]:size-3',
  md: 'h-8.5 gap-[7px] pr-2.5 pl-3 text-[13px] [&_[data-slot=chevron]]:size-3.5',
  lg: 'h-10 gap-2 pr-3 pl-4 text-sm [&_[data-slot=chevron]]:size-4',
} as const;

export type StatusTriggerSize = keyof typeof SIZE;

/**
 * The compact status pill that opens a status menu: colour dot, label and a
 * chevron that flips while open. It renders a real button, so it slots into a
 * `DropdownMenuTrigger asChild` or a drawer trigger unchanged. `sm` sits
 * borderless on a tinted hero; `md` and `lg` carry a hairline for paper.
 */
export function StatusTrigger({
  tone,
  label,
  size = 'sm',
  prefix,
  className,
  ...props
}: Omit<ComponentProps<'button'>, 'prefix' | 'children'> & {
  tone: LifecycleTone;
  label: ReactNode;
  size?: StatusTriggerSize;
  /** Muted lead-in before the dot, e.g. "Status". */
  prefix?: ReactNode;
}) {
  return (
    <button
      type="button"
      data-slot="status-trigger"
      data-size={size}
      className={cn(
        'group/status inline-flex shrink-0 items-center rounded-pill border bg-card leading-none font-medium whitespace-nowrap text-foreground transition-[border-color,box-shadow,background-color] duration-150 ease-out outline-none hover:border-line-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-expanded:border-ring aria-expanded:ring-3 aria-expanded:ring-ring/16 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'border-transparent' : 'border-border',
        SIZE[size],
        className,
      )}
      {...props}
    >
      {prefix ? <span className="font-medium text-muted-foreground">{prefix}</span> : null}
      <span
        aria-hidden="true"
        className={cn('size-[7px] shrink-0 rounded-pill', STATUS_TONE[tone].dot)}
      />
      <span>{label}</span>
      <ChevronDownIcon
        aria-hidden="true"
        data-slot="chevron"
        strokeWidth={2.2}
        className="shrink-0 text-muted-foreground transition-transform duration-150 group-aria-expanded/status:rotate-180"
      />
    </button>
  );
}
