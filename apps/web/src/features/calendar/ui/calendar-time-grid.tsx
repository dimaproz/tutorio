'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  dropConflict,
  isMovable,
  lessonsOnDay,
  placeDay,
  type CalendarLesson,
} from '../model/lessons';
import { atMinute, clockLabel, isSameDay, minutesOfDay } from '../model/period';
import { CalendarEvent, useEventTimes, type CalendarEventVariant } from './calendar-event';
import { useGridPointer, type GridSelection } from './use-grid-pointer';
import { useCalendarFormatter } from './use-calendar-formatter';

/** Per-hour height: the week, the desktop day, the phone day. */
export const HOUR_HEIGHT = { week: 44, day: 64, phone: 58 } as const;
/** The week's hours in view without scrolling: 08:00–21:00 (decision 1). */
const VISIBLE_HOURS = 13;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** Deterministic placeholder blocks for the loading state. */
const SKELETON: { day: number; start: number; length: number }[] = [
  { day: 0, start: 600, length: 60 },
  { day: 0, start: 1020, length: 60 },
  { day: 1, start: 1080, length: 90 },
  { day: 2, start: 540, length: 120 },
  { day: 2, start: 960, length: 60 },
  { day: 3, start: 900, length: 60 },
  { day: 3, start: 1080, length: 90 },
  { day: 4, start: 1020, length: 60 },
  { day: 5, start: 600, length: 90 },
];

export type TimeGridSlot = { day: Date; startMin: number; durationMin: number };

/**
 * The time grid of the week and day views (S03): a time gutter, one column
 * per day, hour lines, today's column tinted with the now line, and lessons
 * placed by time — overlapping ones in lanes. A lesson opens on click and
 * moves by drag (snapped to 15 minutes, Esc cancels): its old slot stays as a
 * ghost, the lifted card shows the new date and time, red over an overlap.
 * A click or a drag on empty time marks a slot for a new lesson.
 */
export function CalendarTimeGrid({
  days,
  lessons,
  context = lessons,
  nowMs,
  hourHeight = HOUR_HEIGHT.week,
  header = true,
  eventVariant = 'block',
  stackedEvents = false,
  showTeacher = false,
  loading = false,
  overlay,
  selection,
  scrollToMinute = 8 * 60,
  visibleHours = VISIBLE_HOURS,
  interactive = true,
  onOpenLesson,
  onMoveLesson,
  onPickSlot,
  onDragChange,
  className,
}: {
  days: Date[];
  /** The lessons to draw. */
  lessons: readonly CalendarLesson[];
  /** Everything the overlap hint may name, e.g. lessons the filters hide. */
  context?: readonly CalendarLesson[];
  nowMs: number;
  hourHeight?: number;
  /** The weekday and date row over the columns. */
  header?: boolean;
  eventVariant?: Extract<CalendarEventVariant, 'block' | 'wide'>;
  /** Wide cards put the time under the name (the phone). */
  stackedEvents?: boolean;
  showTeacher?: boolean;
  loading?: boolean;
  /** A card over the grid: the empty week or the error. */
  overlay?: ReactNode;
  /** The slot kept marked while the new-lesson form is open. */
  selection?: TimeGridSlot | null;
  scrollToMinute?: number;
  /** How many hours the grid shows before it scrolls. */
  visibleHours?: number;
  interactive?: boolean;
  onOpenLesson: (lesson: CalendarLesson) => void;
  onMoveLesson: (lesson: CalendarLesson, day: Date, startMin: number) => void;
  onPickSlot: (slot: TimeGridSlot) => void;
  /** Whether a lesson is being dragged: the page swaps its legend for the hint. */
  onDragChange?: (dragging: boolean) => void;
  className?: string;
}) {
  const t = useTranslations('calendar');
  const format = useCalendarFormatter();
  const times = useEventTimes();
  const scroller = useRef<HTMLDivElement>(null);
  const now = new Date(nowMs);
  const pointer = useGridPointer({
    hourHeight,
    enabled: interactive && !loading,
    onMove: (lesson, dayIndex, startMin) => {
      const day = days[dayIndex];
      if (day) onMoveLesson(lesson, day, startMin);
    },
    onSelect: (picked: GridSelection) => {
      const day = days[picked.dayIndex];
      if (day) {
        onPickSlot({
          day,
          startMin: picked.startMin,
          durationMin: picked.endMin - picked.startMin,
        });
      }
    },
  });

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = (scrollToMinute / 60) * hourHeight;
  }, [scrollToMinute, hourHeight]);

  const dragging = pointer.drag !== null;
  useEffect(() => {
    onDragChange?.(dragging);
  }, [dragging, onDragChange]);

  const top = (minutes: number) => (minutes / 60) * hourHeight;
  const drag = pointer.drag;
  const dragConflict = drag
    ? dropConflict(drag.lesson, days[drag.dayIndex]!, drag.startMin, context)
    : null;
  const marked: GridSelection | null =
    pointer.selection ??
    (selection
      ? (() => {
          const dayIndex = days.findIndex((day) => isSameDay(day, selection.day));
          return dayIndex === -1
            ? null
            : {
                dayIndex,
                startMin: selection.startMin,
                endMin: selection.startMin + selection.durationMin,
              };
        })()
      : null);

  return (
    <div
      data-slot="calendar-time-grid"
      className={cn(
        'relative flex min-h-0 flex-col overflow-hidden rounded-[24px] bg-card',
        className,
      )}
    >
      {header ? (
        <div className="flex border-b border-border">
          <div className="w-13 shrink-0" />
          {days.map((day) => {
            const today = isSameDay(day, now);
            return (
              <div
                key={day.toISOString()}
                className="flex min-w-0 flex-1 items-center justify-center gap-2 py-4"
              >
                <span
                  className={cn(
                    'text-xs leading-4 font-semibold uppercase',
                    today ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {format.dateTime(day, { weekday: 'short' })}
                </span>
                <span
                  className={cn(
                    'flex h-7 min-w-7 items-center justify-center rounded-[10px] px-1.5 text-lg leading-6 font-semibold',
                    today ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                  )}
                  aria-current={today ? 'date' : undefined}
                >
                  {day.getDate()}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      <div
        ref={scroller}
        role="region"
        aria-label={t('gridLabel')}
        tabIndex={0}
        className="scrollbar-thin relative overflow-y-auto outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
        style={{ height: visibleHours * hourHeight + 24 }}
      >
        <div className="relative flex" style={{ height: 24 * hourHeight }}>
          <div aria-hidden="true" className="relative w-13 shrink-0">
            {HOURS.slice(1).map((hour) => (
              <span
                key={hour}
                className="absolute right-2 font-mono text-[11px] leading-none text-muted-foreground"
                style={{ top: top(hour * 60) - 5 }}
              >
                {clockLabel(hour * 60)}
              </span>
            ))}
          </div>
          <div className="relative flex min-w-0 flex-1">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              {HOURS.slice(1).map((hour) => (
                <div
                  key={hour}
                  className="absolute inset-x-0 border-t border-border"
                  style={{ top: top(hour * 60) }}
                />
              ))}
            </div>
            {days.map((day, dayIndex) => {
              const today = isSameDay(day, now);
              const placed = placeDay(lessonsOnDay(lessons, day));
              return (
                <div
                  key={day.toISOString()}
                  ref={(cell) => {
                    pointer.columns.current[dayIndex] = cell;
                  }}
                  data-day={dayIndex}
                  className={cn(
                    'relative min-w-0 flex-1 border-l border-border',
                    today && header && 'bg-tint-indigo/35',
                  )}
                  onPointerDown={(event) => pointer.slotPointerDown(event, dayIndex)}
                >
                  {loading
                    ? SKELETON.filter((block) => block.day === dayIndex % 7).map((block) => (
                        <Skeleton
                          key={block.start}
                          className="absolute inset-x-1 rounded-[10px] bg-tint-indigo/60"
                          style={{ top: top(block.start), height: top(block.length) - 2 }}
                        />
                      ))
                    : placed.map(({ lesson, startMin, endMin, lane, lanes }) => {
                        const dragging = drag?.lesson.id === lesson.id;
                        return (
                          <div
                            key={lesson.id}
                            className="absolute"
                            style={{
                              top: top(startMin) + 1,
                              height: Math.max(20, top(endMin - startMin) - 3),
                              left: `calc(${(lane / lanes) * 100}% + 3px)`,
                              width: `calc(${100 / lanes}% - 6px)`,
                            }}
                          >
                            <CalendarEvent
                              lesson={lesson}
                              nowMs={nowMs}
                              variant={eventVariant}
                              stacked={stackedEvents}
                              compact={eventVariant === 'block' && lesson.durationMin <= 45}
                              startOnly={lanes > 1}
                              withTopic={lesson.durationMin >= 90}
                              showTeacher={showTeacher}
                              state={dragging ? 'ghost' : 'idle'}
                              aria-hidden={dragging || undefined}
                              tabIndex={dragging ? -1 : undefined}
                              className="touch-manipulation"
                              onPointerDown={(event) =>
                                pointer.lessonPointerDown(
                                  event,
                                  lesson,
                                  startMin,
                                  isMovable(lesson),
                                )
                              }
                              onClick={() => {
                                if (pointer.takeClick()) onOpenLesson(lesson);
                              }}
                            />
                          </div>
                        );
                      })}

                  {drag && drag.dayIndex === dayIndex ? (
                    <div
                      className="pointer-events-none absolute inset-x-[3px] z-20"
                      style={{
                        top: top(drag.startMin) + 1,
                        height: Math.max(20, top(drag.lesson.durationMin) - 3),
                      }}
                    >
                      <span
                        role="status"
                        className={cn(
                          'absolute -top-8 left-0 z-10 flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs leading-4 font-semibold whitespace-nowrap shadow-toast',
                          dragConflict
                            ? 'bg-destructive text-destructive-foreground'
                            : 'bg-ink text-ink-foreground',
                        )}
                      >
                        {dragConflict ? (
                          <>
                            <TriangleAlertIcon aria-hidden="true" className="size-3.5" />
                            {t('drag.overlap', {
                              name:
                                dragConflict.student?.fullName ?? dragConflict.group?.name ?? '',
                              time: times.start(dragConflict),
                            })}
                          </>
                        ) : (
                          t('drag.target', {
                            date: format.dateTime(day, {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'long',
                            }),
                            time: format.dateTime(atMinute(day, drag.startMin), {
                              hour: '2-digit',
                              minute: '2-digit',
                            }),
                          })
                        )}
                      </span>
                      <CalendarEvent
                        tabIndex={-1}
                        aria-hidden="true"
                        lesson={{
                          ...drag.lesson,
                          startsAtUtc: atMinute(day, drag.startMin).toISOString(),
                        }}
                        nowMs={nowMs}
                        variant={eventVariant}
                        stacked={stackedEvents}
                        compact={eventVariant === 'block' && drag.lesson.durationMin <= 45}
                        state={dragConflict ? 'conflict' : 'dragging'}
                      />
                    </div>
                  ) : null}

                  {marked && marked.dayIndex === dayIndex ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-[3px] z-10 flex items-start rounded-[10px] border-2 border-dashed border-brand bg-tint-indigo/70 px-2 py-1 text-xs leading-4 font-semibold text-brand"
                      style={{
                        top: top(marked.startMin) + 1,
                        height: Math.max(20, top(marked.endMin - marked.startMin) - 3),
                      }}
                    >
                      {t('slot.mark', {
                        range: `${clockLabel(marked.startMin)}–${clockLabel(marked.endMin)}`,
                      })}
                    </div>
                  ) : null}

                  {today ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-destructive"
                      style={{ top: top(minutesOfDay(now)) }}
                    >
                      <span className="absolute top-1/2 -left-[5px] size-2.5 -translate-y-1/2 rounded-full bg-destructive" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {overlay ? (
        <div className="pointer-events-none absolute inset-x-0 top-16 bottom-0 flex items-center justify-center p-4">
          <div className="pointer-events-auto w-full max-w-132">{overlay}</div>
        </div>
      ) : null}
    </div>
  );
}
