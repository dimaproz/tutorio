import type { CSSProperties, ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * The identity block at the top of a person profile: avatar, status chips,
 * name, a meta line and the action row. Built for the student profile and
 * reusable for teacher and parent profiles.
 */
export function ProfileHero({
  avatar,
  badges,
  name,
  meta,
  contacts,
  actions,
  glyph,
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
  actions?: ReactNode;
  /** Decorative level mark, clipped to the card. Never announced. */
  glyph?: string;
  className?: string;
}) {
  const metaItems = (meta ?? []).filter(Boolean);

  return (
    <Card
      tone="indigo"
      radius="hero"
      data-slot="profile-hero"
      className={cn(
        // The handoff specifies the desktop hero only. Below md it stacks, the
        // avatar steps down and the decorative glyph is dropped: at 390px it
        // would cover the name it is meant to decorate.
        'relative items-start gap-5 p-6 md:h-80 md:flex-row md:items-center md:gap-7 md:p-8',
        className,
      )}
    >
      {glyph ? (
        // Drawn as generated content: it is wallpaper, not text, so it never
        // reaches the accessibility tree or the contrast rules that govern copy.
        <span
          aria-hidden="true"
          style={{ '--profile-glyph': `"${glyph}"` } as CSSProperties}
          className="pointer-events-none absolute -right-[18px] -bottom-[86px] hidden text-[300px] leading-[300px] font-bold tracking-[-0.06em] text-tint-indigo-glyph select-none after:content-[var(--profile-glyph)] md:block"
        />
      ) : null}

      {avatar}

      <div className="relative flex w-full min-w-0 flex-col gap-3.5">
        {badges ? <div className="flex items-center gap-2">{badges}</div> : null}
        <h1 className="text-[34px] leading-[38px] font-semibold tracking-[-0.03em] md:text-[56px] md:leading-[56px] md:tracking-[-0.04em]">
          {name}
        </h1>
        {metaItems.length > 0 ? (
          <div className="flex flex-wrap gap-2 text-sm text-ink-soft">
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
        {contacts || actions ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {contacts}
            {contacts && actions ? (
              <span
                aria-hidden="true"
                className="mx-1.5 h-7 w-px bg-tint-indigo-foreground/20"
              />
            ) : null}
            {actions}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
