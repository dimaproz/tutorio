import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Lesson credits as one pill per credit. Used at `sm` in collection rows and at
 * `lg` on the package card. Every caption is supplied by the caller so the
 * meter owns no copy.
 */
export function CreditMeter({
  left,
  total,
  size = 'sm',
  lowThreshold = 2,
  label,
  usedLabel,
  leftLabel,
  className,
}: {
  left: number;
  total: number;
  size?: 'sm' | 'lg';
  /** At or below this many remaining credits the meter reads as running out. */
  lowThreshold?: number;
  /** `sm` caption, e.g. "6 of 8 left" or "No active package". */
  label?: ReactNode;
  /** `lg` footer, left side. */
  usedLabel?: ReactNode;
  /** `lg` footer, right side. */
  leftLabel?: ReactNode;
  className?: string;
}) {
  const safeTotal = Math.max(total, 0);
  const safeLeft = Math.min(Math.max(left, 0), safeTotal);
  const used = safeTotal - safeLeft;
  const low = safeTotal > 0 && safeLeft <= lowThreshold;
  const segments = Array.from({ length: safeTotal }, (_, index) => index);

  if (size === 'lg') {
    return (
      <div data-slot="credit-meter" className={cn('flex w-full flex-col gap-3.5', className)}>
        <div aria-hidden="true" className="flex gap-[5px]">
          {segments.map((index) => (
            <span
              key={index}
              className={cn(
                'h-2.5 grow rounded-[5px]',
                index >= used ? 'bg-tint-info-foreground' : 'bg-tint-info-foreground/20',
              )}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-[13px] leading-[18px]">
          <span>{usedLabel}</span>
          <span className="font-semibold">{leftLabel}</span>
        </div>
      </div>
    );
  }

  // One 8px pill per credit, sized so a package of any length fills ~96px.
  const segmentWidth = Math.max(6, Math.round(96 / Math.max(safeTotal, 1)) - 4);

  return (
    <div data-slot="credit-meter" className={cn('flex flex-col gap-1.5', className)}>
      {segments.length > 0 ? (
        <div aria-hidden="true" className="flex gap-1">
          {segments.map((index) => (
            <span
              key={index}
              style={{ width: segmentWidth }}
              className={cn(
                'h-2 rounded-[4px]',
                index < safeLeft ? (low ? 'bg-danger-mark' : 'bg-primary') : 'bg-border',
              )}
            />
          ))}
        </div>
      ) : null}
      {label ? (
        <span
          className={cn(
            'text-xs leading-4',
            low ? 'font-semibold text-tint-danger-foreground' : 'text-muted-foreground',
          )}
        >
          {label}
        </span>
      ) : null}
    </div>
  );
}
