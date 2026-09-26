'use client';

import Link from 'next/link';
import {
  CalendarClockIcon,
  CircleStopIcon,
  LayersIcon,
  SquareArrowOutUpRightIcon,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ScheduleResponse } from '@tutorio/validation';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { RowActionsTrigger } from '@/components/shared/row-actions-trigger';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { SlotChips } from '@/features/lessons';
import { zonedDate, zonedDateTime } from '@/lib/datetime';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { cn } from '@/lib/utils';
import { scheduleMark } from '../model/presentation';

/**
 * One schedule on the teacher's profile (S09 «Розклади»): the group tile or
 * the student, «група · 5 учнів» or «індивідуально» with a status dot only
 * when needed (a planned change, an end date), one badge per weekday, the
 * next lesson (today in the brand colour) and ⋯ with the S05 change and stop.
 * Phones and tablets stack the badges under the name.
 */
export function TeacherScheduleRow({
  schedule,
  now,
  onChange,
  onStop,
}: {
  schedule: ScheduleResponse;
  now: number;
  /** Omitted on an archived profile. */
  onChange?: () => void;
  onStop?: () => void;
}) {
  const t = useTranslations('teachers.profile.work');
  const format = useFormatter();
  const timeZone = useStudioTimeZone();
  const mark = scheduleMark(schedule, timeZone);
  const at = (date: string) => new Date(zonedDateTime(date, '12:00', timeZone));
  const day = (date: string) => format.dateTime(at(date), { day: 'numeric', month: 'short' });
  const name = schedule.group?.name ?? schedule.student?.fullName ?? '';
  const href = schedule.group
    ? `/app/groups/${schedule.group.id}`
    : schedule.student
      ? `/app/students/${schedule.student.id}`
      : null;

  const next = schedule.nextLessonAt;
  const today = next ? zonedDate(next, timeZone) === zonedDate(now, timeZone) : false;
  const nextLabel = !next
    ? t('nextNone')
    : today
      ? t('nextToday', {
          time: format.dateTime(new Date(next), { hour: '2-digit', minute: '2-digit' }),
        })
      : format.dateTime(new Date(next), {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });

  return (
    <li className="grid min-h-15 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-2 border-b border-border py-3 last:border-b-0 lg:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1.2fr)_auto_auto]">
      {schedule.group ? (
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-tile bg-tile-indigo text-tile-indigo-foreground [&_svg]:size-4.5"
        >
          <LayersIcon />
        </span>
      ) : (
        <EntityAvatar avatarKey={schedule.student?.avatarKey} fullName={name} size="sm" />
      )}
      <div className="flex min-w-0 flex-col">
        {href ? (
          <Link
            prefetch={false}
            href={href}
            className="truncate text-sm font-semibold hover:underline"
          >
            {name}
          </Link>
        ) : (
          <span className="truncate text-sm font-semibold">{name}</span>
        )}
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span>
            {schedule.group ? t('group', { count: schedule.group.memberCount }) : t('individual')}
          </span>
          {mark ? (
            <span
              className={cn(
                'inline-flex items-center gap-1.5',
                mark.tone === 'info' ? 'text-tint-info-foreground' : 'text-tint-warning-foreground',
              )}
            >
              <span aria-hidden="true" className="size-1.5 rounded-pill bg-current" />
              {mark.tone === 'info'
                ? t('changeFrom', { date: day(mark.from) })
                : t('until', { date: day(mark.until) })}
            </span>
          ) : null}
        </span>
      </div>
      <SlotChips
        slots={schedule.slots}
        className="col-span-3 col-start-2 row-start-2 gap-1.5 lg:col-span-1 lg:col-start-3 lg:row-start-1"
      />
      <span
        className={cn(
          'col-start-3 row-start-1 text-right text-[13px] whitespace-nowrap tabular-nums lg:col-start-4',
          today ? 'font-semibold text-brand' : 'text-muted-foreground',
        )}
      >
        {nextLabel}
      </span>
      {onChange || onStop ? (
        <DropdownMenu>
          <RowActionsTrigger label={t('menu')} className="col-start-4 row-start-1 lg:col-start-5" />
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              {href ? (
                <DropdownMenuItem asChild>
                  <Link prefetch={false} href={href}>
                    <SquareArrowOutUpRightIcon data-icon />
                    {t('open')}
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {onChange ? (
                <DropdownMenuItem onSelect={onChange}>
                  <CalendarClockIcon data-icon />
                  {t('change')}
                </DropdownMenuItem>
              ) : null}
              {onStop ? (
                <DropdownMenuItem onSelect={onStop}>
                  <CircleStopIcon data-icon />
                  {t('stop')}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </li>
  );
}
