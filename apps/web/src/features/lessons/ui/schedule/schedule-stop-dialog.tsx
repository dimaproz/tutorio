'use client';

import { useState } from 'react';
import { CalendarCheckIcon, CirclePauseIcon, LockIcon, Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ScheduleChangeResult, ScheduleResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { DateField } from '@/components/shared/date-field';
import { ImpactList, type ImpactItem } from '@/components/shared/impact-list';
import { FieldFrame } from '@/components/shared/text-field';
import { dayStartIso, zonedDate } from '@/lib/datetime';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { useScheduleStopPreviewQuery, useStopScheduleMutation } from '../../api';
import { useFormDates, useSlotsLabel } from '../field-labels';
import { useErrorToast } from '../lesson-form-parts';
import { scheduleWho } from './schedule-change-dialog';
import { useScheduleDates } from './use-schedule-dates';

/**
 * «Зупинити розклад» (S05 board 03, state 05): from a date, the lessons it
 * removes, the ones moved by hand that stay (L-24), and that held and
 * cancelled lessons do not change (L-27); the stop itself is destructive.
 */
export function ScheduleStopDialog({
  open,
  onOpenChange,
  schedule,
  nowMs,
  onStopped,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: ScheduleResponse;
  nowMs?: number;
  onStopped?: (result: ScheduleChangeResult) => void;
}) {
  return open ? (
    <StopFlow
      schedule={schedule}
      nowMs={nowMs}
      onClose={() => onOpenChange(false)}
      onStopped={onStopped}
    />
  ) : null;
}

function StopFlow({
  schedule,
  nowMs,
  onClose,
  onStopped,
}: {
  schedule: ScheduleResponse;
  nowMs?: number;
  onClose: () => void;
  onStopped?: (result: ScheduleChangeResult) => void;
}) {
  const t = useTranslations('schedules.stop');
  const tPanel = useTranslations('lessons.panel');
  const tFields = useTranslations('lessons.fields');
  const formDates = useFormDates();
  const dates = useScheduleDates();
  const slots = useSlotsLabel();
  const showError = useErrorToast();
  const timeZone = useStudioTimeZone();
  const [from, setFrom] = useState(() => zonedDate(nowMs ?? Date.now(), timeZone));
  const dto = /^\d{4}-\d{2}-\d{2}$/.test(from) ? { from: dayStartIso(from, timeZone) } : null;
  const preview = useScheduleStopPreviewQuery(schedule.id, dto);
  const stop = useStopScheduleMutation();
  const data = preview.data;

  const items: ImpactItem[] = [];
  if (data) {
    const removals = data.removals.map((removal) => removal.startsAtUtc).sort();
    items.push({
      id: 'removed',
      icon: <Trash2Icon />,
      tone: 'danger',
      title: data.removed > 0 ? t('removed', { count: data.removed }) : t('removedNone'),
      text:
        removals.length > 1
          ? t('removedRange', { from: dates.day(removals[0]!), to: dates.day(removals.at(-1)!) })
          : removals[0]
            ? dates.day(removals[0])
            : undefined,
    });
    const moved = data.keptLessons.filter((kept) => kept.reason === 'MOVED');
    if (moved.length > 0) {
      items.push({
        id: 'moved',
        icon: <LockIcon />,
        tone: 'neutral',
        title: t('keptMoved', { count: moved.length }),
        text: moved.map((kept) => dates.dayTime(kept.startsAtUtc)).join(', '),
      });
    }
    items.push({ id: 'held', icon: <CalendarCheckIcon />, tone: 'neutral', title: t('heldStay') });
  }

  const confirm = async () => {
    if (!dto) return;
    try {
      const result = await stop.mutateAsync({ scheduleId: schedule.id, dto });
      toast.success(
        t('done', {
          name: scheduleWho(schedule),
          date: dates.dayMonth(result.summary.effectiveFrom),
          count: result.summary.removed,
        }),
      );
      onStopped?.(result);
      onClose();
    } catch (error) {
      showError(error);
    }
  };

  return (
    <AdaptiveDialog
      open
      onOpenChange={(next) => {
        if (!next && !stop.isPending) onClose();
      }}
      size="lg"
      sheetLayout="compact"
      closeLabel={tPanel('close')}
      icon={<CirclePauseIcon />}
      iconClassName="bg-tint-warning text-tint-warning-foreground"
      title={t('title')}
      description={[scheduleWho(schedule), slots(schedule.slots)].filter(Boolean).join(' · ')}
      secondary={
        <Button type="button" variant="outline" disabled={stop.isPending} onClick={onClose}>
          {t('cancel')}
        </Button>
      }
      primary={
        <Button
          type="button"
          variant="destructive"
          disabled={!data || stop.isPending}
          onClick={() => void confirm()}
        >
          {stop.isPending ? <Spinner data-icon="inline-start" /> : null}
          {t('confirm')}
        </Button>
      }
    >
      <FieldFrame label={t('from')} hint={t('fromHint')}>
        {(a11y) => (
          <DateField
            id={a11y.id}
            aria-describedby={a11y.describedBy}
            value={from}
            onValueChange={setFrom}
            formatValue={formDates.field}
            placeholder={tFields('pickDate')}
            locale={formDates.locale}
          />
        )}
      </FieldFrame>
      {items.length > 0 ? <ImpactList items={items} label={t('impactLabel')} /> : null}
    </AdaptiveDialog>
  );
}
