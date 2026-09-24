'use client';

import Link from 'next/link';
import {
  ArchiveIcon,
  ExternalLinkIcon,
  PencilIcon,
  RotateCcwIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { RowActionsTrigger } from '@/components/shared/row-actions-trigger';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

/**
 * The row menu of a group: open, edit and schedule a lesson; for the owner,
 * archive under a divider. An archived group offers only open and restore.
 */
export function GroupRowActions({
  group,
  archived,
  canArchive,
  onArchive,
  onRestore,
  busy = false,
}: {
  group: { id: string; name: string };
  archived: boolean;
  canArchive: boolean;
  onArchive: () => void;
  onRestore: () => void;
  busy?: boolean;
}) {
  const t = useTranslations('groups.actions');

  return (
    <DropdownMenu>
      <RowActionsTrigger busy={busy} label={t('menu', { name: group.name })} />
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link prefetch={false} href={`/app/groups/${group.id}`}>
              <ExternalLinkIcon data-icon />
              {t('open')}
            </Link>
          </DropdownMenuItem>
          {archived ? null : (
            <>
              <DropdownMenuItem asChild>
                <Link prefetch={false} href={`/app/groups/${group.id}/edit`}>
                  <PencilIcon data-icon />
                  {t('edit')}
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuGroup>
        {canArchive ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {archived ? (
                <DropdownMenuItem onSelect={onRestore}>
                  <RotateCcwIcon data-icon />
                  {t('restore')}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={onArchive}>
                  <ArchiveIcon data-icon />
                  {t('archive')}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
