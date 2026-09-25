'use client';

import Link from 'next/link';
import { PackageIcon, UserRoundIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { RowActionsTrigger } from '@/components/shared/row-actions-trigger';
import { owedMinor } from '../../model/ticket';
import { TICKET_ACTION_ICON } from '../ticket-actions';
import type { ListPackage } from './package-cells';

export type RowAction = 'open' | 'pay' | 'extend' | 'transfer' | 'refund';

/**
 * A package's ⋯ (board 04, state 04): open the ticket, record a payment,
 * extend, transfer, refund, and open the student — each only when it can
 * run.
 */
export function PackageRowMenu({
  pkg,
  onAction,
}: {
  pkg: ListPackage;
  onAction: (action: RowAction, pkg: ListPackage) => void;
}) {
  const t = useTranslations('packages.list.menu');
  const tActions = useTranslations('packages.ticket.actions');
  const items: { action: Exclude<RowAction, 'open'>; shown: boolean }[] = [
    { action: 'pay', shown: owedMinor(pkg) > 0 },
    { action: 'extend', shown: pkg.expiresAt !== null },
    { action: 'transfer', shown: pkg.remainingCredits > 0 },
    { action: 'refund', shown: pkg.remainingCredits > 0 || pkg.paidMinor > 0 },
  ];
  return (
    <DropdownMenu>
      <RowActionsTrigger label={t('label', { name: pkg.student.fullName })} />
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onSelect={() => onAction('open', pkg)}>
          <PackageIcon />
          {t('open')}
        </DropdownMenuItem>
        {items
          .filter((item) => item.shown)
          .map(({ action }) => {
            const Icon = TICKET_ACTION_ICON[action];
            return (
              <DropdownMenuItem key={action} onSelect={() => onAction(action, pkg)}>
                <Icon />
                {tActions(action)}
              </DropdownMenuItem>
            );
          })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/app/students/${pkg.studentId}`}>
            <UserRoundIcon />
            {t('openStudent')}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
