'use client';

import {
  CalendarClockIcon,
  CalendarPlusIcon,
  EllipsisVerticalIcon,
  OctagonXIcon,
  PencilIcon,
  PlusIcon,
} from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import type { GroupDetail, LessonResponse, ScheduleResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { scheduleSlots, timeRange } from '@/features/groups/model/presentation';
import { useWeekdayLabels } from '@/lib/i18n/weekdays';
import { cn } from '@/lib/utils';
import { ScheduleEmptyArt } from './schedule-empty-art';

/** What the card can do; omitted, it only reads (an archived group). */
export type ScheduleCardActions = {
  onCreate: () => void;
  onChange: () => void;
  onAddDay: () => void;
  onStop: () => void;
  onCancelChange: () => void;
  cancelling: boolean;
};

/**
 * The page's one saturated card (`Card tone="feature"`: ink in light, indigo
 * in dark): the weekly rows, a planned change with «Скасувати зміну», and the
 * next lesson. Its ⋯ holds «Змінити дні або час», «Додати день» and
 * «Зупинити розклад» (S08 decision 11, the S05 dialogs). Without a schedule
 * it becomes the call to create one.
 */
export function GroupScheduleCard({
  group,
  schedule,
  lessons,
  actions,
}: {
  group: GroupDetail;
  /** The group's schedule itself (S05): its planned change and the dialogs' input. */
  schedule: ScheduleResponse | null;
  /** The group's lessons, to count what a planned change moves. */
  lessons: readonly LessonResponse[];
  actions?: ScheduleCardActions;
}) {
  const t = useTranslations('groups');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const longDays = useWeekdayLabels('long');
  const shortDays = useWeekdayLabels();
  const slots = scheduleSlots(group.schedules);
  const next = group.nextLesson;

  if (slots.length === 0) {
    return (
      <Card
        tone="feature"
        radius="hero"
        data-slot="group-schedule"
        className="relative isolate gap-4 overflow-hidden p-6.5 md:min-h-80"
      >
        <ScheduleEmptyArt className="pointer-events-none absolute top-1.5 -right-3.5 -z-10 opacity-55" />
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-tile bg-feature-soft [&_svg]:size-5"
        >
          <CalendarPlusIcon />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl leading-7 font-semibold">{t('schedule.emptyTitle')}</h2>
          <p className="text-sm leading-5 text-feature-muted">{t('schedule.emptyText')}</p>
        </div>
        {actions ? (
          <Button
            type="button"
            variant="soft"
            size="xl"
            leading={<PlusIcon />}
            className="mt-auto self-start"
            onClick={actions.onCreate}
          >
            {t('schedule.create')}
          </Button>
        ) : null}
      </Card>
    );
  }

  const planned = schedule?.nextChange ?? null;

  return (
    <Card
      tone="feature"
      radius="hero"
      data-slot="group-schedule"
      className="gap-4 p-5 md:min-h-80 md:p-6.5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t('schedule.title')}</h2>
        {actions && schedule ? <ScheduleMenu actions={actions} /> : null}
      </div>

      {/* Phones read the week as pills; wider screens as one row per day. */}
      <ul className="flex flex-wrap gap-2 md:hidden">
        {slots.map((slot) => (
          <li
            key={`${slot.weekday}-${slot.localTime}`}
            className="inline-flex h-9 items-center gap-2 rounded-control bg-feature-soft px-3 font-mono text-sm tabular-nums"
          >
            <span className="font-sans font-semibold uppercase">{shortDays[slot.weekday]}</span>
            {slot.localTime}
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-2 max-md:hidden">
        {slots.map((slot) => (
          <li
            key={`${slot.weekday}-${slot.localTime}`}
            className="flex h-10 items-center justify-between gap-3 rounded-item bg-feature-soft px-3.5"
          >
            <span className="text-sm font-semibold tracking-[0.04em] uppercase">
              {longDays[slot.weekday]}
            </span>
            <span className="font-mono text-[13px] text-feature-muted tabular-nums">
              {timeRange(slot.localTime, slot.durationMin)}
            </span>
          </li>
        ))}
      </ul>

      {planned && schedule ? (
        <PlannedChange schedule={schedule} planned={planned} lessons={lessons} actions={actions} />
      ) : null}

      <div className="mt-auto flex flex-col gap-3 border-t border-feature-line pt-4">
        {next ? (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-feature-muted">{t('schedule.next')}</span>
            <span className="text-xl leading-7 font-semibold tracking-[-0.01em]">
              {format.dateTime(new Date(next.startsAtUtc), {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
              {' · '}
              {format.dateTime(new Date(next.startsAtUtc), { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-[13px] text-feature-muted">
              {t('schedule.nextMeta', {
                title: next.notes || t('lessons.fallbackTitle'),
                relative: format.relativeTime(new Date(next.startsAtUtc), now),
              })}
            </span>
          </div>
        ) : (
          <span className="text-sm text-feature-muted">{t('schedule.noNext')}</span>
        )}
      </div>
    </Card>
  );
}

/** The card's ⋯: each command with its icon and a line of what it does. */
function ScheduleMenu({ actions }: { actions: ScheduleCardActions }) {
  const t = useTranslations('groups.schedule');
  const item = (label: string, hint?: string) => (
    <span className="flex min-w-0 flex-col">
      <span className="text-sm font-medium">{label}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </span>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('menu')}
          className="flex size-9 items-center justify-center rounded-full bg-feature-soft outline-none focus-visible:ring-2 focus-visible:ring-feature-foreground [&_svg]:size-4.5"
        >
          <EllipsisVerticalIcon />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem className="items-start" onSelect={actions.onChange}>
          <PencilIcon className="mt-0.5" />
          {item(t('menuChange'), t('menuChangeHint'))}
        </DropdownMenuItem>
        <DropdownMenuItem className="items-start" onSelect={actions.onAddDay}>
          <CalendarPlusIcon className="mt-0.5" />
          {item(t('menuAddDay'))}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" className="items-start" onSelect={actions.onStop}>
          <OctagonXIcon className="mt-0.5" />
          {item(t('menuStop'), t('menuStopHint'))}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * A change that takes effect later (L-25): the warm band with its date, the
 * new slots, how many booked lessons it moves and «Скасувати зміну».
 */
function PlannedChange({
  schedule,
  planned,
  lessons,
  actions,
}: {
  schedule: ScheduleResponse;
  planned: NonNullable<ScheduleResponse['nextChange']>;
  lessons: readonly LessonResponse[];
  actions?: ScheduleCardActions;
}) {
  const t = useTranslations('groups.schedule');
  const format = useFormatter();
  const shortDays = useWeekdayLabels();
  const from = Date.parse(planned.effectiveFrom);
  // The change is saved: its lessons already sit at the new times.
  const moving = lessons.filter(
    (lesson) => lesson.status === 'SCHEDULED' && Date.parse(lesson.startsAtUtc) >= from,
  ).length;
  const times = [...new Set(planned.slots.map((slot) => slot.localTime))];
  const slots = [...planned.slots].sort(
    (a, b) =>
      ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7) || a.localTime.localeCompare(b.localTime),
  );
  const caption =
    moving === 0
      ? t('plannedNone')
      : times.length === 1
        ? t('plannedMoves', {
            count: moving,
            range: timeRange(times[0]!, schedule.durationMin),
          })
        : t('plannedMovesNoTime', { count: moving });

  return (
    <div className="flex flex-col gap-2 rounded-item bg-warning/22 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-semibold [&_svg]:size-[15px]">
          <CalendarClockIcon />
          {t('plannedFrom', {
            date: format.dateTime(new Date(planned.effectiveFrom), {
              day: 'numeric',
              month: 'long',
            }),
          })}
        </span>
        {actions ? (
          <button
            type="button"
            disabled={actions.cancelling}
            onClick={actions.onCancelChange}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm text-[13px] font-medium text-feature-muted underline outline-none focus-visible:ring-2 focus-visible:ring-feature-foreground',
              'disabled:opacity-60',
            )}
          >
            {actions.cancelling ? <Spinner className="size-3.5" /> : null}
            {t('cancelChange')}
          </button>
        ) : null}
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {slots.map((slot) => (
          <li
            key={`${slot.weekday}-${slot.localTime}`}
            className="inline-flex h-7 items-center gap-1.5 rounded-control bg-feature-soft px-2.5 font-mono text-[13px] tabular-nums"
          >
            <span className="font-sans font-semibold uppercase">{shortDays[slot.weekday]}</span>
            {slot.localTime}
          </li>
        ))}
      </ul>
      <span className="text-xs text-feature-muted">{caption}</span>
    </div>
  );
}
