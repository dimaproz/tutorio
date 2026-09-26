'use client';

import { useRouter } from 'next/navigation';
import { SparklesIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LessonResponse } from '@tutorio/validation';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { Notice } from '@/components/shared/notice';
import { LessonRowMenu } from '@/features/lesson-list';
import { minutesLeft, TimedLessonRow, type TimeRowPackage } from '@/features/lessons';
import { addCalendarDays, calendarWeekday, zonedDate, zonedDayStart } from '@/lib/datetime';
import { useLocalFormatter } from '@/lib/i18n/local-formatter';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import type { DayOverview } from '../model/today';
import { DaySection } from './day-section';
import { NowTicket } from './now-ticket';
import { TomorrowCard } from './tomorrow-card';

type Lesson = LessonResponse;

/** What a row needs from the page: the clock, the scope and the panel. */
export type RowContext = {
  now: number;
  dense: boolean;
  showTeacher: boolean;
  packages: Map<string, TimeRowPackage>;
  lowCreditThreshold: number;
  onOpen: (lessonId: string, intent?: 'markAttendance' | 'move' | 'makeup' | 'cancel') => void;
};

export const calendarDayHref = (date: string) => `/app/calendar?date=${date}&view=day`;

const who = (lesson: Lesson) => lesson.student?.fullName ?? lesson.group?.name ?? '';

function useRows(context: RowContext, compactMenu = false) {
  return (lessons: readonly Lesson[], dense = context.dense) =>
    lessons.map((lesson) => ({
      key: lesson.id,
      row: (
        <TimedLessonRow
          lesson={lesson}
          nowMs={context.now}
          dense={dense}
          showTeacher={context.showTeacher}
          pkg={lesson.enrollmentId ? (context.packages.get(lesson.enrollmentId) ?? null) : null}
          lowCreditThreshold={context.lowCreditThreshold}
          menu={
            dense || compactMenu ? undefined : (
              <LessonRowMenu
                lesson={lesson}
                now={context.now}
                onOpen={(id, intent) => context.onOpen(id, intent)}
              />
            )
          }
          onOpen={(id) => context.onOpen(id)}
          onMarkAttendance={(id) => context.onOpen(id, 'markAttendance')}
        />
      ),
    }));
}

/**
 * The «Зараз» ticket for the day: the running lesson with its progress, the
 * next one between lessons, «На сьогодні все» with tomorrow's first lesson at
 * the end of the day.
 */
export function TodayTicket({
  overview,
  following,
  context,
}: {
  overview: DayOverview<Lesson>;
  /** The first lesson after today, for the end of the day. */
  following: Lesson | null;
  context: RowContext;
}) {
  const t = useTranslations('today.ticket');
  const tRow = useTranslations('lessons.timeRow');
  const format = useLocalFormatter();
  const timeZone = useStudioTimeZone();
  const router = useRouter();
  const time = (value: number) => format.time(value);

  if (overview.over) {
    const first = following;
    const firstDate = first ? zonedDate(new Date(first.startsAtUtc), timeZone) : null;
    const tomorrow = firstDate === addCalendarDays(zonedDate(new Date(context.now), timeZone), 1);
    const weekday = first ? format.dateTime(new Date(first.startsAtUtc), { weekday: 'long' }) : '';
    return (
      <NowTicket
        stubTop={first ? time(Date.parse(first.startsAtUtc)) : '—'}
        stubBottom={first ? (tomorrow ? t('tomorrow') : weekday) : t('nothingAhead')}
        eyebrow={t('done')}
        title={t('held', { count: overview.taking })}
        meta={
          first
            ? t('firstNext', {
                tomorrow: tomorrow ? 'yes' : 'no',
                weekday: firstDate ? calendarWeekday(firstDate) : 0,
                time: time(Date.parse(first.startsAtUtc)),
                who: who(first),
              })
            : undefined
        }
        action={{
          label: tomorrow ? t('tomorrowCalendar') : t('calendar'),
          onClick: () => router.push(firstDate ? calendarDayHref(firstDate) : '/app/calendar'),
        }}
      />
    );
  }

  const lesson = overview.running ?? overview.next;
  if (!lesson) return null;
  const running = lesson === overview.running;
  const start = Date.parse(lesson.startsAtUtc);
  const end = start + lesson.durationMin * 60_000;
  const pkg = lesson.enrollmentId ? context.packages.get(lesson.enrollmentId) : undefined;
  const kind = lesson.groupId
    ? lesson.groupMembers !== null
      ? tRow('groupOf', { count: lesson.groupMembers })
      : tRow('kind.group')
    : lesson.kind === 'MAKEUP'
      ? tRow('makeupChip')
      : tRow('kind.individual');
  const meta = [
    kind,
    lesson.topic,
    pkg ? t('package', { left: pkg.left, total: pkg.total }) : null,
    context.showTeacher ? lesson.teacher.name : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const inMinutes = Math.max(0, Math.round((start - context.now) / 60_000));

  return (
    <NowTicket
      stubTop={time(start)}
      stubBottom={t('until', { time: time(end) })}
      eyebrow={running ? t('now') : t('next')}
      chip={
        running
          ? t('left', { minutes: minutesLeft(lesson, context.now) })
          : inMinutes < 60
            ? t('inMinutes', { minutes: inMinutes })
            : t('inHours', { hours: Math.floor(inMinutes / 60), minutes: inMinutes % 60 })
      }
      media={
        lesson.student ? (
          <EntityAvatar
            avatarKey={lesson.student.avatarKey}
            fullName={lesson.student.fullName}
            tint="indigo"
          />
        ) : null
      }
      title={who(lesson)}
      meta={meta}
      progress={
        running
          ? {
              value: Math.min(100, ((context.now - start) / (end - start)) * 100),
              label: t('progress'),
            }
          : undefined
      }
      action={{ label: t('open'), onClick: () => context.onOpen(lesson.id) }}
      onOpen={context.dense ? () => context.onOpen(lesson.id) : undefined}
      openLabel={t('openLesson', { who: who(lesson) })}
    />
  );
}

/** Today's lessons as one timeline with the «зараз» line. */
export function TodayDayList({
  overview,
  today,
  loading,
  error,
  onRetry,
  context,
}: {
  overview: DayOverview<Lesson>;
  today: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  context: RowContext;
}) {
  const t = useTranslations('today.day');
  const format = useLocalFormatter();
  const rows = useRows(context);
  const meta = loading
    ? undefined
    : overview.over
      ? t('held', { count: overview.taking })
      : overview.cancelled > 0
        ? t('countCancelled', { count: overview.lessons.length, cancelled: overview.cancelled })
        : t('count', { count: overview.lessons.length });
  return (
    <DaySection
      title={t('today')}
      meta={meta}
      calendarHref={calendarDayHref(today)}
      rows={rows(overview.lessons)}
      nowLine={
        overview.lessons.length > 0
          ? { label: format.time(context.now), after: overview.nowAfter }
          : undefined
      }
      dense={context.dense}
      loading={loading}
      error={error}
      onRetry={onRetry}
    />
  );
}

/**
 * A free day (S11 decision 3, variant A): «Сьогодні вільно» and the nearest
 * day with lessons as the day's list.
 */
export function FreeDay({
  nearest,
  tomorrow,
  context,
}: {
  nearest: { date: string; lessons: Lesson[] } | null;
  tomorrow: string;
  context: RowContext;
}) {
  const t = useTranslations('today.free');
  const format = useLocalFormatter();
  const rows = useRows(context);
  const first = nearest?.lessons[0];
  const last = nearest?.lessons.at(-1);
  const when = !nearest
    ? t('nothing')
    : nearest.date === tomorrow
      ? t('tomorrow')
      : t('onDay', { weekday: calendarWeekday(nearest.date) });
  return (
    <div className="flex flex-col gap-3.5">
      <Notice tone="success" icon={<SparklesIcon />} title={t('title')} text={when} />
      {nearest && first && last ? (
        <DaySection
          title={capitalize(
            format.dateTime(new Date(first.startsAtUtc), {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }),
          )}
          meta={
            context.dense
              ? t('count', { count: nearest.lessons.length })
              : t('countRange', {
                  count: nearest.lessons.length,
                  from: format.time(Date.parse(first.startsAtUtc)),
                  to: format.time(Date.parse(last.startsAtUtc) + last.durationMin * 60_000),
                })
          }
          calendarHref={calendarDayHref(nearest.date)}
          rows={rows(nearest.lessons)}
          dense={context.dense}
        />
      ) : null}
    </div>
  );
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** «Завтра», collapsed; open at the end of the day. */
export function TodayTomorrow({
  lessons,
  date,
  open,
  context,
}: {
  lessons: Lesson[];
  date: string;
  open: boolean;
  context: RowContext;
}) {
  const t = useTranslations('today.tomorrow');
  const format = useLocalFormatter();
  const timeZone = useStudioTimeZone();
  const rows = useRows(context, true);
  const first = lessons[0];
  const day = format.dateTime(zonedDayStart(date, timeZone), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return (
    <TomorrowCard
      key={open ? 'open' : 'closed'}
      defaultOpen={open}
      summary={
        first
          ? t('summary', {
              day,
              count: lessons.length,
              time: format.time(Date.parse(first.startsAtUtc)),
            })
          : t('none')
      }
      calendarHref={calendarDayHref(date)}
      rows={rows(lessons, true)}
    />
  );
}
