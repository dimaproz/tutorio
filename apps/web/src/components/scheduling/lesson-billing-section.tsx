'use client';

import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { BanknoteIcon, CircleCheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { SUPPORTED_CURRENCIES } from '@tutorio/domain';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CurrencyOption } from '@/components/app/currency-option';
import { FormSection } from '@/components/app/form-section';
import { MoneyInput } from '@/components/app/money-input';
import { StatusSelect, useLessonStatusOptions } from '@/components/app/status-select';
import { DatePicker } from '@/components/shared';
import {
  filledDates,
  isCancelledStatus,
  type LessonFormValues,
} from '@/features/scheduling/model/lesson-form';
import { CANCELLED_BY_VALUES } from '@/features/scheduling/model/lesson-form';

/** Price, currency — and, for a lesson recorded after the fact, its payment. */
export function LessonBillingSection() {
  const t = useTranslations('scheduling.lessonForm');
  const form = useFormContext<LessonFormValues>();
  const { errors } = form.formState;
  const target = useWatch({ control: form.control, name: 'target' });

  return (
    <FormSection
      icon={BanknoteIcon}
      title={t('price')}
      description={target === 'group' ? t('groupPriceHint') : t('studentHint')}
      tone="success"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Field data-invalid={errors.price ? true : undefined} className="flex-1">
          <FieldLabel htmlFor="lesson-price">{t('price')}</FieldLabel>
          <MoneyInput
            id="lesson-price"
            placeholder={t('pricePlaceholder')}
            aria-invalid={errors.price ? true : undefined}
            {...form.register('price')}
          />
          <FieldError errors={[errors.price]} />
        </Field>

        <Controller
          control={form.control}
          name="currency"
          render={({ field }) => (
            <Field className="sm:w-40">
              <FieldLabel htmlFor="lesson-currency">{t('currency')}</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="lesson-currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {SUPPORTED_CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        <CurrencyOption code={currency} />
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}
        />
      </div>
    </FormSection>
  );
}

/**
 * The lesson's own state. Tutors book ahead *and* record lessons after they
 * happened, so the status is part of creating a lesson, not only of editing one.
 * Cancelling always names who cancelled — the API rejects it otherwise.
 */
export function LessonStatusSection() {
  const t = useTranslations('scheduling.lessonForm');
  const tBy = useTranslations('scheduling.cancelledBy');
  const form = useFormContext<LessonFormValues>();
  const { errors } = form.formState;
  const statusOptions = useLessonStatusOptions();
  const status = useWatch({ control: form.control, name: 'status' });
  const startsAt = useWatch({ control: form.control, name: 'startsAt' });
  const isSingleBooking = filledDates({ startsAt: startsAt ?? [] }).length <= 1;

  return (
    <FormSection
      icon={CircleCheckIcon}
      title={t('statusSection')}
      description={t('statusHint')}
      tone="primary"
    >
      <Controller
        control={form.control}
        name="status"
        render={({ field }) => (
          <Field>
            <FieldLabel htmlFor="lesson-status" className="sr-only">
              {t('status')}
            </FieldLabel>
            <StatusSelect
              id="lesson-status"
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
                // Leaving a cancelled state drops the author with it, so a
                // stale "cancelled by" can never reach the API.
                if (!isCancelledStatus(value as LessonFormValues['status'])) {
                  form.setValue('cancelledBy', '');
                }
              }}
              options={statusOptions}
            />
          </Field>
        )}
      />

      {isCancelledStatus(status) ? (
        <Controller
          control={form.control}
          name="cancelledBy"
          render={({ field }) => (
            <Field data-invalid={errors.cancelledBy ? true : undefined}>
              <FieldLabel htmlFor="lesson-cancelled-by">{t('cancelledBy')}</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="lesson-cancelled-by"
                  className="w-full"
                  aria-invalid={errors.cancelledBy ? true : undefined}
                >
                  <SelectValue placeholder={t('cancelledByPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {CANCELLED_BY_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {tBy(value)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError errors={[errors.cancelledBy]} />
            </Field>
          )}
        />
      ) : null}

      {/* A payment belongs to one lesson: booking several dates at once turns
          the field into a guess, so it steps aside until there is one date. */}
      {isSingleBooking ? (
        <Controller
          control={form.control}
          name="paidAt"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="lesson-paid-at">{t('paidAt')}</FieldLabel>
              <DatePicker
                id="lesson-paid-at"
                value={field.value}
                onChange={field.onChange}
                clearable
              />
              <FieldDescription>{t('paidAtHint')}</FieldDescription>
            </Field>
          )}
        />
      ) : (
        <FieldDescription>{t('paidAtMultipleHint')}</FieldDescription>
      )}
    </FormSection>
  );
}
