'use client';

import type { ComponentProps, ReactNode } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * A collection filter or sort control. Renders as a toggle when `pressed` is
 * supplied and as a menu trigger when `menu` is set; the caller owns the menu
 * itself and every label.
 */
export function FilterPill({
  label,
  icon,
  menu = false,
  pressed,
  count,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, 'variant' | 'size' | 'leading'> & {
  label: ReactNode;
  icon?: ReactNode;
  /** Shows the dropdown chevron for a control that opens a menu. */
  menu?: boolean;
  /** Makes the pill a toggle and reflects its state to assistive tech. */
  pressed?: boolean;
  /** Number of selected values, shown as an ink counter. */
  count?: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={pressed}
      data-slot="filter-pill"
      className={cn('px-4', pressed && 'border-primary', className)}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="flex shrink-0 [&_svg]:size-4">
          {icon}
        </span>
      ) : null}
      {label}
      {count != null ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-pill bg-primary px-1.5 font-mono text-[11px] text-primary-foreground">
          {count}
        </span>
      ) : null}
      {menu ? <ChevronDownIcon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
    </Button>
  );
}
