'use client';

import type { ReactNode } from 'react';
import {
  CalendarClockIcon,
  CircleCheckIcon,
  CircleSlashIcon,
  CircleXIcon,
  HistoryIcon,
  PackageIcon,
  RotateCcwIcon,
  UserCheckIcon,
  UserXIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { LessonDetailResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { ChoiceCardGroup } from '@/components/shared/choice-card';
import { ImpactList, type ImpactItem } from '@/components/shared/impact-list';
import { useTransitionLessonMutation } from '../../api';
import {
  defaultFixTarget,
  fixDto,
  fixImpact,
  fixTargets,
  type FixImpact,
  type FixTarget,
} from '../../model/status-fix';
import { useErrorToast, useLessonForm } from '../lesson-form-parts';
import type { ChargeContext } from './charge-context';

const TARGET_ICON: Record<FixTarget, ReactNode> = {
  scheduled: <CalendarClockIcon />,
  held: <CircleCheckIcon />,
  cancelCharged: <CircleXIcon />,
  cancelFree: <CircleSlashIcon />,
  noShow: <UserXIcon />,
};

const fixFormSchema = z.object({
  target: z.enum(['scheduled', 'held', 'cancelCharged', 'cancelFree', 'noShow']),
});
type FixFormValues = z.infer<typeof fixFormSchema>;

/** Correct a lesson's status (L-53): the target, and what it changes before it applies. */
export function StatusFixDialog({
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
  const t = useTranslations('lessons.statusFix');
  const tPanel = useTranslations('lessons.panel');
  const showError = useErrorToast();
  const transition = useTransitionLessonMutation(lesson.id);
  const targets = fixTargets(lesson, now);
  const initial = defaultFixTarget(lesson, targets) ?? 'held';
  const form = useLessonForm<FixFormValues>(fixFormSchema, { target: initial });
  const target = useWatch({ control: form.control, name: 'target' });

  const impactItem = (impact: FixImpact): ImpactItem => {
    const pkg = charge.kind === 'package' ? charge : null;
    switch (impact) {
      case 'chargeKept':
        return {
          id: impact,
          icon: <PackageIcon />,
          tone: 'indigo',
          title: pkg ? t('impact.chargeKeptPackage') : t('impact.chargeKept'),
          text: pkg
            ? t('impact.chargeKeptPackageText', {
                name: pkg.name,
                left: pkg.remaining,
                total: pkg.total,
              })
            : undefined,
        };
      case 'chargeTaken':
        return {
          id: impact,
          icon: <PackageIcon />,
          tone: 'warning',
          title: t('impact.chargeTaken'),
          text: pkg ? t('impact.chargeTakenPackageText', { name: pkg.name }) : undefined,
        };
      case 'chargeReturned':
        return {
          id: impact,
          icon: <PackageIcon />,
          tone: 'success',
          title: t('impact.chargeReturned'),
          text: pkg ? t('impact.chargeReturnedPackageText', { name: pkg.name }) : undefined,
        };
      case 'noCharge':
        return { id: impact, icon: <PackageIcon />, tone: 'neutral', title: t('impact.noCharge') };
      case 'missAdded':
        return {
          id: impact,
          icon: <UserXIcon />,
          tone: 'danger',
          title: t('impact.missAdded'),
          text: t('impact.missAddedText'),
        };
      case 'missRemoved':
        return {
          id: impact,
          icon: <UserCheckIcon />,
          tone: 'success',
          title: t('impact.missRemoved'),
        };
      case 'scheduledUnavailable':
        return {
          id: impact,
          icon: <HistoryIcon />,
          tone: 'neutral',
          title: t('impact.scheduledUnavailable'),
          text: t('impact.scheduledUnavailableText'),
        };
    }
  };

  const close = (next: boolean) => {
    if (!next) form.reset({ target: initial });
    onOpenChange(next);
  };
  const submit = form.handleSubmit(async (values) => {
    try {
      await transition.mutateAsync(fixDto(lesson, values.target));
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
      icon={<RotateCcwIcon />}
      iconClassName="bg-tile-indigo text-tile-indigo-foreground"
      title={t('title')}
      description={subtitle}
      secondary={
        <Button type="button" variant="outline" onClick={() => close(false)}>
          {t('cancel')}
        </Button>
      }
      primary={
        <Button type="button" disabled={transition.isPending} onClick={() => void submit()}>
          {transition.isPending ? <Spinner data-icon="inline-start" /> : null}
          {t('save')}
        </Button>
      }
    >
      <Controller
        control={form.control}
        name="target"
        render={({ field }) => (
          <ChoiceCardGroup
            label={t('label')}
            value={field.value}
            onValueChange={field.onChange}
            options={targets.map((option) => ({
              value: option,
              title: t(`option.${option}`),
              hint: t(`option.${option}Hint`),
              icon: TARGET_ICON[option],
            }))}
          />
        )}
      />
      <ImpactList label={t('whatChanges')} items={fixImpact(lesson, target, now).map(impactItem)} />
    </AdaptiveDialog>
  );
}
