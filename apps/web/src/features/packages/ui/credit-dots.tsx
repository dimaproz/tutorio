import { PlusIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The colour of the credits a package still has. */
export type DotTone = 'brand' | 'warning' | 'danger' | 'success' | 'muted';

const FILL: Record<DotTone, string> = {
  brand: 'bg-brand',
  warning: 'bg-tint-warning-foreground',
  danger: 'bg-destructive',
  success: 'bg-success',
  muted: 'bg-muted-foreground',
};

const LINE: Record<DotTone, string> = {
  brand: 'border-brand',
  warning: 'border-tint-warning-foreground',
  danger: 'border-destructive',
  success: 'border-success',
  muted: 'border-muted-foreground',
};

const SIZE = {
  xs: 'size-2',
  sm: 'size-3',
  md: 'size-4',
  lg: 'size-4.5',
} as const;

/** Over this many a row of dots stops helping; the figure says it. */
const MAX_DOTS = 24;

/**
 * One dot per credit of a package (S07): the ones left filled in the tone,
 * the used ones as a dashed ring (on a ticket) or a quiet grey dot (in a
 * list); `added` draws the correction's new credits in green with a «+» and
 * a halo; `bars` draws a small package of up to four as short bars.
 * Decorative: the figure beside it carries the meaning.
 */
export function CreditDots({
  left,
  total,
  added = 0,
  tone = 'brand',
  size = 'md',
  used = 'dashed',
  bars = false,
  className,
}: {
  left: number;
  total: number;
  added?: number;
  tone?: DotTone;
  size?: keyof typeof SIZE;
  used?: 'dashed' | 'quiet';
  bars?: boolean;
  className?: string;
}) {
  const count = Math.min(Math.max(total, left + added), MAX_DOTS);
  if (count === 0) return null;
  return (
    <div
      aria-hidden="true"
      data-slot="credit-dots"
      className={cn('flex flex-wrap', size === 'xs' ? 'gap-0.75' : 'gap-1.5', className)}
    >
      {Array.from({ length: count }, (_, index) => {
        const state = index < left ? 'left' : index < left + added ? 'added' : 'used';
        return (
          <span
            // Credits are positional, so the index is the identity.
            key={index}
            data-state={state}
            className={cn(
              'flex shrink-0 items-center justify-center',
              bars ? 'h-2 w-7 rounded-pill' : cn('rounded-pill', SIZE[size]),
              state === 'left' && FILL[tone],
              state === 'added' &&
                'bg-success text-success-foreground ring-4 ring-success/20 [&_svg]:size-3',
              state === 'used' &&
                (used === 'dashed'
                  ? cn('border-[1.5px] border-dashed opacity-55', LINE[tone])
                  : 'bg-border'),
            )}
          >
            {state === 'added' && !bars ? <PlusIcon strokeWidth={3} /> : null}
          </span>
        );
      })}
    </div>
  );
}
