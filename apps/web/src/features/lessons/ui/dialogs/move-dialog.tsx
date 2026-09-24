'use client';

import { useMemo, useState } from 'react';
import {
  CalendarClockIcon,
  CircleCheckIcon,
  NotebookPenIcon,
  RepeatIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type {
  LessonDetailResponse,
  RescheduleScopeDto,
  ScheduleResponse,
} from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { ChoiceCardGroup } from '@/components/shared/choice-card';
import { ImpactList, type ImpactItem } from '@/components/shared/impact-list';
import { MoveChange } from '@/components/shared/move-change';
import { Notice } from '@/components/shared/notice';
import { useIsMobile } from '@/hooks/use-mobile';
import { useScheduleChangePreviewQuery } from '../../api';
import { localSlotOf, moveChange } from '../../model/move';
import { useLessonDates } from '../lesson-format';

/**
 * Moving a lesson of a schedule asks what to move (L-41): this lesson only,
 * or this and the following — which changes that weekday's time in the
 * schedule from here on, previewed with its numbers before it applies (L-25).
 */
export function MoveDialog({
  lesson,
  schedule,
  target,
  open,
  onOpenChange,
  busy,
  onConfirm,
}: {
  lesson: LessonDetailResponse;
  schedule: ScheduleResponse;
  target: { startsAtUtc: string; durationMin?: number } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onConfirm: (scope: RescheduleScopeDto) => void;
}) {
  const t = useTranslations('lessons.move');
  const tPanel = useTranslations('lessons.panel');
  const format = useFormatter();
  const dates = useLessonDates();
  const mobile = useIsMobile();
  const [scope, setScope] = useState<RescheduleScopeDto>('this_and_following');

  const change = useMemo(
    () =>
      target && scope === 'this_and_following'
        ? moveChange(schedule, lesson.startsAtUtc, target.startsAtUtc, target.durationMin)
        : null,
    [lesson.startsAtUtc, schedule, scope, target],
  );
  const preview = useScheduleChangePreviewQuery(open ? schedule.id : null, change);

  if (!target) return null;
  const from = localSlotOf(lesson.startsAtUtc, schedule.timezone);
  const to = localSlotOf(target.startsAtUtc, schedule.timezone);
  const tile = (iso: string) => ({
    top: format.dateTime(new Date(iso), { weekday: 'short' }),
    day: format.dateTime(new Date(iso), { day: 'numeric' }),
  });
  const weekdays = format.list(
    schedule.slots.map((slot) =>
      format.dateTime(new Date(Date.UTC(2024, 0, 7 + slot.weekday, 12)), { weekday: 'short' }),
    ),
    { type: 'conjunction' },
  );

  const impact: ImpactItem[] | null =
    scope === 'this'
      ? [
          {
            id: 'one',
            icon: <CalendarClockIcon />,
            tone: 'indigo',
            title: t('moveOne'),
            text: t('moveOneText', {
              date: dates.longDay(target.startsAtUtc),
              time: dates.time(target.startsAtUtc),
            }),
          },
        ]
      : preview.data
        ? [
            {
              id: 'rebuilt',
              icon: <RepeatIcon />,
              tone: 'indigo',
              title: t('rebuilt', { count: preview.data.moved + preview.data.created }),
              text: t('rebuiltText', { date: dates.dayMonth(preview.data.effectiveFrom) }),
            },
            ...(preview.data.notesLost.length > 0
              ? [
                  {
                    id: 'lost',
                    icon: <NotebookPenIcon />,
                    tone: 'warning' as const,
                    title: t('notesLost', { count: preview.data.notesLost.length }),
                    text: preview.data.notesLost
                      .map((lost) => dates.weekdayShort(lost.startsAtUtc))
                      .join(' · '),
                  },
                ]
              : []),
            preview.data.conflicts.length > 0
              ? {
                  id: 'conflicts',
                  icon: <TriangleAlertIcon />,
                  tone: 'danger' as const,
                  title: t('conflicts', { count: preview.data.conflicts.length }),
                  text: [...new Set(preview.data.conflicts.map((c) => c.candidateStartsAtUtc))]
                    .map((iso) => dates.weekdayShort(iso))
                    .join(' · '),
                }
              : {
                  id: 'noConflicts',
                  icon: <CircleCheckIcon />,
                  tone: 'success' as const,
                  title: t('noConflicts'),
                },
          ]
        : null;

  const count = preview.data ? preview.data.moved + preview.data.created : 0;
  const ready = scope === 'this' || Boolean(preview.data);

  return (
    <AdaptiveDialog
      open={open}
      onOpenChange={onOpenChange}
      closeLabel={tPanel('close')}
      icon={<CalendarClockIcon />}
      iconClassName="bg-tile-indigo text-tile-indigo-foreground"
      title={t('title')}
      description={t('subtitle', {
        name: lesson.student?.fullName ?? lesson.group?.name ?? '',
        days: weekdays,
      })}
      secondary={
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          {t('cancel')}
        </Button>
      }
      primary={
        <Button type="button" disabled={busy || !ready} onClick={() => onConfirm(scope)}>
          {busy ? <Spinner data-icon="inline-start" /> : null}
          {scope === 'this' || count === 0 ? t('confirmOne') : t('confirmMany', { count })}
        </Button>
      }
    >
      <MoveChange
        stacked={mobile}
        from={{
          date: tile(lesson.startsAtUtc),
          label: t('before'),
          time: from.localTime,
          hint: t('every', { weekday: String(from.weekday) }),
        }}
        to={{
          date: tile(target.startsAtUtc),
          label: t('after'),
          time: to.localTime,
          hint: t('fromDate', { date: dates.dayMonth(target.startsAtUtc) }),
        }}
      />
      <ChoiceCardGroup
        label={t('scopeLabel')}
        value={scope}
        onValueChange={setScope}
        options={[
          {
            value: 'this',
            title: t('thisTitle'),
            hint: t('thisHint', { time: from.localTime }),
            icon: <CalendarClockIcon />,
          },
          {
            value: 'this_and_following',
            title: t('followingTitle'),
            hint: t('followingHint', {
              weekday: String(from.weekday),
              date: dates.dayMonth(lesson.startsAtUtc),
              time: to.localTime,
            }),
            icon: <RepeatIcon />,
          },
        ]}
      />
      <div className="flex flex-col gap-2.5">
        <span className="text-sm leading-5 font-medium">{t('whatChanges')}</span>
        {impact ? (
          <ImpactList items={impact} />
        ) : preview.isError ? (
          <Notice tone="danger" text={t('previewError')} />
        ) : (
          <Skeleton
            role="status"
            aria-label={t('previewLoading')}
            className="h-36 w-full rounded-tile"
          />
        )}
      </div>
    </AdaptiveDialog>
  );
}
