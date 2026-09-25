'use client';

import { GraduationCapIcon, TriangleAlertIcon, UserRoundIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ScheduleConflict } from '@tutorio/validation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { DateTile } from '@/components/shared/date-tile';
import { LessonItem } from '@/components/shared/lesson-item';
import { useLessonDates } from '../lesson-format';

/** The lesson being saved, as the conflict dialog's feature card shows it. */
export type ConflictCandidate = {
  startsAtUtc: string;
  durationMin: number;
  /** The student or group name. */
  title: string;
  teacherName: string;
};

function range(
  dates: ReturnType<typeof useLessonDates>,
  lesson: { startsAtUtc: string; durationMin: number },
) {
  return `${dates.time(lesson.startsAtUtc)}–${dates.endTime(lesson)}`;
}

/**
 * What a new time overlaps (L-110, S01 decision 9, variant C): the new lesson
 * in the feature card, "overlaps with", and one row per booked lesson with a
 * chip naming who is double-booked. "Save anyway" repeats the save with
 * `force` (L-111); "Change the time" goes back to the form.
 */
export function ConflictDialog({
  open,
  onOpenChange,
  candidate,
  conflicts,
  busy,
  onSaveAnyway,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: ConflictCandidate | null;
  conflicts: ScheduleConflict[];
  busy: boolean;
  onSaveAnyway: () => void;
}) {
  const t = useTranslations('lessons.conflict');
  const tPanel = useTranslations('lessons.panel');
  const format = useFormatter();
  const dates = useLessonDates();
  const tile = (iso: string) => ({
    top: format.dateTime(new Date(iso), { weekday: 'short' }),
    day: format.dateTime(new Date(iso), { day: 'numeric' }),
  });

  return (
    <AdaptiveDialog
      open={open}
      onOpenChange={onOpenChange}
      closeLabel={tPanel('close')}
      icon={<TriangleAlertIcon />}
      iconClassName="bg-tint-warning text-tint-warning-foreground"
      title={t('title', { count: conflicts.length })}
      secondary={
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {t('change')}
        </Button>
      }
      primary={
        <Button type="button" disabled={busy} onClick={onSaveAnyway}>
          {busy ? <Spinner data-icon="inline-start" /> : null}
          {t('saveAnyway')}
        </Button>
      }
    >
      {candidate ? (
        <Card tone="feature" className="flex-row items-center gap-4 rounded-row px-5 py-4">
          <DateTile
            {...tile(candidate.startsAtUtc)}
            size={52}
            className="bg-feature-soft text-feature-foreground"
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-semibold tracking-[0.04em] text-feature-muted uppercase">
              {t('newLesson')}
            </span>
            <span className="truncate text-[15px] font-semibold">{candidate.title}</span>
            <span className="truncate text-sm text-feature-muted">
              {`${range(dates, candidate)} · ${candidate.teacherName}`}
            </span>
          </div>
        </Card>
      ) : null}
      <div className="flex items-center gap-3 text-xs font-semibold text-tint-warning-foreground">
        <span aria-hidden="true" className="h-px grow bg-border" />
        <TriangleAlertIcon aria-hidden="true" className="size-3.5" />
        {t('overlapsWith')}
        <span aria-hidden="true" className="h-px grow bg-border" />
      </div>
      <ul className="flex flex-col gap-3">
        {conflicts.map((conflict) => {
          const group = conflict.group !== null;
          const title = group ? conflict.group!.name : (conflict.student?.fullName ?? '');
          const students = conflict.students.map((student) => student.fullName).join(', ');
          const teacherDoubled = conflict.reason === 'TEACHER';
          const doubled = teacherDoubled
            ? t('teacherBoth', { name: conflict.teacher.name })
            : t('studentBoth', { name: students });
          return (
            <li
              key={`${conflict.lessonId}-${conflict.reason}`}
              className="flex flex-col gap-1 rounded-row bg-secondary pb-3"
            >
              <LessonItem
                compact
                date={tile(conflict.startsAtUtc)}
                title={title}
                meta={t('meta', {
                  time: range(dates, conflict),
                  kind: t(
                    group
                      ? 'kind.group'
                      : conflict.kind === 'MAKEUP'
                        ? 'kind.makeup'
                        : 'kind.individual',
                  ),
                  who: teacherDoubled || !students ? conflict.teacher.name : students,
                })}
              />
              <Badge variant="warning" className="mx-3">
                {teacherDoubled ? (
                  <GraduationCapIcon data-icon="inline-start" />
                ) : (
                  <UserRoundIcon data-icon="inline-start" />
                )}
                {doubled}
              </Badge>
            </li>
          );
        })}
      </ul>
    </AdaptiveDialog>
  );
}
