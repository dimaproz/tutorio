'use client';

import { useMemo, useState } from 'react';
import {
  Calendar,
  dateFnsLocalizer,
  type View,
  type Event as RbcEvent,
} from 'react-big-calendar';
import withDragAndDrop, {
  type EventInteractionArgs,
} from 'react-big-calendar/lib/addons/dragAndDrop';
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  parse,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { enUS, uk } from 'date-fns/locale';
import { PlusIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { LessonResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/app/page-shell';
import {
  useLessonsQuery,
  useRescheduleLessonMutation,
} from '@/lib/api/scheduling';
import { LessonActionsDialog } from './lesson-actions-dialog';
import { LessonFormDialog } from './lesson-form-dialog';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { en: enUS, uk },
});

// Brand-aligned status colors (see CLAUDE.md palette).
const STATUS_COLOR: Record<LessonResponse['status'], string> = {
  SCHEDULED: '#465FFF',
  COMPLETED: '#12B76A',
  CANCELLED_CHARGED: '#F04438',
  CANCELLED_UNCHARGED: '#F79009',
};

type LessonEvent = RbcEvent & { resource: LessonResponse };

const DnDCalendar = withDragAndDrop<LessonEvent, object>(Calendar);

function rangeFor(view: View, date: Date): { from: Date; to: Date } {
  switch (view) {
    case 'day':
      return { from: startOfDay(date), to: endOfDay(date) };
    case 'week':
    case 'work_week':
      return { from: startOfWeek(date), to: endOfWeek(date) };
    default:
      // Month view paints leading/trailing days of adjacent weeks.
      return { from: startOfWeek(startOfMonth(date)), to: endOfWeek(endOfMonth(date)) };
  }
}

export function CalendarView() {
  const t = useTranslations('scheduling.calendar');
  const tToolbar = useTranslations('scheduling.toolbar');
  const tConflict = useTranslations('scheduling.conflict');
  const locale = useLocale();

  const [view, setView] = useState<View>('week');
  const [date, setDate] = useState(new Date());
  const [selected, setSelected] = useState<LessonResponse | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formStart, setFormStart] = useState<Date | undefined>();

  const range = useMemo(() => rangeFor(view, date), [view, date]);
  const lessons = useLessonsQuery({
    from: range.from.toISOString(),
    to: range.to.toISOString(),
  });
  const reschedule = useRescheduleLessonMutation();

  const events: LessonEvent[] = useMemo(
    () =>
      (lessons.data?.items ?? []).map((lesson) => ({
        title: lesson.student?.fullName ?? lesson.group?.name ?? '—',
        start: new Date(lesson.startsAtUtc),
        end: new Date(new Date(lesson.startsAtUtc).getTime() + lesson.durationMin * 60_000),
        resource: lesson,
      })),
    [lessons.data],
  );

  const onDrop = async ({ event, start }: EventInteractionArgs<LessonEvent>) => {
    const lesson = event.resource;
    const startsAtUtc =
      typeof start === 'string' ? new Date(start).toISOString() : start.toISOString();
    try {
      await reschedule.mutateAsync({
        lessonId: lesson.id,
        dto: { startsAtUtc, scope: 'this' },
      });
    } catch (error) {
      if ((error as { status?: number }).status === 409) {
        toast.error(tConflict('message'));
        return;
      }
      throw error;
    }
  };

  const messages = {
    today: tToolbar('today'),
    previous: tToolbar('back'),
    next: tToolbar('next'),
    month: tToolbar('month'),
    week: tToolbar('week'),
    day: tToolbar('day'),
    agenda: tToolbar('agenda'),
    date: tToolbar('date'),
    time: tToolbar('time'),
    event: tToolbar('event'),
    noEventsInRange: tToolbar('noEvents'),
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          <Button
            onClick={() => {
              setFormStart(undefined);
              setFormOpen(true);
            }}
          >
            <PlusIcon className="size-4" />
            {t('newLesson')}
          </Button>
        }
      />

      <div className="bg-card h-[70vh] rounded-2xl border p-3 shadow-sm">
        <DnDCalendar
          localizer={localizer}
          culture={locale}
          messages={messages}
          events={events}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          views={['month', 'week', 'day', 'agenda']}
          startAccessor="start"
          endAccessor="end"
          popup
          selectable
          onSelectEvent={(event) => {
            setSelected(event.resource);
            setActionsOpen(true);
          }}
          onSelectSlot={({ start }) => {
            setFormStart(start as Date);
            setFormOpen(true);
          }}
          onEventDrop={onDrop}
          onEventResize={onDrop}
          eventPropGetter={(event: LessonEvent) => {
            const status = event.resource.status as LessonResponse['status'];
            return {
              style: {
                backgroundColor: STATUS_COLOR[status],
                border: 'none',
                opacity: status.startsWith('CANCELLED') ? 0.6 : 1,
              },
            };
          }}
          style={{ height: '100%' }}
        />
      </div>

      <LessonActionsDialog
        open={actionsOpen}
        onOpenChange={setActionsOpen}
        lesson={selected}
      />
      <LessonFormDialog open={formOpen} onOpenChange={setFormOpen} initialStart={formStart} />
    </div>
  );
}
