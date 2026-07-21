import { cn } from '@/lib/utils';

/**
 * Signature element of the Tutorio visual language.
 *
 * Every dashboard template renders progress as a continuous bar with a
 * percentage. Tutorio's core quantity is not a percentage — a student has
 * eight lessons left, not 78 % of a package. So the meter is discrete: one
 * cell per lesson. When the remaining count drops to the alert threshold the
 * remaining cells switch colour, which is the "≤2 lessons left" warning
 * expressed in the meter itself instead of a separate note.
 */
export function LessonPips({
  remaining,
  total,
  lowThreshold = 2,
  className,
}: {
  remaining: number;
  total: number;
  lowThreshold?: number;
  className?: string;
}) {
  const isLow = remaining > 0 && remaining <= lowThreshold;
  const isEmpty = remaining <= 0;

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      role="meter"
      aria-valuenow={remaining}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`Залишилось занять: ${remaining} з ${total}`}
    >
      <div className="flex flex-1 items-center gap-[3px]" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => {
          const filled = index < remaining;
          return (
            <span
              key={index}
              className="h-1.5 flex-1 rounded-full transition-colors"
              style={{
                backgroundColor: filled
                  ? isLow
                    ? 'var(--pip-low)'
                    : 'var(--pip-full)'
                  : 'var(--pip-empty)',
              }}
            />
          );
        })}
      </div>
      <span
        className={cn(
          'numeral shrink-0 text-sm',
          isEmpty || isLow ? 'text-destructive' : 'text-foreground',
        )}
      >
        {remaining}
        <span className="text-muted-foreground">/{total}</span>
      </span>
    </div>
  );
}
