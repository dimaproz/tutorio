'use client';

import type { ReactNode } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

export type SegmentedItem<T extends string> = {
  value: T;
  /** Visible label. Omit for an icon-only segment, which then needs `ariaLabel`. */
  label?: ReactNode;
  icon?: ReactNode;
  count?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
  title?: string;
  /**
   * Paints the selected segment in a mark colour with a leading dot, e.g. the
   * attendance marks; untoned segments keep the ink selection.
   */
  tone?: SegmentedTone;
};

export type SegmentedTone = keyof typeof TONE_CLASS;

// A toned segment fills with its tint when selected. The pressed and hover
// states repeat the fill so the ink selection of the base variant never shows.
const TONE_CLASS = {
  success:
    'aria-pressed:bg-tint-success aria-pressed:text-tint-success-foreground data-[state=on]:bg-tint-success data-[state=on]:text-tint-success-foreground data-[state=on]:hover:bg-tint-success data-[state=on]:hover:text-tint-success-foreground',
  danger:
    'aria-pressed:bg-tint-danger aria-pressed:text-tint-danger-foreground data-[state=on]:bg-tint-danger data-[state=on]:text-tint-danger-foreground data-[state=on]:hover:bg-tint-danger data-[state=on]:hover:text-tint-danger-foreground',
  info: 'aria-pressed:bg-tint-info aria-pressed:text-tint-info-foreground data-[state=on]:bg-tint-info data-[state=on]:text-tint-info-foreground data-[state=on]:hover:bg-tint-info data-[state=on]:hover:text-tint-info-foreground',
  warning:
    'aria-pressed:bg-tint-warning aria-pressed:text-tint-warning-foreground data-[state=on]:bg-tint-warning data-[state=on]:text-tint-warning-foreground data-[state=on]:hover:bg-tint-warning data-[state=on]:hover:text-tint-warning-foreground',
} as const;

/**
 * A pill of mutually exclusive options: status facets with counts, the
 * list/grid switch, profile section tabs. `surface` sits on paper (white pill,
 * ink selection); `paper` sits on a card (paper pill, 34px segments). An
 * icon-only segment selects with a paper disc instead of ink. A segment with a
 * `tone` selects in that mark colour with a dot (the attendance marks).
 */
export function Segmented<T extends string>({
  value,
  onValueChange,
  items,
  label,
  variant = 'surface',
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  items: SegmentedItem<T>[];
  /** Accessible name of the group. */
  label: string;
  variant?: 'surface' | 'paper';
  className?: string;
}) {
  const paper = variant === 'paper';

  return (
    <ToggleGroup
      type="single"
      value={value}
      // A single-select group never lets its last selection go.
      onValueChange={(next) => (next ? onValueChange(next as T) : undefined)}
      aria-label={label}
      spacing={0.5}
      data-slot="segmented"
      className={cn(
        'max-w-full rounded-pill p-1',
        paper ? 'bg-background' : 'border border-border bg-card',
        className,
      )}
    >
      {items.map((item) => {
        const iconOnly = !item.label;
        return (
          <ToggleGroupItem
            key={item.value}
            value={item.value}
            aria-label={item.ariaLabel}
            disabled={item.disabled}
            title={item.title}
            variant={iconOnly ? 'segmented' : 'segmented-solid'}
            className={cn(
              'min-w-0 gap-2 rounded-pill font-medium',
              paper ? 'h-8.5 text-[13px]' : 'h-9 text-sm',
              iconOnly ? (paper ? 'w-8.5 px-0' : 'w-9 px-0') : 'px-3.5',
              '[&_svg:not([class*=size-])]:size-4',
              item.tone && ['gap-1.5 data-[state=on]:font-semibold', TONE_CLASS[item.tone]],
            )}
          >
            {item.tone ? (
              <span
                aria-hidden="true"
                className="hidden size-1.5 shrink-0 rounded-pill bg-current in-data-[state=on]:block"
              />
            ) : null}
            {item.icon}
            {item.label}
            {item.count != null ? (
              // The count dims only on the filled segment, where 70% still
              // clears AA; on paper it stays at full muted strength.
              <span className="tabular-nums text-xs in-data-[state=on]:opacity-70">
                {item.count}
              </span>
            ) : null}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
