'use client';

import { useEffect, useState } from 'react';
import { ArrowRightIcon, CalendarDaysIcon, InfoIcon, PlusIcon, TreePalmIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { PageHeader } from '@/components/shared/page-shell';
import { Button } from '@/components/ui/button';
import {
  LessonCreateDialog,
  LessonPanel,
  useLessonMove,
  useLessonPanel,
  type LessonCreateInitial,
  type LessonPanelLinks,
} from '@/features/lessons';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useNextLessonQuery } from '../api';
import { statusFilterCount } from '../model/filters';
import { lessonsOnDay, type CalendarLesson } from '../model/lessons';
import {
  atMinute,
  calendarPeriod,
  clockLabel,
  dayKey,
  isSameDay,
  minutesOfDay,
  startOfDay,
} from '../model/period';
import {
  CalendarAgenda,
  CalendarDayLine,
  CalendarDaySide,
  CalendarWeekStrip,
} from './calendar-day-parts';
import { CalendarEvent } from './calendar-event';
import { CalendarFilterSheet, StatusFilterMenu, TeacherFilterMenu } from './calendar-filters';
import { CalendarLegend } from './calendar-legend';
import { CalendarMonthDots, CalendarMonthGrid } from './calendar-month-grid';
import { CalendarTimeGrid, HOUR_HEIGHT, type TimeGridSlot } from './calendar-time-grid';
import {
  CalendarErrorCard,
  CalendarPhoneBar,
  CalendarStateCard,
  CalendarToolbar,
} from './calendar-toolbar';
import {
  useCalendarState,
  useCalendarSubtitle,
  useNow,
  usePeriodTitle,
} from './use-calendar-state';
import { useCalendarFormatter } from './use-calendar-formatter';

const LESSON_LINKS: LessonPanelLinks = {
  studentHref: (id) => `/app/students/${id}`,
  groupHref: (id) => `/app/groups/${id}`,
};

type Creating = { initial: LessonCreateInitial; slot: TimeGridSlot | null };

/** Arrows step the period, T goes to today — unless a field or a dialog has the keys. */
function useCalendarKeys(onStep: (step: 1 | -1) => void, onToday: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) {
        return;
      }
      if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) return;
      if (event.key === 'ArrowLeft') onStep(-1);
      else if (event.key === 'ArrowRight') onStep(1);
      else if (event.key === 't' || event.key === 'T') onToday();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStep, onToday]);
}

/**
 * The calendar (S03, `/app/calendar`): the studio's lessons by week, day or
 * month, filtered by teacher and status. A lesson opens the S01 panel
 * (`?lesson=`); a click or a drag on empty time opens the S02 form with that
 * date, time and length; dragging a lesson moves it through the S01 scope
 * and conflict dialogs. Phones get the day grid, a week agenda, a dot month,
 * the filter sheet and the «+» button.
 */
export function CalendarPage({ nowMs: pinnedNow }: { nowMs?: number } = {}) {
  const t = useTranslations('calendar');
  const format = useCalendarFormatter();
  const mobile = useIsMobile();
  const nowMs = useNow(pinnedNow);
  const state = useCalendarState({ mobile, nowMs });
  const subtitle = useCalendarSubtitle();
  const periodTitle = usePeriodTitle();
  const panel = useLessonPanel();
  const mover = useLessonMove();
  const [creating, setCreating] = useState<Creating | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  useCalendarKeys(state.step, state.today);

  const { view, anchor, period, visible, all } = state;
  const multiTeacher = state.teachers.length > 1 && state.selectedTeachers.length !== 1;
  const error = state.lessonsQuery.isError && !state.loading;
  const empty = !state.loading && !error && state.visibleInPeriod.length === 0;
  const next = useNextLessonQuery(
    period.to.toISOString(),
    state.selectedTeachers.length === 1 ? state.selectedTeachers[0] : undefined,
    empty && view !== 'month',
  ).data?.items[0];

  const openLesson = (lesson: CalendarLesson) => panel.open(lesson.id);
  const moveLesson = (lesson: CalendarLesson, day: Date, startMin: number) =>
    void mover.move(lesson, { startsAtUtc: atMinute(day, startMin).toISOString() });
  const pickSlot = (slot: TimeGridSlot) =>
    setCreating({
      initial: {
        date: dayKey(slot.day),
        time: clockLabel(slot.startMin),
        durationMin: slot.durationMin,
      },
      slot,
    });
  const newLesson = (day: Date = isSameDay(anchor, new Date(nowMs)) ? new Date(nowMs) : anchor) =>
    setCreating({ initial: { date: dayKey(day) }, slot: null });
  const goTo = (iso: string) => state.setAnchor(startOfDay(new Date(iso)));

  const filterCount = statusFilterCount(state.statusFilter) + (state.teachersFiltered ? 1 : 0);
  const retry = () => void state.lessonsQuery.refetch();
  const nextDate = next
    ? format.dateTime(new Date(next.startsAtUtc), {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
      })
    : null;
  const nextTime = next
    ? format.dateTime(new Date(next.startsAtUtc), { hour: '2-digit', minute: '2-digit' })
    : null;
  const nextName = next ? (next.student?.fullName ?? next.group?.name ?? '') : '';

  const dialogs = (
    <>
      <LessonCreateDialog
        open={creating !== null}
        onOpenChange={(open) => {
          if (!open) setCreating(null);
        }}
        initial={creating?.initial}
        nowMs={pinnedNow}
      />
      <LessonPanel
        lessonId={panel.lessonId}
        intent={panel.intent}
        onClose={panel.close}
        onOpenLesson={panel.open}
        linkTo={panel.linkTo}
        links={LESSON_LINKS}
        nowMs={pinnedNow}
      />
      {mover.dialogs}
    </>
  );

  if (mobile) {
    const dayLessons = lessonsOnDay(visible, anchor);
    const firstMinute = dayLessons[0] ? minutesOfDay(new Date(dayLessons[0].startsAtUtc)) : 480;
    const weekDays = calendarPeriod('week', anchor).days;
    return (
      <div className="flex flex-col gap-4 pb-24">
        <CalendarPhoneBar
          view={view}
          onViewChange={state.setView}
          title={periodTitle(view, period.days, anchor, view === 'month')}
          onToday={state.today}
          onStep={state.step}
          filterCount={filterCount}
          onOpenFilters={() => setFiltersOpen(true)}
        />

        {view === 'day' ? (
          <>
            <CalendarWeekStrip
              days={weekDays}
              lessons={visible}
              selected={anchor}
              onSelect={state.setAnchor}
              className="rounded-[24px] bg-card p-1.5"
            />
            {error ? (
              <CalendarErrorCard onRetry={retry} floating={false} />
            ) : dayLessons.length === 0 && !state.loading ? (
              <CalendarStateCard
                floating={false}
                icon={<TreePalmIcon />}
                title={t('empty.dayTitle')}
                text={
                  next
                    ? t('empty.nextDay', { date: nextDate ?? '', time: nextTime ?? '' })
                    : t('empty.noNext')
                }
                actions={
                  <div className="flex w-full flex-col gap-2.5">
                    <Button type="button" size="xl" onClick={() => newLesson(anchor)}>
                      <PlusIcon data-icon="inline-start" />
                      {t('empty.newOn', {
                        date: format.dateTime(anchor, { day: 'numeric', month: 'long' }),
                      })}
                    </Button>
                    {next ? (
                      <Button
                        type="button"
                        size="xl"
                        variant="outline"
                        onClick={() => goTo(next.startsAtUtc)}
                      >
                        {t('empty.goNextLesson')}
                      </Button>
                    ) : null}
                  </div>
                }
              />
            ) : (
              <>
                <CalendarDayLine lessons={dayLessons} context={all} nowMs={nowMs} />
                <CalendarTimeGrid
                  days={[anchor]}
                  lessons={visible}
                  context={all}
                  nowMs={nowMs}
                  hourHeight={HOUR_HEIGHT.phone}
                  header={false}
                  eventVariant="wide"
                  stackedEvents
                  loading={state.loading}
                  selection={creating?.slot}
                  scrollToMinute={Math.max(0, Math.floor(firstMinute / 60) * 60 - 60)}
                  visibleHours={9}
                  onOpenLesson={openLesson}
                  onMoveLesson={moveLesson}
                  onPickSlot={pickSlot}
                  onDragChange={setDragging}
                />
                {dragging ? <DragHint /> : null}
              </>
            )}
          </>
        ) : view === 'week' ? (
          error ? (
            <CalendarErrorCard onRetry={retry} floating={false} />
          ) : empty ? (
            <CalendarStateCard
              floating={false}
              icon={<CalendarDaysIcon />}
              title={t('empty.weekTitle')}
              text={nextText(t, nextDate, nextTime, nextName)}
            />
          ) : (
            <CalendarAgenda
              days={period.days}
              lessons={visible}
              nowMs={nowMs}
              onOpenLesson={openLesson}
            />
          )
        ) : (
          <>
            <CalendarMonthDots
              days={period.days}
              anchor={anchor}
              lessons={visible}
              selected={anchor}
              onSelect={state.setAnchor}
            />
            <h2 className="px-1 text-xs leading-4 font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              {format.dateTime(anchor, { weekday: 'long', day: 'numeric', month: 'long' })}
              {' · '}
              {t('agenda.count', { count: dayLessons.length })}
            </h2>
            <div className="flex flex-col gap-2">
              {dayLessons.map((lesson) => (
                <CalendarEvent
                  key={lesson.id}
                  lesson={lesson}
                  nowMs={nowMs}
                  variant="row"
                  onClick={() => openLesson(lesson)}
                />
              ))}
            </div>
          </>
        )}

        <Button
          type="button"
          size="icon"
          aria-label={t('fab')}
          className="fixed right-4 bottom-[calc(var(--mobile-tab-bar-height)+16px)] z-30 size-14 rounded-tile shadow-dialog [&_svg]:size-6"
          onClick={() => newLesson()}
        >
          <PlusIcon />
        </Button>

        <CalendarFilterSheet
          // Opening starts its drafts from the filters in force.
          key={filtersOpen ? 'open' : 'closed'}
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          teachers={state.teachers}
          selected={state.selectedTeachers}
          teacherCounts={state.teacherCounts}
          filter={state.statusFilter}
          statusCounts={state.statusCounts}
          countFor={state.countFor}
          onApply={(teachers, filter) => {
            state.setSelectedTeachers(teachers);
            state.setStatusFilter(filter);
          }}
        />
        {dialogs}
      </div>
    );
  }

  const filters = (
    <>
      {state.teachers.length > 1 ? (
        <TeacherFilterMenu
          teachers={state.teachers}
          selected={state.selectedTeachers}
          counts={state.teacherCounts}
          onChange={state.setSelectedTeachers}
        />
      ) : null}
      <StatusFilterMenu
        filter={state.statusFilter}
        counts={state.statusCounts}
        onChange={state.setStatusFilter}
      />
    </>
  );

  const emptyCard = (
    <CalendarStateCard
      icon={<CalendarDaysIcon />}
      title={view === 'day' ? t('empty.dayTitle') : t('empty.weekTitle')}
      text={nextText(t, nextDate, nextTime, nextName)}
      actions={
        <>
          {next ? (
            <Button type="button" variant="outline" onClick={() => goTo(next.startsAtUtc)}>
              <ArrowRightIcon data-icon="inline-start" />
              {t('empty.goNext', {
                date: format.dateTime(new Date(next.startsAtUtc), {
                  day: 'numeric',
                  month: 'long',
                }),
              })}
            </Button>
          ) : null}
          <Button type="button" onClick={() => newLesson()}>
            <PlusIcon data-icon="inline-start" />
            {t('newLesson')}
          </Button>
        </>
      }
    />
  );
  const overlay = error ? <CalendarErrorCard onRetry={retry} /> : empty ? emptyCard : null;
  const teachersShown = state.teachers.filter(
    (teacher) => state.selectedTeachers.length === 0 || state.selectedTeachers.includes(teacher.id),
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        size="md"
        title={t('title')}
        description={subtitle({
          state,
          teachers: state.teachers,
          selected: state.selectedTeachers,
        })}
        action={
          <Button type="button" size="lg" onClick={() => newLesson()}>
            <PlusIcon data-icon="inline-start" />
            {t('newLesson')}
          </Button>
        }
      />
      <CalendarToolbar
        view={view}
        onViewChange={state.setView}
        title={periodTitle(view, period.days, anchor, true)}
        onToday={state.today}
        onStep={state.step}
        filters={filters}
      />

      {view === 'month' ? (
        <div className="relative">
          <CalendarMonthGrid
            days={period.days}
            anchor={anchor}
            lessons={visible}
            nowMs={nowMs}
            showTeacher={multiTeacher}
            onOpenLesson={openLesson}
            onShowDay={(day) => {
              state.setAnchor(day);
              state.setView('day');
            }}
          />
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="w-full max-w-132">
                <CalendarErrorCard onRetry={retry} />
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className={cn(view === 'day' && 'grid grid-cols-[minmax(0,1fr)_340px] items-start gap-5')}
        >
          <CalendarTimeGrid
            days={period.days}
            lessons={visible}
            context={all}
            nowMs={nowMs}
            hourHeight={view === 'day' ? HOUR_HEIGHT.day : HOUR_HEIGHT.week}
            header={view === 'week'}
            eventVariant={view === 'day' ? 'wide' : 'block'}
            showTeacher={multiTeacher}
            loading={state.loading}
            overlay={overlay}
            selection={creating?.slot}
            scrollToMinute={view === 'day' ? dayScroll(visible, anchor) : 8 * 60}
            visibleHours={view === 'day' ? 9 : undefined}
            onOpenLesson={openLesson}
            onMoveLesson={moveLesson}
            onPickSlot={pickSlot}
            onDragChange={setDragging}
          />
          {view === 'day' ? (
            <CalendarDaySide
              days={calendarPeriod('week', anchor).days}
              day={anchor}
              lessons={visible}
              context={all}
              nowMs={nowMs}
              onSelectDay={state.setAnchor}
            />
          ) : null}
        </div>
      )}

      {dragging ? (
        <DragHint />
      ) : view !== 'day' ? (
        <CalendarLegend
          teachers={multiTeacher ? teachersShown : []}
          renderTeacher={(teacher) => (
            <EntityAvatar
              avatarKey={teacher.avatarKey}
              fullName={teacher.fullName}
              tint="indigo"
              className="size-7"
            />
          )}
        />
      ) : null}
      {dialogs}
    </div>
  );
}

function DragHint() {
  const t = useTranslations('calendar.drag');
  return (
    <p className="flex items-center gap-2 text-sm leading-5 text-muted-foreground [&_svg]:size-4">
      <InfoIcon aria-hidden="true" />
      {t('hint')}
    </p>
  );
}

function nextText(
  t: ReturnType<typeof useTranslations<'calendar'>>,
  date: string | null,
  time: string | null,
  name: string,
) {
  return date && time ? t('empty.next', { date, time, name }) : t('empty.noNext');
}

/** The day view opens an hour before its first lesson, else at 08:00. */
function dayScroll(lessons: readonly CalendarLesson[], day: Date) {
  const first = lessonsOnDay(lessons, day)[0];
  if (!first) return 8 * 60;
  return Math.max(0, Math.floor(minutesOfDay(new Date(first.startsAtUtc)) / 60) * 60 - 60);
}
