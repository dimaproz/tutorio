'use client';

import { useState } from 'react';
import { ArrowRightIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { IconButton } from '@/components/shared/icon-button';
import { Button } from '@/components/ui/button';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { lessonsOnDay, lessonType, type CalendarLesson } from '../model/lessons';
import { dayOfMonth, inMonth, isSameDay } from '../model/period';
import { CalendarEvent } from './calendar-event';
import { useLocalFormatter } from '@/lib/i18n/local-formatter';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';

/** Chips a cell shows before «+N ще». */
const CHIPS_PER_DAY = 3;

const DOT: Record<ReturnType<typeof lessonType>, string> = {
  individual: 'bg-brand',
  group: 'bg-lesson-group',
  makeup: 'bg-lesson-makeup',
};

/** Up to four dots in the lesson types' colours: the week strip, the phone month. */
export function TypeDots({ lessons }: { lessons: readonly CalendarLesson[] }) {
  return (
    <span aria-hidden="true" className="flex h-1.5 items-center justify-center gap-[3px]">
      {lessons.slice(0, 4).map((lesson) => (
        <span key={lesson.id} className={cn('size-1.5 rounded-full', DOT[lessonType(lesson)])} />
      ))}
    </span>
  );
}

function weekdayNames(format: ReturnType<typeof useLocalFormatter>, days: Date[]) {
  return days.slice(0, 7).map((day) => format.dateTime(day, { weekday: 'short' }));
}

/**
 * The month (S03): seven columns of whole weeks, each day with its number
 * (today in a primary tile) and lesson count, up to three chips, then «+N ще»
 * opening the day's full list with «Відкрити день». Days of other months sit
 * on the page colour.
 */
export function CalendarMonthGrid({
  days,
  anchor,
  lessons,
  nowMs,
  showTeacher = false,
  openDay,
  onOpenDayChange,
  onOpenLesson,
  onShowDay,
}: {
  days: Date[];
  anchor: Date;
  lessons: readonly CalendarLesson[];
  nowMs: number;
  showTeacher?: boolean;
  /** The day whose «+N ще» list is open. */
  openDay?: Date | null;
  onOpenDayChange?: (day: Date | null) => void;
  onOpenLesson: (lesson: CalendarLesson) => void;
  /** «Відкрити день»: the day view of that day. */
  onShowDay: (day: Date) => void;
}) {
  const t = useTranslations('calendar.month');
  const format = useLocalFormatter();
  const timeZone = useStudioTimeZone();
  const [ownOpen, setOwnOpen] = useState<Date | null>(null);
  const open = openDay !== undefined ? openDay : ownOpen;
  const setOpen = onOpenDayChange ?? setOwnOpen;
  const now = new Date(nowMs);
  const weeks = Array.from({ length: days.length / 7 }, (_, week) =>
    days.slice(week * 7, week * 7 + 7),
  );

  return (
    <div
      data-slot="calendar-month-grid"
      className="flex flex-col overflow-hidden rounded-[24px] bg-card"
    >
      <div className="grid grid-cols-7 border-b border-border">
        {weekdayNames(format, days).map((name) => (
          <span
            key={name}
            className="px-4 py-4 text-xs leading-4 font-semibold text-muted-foreground uppercase"
          >
            {name}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((day, index) => {
          const dayLessons = lessonsOnDay(lessons, day, timeZone);
          const today = isSameDay(day, now, timeZone);
          const outside = !inMonth(day, anchor, timeZone);
          const hidden = dayLessons.length - CHIPS_PER_DAY;
          const isOpen = open !== null && isSameDay(open, day, timeZone);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'flex min-h-[118px] min-w-0 flex-col gap-1 border-border p-2',
                index % 7 !== 0 && 'border-l',
                index >= 7 && 'border-t',
                outside && 'bg-background',
              )}
            >
              <div className="flex items-center justify-between px-1">
                <span
                  aria-current={today ? 'date' : undefined}
                  className={cn(
                    'flex h-7 min-w-7 items-center justify-center rounded-[10px] px-1 text-[15px] leading-5 font-semibold',
                    today && 'bg-primary text-primary-foreground',
                    outside && 'text-muted-foreground',
                  )}
                >
                  {dayOfMonth(day, timeZone)}
                </span>
                {dayLessons.length > 0 ? (
                  <span className="tabular-nums text-[11px] text-muted-foreground">
                    {dayLessons.length}
                  </span>
                ) : null}
              </div>
              {dayLessons.slice(0, CHIPS_PER_DAY).map((lesson) => (
                <CalendarEvent
                  key={lesson.id}
                  lesson={lesson}
                  nowMs={nowMs}
                  variant="chip"
                  showTeacher={showTeacher}
                  onClick={() => onOpenLesson(lesson)}
                />
              ))}
              {hidden > 0 ? (
                <Popover open={isOpen} onOpenChange={(next) => setOpen(next ? day : null)}>
                  <PopoverAnchor asChild>
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      className="h-5 justify-start px-1 text-[11px] font-semibold"
                      onClick={() => setOpen(isOpen ? null : day)}
                    >
                      {t('more', { count: hidden })}
                    </Button>
                  </PopoverAnchor>
                  <PopoverContent
                    align="start"
                    aria-label={format.dateTime(day, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                    className="flex w-96 flex-col gap-3 rounded-tile p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[15px] leading-5 font-semibold">
                        {format.dateTime(day, { weekday: 'short', day: 'numeric', month: 'long' })}
                      </span>
                      <IconButton
                        icon={<XIcon />}
                        label={t('close')}
                        size={32}
                        tone="paper"
                        onClick={() => setOpen(null)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {dayLessons.map((lesson) => (
                        <CalendarEvent
                          key={lesson.id}
                          lesson={lesson}
                          nowMs={nowMs}
                          variant="chip"
                          className="h-8 text-xs"
                          onClick={() => {
                            setOpen(null);
                            onOpenLesson(lesson);
                          }}
                        />
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      onClick={() => {
                        setOpen(null);
                        onShowDay(day);
                      }}
                    >
                      <ArrowRightIcon data-icon="inline-start" />
                      {t('openDay')}
                    </Button>
                  </PopoverContent>
                </Popover>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The phone's month: a grid of day numbers with type dots; the picked day in
 * a primary tile. Its lessons are listed under it by the caller.
 */
export function CalendarMonthDots({
  days,
  anchor,
  lessons,
  selected,
  onSelect,
}: {
  days: Date[];
  anchor: Date;
  lessons: readonly CalendarLesson[];
  selected: Date;
  onSelect: (day: Date) => void;
}) {
  const format = useLocalFormatter();
  const timeZone = useStudioTimeZone();
  return (
    <div data-slot="calendar-month-dots" className="rounded-[24px] bg-card p-4">
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {weekdayNames(format, days).map((name) => (
          <span
            key={name}
            className="pb-2 text-xs leading-4 font-semibold text-muted-foreground uppercase"
          >
            {name}
          </span>
        ))}
        {days.map((day) => {
          const active = isSameDay(day, selected, timeZone);
          const outside = !inMonth(day, anchor, timeZone);
          return (
            <button
              key={day.toISOString()}
              type="button"
              aria-pressed={active}
              aria-label={format.dateTime(day, { weekday: 'long', day: 'numeric', month: 'long' })}
              className={cn(
                'flex h-12 flex-col items-center justify-center gap-1 rounded-tile text-[15px] leading-5 font-semibold outline-none focus-visible:outline-2 focus-visible:outline-ring',
                active && 'bg-primary text-primary-foreground',
                outside && !active && 'text-muted-foreground',
              )}
              onClick={() => onSelect(day)}
            >
              {dayOfMonth(day, timeZone)}
              <TypeDots lessons={lessonsOnDay(lessons, day, timeZone)} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
