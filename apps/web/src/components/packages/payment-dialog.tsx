'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { BanknoteIcon, StickyNoteIcon, UserRoundIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { PAYMENT_METHODS_MANUAL } from '@tutorio/validation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { FormSection } from '@/components/app/form-section';
import { MoneyInput } from '@/components/app/money-input';
import { PersonMiniCard } from '@/components/app/person-mini-card';
import { EntityFormDialog, FormActions } from '@/components/shared';
import {
  buildRecordPaymentDto,
  emptyPaymentForm,
  paymentFormSchema,
  type PaymentFormValues,
} from '@/features/packages/model/payment-form';
import { errorMessageKey } from '@/lib/api/error-message';
import { useRecordPaymentMutation } from '@/lib/api/packages';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { scrollToFirstError } from '@/lib/forms/focus-error';
import { formatMoneyDisplay } from '@/lib/money';

/** Who is paying: the enrollment the money is booked against. */
export interface PaymentTarget {
  enrollmentId: string;
  fullName: string;
  /** What is still outstanding, used to prefill the amount. */
  oweMinor?: number;
}

export function PaymentDialog({
  open,
  onOpenChange,
  packageId,
  currency,
  target,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageId?: string | null;
  currency: string;
  target: PaymentTarget | null;
}) {
  const t = useTranslations('packages.payment');
  const tPackages = useTranslations('packages');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');
  const locale = useLocale();
  const recordPayment = useRecordPaymentMutation();

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema, {
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }),
    defaultValues: emptyPaymentForm({ enrollmentId: '' }),
  });
  const { errors } = form.formState;

  useEffect(() => {
    if (!open || !target) {
      return;
    }
    recordPayment.reset();
    form.reset(
      emptyPaymentForm({
        enrollmentId: target.enrollmentId,
        oweMinor: target.oweMinor,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on open
  }, [open, target?.enrollmentId, target?.oweMinor]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await recordPayment.mutateAsync(
        buildRecordPaymentDto(values, { packageId, currency }),
      );
      toast.success(tPackages('toasts.paymentRecorded'));
      onOpenChange(false);
    } catch {
      // Surfaced by the alert below.
    }
  }, scrollToFirstError);

  if (!target) {
    return null;
  }

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('title')}
      description={t('subtitle')}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-7">
        {recordPayment.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>
              {tErrors(errorMessageKey(recordPayment.error))}
            </AlertDescription>
          </Alert>
        ) : null}

        <FormSection icon={UserRoundIcon} title={t('student')} tone="primary">
          <PersonMiniCard fullName={target.fullName} />
        </FormSection>

        <FormSection
          icon={BanknoteIcon}
          title={t('amount')}
          description={
            target.oweMinor
              ? `${tPackages('detail.owes')}: ${formatMoneyDisplay(
                  target.oweMinor,
                  currency,
                  locale,
                )}`
              : undefined
          }
          tone="success"
        >
          <Field data-invalid={errors.amount ? true : undefined}>
            <FieldLabel htmlFor="payment-amount">{t('amount')}</FieldLabel>
            <MoneyInput
              id="payment-amount"
              aria-invalid={errors.amount ? true : undefined}
              {...form.register('amount')}
            />
            <FieldDescription>{currency}</FieldDescription>
            <FieldError errors={[errors.amount]} />
          </Field>

          <Controller
            control={form.control}
            name="method"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="payment-method">{t('method')}</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="payment-method" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PAYMENT_METHODS_MANUAL.map((value) => (
                        <SelectItem key={value} value={value}>
                          {tPackages(`method.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
        </FormSection>

        <FormSection icon={StickyNoteIcon} title={t('note')} tone="neutral">
          <Field data-invalid={errors.note ? true : undefined}>
            <FieldLabel htmlFor="payment-note">{t('note')}</FieldLabel>
            <Textarea id="payment-note" {...form.register('note')} />
            <FieldError errors={[errors.note]} />
          </Field>
        </FormSection>

        <FormActions>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={recordPayment.isPending}>
            {recordPayment.isPending ? <Spinner data-icon="inline-start" /> : null}
            {t('submit')}
          </Button>
        </FormActions>
      </form>
    </EntityFormDialog>
  );
}
