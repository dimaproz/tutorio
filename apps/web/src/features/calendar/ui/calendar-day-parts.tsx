'use client';

import { CalendarDaysIcon, ClockIcon, RotateCcwIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ImpactList, type ImpactItem } from '@/components/shared/impact-list';
import { cn } from '@/lib/utils';
import { lessonsOnDay, lessonTitle, type CalendarLesson } from '../model/lessons';
import { clockLabel, dayOfMonth, isSameDay } from '../model/period';
import { daySummary, type DaySummary } from '../model/summary';
import { TimedLessonRow } from '@/features/lessons';
import { TypeDots } from './calendar-month-grid';
import { useLocalFormatter } from '@/lib/i18n/local-formatter';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';

/**
 * Seven day tiles with the lesson types as dots; the picked day in a primary
 * tile. The phone's day view and the desktop day's side panel.
 */
export function CalendarWeekStrip({
  days,
  lessons,
  selected,
  onSelect,
  className,
}: {
  days: Date[];
  lessons: readonly CalendarLesson[];
  selected: Date;
  onSelect: (day: Date) => void;
  className?: string;
}) {
  const format = useLocalFormatter();
  const timeZone = useStudioTimeZone();
  return (
    <div data-slot="calendar-week-strip" className={cn('grid grid-cols-7 gap-1', className)}>
      {days.map((day) => {
        const active = isSameDay(day, selected, timeZone);
        return (
          <button
            key={day.toISOString()}
            type="button"
            aria-pressed={active}
            aria-label={format.dateTime(day, { weekday: 'long', day: 'numeric', month: 'long' })}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-tile py-2.5 outline-none focus-visible:outline-2 focus-visible:outline-ring',
              active && 'bg-primary text-primary-foreground',
            )}
            onClick={() => onSelect(day)}
          >
            <span
              className={cn(
                'text-xs leading-4 font-semibold uppercase',
                active ? 'text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              {format.dateTime(day, { weekday: 'short' })}
            </span>
            <span className="text-lg leading-6 font-semibold">{dayOfMonth(day, timeZone)}</span>
            <TypeDots lessons={lessonsOnDay(lessons, day, timeZone)} />
          </button>
        );
      })}
    </div>
  );
}

/** «3,5 год» from minutes. */
function useHours() {
  const format = useLocalFormatter();
  return (minutes: number) =>
    format.number(minutes / 60, { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

function useGapsText() {
  const format = useLocalFormatter();
  return (gaps: DaySummary['gaps']) =>
    format.list(
      gaps.map((gap) => `${clockLabel(gap.startMin)}–${clockLabel(gap.endMin)}`),
      { type: 'conjunction' },
    );
}

/**
 * The desktop day's side panel: the week strip and the day's summary — its
 * lessons and hours, the makeup, and the free windows between lessons.
 */
export function CalendarDaySide({
  days,
  day,
  lessons,
  context = lessons,
  nowMs,
  onSelectDay,
}: {
  days: Date[];
  day: Date;
  lessons: readonly CalendarLesson[];
  context?: readonly CalendarLesson[];
  nowMs: number;
  onSelectDay: (day: Date) => void;
}) {
  const t = useTranslations('calendar.day');
  const format = useLocalFormatter();
  const hours = useHours();
  const gapsText = useGapsText();
  const timeZone = useStudioTimeZone();
  const summary = daySummary(lessonsOnDay(lessons, day, timeZone), nowMs, timeZone, context);

  const items: ImpactItem[] = [
    {
      id: 'count',
      icon: <CalendarDaysIcon />,
      tone: 'indigo',
      title: t('summary', { count: summary.count, hours: hours(summary.minutes) }),
      text:
        summary.count > 0
          ? t('summaryText', {
              held: summary.held,
              running: summary.running,
              upcoming: summary.upcoming,
            })
          : undefined,
    },
  ];
  if (summary.makeup) {
    const { lesson, original } = summary.makeup;
    items.push({
      id: 'makeup',
      icon: <RotateCcwIcon />,
      tone: 'warning',
      title: t('makeup', {
        time: format.dateTime(new Date(lesson.startsAtUtc), { hour: '2-digit', minute: '2-digit' }),
      }),
      text: original
        ? t('makeupFor', {
            name: lessonTitle(lesson),
            date: format.dateTime(new Date(original.startsAtUtc), {
              day: 'numeric',
              month: 'long',
            }),
          })
        : lessonTitle(lesson),
    });
  }
  if (summary.gaps.length > 0) {
    items.push({
      id: 'free',
      icon: <ClockIcon />,
      tone: 'neutral',
      title: t('free', { ranges: gapsText(summary.gaps) }),
    });
  }

  return (
    <aside
      data-slot="calendar-day-side"
      className="flex flex-col gap-4 rounded-[24px] bg-card p-5"
      aria-label={t('sideLabel')}
    >
      <CalendarWeekStrip days={days} lessons={lessons} selected={day} onSelect={onSelectDay} />
      <span className="px-1 text-xs leading-4 font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        {format.dateTime(day, { weekday: 'long', day: 'numeric', month: 'long' })}
      </span>
      <ImpactList items={items} label={t('summaryLabel')} />
    </aside>
  );
}

/** The phone day's line: «3 заняття · 3,5 год» and the first free window. */
export function CalendarDayLine({
  lessons,
  context,
  nowMs,
}: {
  lessons: readonly CalendarLesson[];
  context?: readonly CalendarLesson[];
  nowMs: number;
}) {
  const t = useTranslations('calendar.day');
  const hours = useHours();
  const timeZone = useStudioTimeZone();
  const summary = daySummary(lessons, nowMs, timeZone, context);
  const gap = summary.gaps[0];
  return (
    <div className="flex items-center justify-between gap-3 px-1 text-sm leading-5 text-muted-foreground">
      <span className="flex items-center gap-2 [&_svg]:size-4">
        <CalendarDaysIcon aria-hidden="true" />
        {t('summary', { count: summary.count, hours: hours(summary.minutes) })}
      </span>
      {gap ? (
        <span className="flex items-center gap-2 [&_svg]:size-4">
          <ClockIcon aria-hidden="true" />
          {t('freeShort', { range: `${clockLabel(gap.startMin)}–${clockLabel(gap.endMin)}` })}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The phone's week: an agenda grouped by day (a seven-column grid does not
 * fit 390), each lesson the shared timed row (`LessonTimeRow`, dense).
 */
export function CalendarAgenda({
  days,
  lessons,
  nowMs,
  showTeacher = false,
  onOpenLesson,
}: {
  days: Date[];
  lessons: readonly CalendarLesson[];
  nowMs: number;
  /** Several teachers: each time column takes the teacher's colour (S11). */
  showTeacher?: boolean;
  onOpenLesson: (lesson: CalendarLesson) => void;
}) {
  const t = useTranslations('calendar.agenda');
  const format = useLocalFormatter();
  const timeZone = useStudioTimeZone();
  return (
    <div data-slot="calendar-agenda" className="flex flex-col gap-5">
      {days.map((day) => {
        const dayLessons = lessonsOnDay(lessons, day, timeZone);
        if (dayLessons.length === 0) return null;
        return (
          <section key={day.toISOString()} className="flex flex-col gap-2.5">
            <h2 className="flex items-baseline gap-2 px-1 text-[17px] leading-6 font-semibold">
              {format.dateTime(day, { weekday: 'short', day: 'numeric', month: 'long' })}
              <span className="text-sm font-normal text-muted-foreground">
                {t('count', { count: dayLessons.length })}
              </span>
            </h2>
            <div className="flex flex-col gap-2">
              {dayLessons.map((lesson) => (
                <TimedLessonRow
                  key={lesson.id}
                  lesson={lesson}
                  nowMs={nowMs}
                  dense
                  showTeacher={showTeacher}
                  onOpen={() => onOpenLesson(lesson)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
