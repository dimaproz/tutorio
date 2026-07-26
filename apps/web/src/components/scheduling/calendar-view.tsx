'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { PageHeader } from '@/components/app/page-shell';
import { useIsSoloWorkspace } from '@/components/app/session-provider';
import {
  useLessonsQuery,
  useRescheduleLessonMutation,
} from '@/lib/api/scheduling';
import { useTeachersQuery } from '@/lib/api/teachers';
import { LessonActionsDialog } from './lesson-actions-dialog';
import { LessonFormDialog } from './lesson-form-dialog';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import './calendar-view.css';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { en: enUS, uk },
});

// Status owns the event fill; the teacher's own colour rides on the left rail
// (see eventPropGetter), so both read at once on a shared calendar.
const STATUS_CLASS: Record<LessonResponse['status'], string> = {
  SCHEDULED: 'tutorio-event--scheduled',
  COMPLETED: 'tutorio-event--completed',
  CANCELLED_CHARGED: 'tutorio-event--cancelled-charged',
  CANCELLED_UNCHARGED: 'tutorio-event--cancelled-uncharged',
};

const LESSON_STATUSES = Object.keys(STATUS_CLASS) as LessonResponse['status'][];

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

/** The event body: time, who, and the teacher when there is room. */
function EventContent({ event }: { event: LessonEvent }) {
  const lesson = event.resource;
  // Solo workspaces teach every lesson themselves — naming the teacher on each
  // event is noise.
  const isSolo = useIsSoloWorkspace();
  return (
    <div className="flex min-w-0 flex-col leading-tight">
      <span className="truncate font-medium">
        {lesson.student?.fullName ?? lesson.group?.name ?? '—'}
      </span>
      {isSolo ? null : (
        <span className="truncate text-[11px] opacity-80">{lesson.teacher.name}</span>
      )}
    </div>
  );
}

export function CalendarView() {
  const t = useTranslations('scheduling.calendar');
  const tToolbar = useTranslations('scheduling.toolbar');
  const tConflict = useTranslations('scheduling.conflict');
  const tStatus = useTranslations('scheduling.status');
  const locale = useLocale();

  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());
  // Filters live in the URL so a filtered calendar is shareable and survives a
  // reload — the same convention the /design sections use.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const teacherFilter = searchParams.get('teacherId') ?? '';
  const statusFilter = searchParams.get('status') ?? '';

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    router.replace(next.size > 0 ? `${pathname}?${next}` : pathname, {
      scroll: false,
    });
  };

  const isSolo = useIsSoloWorkspace();
  const teachers = useTeachersQuery({ page: 1, pageSize: 100 }, !isSolo);
  const [selected, setSelected] = useState<LessonResponse | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formStart, setFormStart] = useState<Date | undefined>();

  const range = useMemo(() => rangeFor(view, date), [view, date]);
  const lessons = useLessonsQuery({
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    ...(teacherFilter ? { teacherId: teacherFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
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

  const openForm = (start?: Date) => {
    setFormStart(start);
    setFormOpen(true);
  };

  const onDrop = async ({ event, start }: EventInteractionArgs<LessonEvent>) => {
    const lesson = event.resource;
    const startsAtUtc =
      typeof start === 'string' ? new Date(start).toISOString() : start.toISOString();
    const dto = { startsAtUtc, scope: 'this' as const };
    try {
      await reschedule.mutateAsync({ lessonId: lesson.id, dto });
    } catch (error) {
      if ((error as { status?: number }).status === 409) {
        // Same "book anyway" escape hatch the create flow offers.
        toast.error(tConflict('message'), {
          action: {
            label: tConflict('force'),
            onClick: () =>
              void reschedule.mutateAsync({ lessonId: lesson.id, dto, force: true }),
          },
        });
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
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          <Button onClick={() => openForm(undefined)}>
            <PlusIcon data-icon="inline-start" />
            {t('newLesson')}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {/* One teacher in the workspace: nothing to filter by. */}
        {isSolo ? null : (
          <Select
            value={teacherFilter || 'all'}
            onValueChange={(value) => setFilter('teacherId', value === 'all' ? '' : value)}
          >
            <SelectTrigger className="w-full sm:w-52" aria-label={t('filterTeacher')}>
              <SelectValue placeholder={t('filterTeacher')} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">{t('filterAll')}</SelectItem>
                {(teachers.data?.items ?? []).map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.fullName}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}

        <Select
          value={statusFilter || 'all'}
          onValueChange={(value) => setFilter('status', value === 'all' ? '' : value)}
        >
          <SelectTrigger className="w-full sm:w-52" aria-label={t('filterStatus')}>
            <SelectValue placeholder={t('filterStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">{t('filterAll')}</SelectItem>
              {LESSON_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {tStatus(status)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card relative rounded-2xl border p-3 shadow-sm sm:p-4">
        {/* A background refetch must not blank the grid, so the spinner floats. */}
        {lessons.isFetching && !lessons.isPending ? (
          <div className="text-muted-foreground absolute top-5 right-5 z-10 flex items-center gap-2 text-xs">
            <Spinner className="size-3.5" />
            {t('loading')}
          </div>
        ) : null}

        {lessons.isPending ? (
          <div className="flex flex-col gap-2 p-2" aria-busy="true">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-9 w-64" />
            </div>
            <Skeleton className="h-[62vh] w-full" />
          </div>
        ) : (
          <div className="tutorio-calendar h-[70vh]">
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
              components={{ event: EventContent }}
              onSelectEvent={(event) => {
                setSelected(event.resource);
                setActionsOpen(true);
              }}
              // Clicking (or dragging over) empty space books a lesson there.
              onSelectSlot={({ start }) => openForm(start as Date)}
              onDrillDown={(nextDate) => openForm(nextDate)}
              onEventDrop={onDrop}
              onEventResize={onDrop}
              eventPropGetter={(event: LessonEvent) => {
                const { status, teacher } = event.resource;
                return {
                  className: STATUS_CLASS[status as LessonResponse['status']],
                  // The status owns the fill; the teacher's own colour rides on
                  // the left rail so a shared calendar stays readable.
                  ...(teacher.color
                    ? { style: { borderLeftColor: teacher.color } }
                    : {}),
                };
              }}
              dayPropGetter={(day) => ({
                className:
                  day.toDateString() === new Date().toDateString()
                    ? 'tutorio-day--today'
                    : undefined,
              })}
              style={{ height: '100%' }}
            />
          </div>
        )}
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
