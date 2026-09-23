'use client';

import Link from 'next/link';
import { PencilIcon, PhoneIcon, UserIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ParentListItem } from '@tutorio/validation';
import { RowActionsTrigger } from '@/components/shared/row-actions-trigger';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

/**
 * The row menu of a parent in the collection: open, call when a phone is on
 * file, edit, and — for the owner only — the permanent delete under a divider.
 */
export function ParentRowActions({
  parent,
  canDelete,
  onDelete,
  busy = false,
}: {
  parent: Pick<ParentListItem, 'id' | 'fullName' | 'phone'>;
  canDelete: boolean;
  onDelete: () => void;
  busy?: boolean;
}) {
  const t = useTranslations('parents');
  const tCommon = useTranslations('common');

  return (
    <DropdownMenu>
      <RowActionsTrigger busy={busy} label={t('rowActions', { name: parent.fullName })} />
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link prefetch={false} href={`/app/parents/${parent.id}`}>
              <UserIcon data-icon />
              {t('openProfile')}
            </Link>
          </DropdownMenuItem>
          {parent.phone ? (
            <DropdownMenuItem asChild>
              <a href={`tel:${parent.phone}`}>
                <PhoneIcon data-icon />
                {t('call')}
              </a>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link prefetch={false} href={`/app/parents/${parent.id}/edit`}>
              <PencilIcon data-icon />
              {tCommon('edit')}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {canDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <XIcon data-icon />
                {t('detail.delete')}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
