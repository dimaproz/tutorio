'use client';

import { useState } from 'react';
import { BanknoteIcon, CircleCheckIcon, HourglassIcon } from 'lucide-react';
import { useNow, useTranslations } from 'next-intl';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { ImpactList } from '@/components/shared/impact-list';
import { TextField } from '@/components/shared/text-field';
import { parsePriceInput } from '@/lib/money';
import { usePackagePaymentMutation } from '../../api';
import { dayKey } from '../../model/dates';
import {
  packagePaymentDefaults,
  packagePaymentDto,
  packagePaymentSchema,
  type PackagePaymentValues,
} from '../../model/operations';
import { owedMinor, paidPercent } from '../../model/ticket';
import { DayField, MethodField, useErrorToast, usePackageForm } from '../form-parts';
import { PaymentRing } from '../payment-ring';
import { usePackageFormat } from '../use-package-format';
import type { OperationProps } from './operation-props';

/**
 * «Оплата за пакет» (board 03, states 01–02): what is left to pay with the
 * ring, the amount (no more than what is left, OVERPAYMENT), the date, the
 * method with «Переказ» first, a comment, and what the payment does.
 */
export function PackagePaymentDialog({ pkg, title, onClose, onDone }: OperationProps) {
  const t = useTranslations('packages.dialogs.payment');
  const tDialogs = useTranslations('packages.dialogs');
  const format = usePackageFormat();
  const clock = useNow();
  const [now] = useState(() => clock);
  const timeZone = useStudioTimeZone();
  const today = dayKey(now, timeZone);
  // One key per opening: a repeated click records the money once.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const left = owedMinor(pkg);
  const form = usePackageForm<PackagePaymentValues>(
    packagePaymentSchema(left),
    packagePaymentDefaults(pkg, today),
  );
  const amountText = useWatch({ control: form.control, name: 'amount' });
  const amount = parsePriceInput(amountText) ?? 0;
  const record = usePackagePaymentMutation();
  const showError = useErrorToast();
  const currency = pkg.currency;

  const submit = form.handleSubmit((values) =>
    record.mutate(
      { ...packagePaymentDto(values, pkg, today, now, timeZone), idempotencyKey },
      {
        onSuccess: () => {
          toast.success(t('done', { amount: format.money(amount, currency) }));
          onDone();
        },
        onError: showError,
      },
    ),
  );

  const after = Math.max(left - amount, 0);
  const fits = amount > 0 && amount <= left;
  return (
    <AdaptiveDialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      closeLabel={tDialogs('close')}
      sheetLayout="compact"
      icon={<BanknoteIcon />}
      iconClassName="bg-tint-success text-tint-success-foreground"
      title={t('title')}
      description={tDialogs('subtitle', { name: title, student: pkg.student.fullName })}
      secondary={
        <Button type="button" variant="outline" onClick={onClose}>
          {tDialogs('cancel')}
        </Button>
      }
      primary={
        <Button type="button" disabled={record.isPending} onClick={() => void submit()}>
          {record.isPending ? <Spinner data-icon="inline-start" /> : null}
          {amount > 0
            ? t('confirmAmount', { amount: format.money(amount, currency) })
            : t('confirm')}
        </Button>
      }
    >
      <section
        aria-label={t('leftLabel')}
        className="flex items-center justify-between gap-4 rounded-tile bg-tint-warning px-5 py-4"
      >
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold tracking-[0.06em] text-tint-warning-foreground uppercase">
            {t('leftLabel')}
          </span>
          <span className="text-[28px] leading-8 font-bold tracking-[-0.02em] tabular-nums">
            {format.money(left, currency)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end text-right text-[13px] leading-[18px] text-tint-foreground">
            <span>{t('paidLabel')}</span>
            <span className="text-base font-bold text-foreground tabular-nums">
              {format.money(pkg.paidMinor, currency)}
            </span>
            <span>
              {t('ofTotal', { total: format.money(pkg.totalPriceMinorSnapshot, currency) })}
            </span>
          </div>
          <PaymentRing percent={paidPercent(pkg)} />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t('amount')}
          inputMode="decimal"
          autoComplete="off"
          suffix={format.symbol(currency)}
          hint={t('amountHint')}
          error={form.formState.errors.amount?.message}
          {...form.register('amount')}
        />
        <DayField control={form.control} name="paidAt" label={t('date')} format={format} />
      </div>
      <MethodField control={form.control} name="method" />
      <TextField
        label={t('note')}
        placeholder={t('notePlaceholder')}
        autoComplete="off"
        {...form.register('note')}
      />
      {fits ? (
        <ImpactList
          label={t('impactLabel')}
          items={[
            after === 0
              ? {
                  id: 'paid',
                  icon: <CircleCheckIcon />,
                  tone: 'success',
                  title: t('impactFull'),
                  text: t('impactFullText'),
                }
              : {
                  id: 'left',
                  icon: <HourglassIcon />,
                  tone: 'warning',
                  title: t('impactLeft', { amount: format.money(after, currency) }),
                  text: t('impactLeftText'),
                },
          ]}
        />
      ) : null}
    </AdaptiveDialog>
  );
}
