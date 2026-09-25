'use client';

import { useId, useState, type ReactNode } from 'react';
import { RotateCcwIcon } from 'lucide-react';
import { useNow, useTranslations } from 'next-intl';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { Controller, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/ui/spinner';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { TextField } from '@/components/shared/text-field';
import { parsePriceInput } from '@/lib/money';
import { useRefundPackageMutation } from '../../api';
import { dayKey } from '../../model/dates';
import { moneyText } from '../../model/sale';
import {
  refundCap,
  refundDefaults,
  refundDto,
  refundSchema,
  type RefundValues,
} from '../../model/operations';
import { DayField, MethodField, useErrorToast, usePackageForm } from '../form-parts';
import { usePackageFormat } from '../use-package-format';
import type { OperationProps } from './operation-props';

/**
 * «Повернення» (board 03, state 05): take the unused credits back and/or
 * return money — at least one — the amount no more than what was paid for
 * the unused lessons, the date, the method (sent explicitly: transfer
 * first, decision 7) and the reason. The button is destructive (L-85).
 */
export function RefundDialog({ pkg, title, onClose, onDone }: OperationProps) {
  const t = useTranslations('packages.dialogs.refund');
  const tDialogs = useTranslations('packages.dialogs');
  const format = usePackageFormat();
  const clock = useNow();
  const [now] = useState(() => clock);
  const timeZone = useStudioTimeZone();
  const today = dayKey(now, timeZone);
  const left = Math.max(pkg.remainingCredits, 0);
  const defaults = refundDefaults(pkg, today);
  const form = usePackageForm<RefundValues>(refundSchema(pkg), defaults);
  const values = useWatch({ control: form.control });
  const cap = refundCap(pkg, Boolean(values.takeCredits));
  const refund = useRefundPackageMutation();
  const showError = useErrorToast();
  const currency = pkg.currency;
  const amount = values.returnMoney ? (parsePriceInput(values.amount ?? '') ?? 0) : 0;

  const toggleCredits = (next: boolean) => {
    form.setValue('takeCredits', next);
    const nextCap = refundCap(pkg, next);
    const current = parsePriceInput(form.getValues('amount')) ?? 0;
    if (current > nextCap || current === 0) form.setValue('amount', moneyText(nextCap));
  };

  const submit = form.handleSubmit((submitted) =>
    refund.mutate(
      { packageId: pkg.id, dto: refundDto(submitted, pkg, today, now, timeZone) },
      {
        onSuccess: () => {
          toast.success(t('done'));
          onDone();
        },
        onError: showError,
      },
    ),
  );

  return (
    <AdaptiveDialog
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      closeLabel={tDialogs('close')}
      sheetLayout="compact"
      icon={<RotateCcwIcon />}
      iconClassName="bg-tint-warning text-tint-warning-foreground"
      title={t('title')}
      description={t('subtitle', {
        name: title,
        student: pkg.student.fullName,
        count: left,
        paid: format.money(pkg.paidMinor, currency),
      })}
      secondary={
        <Button type="button" variant="outline" onClick={onClose}>
          {tDialogs('cancel')}
        </Button>
      }
      primary={
        <Button
          type="button"
          variant="destructive"
          disabled={refund.isPending}
          onClick={() => void submit()}
        >
          {refund.isPending ? <Spinner data-icon="inline-start" /> : null}
          {amount > 0
            ? t('confirmAmount', { amount: format.money(amount, currency) })
            : t('confirm')}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <CheckCard
          checked={Boolean(values.takeCredits)}
          disabled={left === 0}
          onCheckedChange={toggleCredits}
          title={t('takeCredits')}
          text={left > 0 ? t('takeCreditsText', { count: left }) : t('takeCreditsNone')}
        />
        <Controller
          control={form.control}
          name="returnMoney"
          render={({ field }) => (
            <CheckCard
              checked={field.value}
              disabled={pkg.paidMinor <= 0}
              onCheckedChange={field.onChange}
              title={t('returnMoney')}
              text={
                pkg.paidMinor <= 0
                  ? t('returnMoneyNone')
                  : values.takeCredits
                    ? t('returnMoneyFor', { count: left, amount: format.money(cap, currency) })
                    : t('returnMoneyPaid', { amount: format.money(cap, currency) })
              }
            />
          )}
        />
        {form.formState.errors.takeCredits?.message ? (
          <p role="alert" className="text-[13px] font-medium text-destructive">
            {form.formState.errors.takeCredits.message}
          </p>
        ) : null}
      </div>
      {values.returnMoney ? (
        <>
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
        </>
      ) : null}
      <TextField
        label={t('reason')}
        placeholder={t('reasonPlaceholder')}
        autoComplete="off"
        error={form.formState.errors.note?.message}
        {...form.register('note')}
      />
    </AdaptiveDialog>
  );
}

/** A checkbox with its explanation on a quiet panel. */
function CheckCard({
  checked,
  disabled,
  onCheckedChange,
  title,
  text,
}: {
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  title: ReactNode;
  text: ReactNode;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3.5 rounded-row bg-background px-5 py-4 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        className="mt-0.5 size-5"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] leading-5 font-semibold">{title}</span>
        <span className="text-[13px] leading-[18px] text-muted-foreground">{text}</span>
      </span>
    </label>
  );
}
