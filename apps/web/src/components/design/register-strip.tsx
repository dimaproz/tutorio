import { cn } from '@/lib/utils';

/**
 * Signature element: the lesson package rendered as a row of register cells.
 *
 * A class register is a grid — one cell per lesson, marked as it is held.
 * That is literally what a lesson package is, so the meter is square, ruled
 * and countable rather than a rounded percentage bar. When the remaining
 * count reaches the alert threshold the empty cells take the "due" rule, so
 * the warning lives in the meter instead of a separate note beside it.
 */
export function RegisterStrip({
  used,
  total,
  lowThreshold = 2,
  size = 'default',
  showCount = true,
  className,
}: {
  used: number;
  total: number;
  lowThreshold?: number;
  size?: 'sm' | 'default';
  showCount?: boolean;
  className?: string;
}) {
  const remaining = Math.max(total - used, 0);
  const isExhausted = remaining === 0;
  const isLow = remaining > 0 && remaining <= lowThreshold;

  const cell = size === 'sm' ? 'size-2.5' : 'size-3.5';

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        role="meter"
        aria-valuenow={remaining}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`Залишилось занять: ${remaining} з ${total}`}
        className="flex flex-wrap items-center gap-[3px]"
      >
        {Array.from({ length: total }, (_, index) => {
          const isMarked = index < used;
          return (
            <span
              key={index}
              aria-hidden="true"
              className={cn(cell, 'rounded-[2px] border transition-colors')}
              style={{
                backgroundColor: isMarked ? 'var(--cell-mark)' : 'var(--cell-empty)',
                borderColor: isMarked
                  ? 'var(--cell-mark)'
                  : isLow || isExhausted
                    ? 'var(--cell-low)'
                    : 'var(--cell-rule)',
              }}
            />
          );
        })}
      </div>

      {showCount ? (
        <span
          className={cn(
            'numeral shrink-0 text-sm whitespace-nowrap',
            isLow || isExhausted ? 'text-[var(--due)]' : 'text-foreground',
          )}
        >
          {remaining}
          <span className="text-muted-foreground"> / {total}</span>
        </span>
      ) : null}
    </div>
  );
}
