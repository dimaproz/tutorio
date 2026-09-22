import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const TONE_CLASS = {
  surface: 'text-foreground',
  soft: 'bg-secondary p-2.5 text-foreground',
  ink: 'bg-ink-soft p-2.5 text-ink-foreground',
} as const;

const SUBTITLE_TONE_CLASS = {
  surface: 'text-muted-foreground',
  soft: 'text-muted-foreground',
  ink: 'text-ink-muted',
} as const;

export type PersonItemTone = keyof typeof TONE_CLASS;

/**
 * A person as a row: media, name, subtitle and an optional action or trailing
 * control. Shared by the family card, the lesson ticket, the sidebar account
 * card and the workspace switcher.
 */
export function PersonItem({
  media,
  name,
  subtitle,
  action,
  trail,
  tone = 'surface',
  size = 'md',
  className,
}: {
  /** Avatar, initials tile or any other leading media. */
  media?: ReactNode;
  name: ReactNode;
  subtitle?: ReactNode;
  /** Primary control on the trailing edge, typically a round icon button. */
  action?: ReactNode;
  /**
   * Quieter trailing decoration, such as a chevron. It is hidden from
   * assistive technology, so it must never contain anything focusable —
   * controls belong in `action`.
   */
  trail?: ReactNode;
  tone?: PersonItemTone;
  size?: 'md' | 'sm';
  className?: string;
}) {
  return (
    <div
      data-slot="person-item"
      data-tone={tone}
      className={cn(
        'flex w-full items-center rounded-tile',
        size === 'sm' ? 'gap-2.5' : 'gap-3',
        TONE_CLASS[tone],
        className,
      )}
    >
      {media}
      <div className="flex min-w-0 grow flex-col">
        <span
          className={cn(
            'truncate font-semibold',
            size === 'sm' ? 'text-[13px] leading-[17px]' : 'text-[15px] leading-5',
          )}
        >
          {name}
        </span>
        {subtitle ? (
          <span
            className={cn(
              'truncate text-[13px]',
              size === 'sm' ? 'leading-[17px]' : 'leading-[18px]',
              SUBTITLE_TONE_CLASS[tone],
            )}
          >
            {subtitle}
          </span>
        ) : null}
      </div>
      {action}
      {trail ? (
        <span
          aria-hidden="true"
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-[10px]',
            tone === 'ink' ? 'text-ink-muted' : 'text-muted-foreground',
          )}
        >
          {trail}
        </span>
      ) : null}
    </div>
  );
}

/** Square initials tile used where a round avatar would read as a person. */
export function PersonItemTile({ initials }: { initials: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-6.5 shrink-0 items-center justify-center rounded-lg bg-tint-indigo text-xs font-bold text-tint-indigo-foreground"
    >
      {initials}
    </span>
  );
}
