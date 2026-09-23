import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// `ink` is the row inside the highlight card, so it reads the feature pair.
const TONE_CLASS = {
  surface: 'text-foreground',
  soft: 'bg-secondary p-2.5 text-foreground',
  ink: 'bg-feature-soft p-2.5 text-feature-foreground',
} as const;

const SUBTITLE_TONE_CLASS = {
  surface: 'text-muted-foreground',
  soft: 'text-muted-foreground',
  ink: 'text-feature-muted',
} as const;

export type PersonItemTone = keyof typeof TONE_CLASS;

/**
 * A person as a row: media, name, subtitle and an optional action or trailing
 * control. Shared by the family card, the lesson ticket, the sidebar account
 * card and the workspace switcher.
 *
 * With `href` the whole row links to that record: the name becomes a stretched
 * overlay anchor, so `action` and `menu` stay outside the link and keep their
 * own focus and clicks, and the row takes the collection-row hover.
 */
export function PersonItem({
  media,
  name,
  subtitle,
  action,
  menu,
  trail,
  href,
  hrefLabel,
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
  /** The `…` overflow trigger, after `action`. */
  menu?: ReactNode;
  /** Makes the whole row a link to the person's record. */
  href?: string;
  /** Accessible name of the row link when the visible name is not enough. */
  hrefLabel?: string;
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
        href &&
          'relative transition-[background-color,box-shadow] duration-150 hover:bg-surface-hover hover:shadow-[inset_0_0_0_1px_var(--border)] has-[a:focus-visible]:bg-surface-hover',
        href && tone === 'surface' && '-mx-2.5 w-auto px-2.5 py-2',
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
          {href ? (
            <Link
              prefetch={false}
              href={href}
              aria-label={hrefLabel}
              className="outline-none after:absolute after:inset-0 after:rounded-tile focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
            >
              {name}
            </Link>
          ) : (
            name
          )}
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
      {menu || href ? (
        // Above the row link, so the controls keep their own clicks.
        <div className="relative z-1 flex shrink-0 items-center gap-1">
          {action}
          {menu}
        </div>
      ) : (
        action
      )}
      {trail ? (
        <span
          aria-hidden="true"
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-[10px]',
            tone === 'ink' ? 'text-feature-muted' : 'text-muted-foreground',
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
      className="flex size-6.5 shrink-0 items-center justify-center rounded-lg bg-tile-indigo text-xs font-bold text-tile-indigo-foreground"
    >
      {initials}
    </span>
  );
}
