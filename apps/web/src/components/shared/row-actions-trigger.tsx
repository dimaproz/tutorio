'use client';

import { MoreHorizontalIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

/**
 * The "…" button every row menu opens from. While the menu's own mutation runs
 * the dots become a spinner: the menu has already closed by then, so the
 * trigger is the only place left that can say the action is still in flight.
 */
export function RowActionsTrigger({
  busy = false,
  className,
  label,
}: {
  busy?: boolean;
  className?: string;
  /** Overrides the default "open menu" accessible name. */
  label?: string;
}) {
  const tCommon = useTranslations('common');

  return (
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className={cn('size-11 md:size-9', className)}
        aria-label={label ?? tCommon('openMenu')}
        aria-busy={busy || undefined}
        disabled={busy}
      >
        {busy ? <Spinner data-icon /> : <MoreHorizontalIcon data-icon />}
      </Button>
    </DropdownMenuTrigger>
  );
}
