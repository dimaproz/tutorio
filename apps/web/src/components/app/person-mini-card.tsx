'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRightIcon, XIcon } from 'lucide-react';
import { EntityAvatar } from '@/components/app/entity-avatar';
import { cn } from '@/lib/utils';

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
      <EntityAvatar avatarKey={avatarKey} fullName={fullName} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 truncate text-sm font-medium">
          <span className="truncate">{fullName}</span>
          {badge}
        </span>
        {subtitle ? (
          <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </div>
    </>
  );

  const shell = 'flex items-center gap-3 rounded-xl border p-3';

  if (href) {
    return (
      <Link href={href} className={cn(shell, 'transition-colors hover:bg-muted/50', className)}>
        {body}
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    );
  }

  return (
    <div className={cn(shell, className)}>
      {body}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <XIcon className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
