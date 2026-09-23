'use client';

import Link from 'next/link';
import { CalendarIcon } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import type { GroupDetail } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { scheduleSlots, timeRange } from '@/features/groups/model/presentation';
import { useWeekdayLabels } from '@/lib/i18n/weekdays';

/**
 * The page's one saturated card (`Card tone="feature"`: ink in light, indigo
 * in dark): the weekly rows, the next lesson and "Open lesson". Without a
 * schedule it becomes the call to set one up. Days and time change on the
 * recurring-lessons screen, which says what it rebuilds.
 */
export function GroupScheduleCard({
  group,
  archived,
  onOpenLesson,
}: {
  group: GroupDetail;
  archived: boolean;
  onOpenLesson: () => void;
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
        className="justify-center gap-4 p-6.5 md:min-h-80"
      >
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-tile bg-feature-soft [&_svg]:size-5"
        >
          <CalendarIcon />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl leading-7 font-semibold">{t('schedule.emptyTitle')}</h2>
          <p className="text-sm leading-5 text-feature-muted">{t('schedule.emptyText')}</p>
        </div>
        {archived ? null : (
          <Button asChild variant="soft" size="xl" className="self-start">
            <Link prefetch={false} href={`/app/groups/${group.id}/edit#group-form-schedule`}>
              {t('schedule.setUp')}
            </Link>
          </Button>
        )}
      </Card>
    );
  }

  return (
    <Card
      tone="feature"
      radius="hero"
      data-slot="group-schedule"
      className="gap-4 p-5 md:min-h-80 md:p-6.5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t('schedule.title')}</h2>
        {archived ? null : (
          <Button asChild variant="dark-outline" size="xs" className="max-md:h-11">
            <Link prefetch={false} href="/app/lessons/patterns">
              {t('schedule.change')}
            </Link>
          </Button>
        )}
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

      <div className="mt-auto flex flex-col gap-3 border-t border-feature-line pt-4">
        {next ? (
          <>
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
            <Button
              type="button"
              variant="soft"
              size="xl"
              className="w-full max-md:hidden"
              onClick={onOpenLesson}
            >
              {t('schedule.openLesson')}
            </Button>
          </>
        ) : (
          <span className="text-sm text-feature-muted">{t('schedule.noNext')}</span>
        )}
      </div>
    </Card>
  );
}
