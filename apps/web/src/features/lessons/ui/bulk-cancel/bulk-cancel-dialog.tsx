'use client';

import { useState } from 'react';
import {
  ArrowRightIcon,
  Building2Icon,
  CalendarCheckIcon,
  ChevronLeftIcon,
  CircleSlashIcon,
  GiftIcon,
  GraduationCapIcon,
  InfoIcon,
  RepeatIcon,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Controller, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type { BulkCancelPreview } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { ChoiceCardGroup } from '@/components/shared/choice-card';
import { DateField } from '@/components/shared/date-field';
import { EmptyState } from '@/components/shared/empty-state';
import { EntityPicker } from '@/components/shared/entity-picker';
import { ImpactList } from '@/components/shared/impact-list';
import { FieldFrame, TextField } from '@/components/shared/text-field';
import { useIsMobile } from '@/hooks/use-mobile';
import { isCalendarDate, zonedDate, zonedDayStart } from '@/lib/datetime';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { capitalizeFirst } from '@/lib/utils';
import { useBulkCancelMutation, useBulkCancelPreviewMutation } from '../../api';
import {
  BULK_CANCEL_REASONS,
  bulkCancelDefaults,
  bulkCancelDto,
  bulkCancelFormSchema,
  bulkCancelSplit,
  type BulkCancelFormValues,
} from '../../model/bulk-cancel';
import { useFormDates } from '../field-labels';
import { useErrorToast, useLessonForm, useTeacherOptions } from '../lesson-form-parts';
import { BulkCancelDays } from './bulk-cancel-days';

/** The days a done bulk cancel covered, for «Показати» («yyyy-MM-dd», both included). */
export type BulkCancelRange = { from: string; to: string };

type Step = { kind: 'form' } | { kind: 'check'; preview: BulkCancelPreview };

/**
 * «Скасування занять» (S04, L-54): the period, the whole studio or one
 * teacher and a reason, then the check — how many lessons, what it means and
 * every lesson by day — and the free cancellation by the teacher. The done
 * toast offers «Показати», which the caller turns into the list of them.
 */
export function BulkCancelDialog({
  open,
  onOpenChange,
  onShow,
  nowMs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shows the cancelled lessons (the Lessons page with their period). */
  onShow?: (range: BulkCancelRange) => void;
  /** Pins the clock (stories); the live clock otherwise. */
  nowMs?: number;
}) {
  // Mounted while open, so every opening starts from a fresh form.
  return open ? <BulkCancelFlow onOpenChange={onOpenChange} onShow={onShow} nowMs={nowMs} /> : null;
}

function BulkCancelFlow({
  onOpenChange,
  onShow,
  nowMs,
}: {
  onOpenChange: (open: boolean) => void;
  onShow?: (range: BulkCancelRange) => void;
  nowMs?: number;
}) {
  const t = useTranslations('lessons.bulkCancel');
  const tPanel = useTranslations('lessons.panel');
  const tFields = useTranslations('lessons.fields');
  const mobile = useIsMobile();
  const format = useFormatter();
  const formDates = useFormDates();
  const teachers = useTeacherOptions();
  const showError = useErrorToast();
  const timeZone = useStudioTimeZone();
  const [today] = useState(() => zonedDate(nowMs ?? Date.now(), timeZone));
  const parseDay = (value: string) =>
    isCalendarDate(value) ? zonedDayStart(value, timeZone) : null;
  const form = useLessonForm<BulkCancelFormValues>(bulkCancelFormSchema, bulkCancelDefaults(today));
  const values = useWatch({ control: form.control }) as BulkCancelFormValues;
  const [step, setStep] = useState<Step>({ kind: 'form' });
  const preview = useBulkCancelPreviewMutation();
  const apply = useBulkCancelMutation();
  const reasonLabel = (reason: (typeof BULK_CANCEL_REASONS)[number]) => t(`reasons.${reason}`);
  const close = () => onOpenChange(false);
  const busy = apply.isPending;

  const period = periodLabel(values.from, values.to);
  const who =
    values.scope === 'teacher' ? (teachers.names.get(values.teacherId) ?? '') : t('wholeStudio');

  function periodLabel(from: string, to: string) {
    const start = parseDay(from);
    const end = parseDay(to);
    if (!start || !end) return '';
    if (from === to) {
      return capitalizeFirst(
        format.dateTime(start, { weekday: 'short', day: 'numeric', month: 'long' }),
      );
    }
    return format.dateTimeRange(start, end, { day: 'numeric', month: 'long' });
  }

  const next = form.handleSubmit(async (submitted) => {
    try {
      const result = await preview.mutateAsync(bulkCancelDto(submitted, reasonLabel, timeZone));
      setStep({ kind: 'check', preview: result });
    } catch (error) {
      showError(error);
    }
  });

  const confirm = async () => {
    try {
      const result = await apply.mutateAsync(bulkCancelDto(values, reasonLabel, timeZone));
      const range = { from: values.from, to: values.to };
      toast.success(t('done', { count: result.cancelled, period: dayMonthRange(range) }), {
        action: onShow ? { label: t('show'), onClick: () => onShow(range) } : undefined,
      });
      close();
    } catch (error) {
      showError(error);
    }
  };

  function dayMonthRange({ from, to }: BulkCancelRange) {
    const start = parseDay(from);
    const end = parseDay(to);
    if (!start || !end) return '';
    return from === to
      ? format.dateTime(start, { day: 'numeric', month: 'long' })
      : format.dateTimeRange(start, end, { day: 'numeric', month: 'long' });
  }

  const back = (
    <Button
      type="button"
      variant={mobile ? 'outline' : 'ghost'}
      disabled={busy}
      onClick={() => setStep({ kind: 'form' })}
    >
      {mobile ? null : <ChevronLeftIcon data-icon="inline-start" />}
      {t('back')}
    </Button>
  );
  const closeButton = (
    <Button type="button" variant="outline" disabled={busy} onClick={close}>
      {t('close')}
    </Button>
  );

  if (step.kind === 'check' && step.preview.count === 0) {
    return (
      <AdaptiveDialog
        open
        onOpenChange={onOpenChange}
        closeLabel={tPanel('close')}
        sheetLayout="compact"
        icon={<CalendarCheckIcon />}
        iconClassName="bg-tile-indigo text-tile-indigo-foreground"
        title={t('nothingTitle')}
        description={t('nothingDescription')}
        tertiary={mobile ? undefined : back}
        secondary={mobile ? back : undefined}
        primary={
          <Button type="button" onClick={close}>
            {t('close')}
          </Button>
        }
      >
        <div className="rounded-card bg-secondary">
          <EmptyState
            framed={false}
            minHeight={0}
            icon={<CalendarCheckIcon />}
            title={t('nothingEmptyTitle')}
            text={t('nothingEmptyText', { who, period: dayMonthRange(values) })}
            className="py-7"
          />
        </div>
      </AdaptiveDialog>
    );
  }

  if (step.kind === 'check') {
    const { count, lessons, truncated } = step.preview;
    const split = bulkCancelSplit(step.preview);
    const reason = [
      values.reason ? reasonLabel(values.reason) : null,
      values.ownReason?.trim() || null,
    ]
      .filter(Boolean)
      .join(' · ');
    const individual = split?.individual ?? null;
    return (
      <AdaptiveDialog
        open
        onOpenChange={(next) => {
          if (!busy) onOpenChange(next);
        }}
        size="lg"
        closeLabel={tPanel('close')}
        sheetLayout="compact"
        icon={<CircleSlashIcon />}
        iconClassName="bg-tint-warning text-tint-warning-foreground"
        title={t('checkTitle', { count })}
        description={mobile ? undefined : t('checkDescription')}
        tertiary={mobile ? undefined : back}
        secondary={mobile ? back : closeButton}
        primary={
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={() => void confirm()}
          >
            {busy ? <Spinner data-icon="inline-start" /> : null}
            {busy ? t('applying') : mobile ? t('confirmShort', { count }) : t('confirm', { count })}
          </Button>
        }
      >
        <Card tone="warning" className="flex-row items-center gap-5 rounded-card px-6 py-5">
          <span className="text-[56px] leading-none font-semibold tracking-[-0.04em] tabular-nums text-tint-warning-foreground">
            {count}
          </span>
          <div className="flex min-w-0 flex-col gap-1 text-tint-warning-foreground">
            <span className="text-lg leading-6 font-semibold">{t('willCancel', { count })}</span>
            {split ? (
              <span className="text-sm leading-5">
                {t('split', { individual: split.individual, group: split.group })}
              </span>
            ) : null}
            <span className="text-sm leading-5">
              {[period, values.scope === 'teacher' ? who : t('wholeStudioLower'), reason]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
        </Card>
        <ImpactList
          label={t('impactLabel')}
          items={[
            {
              id: 'free',
              icon: <GiftIcon />,
              tone: 'success',
              title: t('impactFree'),
              text: t('impactFreeText'),
            },
            ...(individual === null || individual > 0
              ? [
                  {
                    id: 'makeups',
                    icon: <RepeatIcon />,
                    tone: 'indigo' as const,
                    title: t('impactMakeups'),
                    text:
                      individual === null
                        ? t('impactMakeupsTextAll')
                        : t('impactMakeupsText', { count: individual }),
                  },
                ]
              : []),
            {
              id: 'held',
              icon: <CalendarCheckIcon />,
              tone: 'neutral',
              title: t('impactHeld'),
              text: t('impactHeldText'),
            },
          ]}
        />
        <BulkCancelDays lessons={lessons} more={truncated ? count - lessons.length : 0} />
      </AdaptiveDialog>
    );
  }

  return (
    <AdaptiveDialog
      open
      onOpenChange={onOpenChange}
      size="lg"
      closeLabel={tPanel('close')}
      sheetLayout="compact"
      icon={<CircleSlashIcon />}
      iconClassName="bg-tint-warning text-tint-warning-foreground"
      title={t('title')}
      description={t('description')}
      tertiary={
        mobile ? undefined : (
          <span className="flex items-center gap-2 text-sm text-muted-foreground [&_svg]:size-4">
            <InfoIcon aria-hidden="true" />
            {t('freeNote')}
          </span>
        )
      }
      secondary={closeButton}
      primary={
        <Button type="button" disabled={preview.isPending} onClick={() => void next()}>
          {preview.isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <ArrowRightIcon data-icon="inline-start" />
          )}
          {t('next')}
        </Button>
      }
    >
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
        {(['from', 'to'] as const).map((name) => (
          <Controller
            key={name}
            control={form.control}
            name={name}
            render={({ field, fieldState }) => (
              <FieldFrame label={t(name)} error={fieldState.error?.message}>
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
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm leading-5 font-medium">{t('whose')}</span>
        <Controller
          control={form.control}
          name="scope"
          render={({ field }) => (
            <ChoiceCardGroup
              label={t('whose')}
              value={field.value}
              onValueChange={field.onChange}
              options={[
                {
                  value: 'studio',
                  title: t('studio'),
                  hint: t('studioHint'),
                  icon: <Building2Icon />,
                },
                {
                  value: 'teacher',
                  title: t('oneTeacher'),
                  hint: t('oneTeacherHint'),
                  icon: <GraduationCapIcon />,
                },
              ]}
            />
          )}
        />
      </div>
      {values.scope === 'teacher' ? (
        <Controller
          control={form.control}
          name="teacherId"
          render={({ field, fieldState }) => (
            <FieldFrame label={t('teacher')} error={fieldState.error?.message}>
              {(a11y) => (
                <EntityPicker
                  id={a11y.id}
                  appearance="field"
                  value={field.value || undefined}
                  options={teachers.options}
                  onChange={(next) => field.onChange(next ?? '')}
                  placeholder={t('teacherPlaceholder')}
                  searchPlaceholder={t('teacherSearch')}
                  emptyLabel={t('teacherEmpty')}
                  invalid={Boolean(a11y.invalid)}
                  isLoading={teachers.loading}
                />
              )}
            </FieldFrame>
          )}
        />
      ) : null}
      <div className="flex flex-col gap-2.5">
        <span className="text-sm leading-5 font-medium">{t('reason')}</span>
        <Controller
          control={form.control}
          name="reason"
          render={({ field }) => (
            <ToggleGroup
              type="single"
              aria-label={t('reason')}
              value={field.value ?? ''}
              onValueChange={(next) => field.onChange(next || null)}
              className="flex-wrap gap-2"
            >
              {BULK_CANCEL_REASONS.map((reason) => (
                <ToggleGroupItem
                  key={reason}
                  value={reason}
                  className="h-10 rounded-pill bg-secondary px-4 text-[15px] data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {reasonLabel(reason)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        />
      </div>
      <Controller
        control={form.control}
        name="ownReason"
        render={({ field, fieldState }) => (
          <TextField
            label={t('ownReason')}
            placeholder={t('ownReasonPlaceholder')}
            error={fieldState.error?.message}
            {...field}
          />
        )}
      />
    </AdaptiveDialog>
  );
}
