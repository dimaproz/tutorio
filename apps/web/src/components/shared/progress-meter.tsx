import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * How much of a form is filled in: a bold label, a caption and one segment
 * per section. The label and caption are the caller's localized copy.
 */
export function ProgressMeter({
  value,
  total,
  label,
  caption,
  className,
}: {
  value: number;
  total: number;
  /** e.g. "4 of 6 filled". */
  label: ReactNode;
  caption?: ReactNode;
  className?: string;
}) {
  const filled = Math.min(Math.max(value, 0), total);

  return (
    <div
      data-slot="progress-meter"
      className={cn('flex flex-col gap-2.5 rounded-block bg-card px-5 py-4.5', className)}
    >
      <div className="flex justify-between gap-2 text-[13px]">
        <span className="font-semibold">{label}</span>
        {caption ? <span className="text-muted-foreground">{caption}</span> : null}
      </div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={filled}
        aria-label={typeof label === 'string' ? label : undefined}
        className="flex gap-1"
      >
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={cn('h-2 grow rounded-[4px]', index < filled ? 'bg-brand' : 'bg-border')}
          />
        ))}
      </div>
    </div>
  );
}
