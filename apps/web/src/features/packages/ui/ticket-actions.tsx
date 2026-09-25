'use client';

import Link from 'next/link';
import {
  ArrowRightIcon,
  BanknoteIcon,
  CalendarPlusIcon,
  PackagePlusIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  UserRoundIcon,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { RowActionsTrigger } from '@/components/shared/row-actions-trigger';
import type { TicketAction } from '../model/ticket';

export type TicketOperation = TicketAction | 'adjust' | 'delete';

export const TICKET_ACTION_ICON: Record<TicketAction, LucideIcon> = {
  pay: BanknoteIcon,
  sell: PackagePlusIcon,
  extend: CalendarPlusIcon,
  transfer: ArrowRightIcon,
  refund: RotateCcwIcon,
};

/**
 * The ticket's buttons (board 02): the state's actions with the primary one
 * in ink, then the ⋯ with the correction, the delete and the student.
 */
export function TicketActions({
  actions,
  studentHref,
  onAction,
}: {
  actions: { action: TicketAction; primary: boolean }[];
  studentHref: string | null;
  onAction: (operation: TicketOperation) => void;
}) {
  const t = useTranslations('packages.ticket.actions');
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map(({ action, primary }) => {
        const Icon = TICKET_ACTION_ICON[action];
        return (
          <Button
            key={action}
            type="button"
            size="sm"
            variant={primary ? 'default' : 'outline'}
            onClick={() => onAction(action)}
          >
            <Icon data-icon="inline-start" />
            {t(action)}
          </Button>
        );
      })}
      <DropdownMenu>
        <RowActionsTrigger label={t('more')} className="ml-auto" />
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onSelect={() => onAction('adjust')}>
            <SlidersHorizontalIcon />
            {t('adjust')}
          </DropdownMenuItem>
          {studentHref ? (
            <DropdownMenuItem asChild>
              <Link href={studentHref}>
                <UserRoundIcon />
                {t('openStudent')}
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => onAction('delete')}>
            <Trash2Icon />
            {t('delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
