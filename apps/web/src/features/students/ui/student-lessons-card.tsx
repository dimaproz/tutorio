'use client';

import { useMemo, useState } from 'react';
import { addDays, startOfDay, subDays } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { LessonResponse } from '@tutorio/validation';
import { EmptyState } from '@/components/shared/empty-state';
import { LessonList, type LessonListItem } from '@/components/shared/lesson-list';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLessonsQuery } from '@/lib/api/scheduling';
import {
  isLessonRunning,
  lessonBuckets,
  LessonRunningBadge,
  LessonStatusBadge,
} from '@/features/lessons';

// How far back and forward a student's schedule is read on their profile.
const PAST_DAYS = 120;
const FUTURE_DAYS = 120;
/** The first rows, and how many more each "show more" reveals. */
const FIRST_PAGE = 10;
const MORE = 12;

/**
 * The profile's lesson window; sharing it lets every block reuse one query.
 * Both ends are whole days, so the query key stays the same all day rather
 * than changing with each mount's clock. The upcoming/past split still uses
 * the precise `now`.
 */
export function studentLessonsRange(now: number) {
  const today = startOfDay(now);
  return {
    from: subDays(today, PAST_DAYS).toISOString(),
    to: addDays(today, FUTURE_DAYS + 1).toISOString(),
  };
}

/**
 * The student's own schedule, grouped into what is coming and what already
 * happened, on the shared `LessonList`: a fixed-height box that scrolls, so a
 * long history never grows the profile, with "show more" filling the same
 * box. It renders bare: the profile owns the card, the section switcher and
 * the booking action, while this component owns the lesson data and the
 * per-row menu.
 */
export function StudentLessonsCard({
  studentId,
  readOnly = false,
  historyOnly = false,
  nowMs,
  onSelect,
}: {
  studentId: string;
  readOnly?: boolean;
  /** Archived profiles read their history only: nothing is coming up. */
  historyOnly?: boolean;
  nowMs?: number;
  /** Opens a lesson in the lesson panel. */
  onSelect?: (lessonId: string) => void;
}) {
  const t = useTranslations('scheduling.studentLessons');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const mobile = useIsMobile();
  const [shown, setShown] = useState(FIRST_PAGE);

  // Pinned once per mount: the window and the upcoming/past split must not
  // shift underneath the tutor on an unrelated re-render.
  const [now] = useState(() => nowMs ?? Date.now());

  const range = useMemo(() => studentLessonsRange(now), [now]);
  const lessons = useLessonsQuery({ ...range, studentId });

  // A lesson under way stays with the upcoming rows until it ends.
  const {
    upcoming,
    past,
    nextId: next,
  } = useMemo(() => lessonBuckets(lessons.data?.items ?? [], now), [lessons.data, now]);

  const ordered = historyOnly ? past : [...upcoming, ...past];
  const visible = ordered.slice(0, shown);
  const visibleIds = new Set(visible.map((lesson) => lesson.id));
  const nextId = historyOnly ? null : next;

  const toItem = (lesson: LessonResponse): LessonListItem => {
    const start = new Date(lesson.startsAtUtc);
    const end = new Date(start.getTime() + lesson.durationMin * 60 * 1000);
    const range = `${format.dateTime(start, { hour: '2-digit', minute: '2-digit' })} – ${format.dateTime(end, { hour: '2-digit', minute: '2-digit' })}`;
    const past = end.getTime() <= now;
    return {
      id: lesson.id,
      weekday: format.dateTime(start, { weekday: 'short' }),
      day: format.dateTime(start, { day: '2-digit' }),
      title: lesson.group?.name ?? t('individualLesson'),
      meta: [format.dateTime(start, { month: 'short' }), range, lesson.teacher.name].join(' · '),
      metaShort: [range, lesson.teacher.name.split(' ')[0]].join(' · '),
      state: lesson.id === nextId ? 'next' : past ? 'past' : 'default',
      status: isLessonRunning(lesson, now) ? (
        <LessonRunningBadge />
      ) : (
        <LessonStatusBadge status={lesson.status} />
      ),
      onSelect: onSelect ? () => onSelect(lesson.id) : undefined,
      selectLabel: onSelect
        ? t('openLesson', {
            date: format.dateTime(start, { weekday: 'short', day: 'numeric', month: 'long' }),
          })
        : undefined,
    };
  };

  const more = Math.min(MORE, ordered.length - visible.length);

  return (
    <>
      <LessonList
        framed={false}
        groups={[
          {
            label: t('comingUp'),
            items: historyOnly
              ? []
              : upcoming.filter((lesson) => visibleIds.has(lesson.id)).map(toItem),
          },
          {
            label: historyOnly ? t('history') : t('earlier'),
            items: past.filter((lesson) => visibleIds.has(lesson.id)).map(toItem),
          },
        ]}
        shown={visible.length}
        total={ordered.length}
        countLabel={
          ordered.length > visible.length
            ? t('showing', { shown: visible.length, total: ordered.length })
            : undefined
        }
        onLoadMore={() => setShown((current) => current + MORE)}
        loadMoreLabel={t('showMore', { count: more })}
        loading={lessons.isPending}
        loadingLabel={tCommon('loading')}
        regionLabel={t('region')}
        compact={mobile}
        empty={
          <EmptyState
            icon={<CalendarIcon />}
            title={t('emptyTitle')}
            text={readOnly ? t('emptyArchived') : t('emptyDescription')}
          />
        }
      />
    </>
  );
}
