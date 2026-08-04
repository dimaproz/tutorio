'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRightIcon, XIcon } from 'lucide-react';
import { EntityAvatar } from '@/components/app/entity-avatar';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';

// The single person card — avatar + name + optional subtitle/badge — used for
// parents, students and teachers alike. Three trailing modes:
//   href     → a link with a chevron (navigate to the profile)
//   onRemove → an unlink button (used in editable lists)
//   neither  → a static read-only card (e.g. a locked field in a form)
export function PersonMiniCard({
  avatarKey,
  fullName,
  subtitle,
  badge,
  href,
  onRemove,
  removeLabel,
  className,
}: {
  avatarKey?: string | null;
  fullName: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  href?: string;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
}) {
  const body = (
    <>
      <ItemMedia>
        <EntityAvatar avatarKey={avatarKey} fullName={fullName} size="sm" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          <span className="truncate">{fullName}</span>
          {badge}
        </ItemTitle>
        {subtitle ? <ItemDescription>{subtitle}</ItemDescription> : null}
      </ItemContent>
    </>
  );

  if (href) {
    return (
      <Item asChild variant="outline" className={className}>
        <Link href={href}>
          {body}
          <ItemActions>
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </ItemActions>
        </Link>
      </Item>
    );
  }

  return (
    <Item variant="outline" className={className}>
      {body}
      {onRemove ? (
        <ItemActions>
          <button
            type="button"
            onClick={onRemove}
            aria-label={removeLabel}
            className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <XIcon className="size-4" />
          </button>
        </ItemActions>
      ) : null}
    </Item>
  );
}
