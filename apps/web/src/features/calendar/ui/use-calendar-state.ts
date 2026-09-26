'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useStoredChoice } from '@/hooks/use-stored-choice';
import { useLessonsQuery, useTeachersQuery } from '../api';
import {
  DEFAULT_STATUS_FILTER,
  matchesStatus,
  statusCounts,
  type StatusFilter,
} from '../model/filters';
import { type CalendarLesson } from '../model/lessons';
import {
  calendarPeriod,
  CALENDAR_VIEWS,
  shiftAnchor,
  startOfDay,
  type CalendarView,
} from '../model/period';
import { isCalendarDate, zonedDate, zonedDayStart } from '@/lib/datetime';
import { useLocalFormatter } from '@/lib/i18n/local-formatter';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';

/** The live minute, or a pinned clock (stories). */
export function useNow(pinned?: number) {
  const [now, setNow] = useState(() => pinned ?? Date.now());
  useEffect(() => {
    if (pinned !== undefined) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [pinned]);
  return pinned ?? now;
}

/** Intl adds «р.» after a Ukrainian year; the calendar's titles leave it out. */
const trimYear = (text: string) => text.replace(/\s?р\.$/, '');
const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** The range title: «21 – 27 вересня 2026», «Чт, 24 вересня 2026», «Вересень 2026». */
export function usePeriodTitle() {
  const format = useLocalFormatter();
  return (view: CalendarView, days: Date[], anchor: Date, withYear: boolean) => {
    const year = withYear ? { year: 'numeric' as const } : {};
    if (view === 'day') {
      return capitalize(
        trimYear(
          format.dateTime(anchor, { weekday: 'short', day: 'numeric', month: 'long', ...year }),
        ),
      );
    }
    if (view === 'week') {
      return trimYear(
        format.dateTimeRange(days[0]!, days[6]!, { day: 'numeric', month: 'long', ...year }),
      ).replace(/\s?[–-]\s?/, ' – ');
    }
    return capitalize(trimYear(format.dateTime(anchor, { month: 'long', year: 'numeric' })));
  };
}

/**
 * The calendar's state: the view (remembered per browser, day on phones and
 * week on desktop), the anchor day, the teacher and status filters, and the
 * period's lessons as the grid draws them. A link may open it on a day and
 * one teacher (`?date=yyyy-MM-dd&teacher=<id>`, a teacher's profile), and in
 * one view (`?view=day`, the Today page).
 */
export function useCalendarState({ mobile, nowMs }: { mobile: boolean; nowMs: number }) {
  const [desktopView, setDesktopView] = useStoredChoice<CalendarView>(
    'tutorio.calendar.view',
    CALENDAR_VIEWS,
    'week',
  );
  const [phoneView, setPhoneView] = useStoredChoice<CalendarView>(
    'tutorio.calendar.view.phone',
    CALENDAR_VIEWS,
    'day',
  );
  const searchParams = useSearchParams();
  // A link may open a view once (`?view=day`, the Today page's «Календар»)
  // without changing the remembered one.
  const [linkedView, setLinkedView] = useState<CalendarView | null>(() => {
    const linked = searchParams.get('view');
    return CALENDAR_VIEWS.includes(linked as CalendarView) ? (linked as CalendarView) : null;
  });
  const view = linkedView ?? (mobile ? phoneView : desktopView);
  const setStoredView = mobile ? setPhoneView : setDesktopView;
  const setView = (next: CalendarView) => {
    setLinkedView(null);
    setStoredView(next);
  };
  const timeZone = useStudioTimeZone();
  const [anchor, setAnchor] = useState(() => {
    const linked = searchParams.get('date');
    return linked && isCalendarDate(linked)
      ? zonedDayStart(linked, timeZone)
      : startOfDay(new Date(nowMs), timeZone);
  });
  const period = useMemo(() => calendarPeriod(view, anchor, timeZone), [view, anchor, timeZone]);
  // The day view reads its whole week: the strip's dots and the side panel.
  const readPeriod = useMemo(
    () => (view === 'day' ? calendarPeriod('week', anchor, timeZone) : period),
    [anchor, period, view, timeZone],
  );

  const teachersQuery = useTeachersQuery({ page: 1, pageSize: 100, status: 'ACTIVE' });
  const teachers = useMemo(() => teachersQuery.data?.items ?? [], [teachersQuery.data]);
  const [pickedTeachers, setPickedTeachers] = useState<string[] | null>(() => {
    const linked = searchParams.get('teacher');
    return linked ? [linked] : null;
  });
  // Until the tutor picks, the calendar opens on their own lessons.
  const ownTeachers = useMemo(
    () => teachers.filter((teacher) => teacher.isMe).map((teacher) => teacher.id),
    [teachers],
  );
  const selectedTeachers = pickedTeachers ?? ownTeachers;
  const teachersFiltered =
    selectedTeachers.length !== ownTeachers.length ||
    selectedTeachers.some((id) => !ownTeachers.includes(id));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(DEFAULT_STATUS_FILTER);

  const lessonsQuery = useLessonsQuery({
    from: readPeriod.from.toISOString(),
    to: readPeriod.to.toISOString(),
  });
  const loading = lessonsQuery.isPending || lessonsQuery.isPlaceholderData;
  const all = useMemo<CalendarLesson[]>(
    () => (lessonsQuery.isPlaceholderData ? [] : (lessonsQuery.data?.items ?? [])),
    [lessonsQuery.data, lessonsQuery.isPlaceholderData],
  );
  const inPeriod = (lesson: CalendarLesson) => {
    const start = Date.parse(lesson.startsAtUtc);
    return start >= period.from.getTime() && start < period.to.getTime();
  };
  const ofTeachers = (lesson: CalendarLesson, picked: readonly string[]) =>
    picked.length === 0 || picked.includes(lesson.teacherId);
  const byTeacher = all.filter((lesson) => ofTeachers(lesson, selectedTeachers));
  const visible = byTeacher.filter((lesson) => matchesStatus(lesson, statusFilter));
  const periodLessons = byTeacher.filter(inPeriod);

  const teacherCounts: Record<string, number> = {};
  for (const lesson of all.filter(inPeriod)) {
    teacherCounts[lesson.teacherId] = (teacherCounts[lesson.teacherId] ?? 0) + 1;
  }

  return {
    view,
    setView,
    anchor,
    setAnchor,
    period,
    timeZone,
    step: (direction: 1 | -1) => setAnchor(shiftAnchor(view, anchor, direction, timeZone)),
    today: () => setAnchor(startOfDay(new Date(nowMs), timeZone)),
    teachers,
    selectedTeachers,
    teachersFiltered,
    setSelectedTeachers: setPickedTeachers,
    statusFilter,
    setStatusFilter,
    lessonsQuery,
    loading,
    all,
    visible,
    visibleInPeriod: visible.filter(inPeriod),
    statusCounts: statusCounts(periodLessons),
    teacherCounts,
    countFor: (picked: readonly string[], filter: StatusFilter) =>
      all.filter(
        (lesson) => inPeriod(lesson) && ofTeachers(lesson, picked) && matchesStatus(lesson, filter),
      ).length,
  };
}

/** «Dmytro Tutor · 15 занять цього тижня», and its variants. */
export function useCalendarSubtitle() {
  const t = useTranslations('calendar.subtitle');
  const format = useLocalFormatter();
  return ({
    state,
    teachers,
    selected,
  }: {
    state: ReturnType<typeof useCalendarState>;
    teachers: ReturnType<typeof useCalendarState>['teachers'];
    selected: readonly string[];
  }) => {
    const names =
      selected.length === 1
        ? (teachers.find((teacher) => teacher.id === selected[0])?.fullName ?? '')
        : selected.length > 1
          ? t('teachers', { count: selected.length })
          : teachers.length === 1
            ? teachers[0]!.fullName
            : t('allTeachers');
    if (state.loading) return t('loading');
    if (state.lessonsQuery.isError) return names;
    const count = state.visibleInPeriod.length;
    const filtered = state.statusFilter !== DEFAULT_STATUS_FILTER;
    let lessons: string;
    if (filtered) {
      lessons = state.statusFilter.shown.cancelled
        ? t('filtered', { count })
        : t('cancelledHidden', { count });
    } else if (state.view === 'day') {
      lessons = format.dateTime(state.anchor, { weekday: 'long', day: 'numeric', month: 'long' });
    } else if (state.view === 'week') {
      lessons = t('week', { count });
    } else {
      // The month's index, 0 = January, on the studio's calendar.
      const month = Number(zonedDate(state.anchor, state.timeZone).slice(5, 7)) - 1;
      lessons = t('month', { count, month: String(month) });
    }
    return names ? `${names} · ${lessons}` : lessons;
  };
}
