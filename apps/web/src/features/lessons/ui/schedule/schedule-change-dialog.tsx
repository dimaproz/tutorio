'use client';

import { useState } from 'react';
import {
  ArrowRightIcon,
  CalendarClockIcon,
  CalendarPlusIcon,
  ChevronLeftIcon,
  FileIcon,
  InfoIcon,
  LockIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, FormProvider, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type {
  ScheduleChangeDto,
  ScheduleChangePreview,
  ScheduleChangeResult,
  ScheduleResponse,
} from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { DateField } from '@/components/shared/date-field';
import { DurationField } from '@/components/shared/duration-field';
import { ImpactList, type ImpactItem } from '@/components/shared/impact-list';
import { FieldFrame } from '@/components/shared/text-field';
import { useIsMobile } from '@/hooks/use-mobile';
import type { GatewayError } from '@/lib/auth/client';
import { useApplyScheduleChangeMutation, useScheduleChangePreviewQuery } from '../../api';
import { localDate } from '../../model/create';
import {
  movedSummary,
  removedSummary,
  scheduleChangeDefaults,
  scheduleChangeFormDto,
  scheduleChangeFormSchema,
  slotChanges,
  type ScheduleChangeFormValues,
} from '../../model/schedule';
import { WeeklyBlock } from '../create/create-when';
import { useDurationHint, useDurationLabels, useFormDates } from '../field-labels';
import { useErrorToast, useLessonForm } from '../lesson-form-parts';
import { ConflictPairs, CountTiles, CurrentRule, RuleChange } from './schedule-parts';
import { useScheduleDates } from './use-schedule-dates';

/** Who and the teacher, as every schedule dialog's subtitle says them. */
export function scheduleWho(schedule: Pick<ScheduleResponse, 'student' | 'group'>) {
  return schedule.student?.fullName ?? schedule.group?.name ?? '';
}

/**
 * «Змінити розклад» (S05 board 03, two steps): the rule in force, the days
 * each with a time, the length and «Зміни діють з»; then «Що зміниться»:
 * now against after, the four counts, the conflicts, and the lessons moved
 * (keeping topic and notes, L-26), removed, losing their topic and left
 * alone (L-27). With conflicts the save is «Зберегти попри накладку».
 */
export function ScheduleChangeDialog({
  open,
  onOpenChange,
  schedule,
  nowMs,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: ScheduleResponse;
  nowMs?: number;
  onChanged?: (result: ScheduleChangeResult) => void;
}) {
  return open ? (
    <ScheduleChangeFlow
      schedule={schedule}
      nowMs={nowMs}
      onClose={() => onOpenChange(false)}
      onChanged={onChanged}
    />
  ) : null;
}

function ScheduleChangeFlow({
  schedule,
  nowMs,
  onClose,
  onChanged,
}: {
  schedule: ScheduleResponse;
  nowMs?: number;
  onClose: () => void;
  onChanged?: (result: ScheduleChangeResult) => void;
}) {
  const t = useTranslations('schedules.change');
  const tPanel = useTranslations('lessons.panel');
  const mobile = useIsMobile();
  const showError = useErrorToast();
  const [today] = useState(() => localDate(nowMs ?? Date.now()));
  const form = useLessonForm<ScheduleChangeFormValues>(
    scheduleChangeFormSchema,
    scheduleChangeDefaults(schedule, today),
  );
  const [dto, setDto] = useState<ScheduleChangeDto | null>(null);
  const [step, setStep] = useState<'form' | 'result'>('form');
  const preview = useScheduleChangePreviewQuery(schedule.id, dto);
  const apply = useApplyScheduleChangeMutation();
  const dates = useScheduleDates();
  const subtitle = `${scheduleWho(schedule)} · ${schedule.teacher.name}`;

  const next = form.handleSubmit((values) => {
    setDto(scheduleChangeFormDto(values));
    setStep('result');
  });

  const save = async (force: boolean) => {
    if (!dto) return;
    try {
      const result = await apply.mutateAsync({ scheduleId: schedule.id, dto, force });
      const { summary } = result;
      toast.success(
        t('done', {
          name: scheduleWho(schedule),
          date: dates.dayMonth(summary.effectiveFrom),
          moved: summary.moved,
          removed: summary.removed,
          created: summary.created,
        }),
      );
      onChanged?.(result);
      onClose();
    } catch (error) {
      if ((error as GatewayError).code === 'SCHEDULE_CONFLICT') await preview.refetch();
      else showError(error);
    }
  };

  const result = step === 'result' ? preview.data : undefined;

  return (
    <FormProvider {...form}>
      <AdaptiveDialog
        open={!result}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        size="lg"
        sheetLayout="compact"
        closeLabel={tPanel('close')}
        icon={<PencilIcon />}
        iconClassName="bg-tile-indigo text-tile-indigo-foreground"
        title={t('title')}
        description={subtitle}
        tertiary={
          mobile ? undefined : (
            <span className="flex items-center gap-2 text-sm text-muted-foreground [&_svg]:size-4">
              <InfoIcon aria-hidden="true" />
              {t('nextNote')}
            </span>
          )
        }
        secondary={
          <Button type="button" variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
        }
        primary={
          <Button
            type="button"
            disabled={step === 'result' && preview.isFetching}
            onClick={() => void next()}
          >
            {step === 'result' && preview.isFetching ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <ArrowRightIcon data-icon="inline-start" />
            )}
            {t('next')}
          </Button>
        }
      >
        <CurrentRule slots={schedule.slots} durationMin={schedule.durationMin} />
        <WeeklyBlock dates={false} between={<LengthAndStart today={today} />} />
      </AdaptiveDialog>
      {result && dto ? (
        <ChangeResult
          schedule={schedule}
          dto={dto}
          preview={result}
          subtitle={subtitle}
          busy={apply.isPending}
          onBack={() => setStep('form')}
          onClose={onClose}
          onSave={(force) => void save(force)}
        />
      ) : null}
    </FormProvider>
  );
}

/** «Тривалість» and «Зміни діють з». */
function LengthAndStart({ today }: { today: string }) {
  const t = useTranslations('schedules.change');
  const tFields = useTranslations('lessons.fields');
  const durationLabels = useDurationLabels();
  const durationHint = useDurationHint();
  const formDates = useFormDates();
  const [from] = useWatch<ScheduleChangeFormValues, ['from']>({ name: ['from'] });
  return (
    <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
      <Controller<ScheduleChangeFormValues, 'durationMin'>
        name="durationMin"
        render={({ field, fieldState }) => (
          <FieldFrame
            label={tFields('duration')}
            hint={durationHint(Number(field.value), null)}
            error={fieldState.error?.message}
          >
            {(a11y) => (
              <DurationField
                id={a11y.id}
                aria-describedby={a11y.describedBy}
                invalid={Boolean(a11y.invalid)}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                labels={durationLabels}
              />
            )}
          </FieldFrame>
        )}
      />
      <Controller<ScheduleChangeFormValues, 'from'>
        name="from"
        render={({ field, fieldState }) => (
          <FieldFrame
            label={t('effectiveFrom')}
            hint={
              /^\d{4}-\d{2}-\d{2}$/.test(from) && from > today
                ? t('untouchedBefore', { date: formDates.dayMonth(from) })
                : t('fromToday')
            }
            error={fieldState.error?.message}
          >
            {(a11y) => (
              <DateField
                id={a11y.id}
                aria-describedby={a11y.describedBy}
                invalid={Boolean(a11y.invalid)}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                formatValue={formDates.field}
                placeholder={tFields('pickDate')}
                locale={formDates.locale}
              />
            )}
          </FieldFrame>
        )}
      />
    </div>
  );
}

const KEPT_KEY = {
  HELD: 'held',
  CANCELLED: 'cancelled',
  NO_SHOW: 'noShow',
  MOVED: 'moved',
  MARKED: 'marked',
} as const;

/** «Що зміниться з …»: the consequences of a change, as the apply will do it. */
function ChangeResult({
  schedule,
  dto,
  preview,
  subtitle,
  busy,
  onBack,
  onClose,
  onSave,
}: {
  schedule: ScheduleResponse;
  dto: ScheduleChangeDto;
  preview: ScheduleChangePreview;
  subtitle: string;
  busy: boolean;
  onBack: () => void;
  onClose: () => void;
  onSave: (force: boolean) => void;
}) {
  const t = useTranslations('schedules.change');
  const tKept = useTranslations('schedules.kept');
  const tSchedules = useTranslations('schedules');
  const days = (weekday: number, count: number) =>
    tSchedules('weekdayCount', { weekday: String(weekday), count });
  const tPanel = useTranslations('lessons.panel');
  const mobile = useIsMobile();
  const dates = useScheduleDates();
  const date = dates.dayMonth(preview.effectiveFrom);
  const moved = movedSummary(preview.moves);
  const removed = removedSummary(preview.removals);
  const conflicts = preview.conflicts;

  const items: ImpactItem[] = [];
  if (moved) {
    items.push({
      id: 'moved',
      icon: <CalendarClockIcon />,
      tone: 'info',
      title:
        moved.weekday !== null
          ? t('movedDay', { days: days(moved.weekday, moved.count), time: moved.time! })
          : t('moved', { count: moved.count }),
      text: t('movedText'),
    });
  }
  if (preview.created > 0) {
    items.push({
      id: 'created',
      icon: <CalendarPlusIcon />,
      tone: 'success',
      title: t('created', { count: preview.created }),
      text: dates.list(preview.creates),
    });
  }
  if (removed) {
    items.push({
      id: 'removed',
      icon: <Trash2Icon />,
      tone: 'danger',
      title:
        removed.weekday !== null
          ? t('removedDay', { days: days(removed.weekday, removed.count), count: removed.count })
          : t('removed', { count: removed.count }),
      text: dates.list(removed.dates),
    });
  }
  if (preview.notesLost.length > 0) {
    items.push({
      id: 'notes',
      icon: <FileIcon />,
      tone: 'warning',
      title: t('notesLost', { count: preview.notesLost.length }),
      text: preview.notesLost
        .map((lost) =>
          lost.topic
            ? `${dates.day(lost.startsAtUtc)} · «${lost.topic}»`
            : dates.day(lost.startsAtUtc),
        )
        .join(', '),
    });
  }
  if (preview.keptLessons.length > 0) {
    items.push({
      id: 'kept',
      icon: <LockIcon />,
      tone: 'neutral',
      title: t('kept', { count: preview.keptLessons.length }),
      text: preview.keptLessons
        .slice(0, 4)
        .map((kept) => `${dates.dayShort(kept.startsAtUtc)} — ${tKept(KEPT_KEY[kept.reason])}`)
        .join(' · '),
    });
  }

  const back = (
    <Button type="button" variant={mobile ? 'outline' : 'ghost'} disabled={busy} onClick={onBack}>
      {mobile ? null : <ChevronLeftIcon data-icon="inline-start" />}
      {t('back')}
    </Button>
  );

  return (
    <AdaptiveDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      size="lg"
      sheetLayout="compact"
      closeLabel={tPanel('close')}
      icon={<PencilIcon />}
      iconClassName="bg-tile-indigo text-tile-indigo-foreground"
      title={t('resultTitle', { date })}
      description={mobile ? undefined : subtitle}
      tertiary={mobile ? undefined : back}
      secondary={
        mobile ? (
          back
        ) : (
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {t('cancel')}
          </Button>
        )
      }
      primary={
        <Button type="button" disabled={busy} onClick={() => onSave(conflicts.length > 0)}>
          {busy ? <Spinner data-icon="inline-start" /> : null}
          {mobile ? t('saveShort') : conflicts.length > 0 ? t('saveAnyway') : t('save')}
        </Button>
      }
    >
      <RuleChange
        changes={slotChanges(schedule.slots, dto.slots)}
        durationBefore={schedule.durationMin}
        durationAfter={dto.durationMin}
        afterLabel={t('from', { date })}
        stacked={mobile}
      />
      <CountTiles
        items={[
          { id: 'moved', value: preview.moved, label: t('countMoved'), tone: 'info' },
          { id: 'removed', value: preview.removed, label: t('countRemoved'), tone: 'danger' },
          { id: 'created', value: preview.created, label: t('countCreated'), tone: 'neutral' },
          { id: 'kept', value: preview.kept, label: t('countKept'), tone: 'neutral' },
        ]}
      />
      {conflicts.length > 0 ? (
        <ConflictPairs
          conflicts={conflicts}
          durationMin={dto.durationMin}
          title={scheduleWho(schedule)}
          newLabel={t('afterChange')}
          mobile={mobile}
        />
      ) : null}
      {items.length > 0 ? <ImpactList items={items} label={t('impactLabel')} /> : null}
    </AdaptiveDialog>
  );
}
