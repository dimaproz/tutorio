import type { CSSProperties, ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * The identity block at the top of a person profile: avatar, status chips,
 * name, a meta line and the action row. One implementation, two layouts:
 * on desktop the avatar sits beside a 320px column; on phones the chips move
 * beside a smaller avatar and the primary action takes the full width.
 * Built for the student profile and reusable for teacher and parent profiles.
 */
export function ProfileHero({
  avatar,
  badges,
  name,
  meta,
  contacts,
  primaryAction,
  actions,
  glyph,
  dim = false,
  className,
}: {
  avatar: ReactNode;
  /** Status and lifecycle chips above the name. */
  badges?: ReactNode;
  name: ReactNode;
  /** Meta values; separators are drawn between them. */
  meta?: ReactNode[];
  /** Round contact buttons, shown before the divider in the action row. */
  contacts?: ReactNode;
  /** The one primary command. Full width on phones. */
  primaryAction?: ReactNode;
  /** Secondary commands after the primary one. */
  actions?: ReactNode;
  /** Decorative level mark, clipped to the card. Never announced. */
  glyph?: string;
  /** Quiets the hero for a record that is archived. */
  dim?: boolean;
  className?: string;
}) {
  const metaItems = (meta ?? []).filter(Boolean);
  const hasRow = Boolean(contacts || primaryAction || actions);

  return (
    <Card
      tone="indigo"
      radius="hero"
      data-slot="profile-hero"
      data-dim={dim || undefined}
      className={cn(
        'relative grid grid-cols-[auto_minmax(0,1fr)] content-center items-center gap-x-4 gap-y-4 p-5 md:min-h-80 md:gap-x-7 md:gap-y-3.5 md:py-8 md:pr-3 md:pl-8',
        className,
      )}
    >
      {glyph ? (
        // Drawn as generated content: it is wallpaper, not text, so it never
        // reaches the accessibility tree or the contrast rules that govern copy.
        <span
          aria-hidden="true"
          style={{ '--profile-glyph': `"${glyph}"` } as CSSProperties}
          className="pointer-events-none absolute -top-9 -right-3 text-[150px] leading-[150px] font-bold tracking-[-0.06em] text-tint-indigo-glyph select-none after:content-[var(--profile-glyph)] md:top-auto md:-right-[18px] md:-bottom-[86px] md:text-[300px] md:leading-[300px]"
        />
      ) : null}

      <div
        className={cn('relative md:row-span-4 md:self-center', dim && '[&_img]:grayscale-[0.6]')}
      >
        {avatar}
      </div>

      {badges ? (
        <div className="relative flex flex-col items-start gap-2 md:flex-row md:items-center md:self-end">
          {badges}
        </div>
      ) : null}

      <h1
        className={cn(
          'relative col-span-2 text-[32px] leading-9 font-semibold tracking-[-0.03em] break-words md:col-span-1 md:col-start-2 md:text-[56px] md:leading-[56px] md:tracking-[-0.04em]',
          dim && 'text-tint-indigo-meta',
        )}
      >
        {name}
      </h1>

      {metaItems.length > 0 ? (
        <div className="relative col-span-2 -mt-2 flex flex-wrap gap-2 text-[13px] text-tint-indigo-meta md:col-span-1 md:col-start-2 md:mt-0 md:text-sm">
          {metaItems.map((item, index) => (
            // Meta values are positional and static within a render.
            <span key={index} className="contents">
              {index > 0 ? (
                <span aria-hidden="true" className="text-tint-indigo-foreground">
                  •
                </span>
              ) : null}
              <span>{item}</span>
            </span>
          ))}
        </div>
      ) : null}

      {primaryAction ? (
        <div className="relative col-span-2 flex *:grow md:hidden">{primaryAction}</div>
      ) : null}

      {hasRow ? (
        <div className="relative col-span-2 flex flex-wrap items-center gap-2 md:col-span-1 md:col-start-2 md:mt-1.5 md:self-start">
          {contacts}
          {contacts && (primaryAction || actions) ? (
            <span aria-hidden="true" className="mx-1.5 h-7 w-px bg-tint-indigo-foreground/20" />
          ) : null}
          {primaryAction ? <div className="hidden md:contents">{primaryAction}</div> : null}
          <div className="ml-auto flex gap-2 md:ml-0">{actions}</div>
        </div>
      ) : null}
    </Card>
  );
}
