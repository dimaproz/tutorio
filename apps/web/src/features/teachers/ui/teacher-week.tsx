'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CalendarDaysIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LayersIcon,
  PlusIcon,
  XIcon,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { IconButton } from '@/components/shared/icon-button';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { addCalendarDays, calendarWeekday, zonedDateTime } from '@/lib/datetime';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { useWeekdayLabels } from '@/lib/i18n/weekdays';
import { readableFill } from '@/lib/theme/user-colors';
import { cn } from '@/lib/utils';
import type { TeacherWeek as Week, WeekDay, WeekLesson } from '../model/presentation';

/** The fill of a lesson by where it stands (S09 week block). */
const BLOCK = {
  done: 'bg-[color-mix(in_oklab,var(--teacher)_8%,var(--card))] text-muted-foreground',
  miss: 'bg-tint-danger text-tint-danger-foreground',
  // The colour itself, darkened when needed so the text reads (AA).
  next: 'bg-(--teacher-fill) text-(--teacher-ink)',
  planned:
    'border-l-[3px] border-(--teacher) bg-[color-mix(in_oklab,var(--teacher)_16%,var(--card))] text-foreground',
} as const;

function StateGlyph({ state }: { state: WeekLesson['state'] }) {
  if (state === 'done') return <CheckIcon aria-hidden="true" className="size-3.5 shrink-0" />;
  if (state === 'miss') return <XIcon aria-hidden="true" className="size-3.5 shrink-0" />;
  return null;
}

type WeekProps = {
  week: Week | null;
  color: string;
  /** The week is being read. */
  loading: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onOpenLesson: (lessonId: string) => void;
  /** Omitted for an archived teacher: nothing new is booked for them. */
  onNewLesson?: () => void;
  calendarHref: string;
};

function useDayFormat() {
  const format = useFormatter();
  const timeZone = useStudioTimeZone();
  const at = (date: string) => new Date(zonedDateTime(date, '12:00', timeZone));
  return {
    range: (monday: string) =>
      format.dateTimeRange(at(monday), at(addCalendarDays(monday, 6)), {
        day: 'numeric',
        month: 'long',
      }),
    rangeShort: (monday: string) =>
      format.dateTimeRange(at(monday), at(addCalendarDays(monday, 6)), {
        day: 'numeric',
        month: 'short',
      }),
    long: (date: string) =>
      format.dateTime(at(date), { weekday: 'long', day: 'numeric', month: 'long' }),
  };
}

/**
 * «Тиждень» on the profile (S09 board 02): the teacher's week in their colour
 * — held lessons faded with ✓, a miss in the danger tint with ✗, the next one
 * filled, the rest tinted with a mark —, a day without lessons «вихідний».
 * Seven columns on a desktop; below it a strip of day tiles with lesson dots
 * and the chosen day's lessons as rows. A lesson opens the lesson panel.
 */
export function TeacherWeek(props: WeekProps) {
  const t = useTranslations('teachers.profile.week');
  const days = useDayFormat();
  const { week, color } = props;
  const solid = readableFill(color);
  const style = {
    '--teacher': color,
    '--teacher-fill': solid.fill,
    '--teacher-ink': solid.ink,
  } as React.CSSProperties;
  const summary = week
    ? t('summary', { total: week.total, held: week.held, ahead: week.ahead })
    : null;

  return (
    <Card style={style} className="gap-5 px-4 py-5 md:px-6 md:py-6">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 grow flex-col gap-0.5 lg:flex-row lg:items-baseline lg:gap-3">
          <h2 className="text-xl leading-7 font-semibold">{t('title')}</h2>
          {week ? (
            <>
              <p className="text-[13px] text-muted-foreground max-lg:hidden">{summary}</p>
              <p className="text-[13px] text-muted-foreground lg:hidden">
                {t('summaryShort', { range: days.rangeShort(week.monday), total: week.total })}
              </p>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            icon={<ChevronLeftIcon />}
            label={t('previous')}
            size={36}
            border
            onClick={props.onPrevious}
          />
          {week ? (
            <span className="text-[15px] font-semibold whitespace-nowrap max-lg:hidden">
              {days.range(week.monday)}
            </span>
          ) : null}
          <IconButton
            icon={<ChevronRightIcon />}
            label={t('next')}
            size={36}
            border
            onClick={props.onNext}
          />
        </div>
        <Button asChild variant="outline" className="max-lg:hidden">
          <Link href={props.calendarHref}>
            <CalendarDaysIcon data-icon="inline-start" />
            {t('openCalendar')}
          </Link>
        </Button>
        {props.onNewLesson ? (
          <Button type="button" onClick={props.onNewLesson} className="max-md:hidden">
            <PlusIcon data-icon="inline-start" />
            {t('newLesson')}
          </Button>
        ) : null}
      </header>

      {!week || props.loading ? (
        <Skeleton className="h-60 w-full rounded-block" />
      ) : (
        <>
          <WeekColumns week={week} onOpenLesson={props.onOpenLesson} />
          <DayStrip
            key={week.monday}
            week={week}
            calendarHref={props.calendarHref}
            onOpenLesson={props.onOpenLesson}
          />
        </>
      )}
    </Card>
  );
}

function lessonLabelKey(state: WeekLesson['state']) {
  return state === 'done'
    ? 'lessonDone'
    : state === 'miss'
      ? 'lessonMiss'
      : state === 'next'
        ? 'lessonNext'
        : 'lessonPlanned';
}

function WeekColumns({
  week,
  onOpenLesson,
}: {
  week: Week;
  onOpenLesson: (lessonId: string) => void;
}) {
  const t = useTranslations('teachers.profile.week');
  const weekdays = useWeekdayLabels();
  return (
    <ol className="grid grid-cols-7 gap-2 max-lg:hidden">
      {week.days.map((day) => (
        <li
          key={day.date}
          aria-current={day.today ? 'date' : undefined}
          className={cn(
            'flex min-w-0 flex-col gap-2 rounded-tile p-2 pb-3',
            day.today ? 'bg-secondary' : 'bg-background',
          )}
        >
          <div className="flex items-baseline justify-between px-1 pt-1">
            <span className="text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">
              {weekdays[calendarWeekday(day.date)]}
            </span>
            <span className="font-mono text-[15px] font-semibold tabular-nums">
              {Number(day.date.slice(8))}
            </span>
          </div>
          {day.lessons.length === 0 ? (
            <span className="flex min-h-40 grow items-center justify-center rounded-row border border-dashed border-border text-[13px] text-muted-foreground">
              {t('dayOff')}
            </span>
          ) : (
            day.lessons.map((lesson) => (
              <button
                key={lesson.id}
                type="button"
                onClick={() => onOpenLesson(lesson.id)}
                aria-label={t(lessonLabelKey(lesson.state), {
                  time: lesson.time,
                  title: lesson.title,
                })}
                className={cn(
                  'flex min-w-0 flex-col gap-0.5 rounded-row px-2.5 py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  BLOCK[lesson.state],
                )}
              >
                <span className="flex items-center justify-between gap-1 font-mono text-xs tabular-nums">
                  {lesson.time}
                  <StateGlyph state={lesson.state} />
                </span>
                <span className="flex min-w-0 items-center gap-1 text-[13px] leading-[18px] font-semibold">
                  {lesson.group ? (
                    <LayersIcon aria-hidden="true" className="size-3.5 shrink-0" />
                  ) : null}
                  <span className="truncate">{lesson.title}</span>
                </span>
              </button>
            ))
          )}
        </li>
      ))}
    </ol>
  );
}

function firstDay(week: Week): WeekDay {
  return (
    week.days.find((day) => day.today) ??
    week.days.find((day) => day.lessons.length) ??
    week.days[0]!
  );
}

function DayStrip({
  week,
  calendarHref,
  onOpenLesson,
}: {
  week: Week;
  calendarHref: string;
  onOpenLesson: (lessonId: string) => void;
}) {
  const t = useTranslations('teachers.profile.week');
  const weekdays = useWeekdayLabels();
  const days = useDayFormat();
  const [selected, setSelected] = useState(() => firstDay(week).date);
  const day = week.days.find((item) => item.date === selected) ?? firstDay(week);
  const title = days.long(day.date);

  return (
    <div className="flex flex-col gap-4 lg:hidden">
      <div role="group" aria-label={t('daysLabel')} className="grid grid-cols-7 gap-1.5 md:gap-2">
        {week.days.map((item) => {
          const active = item.date === day.date;
          return (
            <button
              key={item.date}
              type="button"
              aria-pressed={active}
              aria-label={t('dayLabel', {
                date: days.long(item.date),
                count: item.lessons.length,
              })}
              onClick={() => setSelected(item.date)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-block py-2.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                active ? 'bg-primary text-primary-foreground' : 'bg-background',
              )}
            >
              <span
                className={cn(
                  'text-[11px] font-semibold uppercase',
                  active ? 'text-primary-foreground/80' : 'text-muted-foreground',
                )}
              >
                {weekdays[calendarWeekday(item.date)]}
              </span>
              <span className="font-mono text-[17px] leading-5 font-semibold tabular-nums">
                {Number(item.date.slice(8))}
              </span>
              <span aria-hidden="true" className="flex h-1.5 items-center gap-0.5">
                {item.lessons.slice(0, 4).map((lesson) => (
                  <span
                    key={lesson.id}
                    className={cn(
                      'size-[5px] rounded-pill',
                      lesson.state === 'miss'
                        ? 'bg-danger-mark'
                        : active
                          ? 'bg-primary-foreground'
                          : 'bg-(--teacher)',
                      lesson.state === 'done' && 'opacity-45',
                    )}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-semibold first-letter:uppercase">
          {day.today ? t('dayTitleToday', { date: title }) : t('dayTitle', { date: title })}
        </h3>
        <Link href={calendarHref} className="shrink-0 text-sm font-semibold text-brand">
          {t('openCalendarShort')}
        </Link>
      </div>
      {day.lessons.length === 0 ? (
        <p className="rounded-row border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
          {t('dayEmpty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {day.lessons.map((lesson) => (
            <li key={lesson.id}>
              <button
                type="button"
                onClick={() => onOpenLesson(lesson.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-row px-3.5 py-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                  BLOCK[lesson.state],
                )}
              >
                <span className="font-mono text-sm font-semibold tabular-nums">{lesson.time}</span>
                <span className="flex min-w-0 grow items-center gap-1.5 text-[15px] font-semibold">
                  {lesson.group ? (
                    <LayersIcon aria-hidden="true" className="size-4 shrink-0" />
                  ) : null}
                  <span className="truncate">{lesson.title}</span>
                </span>
                {lesson.state === 'done' || lesson.state === 'miss' || lesson.state === 'next' ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs">
                    <StateGlyph state={lesson.state} />
                    {lesson.state === 'done'
                      ? t('done')
                      : lesson.state === 'miss'
                        ? t('miss')
                        : t('upNext')}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
