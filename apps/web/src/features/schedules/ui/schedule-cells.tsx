'use client';

import {
  ArchiveIcon,
  CalendarClockIcon,
  CircleCheckIcon,
  LayersIcon,
  RepeatIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ScheduleResponse } from '@tutorio/validation';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { StatusBadge } from '@/components/shared/status-badges';
import { SlotChips, useDayCode, useLengthLabel } from '@/features/lessons';
import { useLocalFormatter } from '@/lib/i18n/local-formatter';
import { cn } from '@/lib/utils';
import { plannedChanges, scheduleStatus } from '../model/filters';

export type ListSchedule = ScheduleResponse;

/** «1 вер», «22 жовт»: a short date without the month's period. */
export function useShortDate() {
  const format = useLocalFormatter();
  return (iso: string) =>
    format.dateTime(new Date(iso), { day: 'numeric', month: 'short' }).replace(/\.$/, '');
}

/** The group's tile, or the student's avatar. */
export function ScheduleMedia({
  schedule,
  size = 'md',
}: {
  schedule: ListSchedule;
  size?: 'sm' | 'md';
}) {
  if (schedule.group) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-center justify-center rounded-item bg-tile-indigo text-tile-indigo-foreground [&_svg]:size-5',
          size === 'md' ? 'size-11' : 'size-10',
        )}
      >
        <LayersIcon />
      </span>
    );
  }
  return (
    <EntityAvatar
      avatarKey={schedule.student?.avatarKey}
      fullName={schedule.student?.fullName ?? ''}
      size={size}
    />
  );
}

/** Who the schedule is for, and «Індивідуальне» or «Група · 6 учнів» under it. */
export function WhoCell({ schedule }: { schedule: ListSchedule }) {
  const t = useTranslations('schedules.list');
  return (
    <div className="flex min-w-0 items-center gap-3.5">
      <ScheduleMedia schedule={schedule} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[15px] leading-5 font-semibold">
          {schedule.group?.name ?? schedule.student?.fullName ?? ''}
        </span>
        <span className="truncate text-[13px] leading-[18px] text-muted-foreground">
          {schedule.group ? t('groupOf', { count: schedule.group.memberCount }) : t('individual')}
        </span>
      </div>
    </div>
  );
}

/** The slots as chips with the length under them. */
export function SlotsCell({ schedule }: { schedule: ListSchedule }) {
  const length = useLengthLabel();
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      <SlotChips slots={schedule.slots} />
      <span className="text-[13px] leading-[18px] text-muted-foreground">
        {length(schedule.durationMin)}
      </span>
    </div>
  );
}

/** The state badge and its caption: since, until, or the planned change. */
export function StatusCell({
  schedule,
  className,
}: {
  schedule: ListSchedule;
  className?: string;
}) {
  const t = useTranslations('schedules.status');
  const short = useShortDate();
  const code = useDayCode();
  const status = scheduleStatus(schedule);
  const since = schedule.startsAt ? short(schedule.startsAt) : null;
  let badge;
  let caption: string | null;
  switch (status.kind) {
    case 'ended':
      badge = <StatusBadge tone="neutral" icon={ArchiveIcon} label={t('ended')} />;
      caption =
        since && schedule.endsAt
          ? t('endedRange', {
              from: since,
              to: short(new Date(Date.parse(schedule.endsAt) - 1).toISOString()),
            })
          : null;
      break;
    case 'changing':
      badge = (
        <StatusBadge
          tone="info"
          icon={RepeatIcon}
          label={t('changing', { date: short(status.from) })}
        />
      );
      caption = plannedChanges(schedule)
        .map((change) =>
          change.before && change.after
            ? `${code(change.weekday)} ${change.before} → ${change.after}`
            : change.after
              ? `+ ${code(change.weekday)} ${change.after}`
              : `− ${code(change.weekday)} ${change.before}`,
        )
        .join(' · ');
      break;
    case 'until':
      badge = (
        <StatusBadge
          tone="warning"
          icon={CalendarClockIcon}
          label={t('until', { date: short(status.lastDay) })}
        />
      );
      caption = since ? t('sinceUntil', { from: since, to: short(status.lastDay) }) : null;
      break;
    case 'active':
      badge = <StatusBadge tone="success" icon={CircleCheckIcon} label={t('active')} />;
      caption = since ? t('sinceOpen', { from: since }) : null;
      break;
  }
  return (
    <div className={cn('flex min-w-0 flex-col items-start gap-1.5', className)}>
      {badge}
      {caption ? (
        <span className="truncate text-[13px] leading-[18px] text-muted-foreground">{caption}</span>
      ) : null}
    </div>
  );
}

/** The next lesson («сьогодні 18:00» in the brand colour) and how far ahead it is booked. */
export function NextCell({
  schedule,
  now,
  align = 'start',
}: {
  schedule: ListSchedule;
  now: number;
  align?: 'start' | 'end';
}) {
  const t = useTranslations('schedules.list');
  const format = useLocalFormatter();
  const short = useShortDate();
  if (!schedule.nextLessonAt || schedule.state === 'ENDED') {
    return <span className="text-muted-foreground">—</span>;
  }
  const next = new Date(schedule.nextLessonAt);
  const today = next.toDateString() === new Date(now).toDateString();
  const time = format.time(next);
  return (
    <div className={cn('flex min-w-0 flex-col', align === 'end' ? 'items-end' : 'items-start')}>
      <span
        className={cn('text-[15px] leading-5 font-semibold tabular-nums', today && 'text-brand')}
      >
        {today
          ? t('today', { time })
          : `${format.dateTime(next, { weekday: 'short' })} ${short(schedule.nextLessonAt)} · ${time}`}
      </span>
      {schedule.lastLessonAt ? (
        <span className="text-[13px] leading-[18px] text-muted-foreground">
          {t('bookedUntil', { date: short(schedule.lastLessonAt) })}
        </span>
      ) : null}
    </div>
  );
}
