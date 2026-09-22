import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The product empty state: indigo icon tile, title, one line of explanation
 * and an optional action, centred in an optional dashed frame.
 */
export function EmptyState({
  icon,
  title,
  text,
  action,
  framed = true,
  minHeight = 280,
  media,
  pattern = false,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
  framed?: boolean;
  minHeight?: number;
  /** Replaces the icon tile, e.g. with an avatar stack. */
  media?: ReactNode;
  /** A dotted card ground for a whole-page empty state. */
  pattern?: boolean;
  className?: string;
}) {
  return (
    <div
      data-slot="empty-state"
      style={{ minHeight }}
      className={cn(
        'flex w-full flex-col items-center justify-center gap-3.5 rounded-[22px] p-6 text-center text-foreground',
        framed && 'border-[1.5px] border-dashed border-border',
        pattern &&
          'rounded-card bg-card bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[18px_18px]',
        className,
      )}
    >
      {media ?? (
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-tile bg-tint-indigo text-tint-indigo-foreground [&_svg]:size-6"
        >
          {icon}
        </span>
      )}
      <div className="flex max-w-95 flex-col gap-1.5">
        <p className="text-lg leading-6 font-semibold">{title}</p>
        {text ? <p className="text-sm leading-5 text-muted-foreground">{text}</p> : null}
      </div>
      {action}
    </div>
  );
}
