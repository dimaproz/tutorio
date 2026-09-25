'use client';

import { useState } from 'react';
import { BanknoteIcon, CalendarPlusIcon } from 'lucide-react';
import { useNow, useTranslations } from 'next-intl';
import { useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { ImpactList } from '@/components/shared/impact-list';
import { TextField } from '@/components/shared/text-field';
import { useExtendPackageMutation } from '../../api';
import { addDays, addMonth, dayKey, isDayKey, lastDayOf, startOfDay } from '../../model/dates';
import { extendDto, extendSchema, type ExtendValues } from '../../model/operations';
import { usePackageForm, useErrorToast, DayField } from '../form-parts';
import { usePackageFormat } from '../use-package-format';
import type { OperationProps } from './operation-props';

const QUICK = [
  { key: 'week', next: (day: string) => addDays(day, 7) },
  { key: 'twoWeeks', next: (day: string) => addDays(day, 14) },
  { key: 'month', next: (day: string) => addMonth(day) },
] as const;

/**
 * «Продовжити термін» (board 03, state 03): the current end (read-only), a
 * new one after today with +1 week, +2 weeks and +1 month from whichever is
 * later, and what it does — the unused credits pay again until then, the
 * price and payments stay (L-84).
 */
export function ExtendDialog({ pkg, title, onClose, onDone }: OperationProps) {
  const t = useTranslations('packages.dialogs.extend');
  const tDialogs = useTranslations('packages.dialogs');
  const format = usePackageFormat();
  const clock = useNow();
  const [now] = useState(() => clock);
  const today = dayKey(now);
  const currentLast = pkg.expiresAt ? dayKey(lastDayOf(pkg.expiresAt)) : today;
  const base = currentLast > today ? currentLast : today;
  const form = usePackageForm<ExtendValues>(extendSchema(today, currentLast), {
    until: addMonth(base),
  });
  const until = useWatch({ control: form.control, name: 'until' });
  const extend = useExtendPackageMutation();
  const showError = useErrorToast();
  const left = Math.max(pkg.remainingCredits, 0);

  const submit = form.handleSubmit((values) =>
    extend.mutate(
      { packageId: pkg.id, dto: extendDto(values) },
      {
        onSuccess: () => {
          toast.success(t('done', { date: format.dayMonth(startOfDay(values.until)) }));
          onDone();
        },
        onError: showError,
      },
    ),
  );

  const valid = isDayKey(until) && until > base;
  return (
    <AdaptiveDialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      closeLabel={tDialogs('close')}
      sheetLayout="compact"
      icon={<CalendarPlusIcon />}
      iconClassName="bg-tile-indigo text-tile-indigo-foreground"
      title={t('title')}
      description={t('subtitle', { name: title, student: pkg.student.fullName, count: left })}
      secondary={
        <Button type="button" variant="outline" onClick={onClose}>
          {tDialogs('cancel')}
        </Button>
      }
      primary={
        <Button type="button" disabled={extend.isPending} onClick={() => void submit()}>
          {extend.isPending ? <Spinner data-icon="inline-start" /> : null}
          {valid ? t('confirmDate', { date: format.shortDay(startOfDay(until)) }) : t('confirm')}
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t('current')}
          readOnly
          disabled
          value={pkg.expiresAt ? format.field(lastDayOf(pkg.expiresAt)) : ''}
        />
        <DayField
          control={form.control}
          name="until"
          label={t('next')}
          hint={t('nextHint')}
          format={format}
        />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('quick')}>
        {QUICK.map((quick) => {
          const day = quick.next(base);
          const active = until === day;
          return (
            <Button
              key={quick.key}
              type="button"
              size="sm"
              variant={active ? 'default' : 'secondary'}
              aria-pressed={active}
              onClick={() =>
                form.setValue('until', day, { shouldValidate: form.formState.isSubmitted })
              }
            >
              {t(`quickChip.${quick.key}`)}
            </Button>
          );
        })}
      </div>
      {valid ? (
        <ImpactList
          label={t('impactLabel')}
          items={[
            {
              id: 'credits',
              icon: <CalendarPlusIcon />,
              tone: 'indigo',
              title: t('impactCredits', { count: left }),
              text: t('impactCreditsText', { date: format.dayMonth(startOfDay(until)) }),
            },
            {
              id: 'money',
              icon: <BanknoteIcon />,
              tone: 'neutral',
              title: t('impactMoney'),
            },
          ]}
        />
      ) : null}
    </AdaptiveDialog>
  );
}
