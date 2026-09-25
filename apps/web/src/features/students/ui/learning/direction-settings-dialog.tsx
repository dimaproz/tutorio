'use client';

import { BanknoteIcon, CalendarCheckIcon, PackageIcon, SlidersHorizontalIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { ChoiceCardGroup } from '@/components/shared/choice-card';
import { ImpactList, type ImpactItem } from '@/components/shared/impact-list';
import { TextField } from '@/components/shared/text-field';
import { useUpdateDirectionMutation } from '@/features/students/api';
import {
  deadlineChoices,
  directionSettingsDefaults,
  directionSettingsDto,
  directionSettingsSchema,
  modeSwitchImpact,
  STUDIO_DEADLINE,
  type DirectionSettingsValues,
} from '@/features/students/model/direction-settings';
import {
  currentPackage,
  directionName,
  type BillingDirection,
} from '@/features/students/model/learning';
import { parsePriceInput } from '@/lib/money';
import { useBillingErrorToast, useBillingForm } from './dialog-parts';
import { useLearningFormat } from './use-learning-format';

/**
 * «Налаштування напряму» (board 02, states 05–06; L-10, L-11): how the
 * direction pays, its rate for new lessons and its free-cancellation window,
 * with what a mode switch does before it is saved. The low-credit warning is
 * a studio setting (L-120), so it is not offered per direction.
 */
export function DirectionSettingsDialog({
  open,
  onOpenChange,
  studentName,
  direction,
  studioDeadlineHours,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  direction: BillingDirection;
  studioDeadlineHours: number;
}) {
  return open ? (
    <SettingsForm
      studentName={studentName}
      direction={direction}
      studioDeadlineHours={studioDeadlineHours}
      onOpenChange={onOpenChange}
    />
  ) : null;
}

function SettingsForm({
  studentName,
  direction,
  studioDeadlineHours,
  onOpenChange,
}: {
  studentName: string;
  direction: BillingDirection;
  studioDeadlineHours: number;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('students.directionSettings');
  const format = useLearningFormat();
  const update = useUpdateDirectionMutation();
  const showError = useBillingErrorToast();
  const form = useBillingForm<DirectionSettingsValues>(
    directionSettingsSchema,
    directionSettingsDefaults(direction),
  );
  const [billingType, rateText] = useWatch({
    control: form.control,
    name: ['billingType', 'rate'],
  });
  const currency = direction.currency;
  const rate = parsePriceInput(rateText);
  const switched = modeSwitchImpact(direction, billingType);
  const pkg = currentPackage(direction);

  const close = () => onOpenChange(false);
  const submit = form.handleSubmit((values) => {
    const dto = directionSettingsDto(values, direction);
    if (Object.keys(dto).length === 0) {
      close();
      return;
    }
    update.mutate(
      { enrollmentId: direction.enrollmentId, dto },
      {
        onSuccess: () => {
          toast.success(t('done'));
          close();
        },
        onError: showError,
      },
    );
  });

  const impact: ImpactItem[] = [];
  if (switched?.to === 'PER_LESSON') {
    if (pkg && switched.creditsLeft > 0) {
      impact.push({
        id: 'package',
        icon: <PackageIcon />,
        tone: 'indigo',
        title: t('impact.packageStays', { name: pkg.name ?? t('packageUnnamed') }),
        text: t('impact.packageStaysText', { count: switched.creditsLeft }),
      });
    }
    impact.push({
      id: 'rate',
      icon: <BanknoteIcon />,
      tone: 'neutral',
      title: t('impact.newLessons', {
        price: format.money(rate ?? direction.rateMinor, currency),
      }),
      text: t('impact.newLessonsText'),
    });
  }
  if (switched?.to === 'PACKAGE') {
    impact.push({
      id: 'package',
      icon: <PackageIcon />,
      tone: 'indigo',
      title: t('impact.fromPackage'),
      text:
        switched.debtMinor > 0
          ? t('impact.debtStays', { amount: format.money(switched.debtMinor, currency) })
          : t('impact.fromPackageText'),
    });
  }
  if (switched) {
    impact.push({
      id: 'past',
      icon: <CalendarCheckIcon />,
      tone: 'neutral',
      title: t('impact.pastStays'),
    });
  }

  const hoursLabel = (value: string) =>
    value === STUDIO_DEADLINE
      ? t('deadlineStudio', { hours: studioDeadlineHours })
      : Number(value) === 0
        ? t('deadlineUntilStart')
        : t('deadlineHours', { hours: Number(value) });

  return (
    <AdaptiveDialog
      open
      onOpenChange={(next) => (next ? undefined : close())}
      closeLabel={t('close')}
      size="lg"
      sheetLayout="compact"
      icon={<SlidersHorizontalIcon />}
      iconClassName="bg-tile-indigo text-tile-indigo-foreground"
      title={t('title')}
      description={t('subtitle', { student: studentName, direction: directionName(direction) })}
      secondary={
        <Button type="button" variant="outline" onClick={close}>
          {t('cancel')}
        </Button>
      }
      primary={
        <Button type="button" disabled={update.isPending} onClick={() => void submit()}>
          {update.isPending ? <Spinner data-icon="inline-start" /> : null}
          {t('save')}
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <span className="text-sm leading-5 font-medium">{t('howPays')}</span>
        <Controller
          control={form.control}
          name="billingType"
          render={({ field }) => (
            <ChoiceCardGroup
              label={t('howPays')}
              value={field.value}
              onValueChange={field.onChange}
              options={[
                {
                  value: 'PACKAGE',
                  icon: <PackageIcon />,
                  title: t('packages'),
                  hint: t('packagesHint'),
                },
                {
                  value: 'PER_LESSON',
                  icon: <BanknoteIcon />,
                  title: t('perLesson'),
                  hint: t('perLessonHint'),
                },
              ]}
            />
          )}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t('rate')}
          inputMode="decimal"
          autoComplete="off"
          suffix={format.moneyParts(0, currency).symbol}
          hint={t('rateHint')}
          error={form.formState.errors.rate?.message}
          {...form.register('rate')}
        />
        <Controller
          control={form.control}
          name="deadline"
          render={({ field }) => (
            <TextField
              type="select"
              label={t('deadline')}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              hint={field.value === STUDIO_DEADLINE ? t('deadlineHintStudio') : t('deadlineHint')}
              options={deadlineChoices(direction).map((value) => ({
                value,
                label: hoursLabel(value),
              }))}
            />
          )}
        />
      </div>
      {impact.length > 0 ? <ImpactList items={impact} label={t('impactLabel')} /> : null}
    </AdaptiveDialog>
  );
}
