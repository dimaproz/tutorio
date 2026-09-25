'use client';

import { useMemo, useState } from 'react';
import { CalendarIcon, PlusIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { GroupDetail, LessonResponse } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { LessonList, type LessonListItem } from '@/components/shared/lesson-list';
import {
  awaitsAttendance,
  isLessonRunning,
  lessonBuckets,
  LessonRunningBadge,
  LessonStatusBadge,
} from '@/features/lessons';
import { scheduleSlots } from '@/features/groups/model/presentation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWeekdayLabels } from '@/lib/i18n/weekdays';

/** The first rows, and how many more each "show more" reveals. */
const FIRST_PAGE = 7;
const MORE = 12;

/**
 * The group's lessons in the shared `LessonList`: what is coming up (the next
 * one highlighted), then what happened, in a fixed-height box that scrolls,
 * with "show more" filling the same box. A row opens the lesson panel. Past
 * rows read like the others — attendance figures live in «Відвідуваність»
 * (S08 decision 6) —, and one nobody has marked yet reads «присутність не
 * відмічена» with «Відмітити», opening the panel's attendance sheet.
 */
export function GroupLessonsCard({
  group,
  lessons,
  loading,
  now,
  archived,
  onOpenLesson,
  onMarkLesson,
  onAddLesson,
  onCreateSchedule,
}: {
  group: GroupDetail;
  lessons: LessonResponse[];
  loading: boolean;
  now: number;
  archived: boolean;
  onOpenLesson: (lessonId: string) => void;
  /** Opens the lesson panel on its attendance sheet (S01). */
  onMarkLesson: (lessonId: string) => void;
  /** Opens the lesson form for the group (S02); omitted for an archived group. */
  onAddLesson?: () => void;
  /** Opens the S05 schedule form for the group; omitted for an archived group. */
  onCreateSchedule?: () => void;
}) {
  const t = useTranslations('groups.lessons');
  const format = useFormatter();
  const mobile = useIsMobile();
  const shortDays = useWeekdayLabels();
  const [shown, setShown] = useState(FIRST_PAGE);
  const buckets = useMemo(() => lessonBuckets(lessons, now), [lessons, now]);
  const ordered = [...buckets.upcoming, ...buckets.past];
  const visible = ordered.slice(0, shown);
  const visibleIds = new Set(visible.map((lesson) => lesson.id));

  // "Coming up · Tue and Thu at 17:00" when the whole week starts at one time.
  const slots = scheduleSlots(group.schedules);
  const times = new Set(slots.map((slot) => slot.localTime));
  const comingUp =
    slots.length > 0 && times.size === 1
      ? t('comingUpAt', {
          days: format.list([...new Set(slots.map((slot) => shortDays[slot.weekday] ?? ''))], {
            type: 'conjunction',
          }),
          time: slots[0]!.localTime,
        })
      : t('comingUp');

  const time = (date: Date) => format.dateTime(date, { hour: '2-digit', minute: '2-digit' });
  const toItem = (lesson: LessonResponse, past: boolean): LessonListItem => {
    const start = new Date(lesson.startsAtUtc);
    const month = format.dateTime(start, { month: 'short' });
    const end = new Date(start.getTime() + lesson.durationMin * 60_000);
    const range = `${time(start)} – ${time(end)}`;
    const teacher = lesson.teacher.name;
    const next = lesson.id === buckets.nextId;
    const unmarked = past && awaitsAttendance(lesson, now);
    const dateLabel = format.dateTime(start, { weekday: 'short', day: 'numeric', month: 'long' });
    return {
      id: lesson.id,
      weekday: format.dateTime(start, { weekday: 'short' }),
      day: format.dateTime(start, { day: '2-digit' }),
      title: lesson.topic || lesson.notes?.split('\n')[0] || t('fallbackTitle'),
      meta: [month, range, unmarked ? t('notMarked') : teacher].join(' · '),
      metaShort: [range, unmarked ? t('notMarked') : teacher.split(' ')[0]].join(' · '),
      state: next ? 'next' : past ? 'past' : 'default',
      status: isLessonRunning(lesson, now) ? (
        <LessonRunningBadge />
      ) : next ? (
        <Badge variant="brand">{t('next')}</Badge>
      ) : unmarked ? (
        <Badge variant="warning">{t('mark')}</Badge>
      ) : (
        <LessonStatusBadge status={lesson.status} />
      ),
      // The whole row opens the lesson panel; every action lives there.
      onSelect: () => (unmarked ? onMarkLesson(lesson.id) : onOpenLesson(lesson.id)),
      selectLabel: unmarked
        ? t('markLesson', { date: dateLabel })
        : t('openLesson', { date: dateLabel }),
    };
  };

  const more = Math.min(MORE, ordered.length - visible.length);

  return (
    <LessonList
      action={onAddLesson ? { label: t('addLesson'), onClick: onAddLesson } : undefined}
      header={{
        kind: 'title',
        title: t('title'),
        meta:
          lessons.length > 0
            ? t('meta', { total: lessons.length, upcoming: buckets.upcoming.length })
            : undefined,
      }}
      groups={[
        {
          label: comingUp,
          items: buckets.upcoming
            .filter((lesson) => visibleIds.has(lesson.id))
            .map((lesson) => toItem(lesson, false)),
        },
        {
          label: t('earlier'),
          items: buckets.past
            .filter((lesson) => visibleIds.has(lesson.id))
            .map((lesson) => toItem(lesson, true)),
        },
      ]}
      shown={visible.length}
      total={ordered.length}
      countLabel={t('showing', { shown: visible.length, total: ordered.length })}
      onLoadMore={() => setShown((current) => current + MORE)}
      loadMoreLabel={t('showMore', { count: more })}
      loading={loading}
      loadingLabel={t('loading')}
      regionLabel={t('region')}
      compact={mobile}
      empty={
        <EmptyState
          icon={<CalendarIcon />}
          title={t('emptyTitle')}
          text={group.schedules.length > 0 ? t('emptyTextScheduled') : t('emptyText')}
          action={
            archived || group.schedules.length > 0 || !onCreateSchedule ? undefined : (
              <Button type="button" leading={<PlusIcon />} onClick={onCreateSchedule}>
                {t('setUp')}
              </Button>
            )
          }
        />
      }
    />
  );
}
