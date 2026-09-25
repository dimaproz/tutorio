'use client';

import { useState } from 'react';
import { Building2Icon, CalendarPlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ScheduleResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { ImpactList, type ImpactItem } from '@/components/shared/impact-list';
import { Segmented } from '@/components/shared/segmented';
import { useSession } from '@/components/app/session-provider';
import { useScheduleHorizonPreviewQuery, useUpdateScheduleHorizonMutation } from '../../api';
import { HORIZON_CHOICES } from '../../model/schedule';
import { useSlotsLabel } from '../field-labels';
import { useErrorToast } from '../lesson-form-parts';
import { scheduleWho } from './schedule-change-dialog';
import { useScheduleDates } from './use-schedule-dates';

/**
 * «Заняття наперед» (S05 board 03, state 06): how many weeks ahead the
 * schedule keeps its lessons (L-22), what a longer horizon adds now and how
 * far it books, and the studio's own setting (L-120).
 */
export function ScheduleHorizonDialog({
  open,
  onOpenChange,
  schedule,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: ScheduleResponse;
}) {
  return open ? <HorizonFlow schedule={schedule} onClose={() => onOpenChange(false)} /> : null;
}

function HorizonFlow({ schedule, onClose }: { schedule: ScheduleResponse; onClose: () => void }) {
  const t = useTranslations('schedules.horizon');
  const tForm = useTranslations('schedules.form');
  const tPanel = useTranslations('lessons.panel');
  const studio = useSession().workspace.scheduleHorizonWeeks;
  const slots = useSlotsLabel();
  const dates = useScheduleDates();
  const showError = useErrorToast();
  const [weeks, setWeeks] = useState(schedule.horizonWeeks);
  const changed = weeks !== schedule.horizonWeeks;
  const preview = useScheduleHorizonPreviewQuery(schedule.id, changed ? weeks : null);
  const update = useUpdateScheduleHorizonMutation();
  const choices = [...new Set([...HORIZON_CHOICES, schedule.horizonWeeks, studio])].sort(
    (a, b) => a - b,
  );

  const booked = changed ? preview.data?.lastLessonAt : schedule.lastLessonAt;
  const items: ImpactItem[] = [
    {
      id: 'added',
      icon: <CalendarPlusIcon />,
      tone: 'indigo',
      title:
        changed && preview.data && preview.data.added > 0
          ? t('added', { count: preview.data.added })
          : t('addedNone'),
      text: booked ? t('bookedUntil', { date: dates.dayMonth(booked) }) : undefined,
    },
    {
      id: 'studio',
      icon: <Building2Icon />,
      tone: 'neutral',
      title: t('studio', { count: studio }),
      text: weeks === studio ? t('studioSame') : t('studioOwn'),
    },
  ];

  const save = async () => {
    try {
      await update.mutateAsync({ scheduleId: schedule.id, horizonWeeks: weeks });
      toast.success(t('done', { name: scheduleWho(schedule), count: weeks }));
      onClose();
    } catch (error) {
      showError(error);
    }
  };

  return (
    <AdaptiveDialog
      open
      onOpenChange={(next) => {
        if (!next && !update.isPending) onClose();
      }}
      size="lg"
      sheetLayout="compact"
      closeLabel={tPanel('close')}
      icon={<CalendarPlusIcon />}
      iconClassName="bg-tile-indigo text-tile-indigo-foreground"
      title={t('title')}
      description={[scheduleWho(schedule), slots(schedule.slots)].filter(Boolean).join(' · ')}
      secondary={
        <Button type="button" variant="outline" disabled={update.isPending} onClick={onClose}>
          {t('cancel')}
        </Button>
      }
      primary={
        <Button
          type="button"
          disabled={!changed || update.isPending || preview.isFetching}
          onClick={() => void save()}
        >
          {update.isPending ? <Spinner data-icon="inline-start" /> : null}
          {t('save')}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <span id="horizon-label" className="text-[15px] leading-5 font-medium">
          {t('label')}
        </span>
        <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
          <Segmented
            label={t('label')}
            variant="paper"
            value={String(weeks)}
            onValueChange={(next) => setWeeks(Number(next))}
            items={choices.map((count) => ({
              value: String(count),
              label: tForm('weeks', { count }),
            }))}
          />
        </div>
      </div>
      <ImpactList items={items} label={t('impactLabel')} />
    </AdaptiveDialog>
  );
}
