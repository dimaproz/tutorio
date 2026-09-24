'use client';

import {
  BanknoteIcon,
  CalendarClockIcon,
  CalendarPlusIcon,
  CircleCheckIcon,
  CircleSlashIcon,
  CircleXIcon,
  ClipboardCheckIcon,
  NotebookPenIcon,
  PencilIcon,
  RotateCcwIcon,
  TimerIcon,
  UserRoundIcon,
  UserXIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { LessonDetailResponse } from '@tutorio/validation';
import { LessonTimeline, type TimelineItem } from '@/components/shared/lesson-timeline';
import type { HistoryEvent } from '../model/history';
import { useLessonDates, useMoney } from './lesson-format';

/**
 * The lesson's history as the panel's timeline (S01 decision 2): three
 * entries, then "show the whole history · N more"; on desktop only the list
 * scrolls (`fill`).
 */
export function LessonHistory({
  lesson,
  events,
  teacherNames,
  fill,
}: {
  lesson: LessonDetailResponse;
  events: HistoryEvent[];
  teacherNames: Map<string, string>;
  fill: boolean;
}) {
  const t = useTranslations('lessons.history');
  const dates = useLessonDates();
  const money = useMoney();
  const join = (...parts: (string | null | false | undefined)[]) =>
    parts.filter(Boolean).join(' · ') || undefined;
  const teacher = (id: string | null) => (id ? (teacherNames.get(id) ?? '—') : '—');

  const item = (event: HistoryEvent): TimelineItem => {
    const base = {
      id: event.id,
      time: t('time', { date: dates.shortDay(event.at), time: dates.time(event.at) }),
    };
    switch (event.kind) {
      case 'created':
        return {
          ...base,
          icon: <CalendarPlusIcon />,
          tone: 'indigo',
          title:
            event.source === 'schedule'
              ? t(lesson.groupId ? 'created.groupSchedule' : 'created.schedule')
              : t(`created.${event.source}`),
          meta:
            event.source === 'makeup' && lesson.original
              ? t('makeupOf', { date: dates.longDay(lesson.original.startsAtUtc) })
              : join(event.actor),
        };
      case 'status': {
        const charge =
          event.charged > 0
            ? lesson.groupId
              ? t('chargedMembers', { count: event.charged })
              : t('charged', { count: event.charged })
            : event.to === 'CANCELLED_UNCHARGED'
              ? t('noCharge')
              : null;
        const reason = event.reason ? t('reason', { reason: event.reason }) : null;
        if (event.to === 'CANCELLED_CHARGED' || event.to === 'CANCELLED_UNCHARGED') {
          const charged = event.to === 'CANCELLED_CHARGED';
          const title =
            event.cancelledBy === 'TEACHER'
              ? t('status.teacher')
              : event.cancelledBy === 'GROUP'
                ? t('status.group')
                : event.cancelledBy === 'STUDENT'
                  ? t(charged ? 'status.studentLate' : 'status.studentOnTime')
                  : t(charged ? 'status.cancelCharged' : 'status.cancelFree');
          return {
            ...base,
            icon: charged ? <CircleXIcon /> : <CircleSlashIcon />,
            tone: 'danger',
            title,
            meta: join(event.actor, reason, charge),
          };
        }
        if (event.to === 'COMPLETED') {
          return {
            ...base,
            icon: <CircleCheckIcon />,
            tone: 'success',
            title: t('status.COMPLETED'),
            meta: join(event.automatic ? t('automatic') : event.actor, charge),
          };
        }
        if (event.to === 'NO_SHOW') {
          return {
            ...base,
            icon: <UserXIcon />,
            tone: 'danger',
            title: t('status.NO_SHOW'),
            meta: join(event.actor, charge),
          };
        }
        return {
          ...base,
          icon: <RotateCcwIcon />,
          tone: 'plain',
          title: t('status.SCHEDULED'),
          meta: join(event.actor),
        };
      }
      case 'attendance':
        return {
          ...base,
          icon: <ClipboardCheckIcon />,
          tone: 'indigo',
          title: t('attendance'),
          meta: join(
            t('attendanceMeta', {
              present: event.marks.PRESENT,
              absent: event.marks.ABSENT,
              excused: event.marks.EXCUSED,
            }),
            event.actor ?? t('automatic'),
          ),
        };
      case 'topic':
        return {
          ...base,
          icon: <PencilIcon />,
          tone: 'plain',
          title: t('topic'),
          meta: !event.after
            ? t('topicCleared')
            : event.before
              ? t('topicChange', { before: event.before, after: event.after })
              : t('topicSet', { after: event.after }),
        };
      case 'notes':
        return {
          ...base,
          icon: <NotebookPenIcon />,
          tone: 'plain',
          title: t('notes'),
          meta: join(event.actor),
        };
      case 'teacher':
        return {
          ...base,
          icon: <UserRoundIcon />,
          tone: 'plain',
          title: t('teacher'),
          meta: t('teacherChange', {
            before: teacher(event.beforeId),
            after: teacher(event.afterId),
          }),
        };
      case 'price':
        return {
          ...base,
          icon: <BanknoteIcon />,
          tone: 'plain',
          title: t('price'),
          meta: t('change', {
            before: event.before === null ? '—' : money(event.before, lesson.currency),
            after: event.after === null ? '—' : money(event.after, lesson.currency),
          }),
        };
      case 'moved':
        return {
          ...base,
          icon: <CalendarClockIcon />,
          tone: 'plain',
          title: t('moved'),
          meta:
            event.before && event.after
              ? t('change', {
                  before: `${dates.shortDay(event.before)} ${dates.time(event.before)}`,
                  after: `${dates.shortDay(event.after)} ${dates.time(event.after)}`,
                })
              : undefined,
        };
      case 'duration':
        return {
          ...base,
          icon: <TimerIcon />,
          tone: 'plain',
          title: t('duration'),
          meta: t('change', {
            before: t('minutes', { count: event.before ?? 0 }),
            after: t('minutes', { count: event.after ?? 0 }),
          }),
        };
      case 'charge':
        return {
          ...base,
          icon: <BanknoteIcon />,
          tone: 'system',
          title: event.charged > 0 ? t('chargeAdded') : t('chargeReleased'),
        };
      case 'paid':
        return {
          ...base,
          icon: <BanknoteIcon />,
          tone: 'success',
          title: t('paid'),
          meta: join(event.actor),
        };
    }
  };

  return (
    <section
      aria-label={t('title')}
      className={fill ? 'flex min-h-0 flex-1 flex-col gap-3.5' : 'flex shrink-0 flex-col gap-3.5'}
    >
      <h3 className="text-xs leading-4 font-semibold tracking-[0.04em] text-muted-foreground uppercase">
        {t('title')}
      </h3>
      <LessonTimeline
        key={lesson.id}
        items={events.map(item)}
        fill={fill}
        showAllLabel={(hidden) => t('showAll', { count: hidden })}
        collapseLabel={t('collapse')}
        label={t('title')}
      />
    </section>
  );
}
