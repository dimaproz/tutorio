'use client';

import { useFormatter, useNow, useTranslations } from 'next-intl';
import type { LessonResponse, StudentStatusDto } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { NextLessonCard, type NextLessonArt } from '@/components/shared/next-lesson-card';
import { PersonItem } from '@/components/shared/person-item';
import { isLessonRunning } from '@/features/lessons';
import { capitalizeFirst } from '@/lib/utils';

const EMPTY_BY_STATUS: Record<StudentStatusDto, 'fresh' | 'hold' | 'archived'> = {
  ACTIVE: 'fresh',
  ON_HOLD: 'hold',
  ARCHIVED: 'archived',
};

const ART: Record<'fresh' | 'hold' | 'archived', NextLessonArt> = {
  fresh: 'empty',
  hold: 'pause',
  archived: 'archive',
};

/**
 * The student's next scheduled lesson as the ink ticket. While the lesson is
 * under way the ticket follows it on a live clock: when it ends, how much has
 * passed, and the commands to open it and, for a group, to mark attendance.
 * With nothing planned it explains why — nothing booked yet, a pause, or the
 * archive — and offers no button: the page already has the command that would
 * change it.
 */
export function StudentNextLesson({
  status,
  lesson,
  loading = false,
  unavailable = false,
  onOpenLesson,
  onMarkAttendance,
  onReschedule,
}: {
  status: StudentStatusDto;
  lesson: LessonResponse | null;
  loading?: boolean;
  /** The lesson read failed: say so instead of claiming nothing is planned. */
  unavailable?: boolean;
  /** Opens the lesson panel; offered while the lesson is under way. */
  onOpenLesson?: (lessonId: string) => void;
  /** Opens the panel on its attendance dialog; group lessons only. */
  onMarkAttendance?: (lessonId: string) => void;
  /** Opens the panel on its move (the S01 move dialog). */
  onReschedule?: (lessonId: string) => void;
}) {
  const t = useTranslations('students.nextLesson');
  const format = useFormatter();
  // Ticks so a running lesson's progress keeps up with the clock.
  const now = useNow({ updateInterval: 60_000 });

  if (loading) {
    return <NextLessonCard heading={t('heading')} loading />;
  }

  if (unavailable) {
    return (
      <NextLessonCard
        heading={t('heading')}
        emptyTitle={t('unavailable.title')}
        emptyDescription={t('unavailable.text')}
        art="empty"
      />
    );
  }

  // A pause may keep lessons the tutor chose not to cancel, and group lessons
  // always run; those still show. Only the archive hides the ticket.
  if (!lesson || status === 'ARCHIVED') {
    const reason = EMPTY_BY_STATUS[status];
    return (
      <NextLessonCard
        heading={t('heading')}
        emptyTitle={t(`empty.${reason}.title`)}
        emptyDescription={t(`empty.${reason}.text`)}
        art={ART[reason]}
      />
    );
  }

  const start = new Date(lesson.startsAtUtc);
  const end = new Date(start.getTime() + lesson.durationMin * 60 * 1000);
  const time = (value: Date) => format.dateTime(value, { hour: '2-digit', minute: '2-digit' });
  const name = lesson.group?.name ?? t('individual');
  const teacher = (
    <PersonItem
      tone="ink"
      size="sm"
      media={<EntityAvatar fullName={lesson.teacher.name} size="sm" />}
      name={lesson.teacher.name}
      subtitle={t('teacher')}
    />
  );

  if (isLessonRunning(lesson, now.getTime())) {
    const elapsed = Math.min(
      Math.floor((now.getTime() - start.getTime()) / 60_000),
      lesson.durationMin,
    );
    return (
      <NextLessonCard
        heading={t('running.heading')}
        relative={t('running.chip')}
        date={t('running.until', { time: time(end) })}
        time={t('running.started', { time: time(start), name })}
        progress={{
          value: elapsed,
          total: lesson.durationMin,
          start: time(start),
          end: time(end),
          label: t('running.elapsed', { elapsed, total: lesson.durationMin }),
          name: t('running.progress'),
        }}
        teacher={teacher}
        primaryAction={
          onOpenLesson ? (
            <Button type="button" variant="soft" onClick={() => onOpenLesson(lesson.id)}>
              {t('open')}
            </Button>
          ) : undefined
        }
        secondaryAction={
          lesson.groupId && onMarkAttendance ? (
            <Button type="button" variant="white" onClick={() => onMarkAttendance(lesson.id)}>
              {t('running.mark')}
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      <NextLessonCard
        heading={t('heading')}
        relative={format.relativeTime(start, now)}
        date={capitalizeFirst(
          format.dateTime(start, { weekday: 'short', day: 'numeric', month: 'short' }),
        )}
        time={`${time(start)} – ${time(end)} · ${name}`}
        teacher={teacher}
        primaryAction={
          onOpenLesson ? (
            <Button type="button" variant="soft" onClick={() => onOpenLesson(lesson.id)}>
              {t('open')}
            </Button>
          ) : undefined
        }
        secondaryAction={
          onReschedule ? (
            <Button type="button" variant="dark-outline" onClick={() => onReschedule(lesson.id)}>
              {t('reschedule')}
            </Button>
          ) : undefined
        }
      />
    </>
  );
}
