'use client';

import { useCallback, useMemo, useState } from 'react';
import { MoreHorizontalIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { LessonResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { LessonItem } from '@/components/shared/lesson-item';
import { LoadingPanel } from '@/components/shared/loading';
import { SectionDivider } from '@/components/shared/section-divider';
import { useLessonsQuery } from '@/lib/api/scheduling';
import { LessonActionsDialog, type LessonDialogMode } from './lesson-actions-dialog';
import { LessonStatusBadge } from './lesson-status';

// How far back and forward a student's schedule is read on their profile.
const PAST_DAYS = 120;
const FUTURE_DAYS = 120;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The student's own schedule, grouped into what is coming and what already
 * happened. It renders as a panel: the profile owns the card, the section
 * switcher and the booking action, while this component owns the lesson data
 * and the per-row menu.
 */
export function StudentLessonsCard({
  studentId,
  readOnly = false,
  nowMs,
}: {
  studentId: string;
  readOnly?: boolean;
  nowMs?: number;
}) {
  const t = useTranslations('scheduling.studentLessons');
  const format = useFormatter();

  const [selected, setSelected] = useState<LessonResponse | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsMode, setActionsMode] = useState<LessonDialogMode>('menu');

  // Pinned once per mount: the window and the upcoming/past split must not
  // shift underneath the tutor on an unrelated re-render.
  const [now] = useState(() => nowMs ?? Date.now());

  const range = useMemo(
    () => ({
      from: new Date(now - PAST_DAYS * DAY_MS).toISOString(),
      to: new Date(now + FUTURE_DAYS * DAY_MS).toISOString(),
    }),
    [now],
  );
  const lessons = useLessonsQuery({ ...range, studentId });

  const { upcoming, past } = useMemo(() => {
    const items = lessons.data?.items ?? [];
    return {
      upcoming: items.filter((item) => new Date(item.startsAtUtc).getTime() >= now),
      // Most recent first — the tutor looks backwards from today.
      past: items.filter((item) => new Date(item.startsAtUtc).getTime() < now).reverse(),
    };
  }, [lessons.data, now]);

  // One dialog for the whole panel: the row menu only says which panel to show.
  const openLesson = useCallback((lesson: LessonResponse, mode: LessonDialogMode = 'menu') => {
    setSelected(lesson);
    setActionsMode(mode);
    setActionsOpen(true);
  }, []);

  if (lessons.isPending) {
    return <LoadingPanel size="md" className="min-h-32 rounded-row border-0 bg-transparent" />;
  }

  if (upcoming.length === 0 && past.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{t('noUpcoming')}</EmptyTitle>
          <EmptyDescription>{t('noPast')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const renderLesson = (lesson: LessonResponse, state: 'next' | 'default' | 'past') => {
    const start = new Date(lesson.startsAtUtc);
    const end = new Date(start.getTime() + lesson.durationMin * 60 * 1000);

    return (
      <LessonItem
        key={lesson.id}
        state={state}
        date={{
          top: format.dateTime(start, { weekday: 'short' }),
          day: format.dateTime(start, { day: '2-digit' }),
        }}
        title={lesson.group?.name ?? t('individualLesson')}
        meta={[
          format.dateTime(start, { month: 'short' }),
          `${format.dateTime(start, { hour: '2-digit', minute: '2-digit' })} – ${format.dateTime(end, { hour: '2-digit', minute: '2-digit' })}`,
          lesson.teacher.name,
        ].join(' · ')}
        status={<LessonStatusBadge status={lesson.status} />}
        actions={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('lessonActions')}
            onClick={() => openLesson(lesson)}
          >
            <MoreHorizontalIcon />
          </Button>
        }
      />
    );
  };

  return (
    <div className="flex flex-col gap-1">
      {upcoming.length > 0 ? (
        <>
          <SectionDivider label={t('comingUp')} className="mb-1" />
          {upcoming.map((lesson, index) => renderLesson(lesson, index === 0 ? 'next' : 'default'))}
        </>
      ) : null}
      {past.length > 0 ? (
        <>
          <SectionDivider label={t('earlier')} className="my-1" />
          {past.map((lesson) => renderLesson(lesson, 'past'))}
        </>
      ) : null}

      {!readOnly ? (
        <LessonActionsDialog
          open={actionsOpen}
          onOpenChange={setActionsOpen}
          lesson={selected}
          initialMode={actionsMode}
        />
      ) : null}
    </div>
  );
}
