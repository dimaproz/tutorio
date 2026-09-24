'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarIcon, ClipboardCheckIcon, PlusIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { GroupDetail, LessonResponse } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/shared/empty-state';
import { LessonList, type LessonListItem } from '@/components/shared/lesson-list';
import { RowActionsTrigger } from '@/components/shared/row-actions-trigger';
import { LessonStatusBadge } from '@/features/lessons';
import { lessonBuckets, scheduleSlots } from '@/features/groups/model/presentation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWeekdayLabels } from '@/lib/i18n/weekdays';

/** The first rows, and how many more each "show more" reveals. */
const FIRST_PAGE = 7;
const MORE = 12;

/** Attendance is marked once a lesson has started, unless it was cancelled. */
export function isAttendanceMarkable(lesson: LessonResponse, now: number): boolean {
  return (
    lesson.status === 'COMPLETED' ||
    (lesson.status === 'SCHEDULED' && Date.parse(lesson.startsAtUtc) <= now)
  );
}

/**
 * The group's lessons in the shared `LessonList`: what is coming up (the next
 * one highlighted), then what happened, in a fixed-height box that scrolls,
 * with "show more" filling the same box. Each row's menu opens the lesson or
 * marks who came.
 */
export function GroupLessonsCard({
  group,
  lessons,
  loading,
  now,
  archived,
  onMarkAttendance,
}: {
  group: GroupDetail;
  lessons: LessonResponse[];
  loading: boolean;
  now: number;
  archived: boolean;
  onMarkAttendance: (lesson: LessonResponse) => void;
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
    const came = lesson.attendance
      ? t('attended', { present: lesson.attendance.present, marked: lesson.attendance.marked })
      : null;
    const teacher = lesson.teacher.name;
    const next = lesson.id === buckets.nextId;
    const markable = !archived && isAttendanceMarkable(lesson, now);
    const dateLabel = format.dateTime(start, { day: 'numeric', month: 'long' });
    return {
      id: lesson.id,
      weekday: format.dateTime(start, { weekday: 'short' }),
      day: format.dateTime(start, { day: '2-digit' }),
      title: lesson.notes?.split('\n')[0] || t('fallbackTitle'),
      meta: past
        ? [month, time(start), came ?? teacher].join(' · ')
        : [month, range, teacher].join(' · '),
      metaShort: past
        ? [time(start), came].filter(Boolean).join(' · ')
        : [range, teacher.split(' ')[0]].join(' · '),
      state: next ? 'next' : past ? 'past' : 'default',
      status: next ? (
        <Badge variant="brand">{t('next')}</Badge>
      ) : (
        <LessonStatusBadge status={lesson.status} />
      ),
      // Marking who came is the one action a lesson row has until the lesson
      // screen is rebuilt; a phone row opens it directly.
      menu: markable ? (
        <DropdownMenu>
          <RowActionsTrigger label={t('actions', { date: dateLabel })} />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onMarkAttendance(lesson)}>
              <ClipboardCheckIcon data-icon />
              {t('mark')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : undefined,
      onSelect: markable ? () => onMarkAttendance(lesson) : undefined,
      selectLabel: markable ? t('markOn', { date: dateLabel }) : undefined,
    };
  };

  const more = Math.min(MORE, ordered.length - visible.length);

  return (
    <LessonList
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
            archived || group.schedules.length > 0 ? undefined : (
              <Button asChild leading={<PlusIcon />}>
                <Link prefetch={false} href={`/app/groups/${group.id}/edit#group-form-schedule`}>
                  {t('setUp')}
                </Link>
              </Button>
            )
          }
        />
      }
    />
  );
}
