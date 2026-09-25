'use client';

import Link from 'next/link';
import {
  CalendarPlusIcon,
  CirclePauseIcon,
  PencilIcon,
  UserRoundIcon,
  UsersIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { RowActionsTrigger } from '@/components/shared/row-actions-trigger';
import type { ListSchedule } from './schedule-cells';

export type ScheduleAction = 'change' | 'horizon' | 'stop';

/**
 * A schedule's «⋯» (S05 board 04): change it, how far ahead, open the
 * student or the group, and stop it. An ended schedule only opens its owner.
 */
export function ScheduleRowMenu({
  schedule,
  onAction,
}: {
  schedule: ListSchedule;
  onAction: (action: ScheduleAction, schedule: ListSchedule) => void;
}) {
  const t = useTranslations('schedules.menu');
  const active = schedule.state === 'ACTIVE';
  const href = schedule.group
    ? `/app/groups/${schedule.group.id}`
    : schedule.student
      ? `/app/students/${schedule.student.id}`
      : null;
  return (
    <DropdownMenu>
      <RowActionsTrigger
        label={t('label', { name: schedule.group?.name ?? schedule.student?.fullName ?? '' })}
      />
      <DropdownMenuContent align="end" className="w-64">
        {active ? (
          <>
            <DropdownMenuItem onSelect={() => onAction('change', schedule)}>
              <PencilIcon />
              {t('change')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAction('horizon', schedule)}>
              <CalendarPlusIcon />
              {t('horizon')}
            </DropdownMenuItem>
          </>
        ) : null}
        {href ? (
          <DropdownMenuItem asChild>
            <Link href={href}>
              {schedule.group ? <UsersIcon /> : <UserRoundIcon />}
              {schedule.group ? t('openGroup') : t('openStudent')}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {active ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onAction('stop', schedule)}>
              <CirclePauseIcon />
              {t('stop')}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
