'use client';

import { useState } from 'react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import type { LessonResponse, StudentStatusDto } from '@tutorio/validation';
import {
  LessonActionsDialog,
  type LessonDialogMode,
} from '@/components/scheduling/lesson-actions-dialog';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { NextLessonCard, type NextLessonArt } from '@/components/shared/next-lesson-card';
import { PersonItem } from '@/components/shared/person-item';
import { Button } from '@/components/ui/button';
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
 * The student's next scheduled lesson as the ink ticket, with open and
 * reschedule commands. With nothing planned it explains why — nothing booked
 * yet, a pause, or the archive — and offers no button: the page already has
 * the command that would change it.
 */
export function StudentNextLesson({
  status,
  lesson,
  loading = false,
  unavailable = false,
}: {
  status: StudentStatusDto;
  lesson: LessonResponse | null;
  loading?: boolean;
  /** The lesson read failed: say so instead of claiming nothing is planned. */
  unavailable?: boolean;
}) {
  const t = useTranslations('students.nextLesson');
  const format = useFormatter();
  const now = useNow();
  const [mode, setMode] = useState<LessonDialogMode | null>(null);

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

  return (
    <>
      <NextLessonCard
        heading={t('heading')}
        relative={format.relativeTime(start, now)}
        date={capitalizeFirst(
          format.dateTime(start, { weekday: 'short', day: 'numeric', month: 'short' }),
        )}
        time={`${time(start)} – ${time(end)} · ${lesson.group?.name ?? t('individual')}`}
        teacher={
          <PersonItem
            tone="ink"
            size="sm"
            media={<EntityAvatar fullName={lesson.teacher.name} size="sm" />}
            name={lesson.teacher.name}
            subtitle={lesson.packageId ? t('usesCredit') : t('teacher')}
          />
        }
        primaryAction={
          <Button type="button" variant="soft" onClick={() => setMode('menu')}>
            {t('open')}
          </Button>
        }
        secondaryAction={
          <Button type="button" variant="dark-outline" onClick={() => setMode('reschedule')}>
            {t('reschedule')}
          </Button>
        }
      />
      <LessonActionsDialog
        open={mode !== null}
        onOpenChange={(open) => (open ? undefined : setMode(null))}
        lesson={lesson}
        initialMode={mode ?? 'menu'}
      />
    </>
  );
}
