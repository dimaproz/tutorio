'use client';

import { useState } from 'react';
import {
  CalendarCheckIcon,
  CalendarPlusIcon,
  CircleSlashIcon,
  PackageIcon,
  PlayIcon,
  XIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { PauseResponse, ScheduleConflict } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { ImpactList, type ImpactItem } from '@/components/shared/impact-list';
import { Notice } from '@/components/shared/notice';
import { ConflictPairs, scheduleConflicts } from '@/features/lessons';
import { useEndPauseMutation, usePauseEndPreviewQuery } from '@/features/students/api';
import { lastPauseDay } from '@/features/students/model/pause';
import { useIsMobile } from '@/hooks/use-mobile';
import { useBillingErrorToast } from './dialog-parts';
import { usePauseLabels } from './pause-labels';
import { useLearningFormat } from './use-learning-format';

/**
 * Ends a pause now («Повернути з паузи зараз?», board 02, states 12–13) or
 * cancels one that has not begun («Скасувати паузу?», state 11), with what it
 * does: the lessons that come back, how the package extension changes, and —
 * when some returning lessons' time is taken since — the pairs and
 * «Повернути без них», which brings back only the free ones (L-103, L-110).
 */
export function PauseEndDialog({
  open,
  onOpenChange,
  pause,
  student,
  teacherName,
  directionNames,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pause: PauseResponse | null;
  student: { fullName: string };
  /** Who booked the overlapping lessons, for the explanation. */
  teacherName?: string;
  /** Each direction's name, so a returning lesson reads «Anna · English». */
  directionNames?: ReadonlyMap<string, string>;
}) {
  return open && pause ? (
    <PauseEnd
      pause={pause}
      student={student}
      teacherName={teacherName}
      directionNames={directionNames}
      onOpenChange={onOpenChange}
    />
  ) : null;
}

function PauseEnd({
  pause,
  student,
  teacherName,
  directionNames,
  onOpenChange,
}: {
  pause: PauseResponse;
  student: { fullName: string };
  teacherName?: string;
  directionNames?: ReadonlyMap<string, string>;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('students.pauseEnd');
  const format = useLearningFormat();
  const labels = usePauseLabels();
  const mobile = useIsMobile();
  const preview = usePauseEndPreviewQuery(pause.id);
  const end = useEndPauseMutation();
  const showError = useBillingErrorToast();
  const [lateConflicts, setLateConflicts] = useState<ScheduleConflict[] | null>(null);
  const cancel = pause.state === 'SCHEDULED';
  const firstName = student.fullName.split(/\s+/)[0] || student.fullName;
  const conflicts = lateConflicts ?? preview.data?.conflicts ?? [];
  const taken = new Set(conflicts.map((conflict) => conflict.candidateStartsAtUtc));
  const lessons = preview.data?.lessons ?? [];
  const returning = lessons.filter((lesson) => !taken.has(lesson.startsAtUtc));
  const skipped = lessons.length - returning.length;
  // The pairs name the student and, when every returning lesson is one
  // direction's, that direction too.
  const lessonDirections = new Set(lessons.map((lesson) => lesson.enrollmentId));
  const [onlyDirection] = lessonDirections;
  const directionName =
    lessonDirections.size === 1 && onlyDirection ? directionNames?.get(onlyDirection) : undefined;
  const pairTitle = directionName ? `${firstName} · ${directionName}` : firstName;

  const close = () => onOpenChange(false);
  const confirm = () =>
    end.mutate(
      { pauseId: pause.id, mode: conflicts.length > 0 ? 'skip' : 'check' },
      {
        onSuccess: () => {
          toast.success(cancel ? t('cancelled') : t('returned', { name: firstName }));
          close();
        },
        onError: (error) => {
          const overlaps = scheduleConflicts(error);
          if (overlaps && overlaps.length > 0) setLateConflicts(overlaps);
          else showError(error);
        },
      },
    );

  const items: ImpactItem[] = [];
  if (preview.data) {
    const first = returning[0];
    const last = returning.at(-1);
    items.push({
      id: 'lessons',
      icon: cancel ? <CalendarCheckIcon /> : <CalendarPlusIcon />,
      tone: 'indigo',
      title: cancel
        ? t('lessonsStay', { count: returning.length })
        : t('lessonsReturn', { count: returning.length }),
      text:
        first && last
          ? returning.length <= 2
            ? format.dateList(returning.map((lesson) => lesson.startsAtUtc))
            : t('lessonsRange', {
                from: format.weekdayDay(first.startsAtUtc),
                to: format.shortDay(last.startsAtUtc),
              })
          : undefined,
    });
    if (skipped > 0) {
      items.push({
        id: 'skipped',
        icon: <CircleSlashIcon />,
        tone: 'neutral',
        title: t('lessonsSkipped', { count: skipped }),
        text: t('lessonsSkippedText'),
      });
    }
    for (const extension of preview.data.extensions) {
      const name = extension.name ?? t('packageUnnamed');
      const next = format.dayMonth(new Date(Date.parse(extension.nextExpiresAt) - 1));
      items.push({
        id: `package-${extension.packageId}`,
        icon: <PackageIcon />,
        tone: 'neutral',
        title: cancel ? t('packageNotExtended') : t('packageShorter'),
        text: cancel
          ? t('packageUntil', { name, date: next })
          : t('packageInstead', {
              name,
              date: next,
              was: format.shortDay(new Date(Date.parse(extension.expiresAt) - 1)),
            }),
      });
    }
    if (!cancel) {
      items.push({
        id: 'past',
        icon: <CalendarCheckIcon />,
        tone: 'neutral',
        title: t('pastDaysStay'),
      });
    }
  }

  const window = pause.endsAt
    ? format.dayRange(pause.startsAt, lastPauseDay(pause.endsAt))
    : t('fromDate', { date: format.dayMonth(pause.startsAt) });
  const until = pause.endsAt
    ? t('until', { date: format.dayMonth(lastPauseDay(pause.endsAt)) })
    : t('open');
  const reason = labels.reason(pause.reason);

  return (
    <AdaptiveDialog
      open
      onOpenChange={(next) => (next ? undefined : close())}
      closeLabel={t('close')}
      size={conflicts.length > 0 ? 'lg' : 'md'}
      icon={cancel ? <XIcon /> : <PlayIcon />}
      iconClassName={
        cancel
          ? 'bg-tint-warning text-tint-warning-foreground'
          : 'bg-tint-success text-tint-success-foreground'
      }
      title={cancel ? t('cancelTitle') : t('returnTitle')}
      description={[cancel ? t('scheduled', { window }) : until, reason]
        .filter(Boolean)
        .join(' · ')}
      secondary={
        <Button type="button" variant="outline" onClick={close}>
          {cancel ? t('keep') : t('cancel')}
        </Button>
      }
      primary={
        <Button type="button" disabled={end.isPending || preview.isPending} onClick={confirm}>
          {end.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : cancel || conflicts.length > 0 ? null : (
            <PlayIcon data-icon="inline-start" />
          )}
          {conflicts.length > 0
            ? t('returnWithout')
            : cancel
              ? t('confirmCancel')
              : t('confirmReturn')}
        </Button>
      }
    >
      {conflicts.length > 0 ? (
        <ConflictPairs
          conflicts={conflicts}
          durationMin={lessons[0]?.durationMin ?? conflicts[0]?.durationMin ?? 60}
          title={pairTitle}
          newLabel={t('returns')}
          mobile={mobile}
          heading={t('conflictsTitle', { count: taken.size })}
          explanation={t('conflictsText', {
            name: firstName,
            teacher: teacherName ?? conflicts[0]?.teacher.name ?? '',
          })}
        />
      ) : null}
      {preview.isError ? (
        <Notice tone="danger" text={t('previewFailed')} />
      ) : preview.isPending ? (
        <Skeleton className="h-32 w-full rounded-tile" />
      ) : (
        <ImpactList items={items} label={t('impactLabel')} />
      )}
    </AdaptiveDialog>
  );
}
