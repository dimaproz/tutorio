'use client';

import {
  BanknoteIcon,
  CalendarCheckIcon,
  CircleSlashIcon,
  CircleXIcon,
  GraduationCapIcon,
  HourglassIcon,
  UsersIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type { LessonDetailResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { ChoiceCardGroup } from '@/components/shared/choice-card';
import { Notice } from '@/components/shared/notice';
import { Segmented } from '@/components/shared/segmented';
import { TextField } from '@/components/shared/text-field';
import { useTransitionLessonMutation } from '../../api';
import {
  cancelAdvice,
  cancelDto,
  cancelFormDefaults,
  cancelFormSchema,
  type CancelAuthor,
  type CancelFormValues,
} from '../../model/cancel';
import { useDurationLabel } from '../lesson-format';
import { useErrorToast, useLessonForm } from '../lesson-form-parts';
import type { ChargeContext } from './charge-context';

/**
 * Cancel a lesson (L-51): who cancels, the deadline suggestion (charge or
 * not, preselected and switchable), and an optional reason.
 */
export function CancelDialog({
  lesson,
  open,
  onOpenChange,
  subtitle,
  charge,
  now,
}: {
  lesson: LessonDetailResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subtitle: string;
  charge: ChargeContext;
  now: number;
}) {
  const t = useTranslations('lessons.cancelDialog');
  const tPanel = useTranslations('lessons.panel');
  const showError = useErrorToast();
  const duration = useDurationLabel();
  const form = useLessonForm<CancelFormValues>(cancelFormSchema, cancelFormDefaults(lesson, now));
  const by = useWatch({ control: form.control, name: 'cancelledBy' });
  const transition = useTransitionLessonMutation(lesson.id);
  const { advice } = cancelAdvice(lesson, by, now);

  const authors: CancelAuthor[] = lesson.groupId ? ['GROUP', 'TEACHER'] : ['STUDENT', 'TEACHER'];

  const notice = (() => {
    switch (advice.kind) {
      case 'late':
        return {
          tone: 'warning' as const,
          icon: <HourglassIcon />,
          title: t('lateTitle'),
          text: t('lateText', {
            left: duration(advice.hoursLeft * 3_600_000),
            deadline: advice.deadlineHours,
          }),
        };
      case 'onTime':
        return {
          tone: 'success' as const,
          icon: <CalendarCheckIcon />,
          title: t('onTimeTitle'),
          text: t('onTimeText', {
            left: duration(advice.hoursLeft * 3_600_000),
            deadline: advice.deadlineHours,
          }),
        };
      case 'started':
        return {
          tone: 'warning' as const,
          icon: <HourglassIcon />,
          title: t('startedTitle'),
          text: t('startedText'),
        };
      case 'teacher':
        return {
          tone: 'info' as const,
          icon: <GraduationCapIcon />,
          title: t('teacherTitle'),
          text: t('teacherText'),
        };
      case 'group':
        return {
          tone: 'info' as const,
          icon: <UsersIcon />,
          title: t('groupTitle'),
          text: t('groupText'),
        };
    }
  })();

  const chargeHint =
    charge.kind === 'package'
      ? t('chargeHintPackage', { name: charge.name })
      : charge.kind === 'money'
        ? t('chargeHintMoney', { amount: charge.amount })
        : t('chargeHintGroup');
  const freeHint =
    charge.kind === 'package'
      ? t('freeHintPackage', { left: charge.remaining, total: charge.total })
      : t('freeHint');

  const close = (next: boolean) => {
    if (!next) form.reset(cancelFormDefaults(lesson, now));
    onOpenChange(next);
  };
  const submit = form.handleSubmit(async (values) => {
    try {
      await transition.mutateAsync(cancelDto(values));
      toast.success(t('done'));
      close(false);
    } catch (error) {
      showError(error);
    }
  });

  return (
    <AdaptiveDialog
      open={open}
      onOpenChange={close}
      closeLabel={tPanel('close')}
      icon={<CircleXIcon />}
      iconClassName="bg-tint-danger text-tint-danger-foreground"
      title={t('title')}
      description={subtitle}
      secondary={
        <Button type="button" variant="outline" onClick={() => close(false)}>
          {t('keep')}
        </Button>
      }
      primary={
        <Button
          type="button"
          variant="destructive"
          disabled={transition.isPending}
          onClick={() => void submit()}
        >
          {transition.isPending ? <Spinner data-icon="inline-start" /> : null}
          {t('confirm')}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="flex flex-col gap-2">
          <span className="text-sm leading-5 font-medium">{t('who')}</span>
          <Controller
            control={form.control}
            name="cancelledBy"
            render={({ field }) => (
              <Segmented
                label={t('who')}
                variant="paper"
                className="self-start"
                value={field.value}
                onValueChange={(next) => {
                  field.onChange(next);
                  form.setValue('charge', cancelAdvice(lesson, next, now).charge);
                }}
                items={authors.map((author) => ({ value: author, label: t(`by.${author}`) }))}
              />
            )}
          />
        </div>
        <Notice appearance="callout" {...notice} />
        <Controller
          control={form.control}
          name="charge"
          render={({ field }) => (
            <ChoiceCardGroup
              label={t('chargeLabel')}
              value={field.value}
              onValueChange={field.onChange}
              options={[
                {
                  value: 'charge',
                  title: t('charge'),
                  hint: chargeHint,
                  icon: <BanknoteIcon />,
                },
                { value: 'free', title: t('free'), hint: freeHint, icon: <CircleSlashIcon /> },
              ]}
            />
          )}
        />
        <Controller
          control={form.control}
          name="reason"
          render={({ field, fieldState }) => (
            <TextField
              type="textarea"
              label={t('reason')}
              placeholder={t('reasonPlaceholder')}
              rows={3}
              error={fieldState.error?.message}
              {...field}
            />
          )}
        />
      </form>
    </AdaptiveDialog>
  );
}
